
  // these are the non specific parameters for all docs/users of this app
  const Setup = () => {

    // shortcut
    const as = Exports.AppStore;

    // before starting,clear ll existing values to ensure we have a clean start
    as.clearMemory();

    // vthis can be used to validate that setup has been run
    as.projectVersion = 'lib.1.0.0.rc9.may.2023'
  
    // these are the template settings for gml
    as.gmlTemplate = {
      keys: [
        { id: "V-Color", "for": "node", "attr.name": "Color", "attr.type": "string" },
        { id: "V-Shape", "for": "node", "attr.name": "Shape", "attr.type": "string" },
        { id: "V-Size", "for": "node", "attr.name": "Size", "attr.type": "string" },
        { id: "V-Opacity", "for": "node", "attr.name": "Opacity", "attr.type": "string" },
        { id: "V-Image File", "for": "node", "attr.name": "Image File", "attr.type": "string" },
        { id: "V-Visibility", "for": "node", "attr.name": "Visibility", "attr.type": "string" },
        { id: "V-Label", "for": "node", "attr.name": "Label", "attr.type": "string" },
        { id: "V-Label Fill Color", "for": "node", "attr.name": "Label Fill Color", "attr.type": "string" },
        { id: "V-Label Position", "for": "node", "attr.name": "Label Position", "attr.type": "string" },
        { id: "V-Tooltip", "for": "node", "attr.name": "Tooltip", "attr.type": "string" },
        { id: "V-Layout Order", "for": "node", "attr.name": "Layout Order", "attr.type": "string" },
        { id: "V-X", "for": "node", "attr.name": "X", "attr.type": "string" },
        { id: "V-Y", "for": "node", "attr.name": "Y", "attr.type": "string" },
        { id: "V-Locked?", "for": "node", "attr.name": "Locked?", "attr.type": "string" },
        { id: "V-Polar R", "for": "node", "attr.name": "Polar R", "attr.type": "string" },
        { id: "V-Polar Angle", "for": "node", "attr.name": "Polar Angle", "attr.type": "string" },
        { id: "V-Degree", "for": "node", "attr.name": "Degree", "attr.type": "int" },
        { id: "V-In-Degree", "for": "node", "attr.name": "In-Degree", "attr.type": "int" },
        { id: "V-Out-Degree", "for": "node", "attr.name": "Out-Degree", "attr.type": "int" },
        { id: "V-Betweenness Centrality", "for": "node", "attr.name": "Betweenness Centrality", "attr.type": "double" },
        { id: "V-Closeness Centrality", "for": "node", "attr.name": "Closeness Centrality", "attr.type": "double" },
        { id: "V-Eigenvector Centrality", "for": "node", "attr.name": "Eigenvector Centrality", "attr.type": "double" },
        { id: "V-PageRank", "for": "node", "attr.name": "PageRank", "attr.type": "string" },
        { id: "V-Clustering Coefficient", "for": "node", "attr.name": "Clustering Coefficient", "attr.type": "string" },
        { id: "V-Reciprocated Vertex Pair Ratio", "for": "node", "attr.name": "Reciprocated Vertex Pair Ratio", "attr.type": "string" },
        { id: "V-ID", "for": "node", "attr.name": "ID", "attr.type": "string" },
        { id: "V-Dynamic Filter", "for": "node", "attr.name": "Dynamic Filter", "attr.type": "string" },
        { id: "V-Add Your Own Columns Here", "for": "node", "attr.name": "Add Your Own Columns Here", "attr.type": "string" },
        { id: "E-Color", "for": "edge", "attr.name": "Color", "attr.type": "string" },
        { id: "E-Width", "for": "edge", "attr.name": "Width", "attr.type": "string" },
        { id: "E-Style", "for": "edge", "attr.name": "Style", "attr.type": "string" },
        { id: "E-Opacity", "for": "edge", "attr.name": "Opacity", "attr.type": "string" },
        { id: "E-Visibility", "for": "edge", "attr.name": "Visibility", "attr.type": "string" },
        { id: "E-Label", "for": "edge", "attr.name": "Label", "attr.type": "string" },
        { id: "E-Label Text Color", "for": "edge", "attr.name": "Label Text Color", "attr.type": "string" },
        { id: "E-Label Font Size", "for": "edge", "attr.name": "Label Font Size", "attr.type": "string" },
        { id: "E-Reciprocated?", "for": "edge", "attr.name": "Reciprocated?", "attr.type": "string" },
        { id: "E-ID", "for": "edge", "attr.name": "ID", "attr.type": "string" },
        { id: "E-Dynamic Filter", "for": "edge", "attr.name": "Dynamic Filter", "attr.type": "string" },
        { id: "E-Add Your Own Columns Here", "for": "edge", "attr.name": "Add Your Own Columns Here", "attr.type": "string" },
        { id: "E-Edge Weight", "for": "edge", "attr.name": "Edge Weight", "attr.type": "double" }
      ]
    }

    // default project color
    as.projectColor = {
      primaryColor: '#512DA8',
      secondaryColor: '#FF5722'
    }

  }

