// can test from here
const both = () => test.both()
const ingest = () => test.execute()
const dump = () => test.dump()

const test = (() => {

  // shortcut
  const as = Exports.AppStore;
  const hs = Exports.Helpers


  const dump = () => {

    Exports.Setup()
    // the source data for export 
    // will have been marked with 
    // its source configuration in its developermetadata
    // sheet so we must use that
    const fromMeta = true
    start(fromMeta)
    as.dumpToDrive()
  }

  const execute = () => {
    Exports.Setup()
    start()
    as.execute()
  }

  const both = () => {
    execute()
    dump()
  }

  const configure = () => {
    as.breaking = 2
    as.stubVersion = 'stub-2.rc6.Dec.2023- testing'
    const testConfig = hs.testConfig
    const configId = testConfig && testConfig.id
    if (!configId) throw 'need a test config'

    // selected configuration
    // this will allow multiple configurations to co-exist
    as.selectedConfiguration = 'alpha'
    as.initConfigurations(configId)

  }

  const start = (fromMeta) => {
    configure()
    Exports.AppStore.patchConfiguration(fromMeta)
  }
  return {
    both,
    execute,
    dump
  }
})()
