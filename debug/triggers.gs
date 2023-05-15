// This uses a library for most of the work
// in here is just the trigger and the local specifics that you may want to customize
const Stub = (() => {
  return {
    execute: () => {
      Exports.Setup()
      Init.start()
      Exports.AppStore.execute()
    },
    dump: () => {
      Exports.Setup()
      Init.start()
      Exports.AppStore.dumpToDrive()
    }
  }
})()

const execute = () => Stub.execute()
const dump = () => Stub.dump()

const onOpen = (e) => {
  const ui = SpreadsheetApp.getUi()
    .createMenu('NodeXL')
    .addItem('Ingest data', 'execute')
    .addItem('Export graphml', 'dump')
    .addToUi();
  
  allSheetNames()
  return ui

}

/**
 * get the sheet names in a workbook that match the rx string passed
 * @param {string} [rxstring="^config"] a regex string to pick certain sheets
 * @return {string[]} all the sheetnames in the ss
 * @customfunction
*/
function allSheetNames(rxconfig = "^config") {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  if (!ss) return []
  const rx = new RegExp(rxconfig, "i")
  const result = ss.getSheets().map(f => f.getName()).filter(f => rx.test(f))
  return result
}


const Init = (() => {

  // use this to configure once off
  // makesure script/setup is run

  const configure = () => {
    // shortcut
    const as = Exports.AppStore;
    as.stubVersion = 'stub.1.0.0.rc2.apr.2023'


    const ss = SpreadsheetApp.getActiveSpreadsheet()
    const configId = ss && ss.getId() 

    // selected configuration
    // this will allow multiple configurations to co-exist
    as.selectedConfiguration = 'alpha'
    as.initConfigurations(configId)

  }


  return {
    start: () => {
      configure()
      Exports.AppStore.patchConfiguration()
    }
  }

})()





