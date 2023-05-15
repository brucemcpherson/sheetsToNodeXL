
/**
 * some usefule fromts for fiddler
 * this  needs spreadsheet scopes,whereas fiddler is dependency free
 */
function PreFiddler() {
  
  const getss = ({ id }) => {
    return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet()
  }

  // open a sheet
  const getSheet = ({ id, sheetName, createIfMissing = false }) => {

    const ss = getss({ id })
    let sheet = ss.getSheetByName(sheetName)
    if (!sheet && createIfMissing) {
      sheet = ss.insertSheet(sheetName)
    }
    return sheet
  }

  // open a fiddler and assign a sheet
  const getFiddler = ({ id, sheetName, createIfMissing, respectFilter = false, respectHidden = false }) => {
    return new Exports.Fiddler(getSheet({ id, sheetName, createIfMissing }))
      .setRespectFilter(respectFilter)
      .setRespectHidden(respectHidden)
  }

  return {
    getFiddler,
    getSheet,
    getss
  }

}
