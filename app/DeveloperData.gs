const DeveloperData = (() => {

  const clearDob = (dob, key = null) => {

    developerMetaDataList = key ? findDob(dob, key) : dob.getDeveloperMetadata()
    for (const developerMetaData of developerMetaDataList) {
      developerMetaData.remove()
    }
  }

  const setDob = (dob, key, value) => {
    // get rid of any existing matching keys
    clearDob(dob, key)

    // always expect an ob
    const str = JSON.stringify(value)

    // register this value against this dob
    dob.addDeveloperMetadata(key, str, SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT)

    // check we can find it again
    const current = getDob (dob,key)
    if (!current) throw 'failed to find just written metadata with key ' + key
    return current
  }

  const getDob = (dob, key) => {
    // check we can find it again
    const [current] = findDob(dob, key)
    return current ? JSON.parse(current.getValue()) : null
  }

  const findDob = (dob, key) => {
    const metadatafinder = dob.createDeveloperMetadataFinder();
    return metadatafinder
      .withKey(key)
      .find()
  }

  return {
    setDob,
    findDob,
    clearDob,
    getDob
  }


})()