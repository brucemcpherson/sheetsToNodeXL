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
  get dobKey() {
    return 'ingest_details'
  },

  //-- execute a resolve followed by a sheet populate
  execute() {
    const as = this
    return as.resolve()
  },

  //--- render as gml
  render(resolved) {

    const as = this
    const u = Exports.Utils
    const hs = Exports.Helpers
    const { verticesFiddler, edgesFiddler, configuration } = as

    // get the developer data
    const metaVertices = Exports.DeveloperData.getDob(verticesFiddler.getSheet(), as.dobKey)
    const metaEdges = Exports.DeveloperData.getDob(edgesFiddler.getSheet(), as.dobKey)

    // they should be the same
    if (!metaVertices || !metaEdges)
      hs.logThrow('cant find stamp of which config wrote this - run ingest again')


    if (JSON.stringify(metaVertices) !== JSON.stringify(metaEdges)) {
      hs.logThrow('the edges and vertices were not created by the same time/configuration - run ingest again')
    }
    const { configuration: metaConfig } = metaVertices
    const { configurationPreFiddler } = configuration
    configurationPreFiddler.sheetName = metaConfig.sheetName
    configurationPreFiddler.id = metaConfig.ssid
    as.toast('Using detected ingestion configuration', configurationPreFiddler.sheetName)

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
      if (!id) hs.logThrow(`id-alias missing from ${JSON.stringify(f)}`)
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

  dumpToDrive() {
    const dd = Exports.DriveExports
    return dd.dumpToDrive()
  },

  //----end of main execution functions-------------------


  //----getting and setting values in store------------------
  get breaking() {
    return this.memory.get('breaking')
  },
  set breaking(value) {
    return this.memory.set('breaking', value)
  },
  get brokenBefore() {
    return this.memory.get('brokenBefore')
  },
  set brokenBefore(value) {
    return this.memory.set('brokenBefore', value)
  },
  // the stub will set a value for breaking
  // if its less than this value then there's been a breaking change in the
  // library that needs a stub change
  isBroken() {
    const u = Exports.Utils
    const as = this
    const minStub = as.brokenBefore
    if (u.isNU(as.breaking) || as.breaking < minStub) {
      throw 'You need to upgrade the stub script in your sheet to v' + minStub
    }
  },
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

  get active() {
    return SpreadsheetApp.getActiveSpreadsheet()
  },

  //---- this initializes the configuration from a template
  initConfigurations(configId) {
    return Exports.Helpers.initConfigurations(configId)
  },

  //---prettification 
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
    return Exports.Helpers.makeHeadFormat(color)
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
    return configurations && configurations[selectedConfiguration];
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

  writeLog(...args) {
    const logFiddler = this.logFiddler
    if (logFiddler) {
      const sheet = logFiddler.getSheet()
      const c = this.memory.get('configurationPreFiddler')
      const mess = [
        c && c.getSheet().getName() || 'config',
        new Date(),
        ...args
      ]
      sheet.appendRow(mess)
      console.log('writelog', mess)
    } else {
      console.log(...args)
    }
    return logFiddler
  },

  get logFiddler() {
    const as = this
    const hs = Exports.Helpers
    const key = 'logPreFiddler'
    const { configuration } = as
    if (!configuration || !configuration[key] || !configuration[key].enableLogging) return null

    // logging is turned on - if we've already opened it we'll have a handle already
    let f = as.memory.get(key)

    // first time round this will happen
    if (!f) {
      f = this.anyFiddler(key)
      if (f) {
        hs.clearTargetSheet({
          sheetName: f.getSheet().getName(),
          id: f.getSheet().getParent().getId()
        })
        console.log(`...logging is enabled - see sheet ${f.getSheet().getName()}`)
      }

    }

    return f
  },

  get edgesFiddler() {
    return this.anyFiddler('edgesPreFiddler')
  },

  get hashNamesFiddler() {
    return this.anyFiddler('hashNamesPreFiddler')
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

  get testFiddler() {
    const as = this
    return as.externalFiddler(as.testId)
  },

  // change the sheet name to a different configuration
  patchConfiguration(fromMeta = false) {
    // check the stub is compatible with this library
    this.isBroken()

    return Exports.Helpers.patchConfiguration(fromMeta)
  },

  anyFiddler(name) {
    const as = this
    const { configuration } = as
    const f = configuration && as.externalFiddler(configuration[name])
    this.memory.set(name, f)
    return f
  },

  externalFiddler(...args) {
    const as = this
    as.writeLog(`..attempting to open ${args && JSON.stringify(args)}`)
    return Exports.newPreFiddler(...args)
  },

  //----end of getting and setting values in store------------------


  //----local app store utilities----------------------------------

  // apply hashing and retention
  applyHashing(value, item) {
    return Exports.Helpers.applyHashing(value, item)
  },

  // get the first names into memory of required
  getHashNames({ key, columnName }) {

    if (!this.memory.has(key)) {
      const t = this.hashNamesFiddler
      if (t.getHeaders().indexOf(columnName) === -1) {
        Exports.Helpers.logThrow(`Couldnt find hash names column ${columnName} to use for redaction`)
      }
      const pop = t.getUniqueValues(columnName)
      this.memory.set(key, pop)
    }
    return this.memory.get(key)
  },

  toast(message, title = "progress report", timeout = -1) {
    const as = this
    const ss = as.active
    if (ss) {
      ss.toast(message, title, timeout);
    }
    as.writeLog(title, message)
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
  prepareResolve(configurationFiddler) {
    const as = this

    // check all necessary config colummns
    const musts = {
      question: {
        musts: ["question-alias", "question-data-source", "question-text"],
        optional: ["questionDataSource"]
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
          "edge-drop-null",
          "edge-ghosts"
        ],
        optional: ["edgeLoopAllow", "edgeDisable", "edgeWeight", "edgeUndirected", "edgeTransformer", "edgeLabel", "edgeDropNull", "edgeGhosts"],
        disable: "edgeDisable",
        alias: "edge"
      }

    }
    return as.resolveMusts(musts, configurationFiddler)
  },

  // overall processig of validation of config types
  resolveMusts(musts, fiddler) {
    return Exports.Helpers.resolveMusts(musts, fiddler)
  },

  // general solver for picking up params
  resolveMust(must, fiddler) {
    return Exports.Helpers.resolveMust(must, fiddler)
  },

  // validate transformers tab and compile
  compileTransformers(transformersFiddler) {
    return Exports.Helpers.compileTransformers(transformersFiddler)
  },

  validateAllThere(item) {
    return Exports.Helpers.validateAllThere(item)
  },


  //----end of configuration resolution-------------------------------


  //----ingestion-----------------------------------------------------

  resolve() {
    const as = this
    const hs = Exports.Helpers
    const u = Exports.Utils

    const { configuration, configurationFiddler, transformersFiddler, edgeDefaultsFiddler } = as
    const { verticesPreFiddler, edgesPreFiddler, edgeWeightDefault } = configuration

    //--- get the edge settings we'll need this later so just do it the once here.
    const edgeSettingsData = edgeDefaultsFiddler.getData()

    if (!isFinite(edgeWeightDefault))
      Exports.Helpers.logThrow(`invalid edgeweightdefault ${edgeWeightDefault}`)

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
        hs.logThrow(`only "question" vertex-type supported for ${entity}`)
    })
    const edge = as.organize(resolved.edge.values, 'edge', (item, entity) => {
      const validTypes = ["grid", "multi-grid", "virtual-grid"]
      if (!validTypes.includes(item.edgeType))
        hs.logThrow(`only ${validTypes.join(",")} edge-type supported for ${entity}`)
    })
      // check that essentialas are there before going any further
      ;["id-alias", "Label"].forEach(f => {
        if (!vertex.get(f)) hs.logThrow(`Mandatory vertex ${f} missing`)
      })

    //---- organize questions an associate them the given alias 
    resolved
      .question
      .values
      .forEach(question => {
        /* datamap contains all the input data
          datakeys is where to find the question text for each quesion (which may differ for each dataset)
          to avoid repetition, a blank data key means it
          can be used to apply to all datamaps
        */
        const dKeys = u.isSheetsNU(question.questionDataSource) ?
          Array.from(dataMap.keys()) : [question.questionDataSource]

        dKeys.forEach(k => {
          const ds = dataMap.get(k)

          if (ds) {
            const av = vertex.get(question.questionAlias)
            const ae = edge.get(question.questionAlias)
            const item = av || ae
            if (item) {
              if (av && ae) hs.logThrow(`vertex ${question.questionAlias} can't be an edge too`)
              if (!ds.items) ds.items = []

              const type = ae ? 'edge' : 'vertex'
              if (!item.dataSources) item.dataSources = new Map()
              if (item.dataSources.get(ds.alias))
                hs.logThrow(`Duplicate data source for alias ${type} ${item.alias} - ${ds.alias}`)
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
            hs.logThrow(`Cant find datasource ${question.questionDataSource} for ${question.questionText}`)
          }
        })
      })


    //--- assign the id questions to avoid repeating later
    as.addIdQuestions(dataMap)

    const emess = 'are you sure the question text is accurate for each data set?'
    // pick up edge values from each data set
    as.toast(`...working on edges`)
    const edgeDataModel = as.makeEdgeDataModel({
      edge, transformerMap, dataMap, vertex, edgeWeightDefault, edgeSettingsData
    })
    if (!edgeDataModel.length) hs.logThrow(`no edges were found - ${emess}`)

    // pick up vertex values from each data set
    as.toast(`...working on vertices`)
    const vertexDataMap = as.makeVertexDataMap({ vertex, dataMap })
    if (!vertexDataMap.size) hs.logThrow(`no vertice data was found -  - ${emess}`)

    // set the meta data we'll write to the receiving sheet
    as.toast(`...writing vertices to sheet ${verticesPreFiddler.sheetName}`)
    meta = {
      createdAt: new Date().getTime(),
      configuration: {
        sheetId: configurationFiddler.getSheet().getSheetId(),
        sheetName: configurationFiddler.getSheet().getName(),
        ssid: configurationFiddler.getSheet().getParent().getId()
      }
    }
    hs.clearTargetSheet(verticesPreFiddler)
    const { verticesFiddler, headFormat } = as

    // write the data and format the headings
    verticesFiddler.setData(Array.from(vertexDataMap.values()))
      .setHeaderFormat(headFormat)
      .dumpValues()

    //-- now deal with the node settings copy over
    hs.applyNodeSettings(resolved.node.values, verticesFiddler)

    // push the meta data
    Exports.DeveloperData.setDob(verticesFiddler.getSheet(), as.dobKey, meta)

    // repeat for edges
    as.toast(`...writing edges to sheet ${edgesPreFiddler.sheetName}`)
    hs.clearTargetSheet(edgesPreFiddler)
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

    hs.applyEdgeFormatSettings(edgesFiddler, edgeDefaultsFiddler)

    // important to postpone dump values till after applying edge format settings
    edgesFiddler.dumpValues()
    hs.setMinWidths(edgesFiddler.getSheet(), as.minColWidth)

    // write developer data for edges
    Exports.DeveloperData.setDob(edgesFiddler.getSheet(), as.dobKey, meta)


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
          Exports.Helpers.logThrow(`unknown ${transformer.name} value ${prop} for ${source} (treat empty as null by appending ,,null to transformer list)`)
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

  // get the transformer for a given edge
  getEdgeTransformer({ edge, transformerMap }) {
    const { alias, edgeTransformer } = edge
    const transformer = transformerMap.get(edgeTransformer)
    if (edgeTransformer && !transformer)
      Exports.Helpers.logThrow(`Couldnt find transformer ${edgeTransformer} for ${alias}`)
    return transformer
  },

  // get edge setting an validate
  getEdgeSettings({ edgeSettings }) {
    const et = edgeSettings && edgeSettings.toString()
    return et && /^\$/.test(et) ? {
      edgeSettings: et.substring(1),
      dynamic: true
    } : {
      edgeSettings: et
    }
  },

  // get the edge settings for easier access
  getEsMap({ edgeSettingsData }) {
    return edgeSettingsData.reduce((p, c) => {
      p.set(c.name.toString(), [c].map(({ name, ...rest }) => ({ ...rest }))[0])
      return p
    }, new Map())
  },


  // say we have questions like i like mary, i like john, i like fred
  // and joan as said I like mary, but mary didnt take the survey, we wouldnt be able to
  // visualize an edge from joan to mary, so we have to create a ghost entry for mary 
  addGhostVertices({ dmap, edge, question, vertex }) {

    const as = this
    const hs = Exports.Helpers
    const u = Exports.Utils
    // they'll go here
    const adds = []
    const { edgeSource, edgeTarget, edgeGhosts } = edge
    const { data, headerSet, alias } = dmap

    // pick up the column names for the required items
    // mostly source and target would be the same 
    // in our example 'name' to produce source and target values of mary, john etc
    const vsd = as.getVertexItem(vertex, edgeSource, edge.alias, alias)
    const vtd = as.getVertexItem(vertex, edgeTarget, edge.alias, alias)
    const vid = as.getVertexItem(vertex, 'id-alias', edge.alias, alias)
    const vld = as.getVertexItem(vertex, 'Label', edge.alias, alias)
    const { questionText } = question

    // the sources available in the data set
    // source and target are generally the same
    // TODO work up and test a scenario where they might be different
    const sources = new Set(
      data.map(f => f[vsd.question.questionText]).concat(
        data.map(f => f[vtd.question.questionText])
      ))

    // use this to create a blank new object
    const templateOb = Array.from(headerSet.keys()).reduce((p, c) => {
      p[c] = ''
      return p
    }, { __dataType: 'ghost' })

    // E1
    // there isnt a placeholder for the target in the question text
    const rx = new RegExp(`\\[${vtd.item.alias}\\]`)
    if (!questionText.match(vtd.item.alias)) {
      hs.logThrow(`Expected to find placeholder [${vtd.item.alias}] in ${questionText}`)
    }

    // E2
    // here's where we'd check if the respondent joan exists as a target
    // at this point it doesn't matter if they don't
    // TODO other scenarios might matter so I'll leave it on for now
    data.forEach((d, i) => {
      const t = d[vsd.question.questionText]
      const q = questionText.replace(rx, `[${t}]`)
      if (!headerSet.has(q)) {
        as.writeLog('warning', `...source ${t} in ds ${alias} row ${i + 1} doesn't appear in a ${questionText}`)
      }
      return d
    })


    // E3
    // remove the [name] part
    const qbase = questionText.replace(/\[.*\]/, "")
    // the question may have special rx chars in it
    const qesc = u.escapeStringforRx(qbase)
    // append a matcher for [ghostname]
    const qescrx = `(${qesc})\\[(.*)\\]`
    const qrx = new RegExp(qescrx)

    // find all questions that look like this one
    const questionsLikeThis = Array.from(headerSet.keys()).filter(f => f.match(qrx))
    questionsLikeThis.forEach(f => {
      // pick up the ghost name
      const ix = f.replace(qrx, "$2")
      // if we dont already know that ghost, create and empty vertex
      if (!sources.has(ix) && edgeGhosts) {
        sources.add(ix)
        const ob = {
          ...templateOb
        }
        ob[vsd.question.questionText] = ix
        ob[vid.question.questionText] = ix
        adds.push(ob)
      }
    })

    return adds

  },

  // make all the ghost vertices in advance
  // the objective to come up with an array of template obs to be added to the each set
  generateGhosts({ edge, dataMap, vertex }) {
    const as = this
    const u = Exports.Utils
    const hs = Exports.Helpers

    // each edge in the sheet
    // there's no return value as we'll add a prop to each dataMap item
    for (let dmap of dataMap.values()) {

      const { alias } = dmap
      dmap.ghosts = []

      for (let edgeValue of edge.values()) {
        const { dataSources } = edgeValue
        if (!dataSources) {
          hs.logThrow(`edge ${edgeValue.edge} missing - have you assigned a question text?`)
        }
        // this finds the edge definition in the current data set alias - alias will be somethinglike t1
        const ds = dataSources.get(alias)
        if (!ds) hs.logThrow(`Couldn't establish data source for ${edgeValue.alias} in dataset ${alias}`)
        // find the placehoder in the grid question
        const { question } = ds
        if (!question)
          hs.logThrow(`question text not found in data source ${alias} for ${vtd.item.alias}`)

        // now add any missing
        const ghosts = as.addGhostVertices({ dmap, edge: edgeValue, question, vertex })
        ghosts.forEach(c => {
          // merge if ids match
          const vid = as.getVertexItem(vertex, 'id-alias', edgeValue.alias, alias)
          const qt = vid.question.questionText
          const match = dmap.ghosts.findIndex(f => f[qt] === c[qt])
          // it exists so add any values that are not null
          if (match !== -1) {
            dmap.ghosts[match] = {
              ...dmap.ghosts[match],
              ...u.dropProps(c)
            }
          } else {
            dmap.ghosts = dmap.ghosts.concat(c)
          }
        })

      }
    }
  },

  //-- now make the edge connections
  makeEdgeDataModel({
    edge,
    transformerMap,
    dataMap,
    vertex,
    edgeWeightDefault,
    edgeSettingsData
  }) {
    const as = this
    const u = Exports.Utils
    const hs = Exports.Helpers

    const ewProp = "Edge Weight"
    const esMap = as.getEsMap({ edgeSettingsData })

    // gety what we need to add to the datamap for ghost vertices
    as.generateGhosts({ edge, dataMap, vertex })

    // add these into the data as if they always existed
    for (let d of dataMap.values()) {
      d.data = d.data.concat(d.ghosts)
    }

    // an array item for each edge
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
        dataSources,
        edgeGhosts
      } = edge


      if (!dataSources) {
        hs.logThrow(`Missing dataSources for edge ${edge.edge} - check they are accurately named in the config and have an associated question`)
      }

      // see if there's a transformer needed
      const transformer = as.getEdgeTransformer({ edge, transformerMap })

      // this applies to the item so we can do it now
      // this'll be the extra column applied if there's a transformer
      const transformProp = transformer && transformer.name

      // edgesettings could be dynamic
      const es = as.getEdgeSettings(edge)

      // now circle on the data sets
      for (let d of dataMap.values()) {
        const { data, headerSet, alias } = d

        // we have an link into each dataset for each vertex
        const ds = dataSources.get(alias)
        if (!ds) hs.logThrow(`Couldn't establish data source for ${edge.alias} in dataset ${alias}`)

        // pick up the column names for the required items
        const vsd = as.getVertexItem(vertex, edgeSource, edge.alias, alias)
        const vtd = as.getVertexItem(vertex, edgeTarget, edge.alias, alias)
        const vxd = as.getVertexItem(vertex, 'id-alias', edge.alias, alias)

        // find the placehoder in the grid question
        const { question } = ds
        if (!question)
          hs.logThrow(`question text not found in data source ${alias} for ${vtd.item.alias}`)

        const rx = new RegExp(`\\[${vtd.item.alias}\\]`)
        if (!rx.test(question.questionText) && edgeType !== 'virtual-grid')
          hs.logThrow(`couldnt find placeholder [${vtd.item.alias}] in ${question.questionText}`)

        // from vertex to vertex mappings


        data.forEach((sourceRow) => {
          const source = as.applyHashing(sourceRow[vsd.question.questionText], vsd.item)
          const vertex1 = as.applyHashing(sourceRow[vxd.question.questionText], vxd.item)

          // now compare with ever other person in the data
          data.forEach((targetRow) => {

            // this is to extract the question that identifies the target
            // so it'll be something like how to like [food]
            // in this case the target is 'food'
            const target = as.applyHashing(targetRow[vtd.question.questionText], vtd.item)

            // check to avoid self loop
            if (!(u.isSheetsNU(source) || u.isSheetsNU(target)) && (source !== target || edgeLoopAllow)) {

              // now we need to figure out the grid matching 
              // the question text should contain something like ... [name]

              const targetQuestion = question.questionText.replace(rx, `[${target}]`)

              // in the case of a virtual grid we need to loop through every possible answer
              // TODO
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

                const transformEdgeValues = ({ edgeType, sourceValue, transformer, source }) => {
                  const hs = Exports.Helpers
                  const as = Exports.AppStore

                  const transform = (({ value }) =>
                    as.execTransformer({ transformer, value, source }))

                  const clean = (items) => items.map(f => f && f.trim())
                    .filter(f => !u.isSheetsNU(f))

                  // multi-grid values could be comma separated
                  // and these need to be expanded into separate edges
                  switch (edgeType) {
                    case "multi-grid":
                      return clean(sourceValue.split(",")).map(value => transform({ value }))

                    case "grid":
                      return clean([sourceValue]).map(value => transform({ value }))

                    case "virtual-grid":
                      // we'll have a target like 'twitter'
                      // and the source will be rapidly changing
                      // so we need an edge for each pair

                      console.log('the target/source/question is', target, source, question)
                      return []
                      break

                    default:
                      hs.logThrow(`Unknown edge-type ${edgeType}`)
                  }
                }

                const values = transformEdgeValues({ edgeType, sourceValue, transformer, source })


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
                  if (transformProp) {
                    // it's possible we have multiple transform output values
                    const tvs = u.isString(transformed) ? transformed.split(":"): [transformed]
                    // the first is the main one
                    const [tv] = tvs
                    model[transformProp] = tv
                    // if there are more, we need to add extra columns
                    tvs.slice(1).forEach ((f,i)=>model[`${transformProp}:${i+1}`] = f)
                  }

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
                        Exports.Helpers.logThrow(`edge-weight ${edgeWeight} missing for ${edge.alias} - is your transformer  ${edgeTransformer} wrong?`)

                      const w = model[edgeWeight]
                      if (!isFinite(w))
                        Exports.Helpers.logThrow(`edge-weight ${w} is not a valid number for ${source} in ${edge.alias}`)

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
                      if (!label) Exports.Helpers.logThrow(`Cant make ${edgeLabel} for ${vertex1}:${vertex2}`)
                      model.Label = dataMap.size > 1 ? label + '-' + alias : label
                    }
                    let esSpread = {}
                    if (es.edgeSettings) {
                      // if dynamic, uses the value rather than the name directly
                      const spreadName = es.dynamic ? model[es.edgeSettings] : es.edgeSettings

                      //TODO ??handle non responses - TODO should this be 'default?'

                      // now get that from known edgesettings
                      esSpread = esMap.get(spreadName)
                      if (!esSpread) Exports.Helpers.logThrow(`couldn't find edge-settings ${spreadName} for ${edge.alias}`)
                      if (Reflect.has(esSpread, edge.alias))
                        Exports.Helpers.logThrow(`${edge.alias} can't exist in both edge defaults and as an edge value - remove or set to empty in edge-defaults`)
                    }

                    // we can drop null transforms
                    p.push({ model, esSpread })
                  }

                })


              } else {

                // TODO decide what action to take if missing - for now I'm just ignoring
                as.writeLog(`For ${edge.alias}:${targetQuestion} is missing from dataset ${alias}`)
              }

            }
          })

        })

      }
      return p
    }, [])
  },

  // get vertex values from dataset
  makeVertexDataMap({ vertex, dataMap }) {
    const as = this
    const hs = Exports.Helpers
    return Array.from(vertex.values()).reduce((p, vertex) => {

      const { dataSources, vertexAddSource } = vertex
      if (!dataSources) {
        console.log('failed to find data sources for ', vertex)
        hs.logThrow(`Failed to find datasource definition for ${vertex && vertex.alias}`)
      }

      // for each data set, find the value for the current vertex
      Array.from(dataMap.values()).forEach(d => {

        const { data, headerSet, alias, idQuestionText, idItem } = d
        // we have an link into each dataset for each vertex
        const ds = dataSources.get(alias)
        if (!ds) hs.logThrow(`Couldn't establish data source for ${vertex.alias} in dataset ${alias}`)

        // this is how this particular vertex is known in the selected data set
        const { question } = ds
        if (!question)
          hs.logThrow(`question text not found in data source ${alias} for ${idItem.alias}`)

        // this is the rows of data from each of the data sources
        data.forEach((inputRow, i) => {
          // first get the alias value for this row

          const idAliasValue = as.applyHashing(inputRow[idQuestionText], idItem)
          if (!idAliasValue) hs.logThrow(`Missing id-alias value in row ${i + 1} of source ${alias}`)

          // we're making a map using the idalias of each row in the data set
          if (!p.get(idAliasValue)) {
            p.set(idAliasValue, {})
          }
          const rob = p.get(idAliasValue)

          // this may have been checked before, but just to double check 
          // that we didnt get lost somewhere
          // So the problem here is that if we've declared a // question with a ...[name] as a vertex it wont find that.
          // I think we need to not allow those kind of q's are vertices

          if (!headerSet.has(question.questionText)) {
            // but if its for a viertual edge... somethign special TODO
            console.log('missing question.questionText - the rob was', rob, 'for', idAliasValue)
            console.log('heres the array from header set', Array.from(headerSet.keys()))
            hs.logThrow(`check spelling-${question.questionText} not found in data source ${alias} for ${idItem.alias} at row ${i + 1}`)
          }
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
    const hs = Exports.Helpers
    return values
      .reduce((p, c) => {
        if (p.get(c.alias)) hs.logThrow(`duplicate ${entity} ${c.alias} found`)
        validate(c, entity)
        p.set(c.alias, c)
        return p
      }, new Map())
  },

  // get the data maps
  getDataMap(values) {
    const as = this
    const hs = Exports.Helpers
    return values.reduce((p, d) => {
      if (p.get(d.alias)) hs.logThrow(`duplicate data-alias ${d.alias} found`)
      try {
        as.toast(`from ${d.dataId}: ${d.dataSheet}`, "Getting Data", 4)
        let fiddler = null
        try {
          fiddler = as.externalFiddler({
            id: d.dataId,
            sheetName: d.dataSheet,
            createIfMissing: false
          })
        }
        catch (err) {
          hs.logThrow(
            "Couldnt to open data sheet ${d.dataSheet}"
          )
        }


        p.set(d.alias, {
          fiddler,
          headers: fiddler.getHeaders(),
          data: fiddler.getData(),
          alias: d.alias,
          headerSet: new Set(fiddler.getHeaders())
        })
      }
      catch (err) {
        hs.logThrow(`couldnt open sheet ${d.dataSheet} ${err}`)
      }
      return p
    }, new Map())


  },

  addIdQuestions(dataMap) {
    const as = this
    const hs = Exports.Helpers
    //--- find the id item for each dataset to avoid doing it loads of times later
    for (let ds of dataMap.values()) {
      const idFind = ds.items && ds.items.find(f => f.item.alias === 'id-alias')
      if (!idFind) hs.logThrow(`Couldn't find id-alias in data source ${ds.alias}`)
      const { item: idItem, question: idQuestion } = idFind
      const { questionText: idQuestionText } = idQuestion
      if (!ds.headerSet.has(idQuestionText))
        hs.logThrow(`${idQuestionText} not found in data source ${ds.alias} for ${idItem.alias}`)
      ds.idQuestionText = idQuestionText
      ds.idItem = idItem
    }
  },

  getVertexItem(vItems, name, edge, dsAlias) {
    const vSource = vItems.get(name)
    const hs = Exports.Helpers
    if (!vSource) hs.logThrow(`Missing vertex ${name} for edge ${edge}`)
    const vd = vSource.dataSources.get(dsAlias)
    if (!vd) hs.logThrow(`Missing datasource ${dsAlias} for vertex ${name} at edge ${edge}`)
    return vd
  },
  //----end of ingestion-----------------------------------------------------
};