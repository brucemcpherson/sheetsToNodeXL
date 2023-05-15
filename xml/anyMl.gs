/**
 * @class AnyMl
 * for rendering markup content
 */
class AnyMl {

  /**
   * @constructor
   * @param {object} p params
   * @param {XmlItem} p.root the markup root
   */
  constructor({ root }) {
    this.root = root
  }

  /**
   * this is the parent item for a complete markup rendering
   * @param {XmlItem[]} children the content
   * @param {number} [indent=2] number of spaces to indent each children content by
   * @return {string} the rendered string
   */
  render({ children, indent } = {}) {
    return Exports.newXmlWrapper({ root: this.root })
      .render({ children, indent })
  }

}

