const DriveExports = {

    //--- all about drive exporting 
  exportDetails(resolved, configurationFiddler) {

    // open the spreadsheet id to get its parent
    const hs = Exports.Helpers
    const id = configurationFiddler.getSheet().getParent().getId()
    const ss = DriveApp.getFileById(id)
    if (!ss) hs.logThrow(`Couldn't open spreadhseet id ${id}`)

    // get the export data 
    const opn = resolved.output.values && resolved.output.values[0] && resolved.output.values[0].outputName
    if (!opn || !opn.toString) hs.logThrow(`unable to find proper output-name`)
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
    const as = Exports.AppStore
    const hs = Exports.Helpers
    const dd = this
    const u = Exports.Utils
    const { configurationFiddler } = as

    // this is to force output to local drive
    const forceRoot = true

    as.toast(
      `${as.getConfigToastie(configurationFiddler)}            ${as.getVersionToastie()}`,
      `Exporting to graphml`)

    //---- validate the config data has all it needs
    const resolved = as.prepareResolve(configurationFiddler)
    Reflect.ownKeys(resolved).forEach(k => as.validateAllThere(resolved[k]))

    // get the export data 
    const opn = resolved.output.values && resolved.output.values[0] && resolved.output.values[0].outputName
    if (!opn || !opn.toString) hs.logThrow(`unable to find proper output-name`)

    // get the drive parent 
    let parent = null
    let outputName = opn.toString()
    if (!forceRoot) {
      const result = dd.exportDetails(resolved, configurationFiddler)
      parent = result.parent
      if (!parent) hs.logThrow(`Couldn't find parent for ${outputName}`)
    }

    // render the whole thing
    const rendered = as.render(resolved)

    // write it out
    let p = null
    // perhaps you don't have write access to the config folder
    try {
      p = parent ? parent.createFile(outputName, rendered, 'application/graphml+xml') : DriveApp.createFile(outputName, rendered, 'application/graphml+xml')
    } catch (err) {
      if (parent) {
        as.toast("You dont have write access to the parent folder", "Writing to default Drive instead")
        p = DriveApp.createFile(outputName, rendered, 'application/graphml+xml')
      }
      else {
        hs.logThrow('was unable to write to your drive root')
      }
    }

    as.toast(
      `Created ${outputName} in Drive folder ${p.getParents().next().getName()}`,
      `Export complete`, 3)
    return p

  },
}
