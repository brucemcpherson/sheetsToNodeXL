/**
 * this the state management central for this app
 * since it uses server, html service and cardservice
 * all state management and communication between them is handled here
 */

const StorePack = (() => {

  // this app only uses memory cache as no persistence is needed ot api calls cached
  const LOG = false;

  let memory = null

  return {
    get memory() {
      if (!memory) {
        memory = Exports.newMemory({
          log: LOG
        })
      }

      return memory
    }
  };
})();

/**
 * this the state management central for this app
 * since it uses server, html service and cardservice
 * all state management and communication between them is handled here
 */
const AppStore = {


  //----main execution functions-------------------

  //render as gml
  render(resolved) {

    const as = this
    const u = Exports.Utils
    const { verticesFiddler, edgesFiddler, configuration } = as

    // get the predefined nodexl keys
    const { template, edgeDefault } = configuration
    const { keys } = template
    const keyMap = new Map(keys.map(f => [f.id, f]))

    //---make a set of vertex/edge exclusions for quick access
    const vExclude = new Set(
      resolved.vertex.values.filter(f => f.vertexExclude).map(f => f.vertexQuestion)
    )
    const eExclude = new Set(['vertex1', 'vertex2', 'source', 'target'])

    // we also need to exclude any source/targets that are derived from excluded node values
    resolved.edge.values.forEach(f => {
      ;['edgeSource', 'edgeTarget'].forEach(e => {
        if (vExclude.has(f[e])) eExclude.add(f[e])
      })
    })

    // get a renderer
    const { Gml: g } = Exports

    // get the vertics data from the sheet, and add an id based on position (like the nodexl template does)
    const vData = verticesFiddler.getData().map((f, i) => {
      if (!f.ID) f.ID = i + 1
      return f
    })

    // add any keys not already there by default
    const addKey = ({ key, forType, name, value }) => {
      if (!keyMap.has(key)) {
        const ob = {
          id: key,
          for: forType,
          'attr.name': name,
          'attr.type': u.isNumber(value) ? "double" : "string"
        }
        keyMap.set(key, ob)
      }
    }

    // make the nodes (vertices)
    const nodes = vData.map((f, i) => {
      const id = f['id-alias']
      if (!id) throw `id-alias missing from ${JSON.stringify(f)}`
      return {
        tag: 'node',
        attrs: {
          id
        },
        children: Reflect.ownKeys(f)
          // drop any exclusions
          .filter(g => !vExclude.has(g))
          // drop any empty fields
          .filter(g => !u.isNU(f[g]) && f[g] !== '')
          .map(g => {
            const key = `V-${g}`
            // in case its missing
            addKey({ key, forType: 'node', name: g, value: f[g] })
            return {
              tag: 'data',
              attrs: {
                key
              },
              children: [f[g]]
            }
          })
      }
    })

    // now do the edges
    const eData = edgesFiddler.getData().map((f, i) => {
      if (!f.ID) f.ID = i + 1
      return f
    })

    // make the edges 
    const edges = eData.map((f, i) => ({
      tag: 'edge',
      attrs: {
        source: f.vertex1,
        target: f.vertex2
      },
      children: Reflect.ownKeys(f)
        // drop any exclusions
        .filter(g => !eExclude.has(g))
        // drop any empty fields
        .filter(g => !u.isNU(f[g]) && f[g] !== '')
        .map(g => {
          const key = `E-${g}`
          // in case its missing
          addKey({ key, forType: 'edge', name: g, value: f[g] })
          return {
            tag: 'data',
            attrs: {
              key
            },
            children: [f[g]]
          }
        })
    }))

    // the graphs header
    const graphs = [{
      tag: 'graph',
      attrs: {
        edgedefault: edgeDefault
      },
      children: nodes.concat(edges)
    }]

    // the children are the key definitions + the graphs
    const children = Array.from(keyMap.values()).map(k => ({
      tag: 'key',
      attrs: k
    })).concat(graphs)

    // make a gml file
    return g.render({ children })
  },

  // execute a resolve followed by a sheet populate
  execute() {
    const as = this
    return as.resolve()
  },

  exportDetails(resolved, configurationFiddler) {

    // open the spreadsheet id to get its parent
    const id = configurationFiddler.getSheet().getParent().getId()
    const ss = DriveApp.getFileById(id)
    if (!ss) throw `Couldn't open spreadhseet id ${id}`

    // get the export data 
    const opn = resolved.output.values && resolved.output.values[0] && resolved.output.values[0].outputName
    if (!opn || !opn.toString) throw `unable to find proper output-name`
    const outputName = opn.toString()
    try {
      const parents = ss.getParents()
      return {
        parent: parents.hasNext() ? parents.next() : null,
        outputName,
      }

    } catch (err) {
      return {
        parent: 'root',
        outputName: outputName.toString()
      }
    }

  },

  dumpToDrive() {
    const as = this
    if (!as) throw `as not defined in dump to drive - proxy got lost`
    const u = Exports.Utils
    const { configurationFiddler } = as

    as.toast(
      `${as.getConfigToastie(configurationFiddler)}            ${as.getVersionToastie()}`,
      `Exporting to graphml`)
    //---- validate the config data has all it needs
    const resolved = as.prepareResolve(configurationFiddler)
    Reflect.ownKeys(resolved).forEach(k => as.validateAllThere(resolved[k]))

    // get the drive parent - same fo
    const { parent, outputName } = as.exportDetails(resolved, configurationFiddler)
    if (!parent) throw `Couldn't find parent for ${outputName}`

    // render the whole thing
    const rendered = as.render(resolved)

    // write it out
    console.log('...writing', outputName)
    let p = null
    // perhaps you don't have write access to the config folder
    try {
      p = parent.createFile(outputName, rendered, 'application/graphml+xml')
    } catch (err) {
      as.toast("You dont have write access to the config folder", "Writing to default Drive instead")
      p = DriveApp.createFile(outputName, rendered, 'application/graphml+xml')
    }
    as.toast(
      `Created ${outputName} in Drive folder ${parent.getName()}`,
      `Export complete`, 3)
    return p

  },

  //----end of main execution functions-------------------


  //----getting and setting values in store------------------
  get stubVersion() {
    return this.memory.get('stubVersion')
  },

  set stubVersion(value) {
    return this.memory.set('stubVersion', value)
  },

  get projectVersion() {
    return this.memory.get('projectVersion')
  },

  set projectVersion(value) {
    this.memory.set('projectVersion', value)
  },

  get memory() {
    return Exports.StorePack.memory;
  },

  clearMemory() {
    this.memory.clear()
  },


  initConfigurations(configId) {
    const as = this
    // all the artefacts can be in different sheets,
    // but by default everything (other than the input data
    // happens in the cloned config spreadsheet
    // for testing we're doing it all here 
    // when it's associated with a sheet this'll uset he active ss
    // this is just an id we can use while testing detached
    // it can be changed as requried - it's ignored when used in container mode
    const testId = '1BoKul0Le2k4G4qTy9lGOMt5szjct3z5m3bR_ZJ0EXuc' //'126V5jnOSrC-pMK5nKOUQPELvlmpGzxFIpfWKvX6Odwo'

    configId = configId || testId
    const edgeDefaultsId = configId
    const nodeDefaultsId = configId
    const verticesId = configId
    const edgesId = configId
    const pickId = configId
    const transformersId = configId

    // specific to this run
    const { gmlTemplate } = as
    if (!gmlTemplate) throw `must run script/setup first`

    const ss = SpreadsheetApp.openById(configId)
    if (!ss) throw 'cant find an active or test ${testId} config spreadsheet'

    console.log(
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
          }
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
        }

      }
    }
  },


  get minColWidth() {
    return 100
  },

  get projectColor() {
    return this.memory.get("projectColor");
  },

  set projectColor(value) {
    return this.memory.set("projectColor", value);
  },

  get headFormat() {
    return this.makeHeadFormat(this.projectColor.primaryColor)
  },

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

  makeStale() {
    // invalidate all cache entries
    return this.memory.makeStale();
  },

  set noisy(value) {
    return this.memory.set("noisy", value);
  },

  get noisy() {
    return this.memory.get("noisy");
  },


  set configurations(value) {
    return this.memory.set("configurations", value);
  },

  get configurations() {
    return this.memory.get("configurations");
  },


  set selectedConfiguration(value) {
    return this.memory.set("selectedConfiguration", value);
  },

  get selectedConfiguration() {
    return this.memory.get("selectedConfiguration");
  },

  get configuration() {
    const as = this
    const { selectedConfiguration, configurations } = as
    return configurations[selectedConfiguration];
  },

  get gmlTemplate() {
    return this.memory.get('gmlTemplate')
  },

  set gmlTemplate(value) {
    return this.memory.set('gmlTemplate', value)
  },

  get configurationFiddler() {
    return this.anyFiddler('configurationPreFiddler')
  },

  get edgesFiddler() {
    return this.anyFiddler('edgesPreFiddler')
  },

  get transformersFiddler() {
    return this.anyFiddler('transformersPreFiddler')
  },

  get verticesFiddler() {
    return this.anyFiddler('verticesPreFiddler')
  },

  get edgeDefaultsFiddler() {
    return this.anyFiddler('edgeDefaultsPreFiddler')
  },

  get nodeDefaultsFiddler() {
    return this.anyFiddler('nodeDefaultsPreFiddler')
  },

  get pickFiddler() {
    return this.anyFiddler('pickPreFiddler')
  },

  // change the sheet name to a different configuration
  patchConfiguration() {
    const as = this
    const prop = 'use-configuration'
    const respectProp = "respect-filter"
    const respectHiddenRowsProp = "respect-hidden-rows"
    const { pickFiddler, configuration } = as
    const { verticesPreFiddler, edgesPreFiddler, configurationPreFiddler } = configuration
    const ps = pickFiddler.getSheet().getName()
    pickFiddler.filterRows(row => row[prop])
    const data = pickFiddler.getData()
    if (data.length !== 1) throw `missing or ambiguous configuration sheet pick in ${ps}`
    const [d] = data
    if (!Reflect.has(d, respectProp)) throw `missing or ambiguous respect filter pick in ${ps}`
    if (!Reflect.has(d, respectHiddenRowsProp)) throw `missing or ambiguous respect-hidden-ows filter pick in ${ps}`
    configurationPreFiddler.sheetName = d[prop]
    verticesPreFiddler.respectFilter = d[respectProp]
    edgesPreFiddler.respectFilter = d[respectProp]
    verticesPreFiddler.respectHiddenRows = d[respectHiddenRowsProp]
    edgesPreFiddler.respectHiddenRows = d[respectHiddenRowsProp]
  },

  anyFiddler(name) {
    const as = this
    const { configuration } = as
    return as.externalFiddler(configuration[name])
  },

  externalFiddler(config) {
    console.log('external fiddler', config)
    return Exports.newPreFiddler(config)
  },

  //----end of getting and setting values in store------------------

  //----direct sheet manip-------------------------------------------
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

  // apply basic edge settings formats by copying the first one over
  applyEdgeFormatSettings(edgesFiddler, edgeDefaultsFiddler) {

    // this is a bit different to the vertex version, as the values are already populated
    // we only want the formats
    const as = this

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

  //-- now deal with the node settings copy over
  applyNodeSettings(values, fiddler) {
    const as = this
    const { nodeDefaultsFiddler } = as
    const vsIndex = as.getNodeSettingsIndex(values, nodeDefaultsFiddler)
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
    as.setMinWidths(fiddler.getSheet(), as.minColWidth)

  },

  //----end of direct sheet manip

  //----local app store utilities----------------------------------
  getHasher(id) {
    const as = this
    const u = Exports.Utils
    const { hashConfigurations } = as.configuration
    const h = hashConfigurations[id]
    if (!h) return null
    if (h.type !== 'flubber') throw `only support flubber hashing`
    return (text) => u.flubber({ ...h.params, text })
  },

  snakeToCamel(snake) {
    return snake.toLowerCase()
      .replace(/([-_][a-z])/g, group =>
        group
          .toUpperCase()
          .replace('-', '')
          .replace('_', ''))
  },

  // apply hashing and retention
  applyHashing(value, item) {
    const as = this
    const hasher = item.vertexRedact && as.getHasher(item.vertexRedact)
    if (hasher) value = hasher(value)
    return value
  },


  toast(message, title = "progress report", timeout = -1) {
    const ss = SpreadsheetApp.getActiveSpreadsheet()
    if (ss) {
      ss.toast(message, title, timeout);
    }
    console.log(title, message)
  },

  getVersionToastie() {
    const as = this
    return `${as.stubVersion}              ${as.projectVersion}`
  },

  getConfigToastie(configurationFiddler) {
    return `${configurationFiddler.getSheet().getName()}`
  },

  //----end of local app store utilities----------------------------------

  //----configuration resolution-----------------------------------------
  // overall processig of validation of config types
  resolveMusts(musts, fiddler) {
    const as = this
    const resolved = Reflect.ownKeys(musts)
      .reduce((p, c) => {
        p[c] = as.resolveMust(musts[c], fiddler)
        return p
      }, {})

    const missing = Reflect.ownKeys(resolved).reduce((p, c) => {
      return p.concat(resolved[c].missing)
    }, [])

    if (missing.length)
      throw `missing headers in sheet - ${fiddler.getSheet().getName()} - ${Array.from(new Set(missing)).join(',')}`

    // check everything required is present
    Reflect.ownKeys(resolved).forEach(k => as.validateAllThere(resolved[k]))
    return resolved
  },

  // general solver for picking up params
  resolveMust(must, fiddler) {
    const as = this
    const headerSet = new Set(fiddler.getHeaders())
    const missing = must.musts.filter(f => !headerSet.has(f))
    const data = fiddler.getData()

    return {
      missing,
      must,
      values: data.map(d => {
        return must.musts.reduce((p, c) => {
          p[as.snakeToCamel(c)] = d[c]
          return p
        }, {})
      })
        .filter(d =>
          Reflect.ownKeys(d)
            .filter(k => !must.optional.includes(k))
            .some(k => d[k]))
        .filter(d => !must.disable || !d[must.disable])
        .map(d => must.alias ? { ...d, alias: d[must.alias] } : d)
    }
  },

  // validate transformers tab and compile
  compileTransformers(transformersFiddler) {
    const as = this
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
      if (type !== 'lookup') throw `Only lookup type supported for transformers ${name}`
      if (!u.isString(kv)) throw `Transformer ${name} key-value-pairs is not a string`
      const tv = kv.split(",")
      if (!tv.length || tv.length % 2) throw `Transformer ${name} key-value-pairs must be an even length (each key must have a value)`
      v.transformer = u.chunker(tv, 2)
        .reduce((p, [key, value]) => {
          key = key.trim()
          value = value.trim()
          if (p[key]) throw `duplicate key ${key} in transformer ${name}`
          // special treatment of null
          p[key] = value === "null" ? null : value
          return p
        }, {})
    })
    return resolved
  },

  prepareResolve(configurationFiddler) {
    const as = this

    // check all necessary config colummns
    const musts = {
      question: {
        musts: ["question-alias", "question-data-source", "question-text"],
        optional: []
      },
      data: {
        musts: ["data-id", "data-sheet", "data-alias", "data-disable"],
        optional: ["dataDisable"],
        disable: "dataDisable",
        alias: 'dataAlias'
      },
      output: {
        musts: ["output-name"],
        optional: []
      },
      node: {
        musts: ["node-settings"],
        optional: []
      },
      vertex: {
        musts: [
          "vertex-question",
          "vertex-type",
          "vertex-redact",
          "vertex-disable",
          "vertex-exclude",
          "vertex-add-source"
        ],
        optional: [
          "vertexExclude",
          "vertexRedact",
          "vertexDisable",
          "vertexAddSource"
        ],
        disable: "vertexDisable",
        alias: "vertexQuestion"
      },

      edge: {
        musts: [
          "edge",
          "edge-grid-subject",
          "edge-grid-value",
          "edge-type",
          "edge-source",
          "edge-target",
          "edge-settings",
          "edge-disable",
          "edge-loop-allow",
          "edge-label",
          "edge-weight",
          "edge-undirected",
          "edge-transformer",
          "edge-drop-null"
        ],
        optional: ["edgeLoopAllow", "edgeDisable", "edgeWeight", "edgeUndirected", "edgeTransformer", "edgeLabel", "edgeDropNull"],
        disable: "edgeDisable",
        alias: "edge"
      }

    }
    return as.resolveMusts(musts, configurationFiddler)
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

    if (broken.length) throw `some missing required values = ${Array.from(new Set(broken)).join(',')}`
    return item
  },

  getNodeSettingsIndex(values, fiddler) {
    const as = this
    const { nodeSettings } = values[0] || {}
    return as.getSettingsIndex(fiddler, nodeSettings, "node-settiings")
  },

  getSettingsIndex(fiddler, propValue, name) {
    //--- get the vSettings
    if (!propValue) throw `${name} value not provided`
    const vsIndex = fiddler.getData().findIndex(f => f.name === propValue)
    if (vsIndex === -1) throw `${name} ${propValue} not found in ${fiddler.getSheet().getName()} tab`
    return vsIndex
  },


  //----end of configuration resolution-------------------------------


  //----ingestion-----------------------------------------------------

  resolve() {
    const as = this
    const u = Exports.Utils

    const { configuration, configurationFiddler, transformersFiddler, edgeDefaultsFiddler } = as
    const { verticesPreFiddler, edgesPreFiddler, edgeWeightDefault } = configuration
    //--- get the edge settings we'll need this later so just do it the once here.
    const edgeSettingsData = edgeDefaultsFiddler.getData()

    if (!isFinite(edgeWeightDefault))
      throw `invalid edgeweightdefault ${edgeWeightDefault}`

    as.toast(
      `${as.getConfigToastie(configurationFiddler)}            ${as.getVersionToastie()}`,
      `Executing data ingestion`)

    //---- validate the config data has all it needs
    const resolved = as.prepareResolve(configurationFiddler)
    const transformerMap = new Map(as.compileTransformers(transformersFiddler)
      .transformers.values.map(f => [f.name, f]))

    //---- pick up the input datas and patch in questions now
    const dataMap = as.getDataMap(resolved.data.values)

    //--- organize entities
    const vertex = as.organize(resolved.vertex.values, 'vertex', (item, entity) => {
      if (item.vertexType !== 'question')
        throw `only "question" vertex-type supported for ${entity}`
    })
    const edge = as.organize(resolved.edge.values, 'edge', (item, entity) => {
      const validTypes = ["grid", "multi-grid"]
      if (!validTypes.includes(item.edgeType))
        throw `only ${validtypes.join(",")} edge-type supported for ${entity}`
    })
      // check that essentialas are there before going any further
      ;["id-alias", "Label"].forEach(f => {
        if (!vertex.get(f)) throw `Mandatory vertex ${f} missing`
      })

    //---- organize questions an associate them the given alias 
    resolved
      .question
      .values
      .forEach(question => {
        const ds = dataMap.get(question.questionDataSource)
        if (ds) {
          const av = vertex.get(question.questionAlias)
          const ae = edge.get(question.questionAlias)
          const item = av || ae
          if (item) {
            if (av && ae) throw `vertex ${question.questionAlias} can't be an edge too`
            if (!ds.items) ds.items = []
            const type = ae ? 'edge' : 'vertex'
            if (!item.dataSources) item.dataSources = new Map()
            if (item.dataSources.get(ds.alias))
              throw `Duplicate data source for alias ${type} ${item.alias} - ${ds.alias}`
            const ob = {
              item,
              question,
              type
            }

            // this is how to get an item definition for a given data source
            item.dataSources.set(ds.alias, ob)

            ds.items.push(ob)
          }
        } else {
          throw `Cant find datasource ${question.questionDataSource} for ${question.questionText}`
        }
      })

    //--- assign the id questions to avoid repeating later
    as.addIdQuestions(dataMap)

    // pick up vertex values from each data set
    as.toast(`...working on vertices`)
    const vertexDataMap = as.makeVertexDataMap({ vertex, dataMap })
    if (!vertexDataMap.size) throw `no vertice data was found - are you sure the question text is accurate for each data set?`

    // and edge values
    as.toast(`...working on edges`)
    const edgeDataModel = as.makeEdgeDataModel({ edge, transformerMap, dataMap, vertex, edgeWeightDefault, edgeSettingsData })
    if (!edgeDataModel.length) throw `no edges were found - are you sure the question text is accurate for each data set?`

    // fix up the edge settings

    //--- put the data without the settings
    // clear it first to avoid wasting time reading any exosting values
    as.toast(`...writing vertices to sheet ${verticesPreFiddler.sheetName}`)
    as.clearTargetSheet(verticesPreFiddler)
    const { verticesFiddler, headFormat } = as
    // write the data and format the headings
    verticesFiddler.setData(Array.from(vertexDataMap.values()))
      .setHeaderFormat(headFormat)
      .dumpValues()

    //-- now deal with the node settings copy over
    as.applyNodeSettings(resolved.node.values, verticesFiddler)


    // clear it first to avoid wasting time reading any exosting values
    as.toast(`...writing edges to sheet ${edgesPreFiddler.sheetName}`)
    as.clearTargetSheet(edgesPreFiddler)
    const { edgesFiddler } = as

    // we postponed the addition of the settings to ensure that all the data fields came first
    const allProps = Array.from(edgeDataModel.reduce((p, c) => {
      Reflect.ownKeys(c.model).forEach(k => p.add(k))
      return p
    }, new Set()))

    const edgeData = edgeDataModel.map(f => {
      return {
        ...allProps.reduce((p, c) => {
          p[c] = f.model[c]
          return p
        }, {}),
        ...f.esSpread
      }
    })

    edgesFiddler.setData(edgeData)
      .setHeaderFormat(headFormat)

    as.applyEdgeFormatSettings(edgesFiddler, edgeDefaultsFiddler)

    // important to postpone dump values till after applying edge format settings
    edgesFiddler.dumpValues()
    as.setMinWidths(edgesFiddler.getSheet(), as.minColWidth)

    as.toast(`...${dataMap.size} datasets produced ${vertexDataMap.size} vertices and ${edgeData.length} edges`, "Data Ingest complete", 3)
  },

  //perform a tranformer translation
  execTransformer({ transformer, value, source }) {
    const u = Exports.Utils
    if (transformer) {
      // a transformer takes the current value of the [edgeGridValue] property
      // eg- frequency       
      const prop = !u.isNU(value) &&
        u.isFunction(value.toString) &&
        value.toString().trim()

      const { transformer: t } = transformer
      // check this prop exists in the transformer
      if (u.isNU(prop) || !Reflect.has(t, prop)) {
        if (!t.invalidAsNull)
          throw `unknown ${transformer.name} value ${prop} for ${source} (treat empty as null by appending ,,null to transformer list)`
        return {
          value,
          transformed: null
        }
      } else {
        return {
          value,
          transformed: t[prop]
        }
      }
    } else {
      return {
        value
      }
    }

  },

  //-- now make the edge connections
  makeEdgeDataModel({ edge, transformerMap, dataMap, vertex, edgeWeightDefault, edgeSettingsData }) {
    const as = this
    const u = Exports.Utils

    const ewProp = "Edge Weight"
    const esMap = edgeSettingsData.reduce((p, c) => {
      p.set(c.name.toString(), [c].map(({ name, ...rest }) => ({ ...rest }))[0])
      return p
    }, new Map())

    return Array.from(edge.values()).reduce((p, edge) => {
      const {
        edgeSource,
        edgeTarget,
        edgeType,
        edgeGridSubject,
        edgeGridValue,
        edgeLabel,
        edgeLoopAllow,
        edgeSettings,
        edgeTransformer,
        edgeDropNull,
        edgeWeight,
        dataSources
      } = edge


      if (!dataSources) throw `Missing dataSources for edge ${edge.edge} - check they are accurately named in the config and have an associated question`


      // see if there's a transformer needed
      const transformer = transformerMap.get(edgeTransformer)
      if (edgeTransformer && !transformer)
        throw `Couldnt find transformer ${edgeTransformer} for ${edge.alias}`

      // this applies to the item so we can do it now
      // this'll be the extra column applied if there's a transformer
      const transformProp = transformer && transformer.name

      // edgesettings could be dynamic
      const et = edgeSettings && edgeSettings.toString()
      const es = et && /^\$/.test(et) ? {
        edgeSettings: et.substring(1),
        dynamic: true
      } : {
        edgeSettings: et
      }

      // now circle on the data sets
      Array.from(dataMap.values()).forEach(d => {
        const { data, headerSet, alias } = d

        // we have an link into each dataset for each vertex
        const ds = dataSources.get(alias)
        if (!ds) throw `Couldn't establish data source for ${edge.alias} in dataset ${alias}`

        // pick up the column names for the required items
        const vsd = as.getVertexItem(vertex, edgeSource, edge.alias, alias)
        const vtd = as.getVertexItem(vertex, edgeTarget, edge.alias, alias)
        const vxd = as.getVertexItem(vertex, 'id-alias', edge.alias, alias)

        // find the placehoder in the grid question
        const { question } = ds
        if (!question)
          throw `question text not found in data source ${alias} for ${vtd.item.alias}`
        const rx = new RegExp(`\\[${vtd.item.alias}\\]`)
        if (!rx.test(question.questionText))
          throw (`couldnt find placeholder [${vtd.item.alias}] in ${question.questionText}`)

        // from vertex to vertex mappings
        data.forEach((sourceRow) => {
          const source = as.applyHashing(sourceRow[vsd.question.questionText], vsd.item)
          const vertex1 = as.applyHashing(sourceRow[vxd.question.questionText], vxd.item)

          // now compare with ever other person in the data
          data.forEach((targetRow) => {

            // this is to extract the question that identifies the target
            const target = as.applyHashing(targetRow[vtd.question.questionText], vtd.item)

            // check to avoid self loop
            if (source !== target || edgeLoopAllow) {

              // now we need to figure out the grid matching 
              // the question text should contain something like ... [name]
              const targetQuestion = question.questionText.replace(rx, `[${target}]`)

              // this test matched the whole thing ie. "the question text for [john doe]"
              if (headerSet.has(targetQuestion)) {

                // the id of the target vertex
                // note that the only purpose of the targetRow is to provide the vertex name
                // all data comes from the source row
                const vertex2 = as.applyHashing(targetRow[vxd.question.questionText], vxd.item)


                // note this is unintuitive but correct - 
                // sourceRow NOT targetRow 
                // because the targetrow is just to find the details of the target
                // the data is always from the source row 
                const sourceValue = sourceRow[targetQuestion]

                // multi-grid values could be comma separated
                // and these need to be expanded into separate edges
                const values = (edgeType === "multi-grid" ?
                  sourceValue.split(",") : [sourceValue])
                  .map(f => f.trim())
                  .filter(f => f !== '' && !u.isNU(f))
                  .map(f => as.execTransformer({ transformer, value: f, source }))

                values.forEach(({ value, transformed }) => {

                  // start the population of the edge for this source/target combination
                  const model = {
                    vertex1,
                    vertex2,
                    data: alias,
                    source,
                    target
                  }
                  model[edgeGridSubject] = edge.alias
                  // the original value
                  model[edgeGridValue] = value
                  if (transformProp) model[transformProp] = transformed

                  // special handling of null values from transformer
                  const drop = transformer &&
                    edgeDropNull &&
                    transformProp &&
                    u.isNU(model[transformProp])

                  // if there's an edgeweight, weuse the edgeweight property to pick up 
                  // the mapped field from the model
                  // this could be a transformed value if there is one
                  // it has to be convertible to a number in any case
                  if (!drop) {
                    // add the settings for this item type
                    // get the settings data

                    if (edgeWeight) {
                      if (!Reflect.has(model, edgeWeight))
                        throw `edge-weight ${edgeWeight} missing for ${edge.alias}`

                      const w = model[edgeWeight]
                      if (!isFinite(w))
                        throw `edge-weight ${w} is not a valid number for ${source} in ${edge.alias}`

                      // convert it to a number and use as a weight
                      model[ewProp] = parseFloat(w)
                    } else {
                      //in this case, there is no edgeweight, so default
                      model[ewProp] = edgeWeightDefault
                    }

                    // maybe there's an edge label
                    // edge label will have data set name appended if there's multiple data sets
                    if (edgeLabel) {
                      const label = edgeLabel === "edge" ? edge.alias : model[edgeLabel]
                      if (!label) throw `Cant make ${edgeLabel} for ${vertex1}:${vertex2}`
                      model.Label = dataMap.size > 1 ? label + '-' + alias : label
                    }
                    let esSpread = {}
                    if (es.edgeSettings) {
                      // if dynamic, uses the value rather than the name directly
                      const spreadName = es.dynamic ? model[es.edgeSettings] : es.edgeSettings

                      //TODO ??handle non responses - TODO should this be 'default?'

                      // now get that from known edgesettings
                      esSpread = esMap.get(spreadName)
                      if (!esSpread) throw `couldn't find edge-settings ${spreadName} for ${edge.alias}`
                      if (Reflect.has(esSpread, edge.alias))
                        throw `${edge.alias} can't exist in both edge defaults and as an edge value - remove or set to empty in edge-defaults`
                    }

                    // we can drop null transforms
                    p.push({ model, esSpread })
                  }

                })


              } else {
                // TODO decide what action to take if missing - for now I'm just ignoring
                // throw `${targetQuestion} is missing from dataset ${alias}`
              }

            }
          })

        })
      })
      return p
    }, [])
  },

  // get vertex values from dataset
  makeVertexDataMap({ vertex, dataMap }) {
    const as = this
    return Array.from(vertex.values()).reduce((p, vertex) => {
      const { dataSources, vertexAddSource } = vertex

      // for each data set, find the value for the current vertex
      Array.from(dataMap.values()).forEach(d => {
        const { data, headerSet, alias, idQuestionText, idItem } = d

        // we have an link into each dataset for each vertex
        const ds = dataSources.get(alias)
        if (!ds) throw `Couldn't establish data source for ${vertex.alias} in dataset ${alias}`

        // this is how this particular vertex is known in the selected data set
        const { question } = ds
        if (!question)
          throw `question text not found in data source ${alias} for ${idItem.alias}`

        // this is the rows of data from each of the data sources
        data.forEach((inputRow, i) => {
          // first get the alias value for this row
          const idAliasValue = as.applyHashing(inputRow[idQuestionText], idItem)
          if (!idAliasValue) throw `Missing id-alias value in row ${i} of source ${alias}`

          // we're making a map using the idalias of each row in the data set
          if (!p.get(idAliasValue)) p.set(idAliasValue, {})
          const rob = p.get(idAliasValue)

          // this may have been checked before, but just to double check 
          // that we didnt get lost somewhere
          if (!headerSet.has(question.questionText))
            throw `${question.questionText} not found in data source ${alias} for ${idItem.alias}`

          // hash the value if required
          const value = as.applyHashing(inputRow[question.questionText], vertex)
          rob[vertex.alias] = value

          // if we're preserving the value at the data source time ad an extra column
          if (vertexAddSource) {
            rob[vertex.alias + '-' + alias] = value
          }
        })
      })
      return p
    }, new Map())
  },

  // general oragnizer
  organize(values, entity, validate) {
    return values
      .reduce((p, c) => {
        if (p.get(c.alias)) throw `duplicate ${entity} ${c.alias} found`
        validate(c, entity)
        p.set(c.alias, c)
        return p
      }, new Map())
  },

  // get the data maps
  getDataMap(values) {
    const as = this
    return values.reduce((p, d) => {
      if (p.get(d.alias)) throw `duplicate data-alias ${d.alias} found`
      try {
        as.toast(`from ${d.dataId}: ${d.dataSheet}`, "Getting Data", 4)
        const fiddler = as.externalFiddler({
          id: d.dataId,
          sheetName: d.dataSheet,
          createIfMissing: false
        })
        p.set(d.alias, {
          fiddler,
          headers: fiddler.getHeaders(),
          data: fiddler.getData(),
          alias: d.alias,
          headerSet: new Set(fiddler.getHeaders())
        })
      }
      catch (err) {
        throw `couldnt open sheet ${d.dataSheet} ${err}`
      }
      return p
    }, new Map())


  },

  addIdQuestions(dataMap) {
    const as = this
    //--- find the id item for each dataset to avoid doing it loads of times later
    for (let ds of dataMap.values()) {
      const idFind = ds.items && ds.items.find(f => f.item.alias === 'id-alias')
      if (!idFind) throw `Couldn't find id-alias in data source ${ds.alias}`
      const { item: idItem, question: idQuestion } = idFind
      const { questionText: idQuestionText } = idQuestion
      if (!ds.headerSet.has(idQuestionText))
        throw `${idQuestionText} not found in data source ${ds.alias} for ${idItem.alias}`
      ds.idQuestionText = idQuestionText
      ds.idItem = idItem
    }
  },

  getVertexItem(vItems, name, edge, dsAlias) {
    const vSource = vItems.get(name)
    if (!vSource) throw `Missing vertex ${name} for edge ${edge}`
    const vd = vSource.dataSources.get(dsAlias)
    if (!vd) throw `Missing datasource ${dsAlias} for vertex ${name} at edge ${edge}`
    return vd
  },
  //----end of ingestion-----------------------------------------------------
};