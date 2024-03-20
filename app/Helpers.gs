
const Helpers = {

  // ths can be used for debugging
  get testConfig() {
    // for testing we're doing it all here 
    // when it's associated with a sheet this'll uset he active ss
    // this is just an id we can use while testing detached
    // it can be changed as requried - it's ignored when used in container mode
    const as = Exports.AppStore
    const patricks = {
      id: "17Z1Z8zRv56D74LiDxoqLW8-8Z7CW22b9rtOMBT57uT0",
      sheetName: "config-interactions"
    }
    const bruces = {
      id: '1Gcu3EjOGx0ADn5UUw7a6Baca-lqN7roERO9GEYBVuFA',
      sheetName: 'config-sgt-bruce'
    }
    const marcs = {
      id: '126V5jnOSrC-pMK5nKOUQPELvlmpGzxFIpfWKvX6Odwo',
      sheetName: 'config-sgt-t1-bruce'
    }

    const work = {
      id: "17y_Bwvx5gIAyFRtqBSsyy-KWucCVuD2-ntQI96-lSrw",
      sheetName: 'config-LHL'
    }

    return !as.active && bruces
  },

  getSettingsIndex(fiddler, propValue, name) {
    //--- get the vSettings
    if (!propValue) this.logThrow(`${name} value not provided`)
    const vsIndex = fiddler.getData().findIndex(f => f.name === propValue)
    if (vsIndex === -1) this.logThrow(`${name} ${propValue} not found in ${fiddler.getSheet().getName()} tab`)
    return vsIndex
  },

  getNodeSettingsIndex(values, fiddler) {
    const hs = this
    const { nodeSettings } = values[0] || {}
    return hs.getSettingsIndex(fiddler, nodeSettings, "node-settiings")
  },

  logThrow (message) {
    const as = Exports.AppStore
    as.writeLog('FAILURE', message)
    throw message
  },


  validateAllThere(item) {
    const { must, values } = item
    const { optional } = must

    const broken = values.reduce((p, c) => {
      Reflect.ownKeys(c).forEach(k => {
        if (!c[k] && !optional.includes(k)) p.push(k)
      })
      return p
    }, [])

    if (broken.length) this.logThrow(`some missing required values = ${Array.from(new Set(broken)).join(',')}`)
    return item
  },

  resolveMusts(musts, fiddler) {
    const as = Exports.AppStore
    const resolved = Reflect.ownKeys(musts)
      .reduce((p, c) => {
        p[c] = as.resolveMust(musts[c], fiddler)
        return p
      }, {})

    const missing = Reflect.ownKeys(resolved).reduce((p, c) => {
      return p.concat(resolved[c].missing)
    }, [])

    if (missing.length)
      this.logThrow (`missing headers in sheet - ${fiddler.getSheet().getName()} - ${Array.from(new Set(missing)).join(',')}`)

    // check everything required is present
    Reflect.ownKeys(resolved).forEach(k => as.validateAllThere(resolved[k]))
    return resolved
  },

  compileTransformers(transformersFiddler) {
    const as = Exports.AppStore
    const u = Exports.Utils

    // check all necessary config colummns
    const musts = {
      transformers: {
        musts: ["name", "type", "invalid-as-null", "key-value-pairs"],
        optional: ["invalidAsNull"]
      }
    }
    const resolved = as.resolveMusts(musts, transformersFiddler)

    // now we need to validate the content of the transformers - we'll do the compilation right here
    resolved.transformers.values.forEach(v => {
      const { name, type, keyValuePairs: kv } = v
      if (type !== 'lookup') this.logThrow (`Only lookup type supported for transformers ${name}`)
      if (!u.isString(kv)) this.logThrow (`Transformer ${name} key-value-pairs is not a string`)
      const tv = kv.split(",")
      if (!tv.length || tv.length % 2) this.logThrow (`Transformer ${name} key-value-pairs must be an even length (each key must have a value)`)
      v.transformer = u.chunker(tv, 2)
        .reduce((p, [key, value]) => {
          key = key.trim()
          value = value.trim()
          if (p[key]) this.logThrow (`duplicate key ${key} in transformer ${name}`)
          // special treatment of null
          p[key] = value === "null" ? null : value
          return p
        }, {})
    })
    return resolved
  },

  // general solver for picking up params
  resolveMust(must, fiddler) {
    const as = Exports.AppStore
    const u = Exports.Utils

    // all the headers in the config page
    const headerSet = new Set(fiddler.getHeaders())

    // musts are all the column headers that must exist
    const missing = must.musts.filter(f => !headerSet.has(f))

    // the data from the config sheet
    const data = fiddler.getData()


    return {
      missing,   // required column headers not found
      must,      // what we were looking for

      // the values of all known column headings
      values: data.map(d => {
        return must.musts.reduce((p, c) => {
          // x-y to xY
          p[u.snakeToCamel(c)] = d[c]
          return p
        }, {})
      })
        // dont' complain if some are optional
        .filter(d =>
          Reflect.ownKeys(d)
            .filter(k => !must.optional.includes(k))
            .some(k => d[k]))
        .filter(d => !must.disable || !d[must.disable])
        .map(d => must.alias ? { ...d, alias: d[must.alias] } : d)
    }
  },
  
  // apply hashing and retention
  applyHashing(value, item) {
    const hasher = item.vertexRedact && this.getHasher(item.alias, item.vertexRedact)
    if (hasher) value = hasher(value)
    return value
  },

  getHasher(alias, id) {

    const as = Exports.AppStore
    const u = Exports.Utils
    const { hashConfigurations } = as.configuration
    const h = hashConfigurations[id]
    if (id && !h) {
      this.logThrow (`no such hasher ${id}`)
    }
    if (!h) return null

    if (h.type === 'list' || h.type === 'index') return this.getHashLister(alias, h)
    if (h.type !== 'flubber') this.logThrow (`only support flubber && list hashing ${JSON.stringify(h)}`)
    return (text) => u.flubber({ ...h.params, text })
  },

  getHashLister(alias, { type, params }) {
    const as = Exports.AppStore
    const lister = this.lister
    const data = type === 'list' ? as.getHashNames({ ...params }) : null
    return (text) => lister({ ...params, data, text, alias })
  },

  lister({ data, key, text, domain, prefix, alias }) {
    const u = Exports.Utils
    const as = Exports.AppStore
    const hs = Exports.Helpers
    const size = (data && data.length) || (domain && u.isArray(domain) && Math.abs(domain[1] - domain[0]))
    if (!size) {
      hs.logThrow (`no hash names to work with for ` + alias)
    }
    if (!text) hs.logThrow (`no text provided to redact`)
    const base = domain && Math.min(...domain)
    // we'll check for collisions
    const collisionKey = key + '-' + 'collisions' + '-' + alias
    let collisionMap = as.memory.get(collisionKey)
    if (!collisionMap) {
      collisionMap = as.memory.set(collisionKey, new Map())
    }

    // now get a digest of the text 
    const hin = u.hashDigest(text)
    const index = hin % size
    const value = `${prefix || ""}${(data && data[index]) || (domain && (base + index))}`

    // now check for a collision
    const t = collisionMap.get(value)
    if (t && t !== text) {
      hs.logThrow (`Redact collision ${value}: ${t} and ${text}: index ${index}\n- try using a longer hash name list`)
    }
    if (!t) collisionMap.set(value, text)

    return value
  },

  //-- now deal with the node settings copy over
  applyNodeSettings(values, fiddler) {
    const as = Exports.AppStore
    const hs = this
    const { nodeDefaultsFiddler } = as
    const vsIndex = hs.getNodeSettingsIndex(values, nodeDefaultsFiddler)
    const vRange = fiddler.getRange()
    const vColumns = fiddler.getNumColumns()
    const vRows = fiddler.getNumRows()

    // drop the name column
    const nColumns = nodeDefaultsFiddler.getNumColumns() - 1
    const nRange = nodeDefaultsFiddler.getRange().offset(0, 1, 1, nColumns)

    // the headers, then data
    nRange.copyTo(vRange.offset(0, vColumns, 1, nColumns))
    nRange.offset(vsIndex + 1, 0, 1, nColumns).copyTo(vRange.offset(1, vColumns, vRows, nColumns))
    // auto resize the colummns
    hs.setMinWidths(fiddler.getSheet(), as.minColWidth)

  },

  // apply basic edge settings formats by copying the first one over
  applyEdgeFormatSettings(edgesFiddler, edgeDefaultsFiddler) {

    // this is a bit different to the vertex version, as the values are already populated
    // we only want the formats
    const as = Exports.AppStore

    // this is the shape of the source formats
    const nColumns = edgeDefaultsFiddler.getNumColumns() - 1
    const nRange = edgeDefaultsFiddler.getRange().offset(0, 1, 1, nColumns)


    // so this is the full range - it already includes the settings data, so we need to subtract that used by the settings
    const vRange = edgesFiddler.getRange()
    const vColumns = edgesFiddler.getNumColumns() - nColumns
    const vRows = edgesFiddler.getNumRows()


    // the headers
    nRange.copyTo(vRange.offset(0, vColumns, 1, nColumns))

    // the first row pasted all over- actuall this seems to copy the values only, so important to postpone the dump values till later
    nRange.offset(1, 0, 1, nColumns).copyTo(vRange.offset(1, vColumns, vRows, nColumns), SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION)

  },

  // autosize, but with min widths
  setMinWidths(sheet, minColWidth) {

    // first autosize the columns
    const range = sheet.getDataRange()
    const columns = range.getNumColumns()
    sheet.autoResizeColumns(1, columns)

    // now ensure the widths are enough
    const getWidth = (_, i) => sheet.getColumnWidth(i + 1)

    return Array.from({ length: columns }, getWidth).map((width, i) => {
      if (width < minColWidth) {
        sheet.setColumnWidth(i + 1, minColWidth)
        return minColWidth
      }
      return width
    })
  },

  // get rid of all formats/data/vaildations so we dont have to both reading it all in just to ignore
  clearTargetSheet({ id, sheetName }) {
    const sheet = SpreadsheetApp.openById(id).getSheetByName(sheetName)

    // possible it doesnt exist yet if first time run on a clean sheet
    if (sheet) {
      sheet.getRange(
        1,
        1,
        sheet.getMaxRows(),
        sheet.getMaxColumns()
      )
        .clearDataValidations()
        .clear()
    }
  },

  // change the sheet name to a different configuration
  patchConfiguration(fromMeta = false) {
    const as = Exports.AppStore
    const hs = this
    const prop = 'use-configuration'
    const respectProp = "respect-filter"
    const respectHiddenRowsProp = "respect-hidden-rows"
    const useActiveProp = 'work-on-active-sheet'
    const enableLoggingProp = 'enable-logging'
    const { pickFiddler, configuration } = as
    const { verticesPreFiddler, edgesPreFiddler, configurationPreFiddler, logPreFiddler } = configuration
    const ps = pickFiddler.getSheet().getName()
    pickFiddler.filterRows(row => row[prop])
    const data = pickFiddler.getData()
    if (data.length !== 1) this.logThrow (`missing or ambiguous configuration sheet pick in ${ps}`)
    // the first row in the pick file
    const [d] = data
      ;[useActiveProp, respectProp, respectHiddenRowsProp, prop, enableLoggingProp]
        .forEach(prop => {
          if (!Reflect.has(d, prop)) this.logThrow (`missing or ambiguous ${prop} in ${ps}`)
        })

    // whether to respect pick drop down or to use current configuration sheet
    const useActive = d[useActiveProp]

    if (!fromMeta) {
      const s = SpreadsheetApp.getActiveSheet()
      if (useActive && s) {
        configurationPreFiddler.sheetName = s.getName()
        as.toast('Using active sheet', configurationPreFiddler.sheetName)
      } else if (hs.testConfig) {
        configurationPreFiddler.sheetName = hs.testConfig.sheetName
        configurationPreFiddler.id = hs.testConfig.id
        as.toast('Using test sheet', configurationPreFiddler.sheetName)
      } else if (useActive && !s) {
        throw 'trying to use active sheet - but there isnt one'
      } else {
        configurationPreFiddler.sheetName = d[prop]
        as.toast('Using picked sheet', configurationPreFiddler.sheetName)
      }

    } else {
      // in this case we'll be doing an export so we need to ensure the config sheet we use matches
      // the data to be exported
      const metaConfig = hs.fetchMetadata()
      configurationPreFiddler.sheetName = metaConfig.sheetName
      configurationPreFiddler.id = metaConfig.ssid
      as.toast('Detected configuration sheet', configurationPreFiddler.sheetName)
    }

    // propagate othe preferences to other fiddlers
    // TODO note some of these may not yet be implemented
    verticesPreFiddler.respectFilter = d[respectProp]
    edgesPreFiddler.respectFilter = d[respectProp]
    verticesPreFiddler.respectHiddenRows = d[respectHiddenRowsProp]
    edgesPreFiddler.respectHiddenRows = d[respectHiddenRowsProp]
    logPreFiddler.enableLogging = d[enableLoggingProp]

  },

  // when we're doing exports, this will link the genreated data to the config that made it.
  fetchMetadata() {
    const as = Exports.AppStore;


    const { verticesFiddler, edgesFiddler } = as

    // get the developer data
    const vSheet = verticesFiddler.getSheet()
    const eSheet = edgesFiddler.getSheet()
    const metaVertices = Exports.DeveloperData.getDob(vSheet, as.dobKey)
    const metaEdges = Exports.DeveloperData.getDob(eSheet, as.dobKey)
    as.writeLog ('...fetching metadata for',vSheet.getName(), eSheet.getName(),metaVertices )

    // they should be the same
    if (!metaVertices || !metaEdges)
      this.logThrow ('cant find stamp of which config wrote this - run ingest again')

    if (JSON.stringify(metaVertices) !== JSON.stringify(metaEdges)) {
      this.logThrow ('the edges and vertices were not created by the same time/configuration - run ingest again')
    }

    return metaVertices.configuration
  },

  //--- prettify exported sheets
  makeHeadFormat(color) {
    const u = Exports.Utils
    const backgrounds = color;
    // this will pick an appropriate font color based on the illumination of the backgrund color
    const fontColors = u.getContrast(backgrounds)
    return {
      wraps: false,
      backgrounds,
      fontColors,
      fontWeights: "bold"
    }
  },

  //---- this initializes the configuration from a template
  initConfigurations(configId) {
    const as = Exports.AppStore
    const hs = this
    // all the artefacts can be in different sheets,
    // but by default everything (other than the input data
    // happens in the cloned config spreadsheet

    const testConfig = hs.testConfig
    configId = configId || (testConfig && testConfig.id)
    const edgeDefaultsId = configId
    const nodeDefaultsId = configId
    const verticesId = configId
    const edgesId = configId
    const pickId = configId
    const transformersId = configId
    const hashNamesId = configId

    // specific to this run
    const { gmlTemplate } = as
    if (!gmlTemplate) this.logThrow (`must run script/setup first`)

    const ss = SpreadsheetApp.openById(configId)
    if (!ss) this.logThrow ('cant find an active or test ${testId} config spreadsheet')

    as.writeLog(
      'setting up project version',
      as.projectVersion,
      'configuration',
      as.selectedConfiguration,
      'stub version',
      as.stubVersion
    )

    // the source data will typically be the form spreadsheet and not included in this sheet
    // (although it could be)
    // so that is specified as a parameter in the config sheet
    // and not here in code
    as.configurations = {
      alpha: {
        edgeDefault: 'directed',
        edgeWeightDefault: 1,
        name: 'alpha',
        template: gmlTemplate,

        // hash parameters
        hashConfigurations: {
          flubber: {
            type: 'flubber',
            params: {
              numberOfWords: 2,
              sep: '-',
              size: 6
            }
          },
          "flubber-3-4": {
            type: 'flubber',
            params: {
              numberOfWords: 3,
              sep: '-',
              size: 4
            }
          },
          "hash-first-names": {
            type: 'list',
            params: {
              key: 'hash-first-names',
              columnName: 'name'
            }
          },
          "hash-id-10k": {
            type: 'index',
            params: {
              key: 'hash-id-10k',
              domain: [1, 10000],
              prefix: 'id-'
            }
          },
        },
        pickPreFiddler: {
          id: pickId,
          sheetName: 'pick'
        },

        // the source of the edge options
        edgeDefaultsPreFiddler: {
          id: edgeDefaultsId,
          sheetName: 'edge-defaults'
        },

        // the source of the vertex options
        nodeDefaultsPreFiddler: {
          id: nodeDefaultsId,
          sheetName: 'node-defaults',
        },

        // where to write logs
        logPreFiddler: {
          id: nodeDefaultsId,
          sheetName: 'run-log',
          createIfMissing: true,
          enableLogging: false
        },

        // where to write the vertices to
        verticesPreFiddler: {
          id: verticesId,
          sheetName: 'vertices',
          createIfMissing: true,
          respectFilter: false,
          respectHiddenRows: false
        },

        // where to write the edges to
        edgesPreFiddler: {
          id: edgesId,
          sheetName: 'edges',
          createIfMissing: true,
          respectFilter: false,
          respectHiddenRows: false
        },

        // this configration ss
        configurationPreFiddler: {
          id: configId,
          sheetName: 'configuration'
        },

        transformersPreFiddler: {
          id: transformersId,
          sheetName: 'transformers'
        },

        hashNamesPreFiddler: {
          id: hashNamesId,
          sheetName: 'hash-names'
        }

      }
    }
  },
}