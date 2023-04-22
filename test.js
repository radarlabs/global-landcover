const gdal = require("gdal-async")
const dataset = gdal.open("source.tif")

console.log("number of bands: " + dataset.bands.count())
console.log("width: " + dataset.rasterSize.x)
console.log("height: " + dataset.rasterSize.y)
console.log("geotransform: " + dataset.geoTransform)
console.log("srs: " + (dataset.srs ? dataset.srs.toWKT() : 'null'))
