var Exports = {

  get Memory (){
    return Memory
  },

  /**
   * Memory instance with validation
   * @param {...*} args
   * @return {Memory} a proxied instance of Memory with property checking enabled
   */
  newMemory(...args) {
    return this.guard ( new this.Memory(...args))
  },

  /**
   * StorePack namespace
   * @return {StorePack} 
   */
  get StorePack() {
    return StorePack
  },

  /**
   * DeveloperData object proxy
   * @return {DeveloperData}
   */
  get DeveloperData() {
    return this.guard(DeveloperData)
  },

  /**
   * AppStore object proxy
   * @return {AppStore}
   */
  get AppStore() {
    return this.guard(AppStore)
  },

  /**
   * AppStore object proxy
   * @return {AppStore}
   */
  get Init() {
    return this.guard(Init)
  },




  /**
   * Utils namespace
   * @return {Utils} 
   */
  get Utils() {
    return this.guard(Utils)
  },

  /**
   * @class XmlWrapper
   * @return {XmlWrapper} 
   */
  get XmlWrapper() {
    return XmlWrapper
  },

  /**
   * @implements HtmlEncoder
   * @return {HtmlEncoder} 
   */
  get HtmlEncoder() {
    return this.guard(HtmlEncoder)
  },

  /**
   * @class AnyMl
   * @return {AnyMl} 
   */
  get AnyMl () {
    return AnyMl
  },

  /**
   * basic general setup
   */
  get Setup() {
    return Setup
  },

  /**
   * hive off some of the appstore stuff
   */
  get Helpers() {
    return this.guard(Helpers)
  },

  /**
   * hive off some of the appstore stuff
   */
  get DriveExports() {
    return this.guard(DriveExports)
  },

  /**
   * Gml Extension namespace example
   * @return {Proxy} 
   */
  get Gml() {
    return this.guard(Gml)
  },

  /**
   * Html Extension namespace example
   * @return {Proxy} 
   */
  get Html() {
    return this.guard(Html)
  },

  /**
   * @implements AnyMl
   * @return {Proxy} 
   */
  newAnyMl(...args) {
    return this.guard(new this.AnyMl(...args))
  },

  /**
   * @implements XmlWrapper
   * @return {XmlWrapper} 
   */
  newXmlWrapper(...args) {
    return this.guard(new this.XmlWrapper(...args))
  },

  get PreFiddler () {
    return PreFiddler
  },

  get Fiddler () {
    return Fiddler
  },


  newPreFiddler(...args) {
    return this.guard(Exports.PreFiddler().getFiddler(...args))
  },

  // used to trap access to unknown properties
  guard(target) {
    return new Proxy(target, this.validateProperties)
  },


  /**
   * for validating attempts to access non existent properties
   */
  get validateProperties() {
    return {
      get(target, prop, receiver) {
        // typeof and console use the inspect prop
        if (
          typeof prop !== 'symbol' &&
          prop !== 'inspect' &&
          !Reflect.has(target, prop)
        ) throw `guard detected attempt to get non-existent property ${prop}`

        return Reflect.get(target, prop, receiver)
      },

      set(target, prop, value, receiver) {
        if (!Reflect.has(target, prop)) throw `guard attempt to set non-existent property ${prop}`
        return Reflect.set(target, prop, value, receiver)
      }
    }
  }

}





