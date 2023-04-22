const path = require('path');
const fs = require('fs');
const gdal = require('gdal-async');
const config = require('./config');

// band values for ESA Landcover images
// https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/docs/WorldCover_PUM_V2.0.pdf
const BAND_VALUES = {
  forest: 10,
  shrub: 20,
  grass: 30,
  crop: 40,
  built: 50,
  bare: 60,
  snow: 70,
  water: 80,
  wetland: 90,
  mangroves: 90,
  moss: 100,
}

// dont process if GeoJSON file exists
const existingFiles = fs.readdirSync('./output/geojson');

// takes a GeoTIFF input file and convert to vector (GeoJSONSeq)
const processFile = async (inputFile) => {
  const filename = path.basename(inputFile, '.tif');
  const outputFile = `./output/geojson/${filename}.geojson`;

  if (existingFiles.includes(`${filename}.geojson`)) {
    console.log(`  Skipping ${filename}, geojson exists`);
    return;
  }

  const start = Date.now();
  if (config.debug) {
    console.log('Starting file', filename, 'with config:', config);
  } else if (config.verbose) {
    console.log('Starting file', filename);
  }

  let inputDataset, sieveDataset, tempDataset, geojsonDataset;
  const sieveFile = `./output/sieve/${filename}-sieve.tif`;
  let error;

  try {

    // open the input raster file
    inputDataset = await gdal.openAsync(inputFile);
    const inputBand = inputDataset.bands.get(1);
    const srs = inputDataset.srs;
    const noDataValue = inputBand.noDataValue;
    const [width, height] = [inputDataset.rasterSize.x, inputDataset.rasterSize.y];

    // create an intermediate file for the sieved data, to reduce noise by filtering out small features
    // (configurable with the --threshold flag)
    const sieveDriver = gdal.drivers.get('GTiff');
    sieveDataset = await sieveDriver.createAsync(sieveFile, width, height, 1, inputBand.dataType);
    sieveDataset.geoTransform = inputDataset.geoTransform;
    sieveDataset.srs = inputDataset.srs;
    const sieveBand = sieveDataset.bands.get(1);
    sieveBand.noDataValue = noDataValue;

    // perform sieve operation
    await gdal.sieveFilterAsync({
      src: inputBand,
      dst: sieveBand,
      threshold: config.threshold,
    });

    // create temporary memory driver to write polygonized data
    const driver = gdal.drivers.get('Memory');
    tempDataset = driver.create(`${filename}.tmp`); // filename is required

    // create the temporary vector layer
    const tempLayer = tempDataset.layers.create('polygons', srs, gdal.wkbPolygon);
    tempLayer.fields.add(new gdal.FieldDefn('band', gdal.OFTInteger));

    // polygonize the raster to create features
    await gdal.polygonizeAsync({
      src: sieveBand,
      dst: tempLayer,
      pixValField: 0,
      connectedness: 8,
    });

    // create a new GeoJSONSeq dataset
    const geojsonDriver = gdal.drivers.get('GeoJSONSeq');
    geojsonDataset = geojsonDriver.create(outputFile, 0, 0, 0, gdal.GDT_Unknown);
    const outputLayer = geojsonDataset.layers.create('global_landcover', srs, gdal.wkbPolygon);
    outputLayer.fields.add(new gdal.FieldDefn('class', gdal.OFTString));

    // only use layers as specified in config
    const layerMap = config.layers.reduce((map, layer) => {
      const bandValue = BAND_VALUES[layer];
      map[bandValue] = layer;
      return map;
    }, {});

    const counts = {};
    const ignored = { empty: 0, skipped: 0 };

    // iterate over each vector feature
    tempLayer.features.forEach((feature) => {
      const band = feature.fields.get('band');
      const layer = layerMap[band];

      // if band is one of the configured layers,
      // add feature to output
      if (layer) {
        const newGeometry = feature.getGeometry().simplify(config.simplify);
        if (!newGeometry.isEmpty()) {
          const newFeature = new gdal.Feature(outputLayer);
          newFeature.setGeometry(newGeometry);
          newFeature.fields.set('class', layer);
          outputLayer.features.add(newFeature);
          counts[layer] = (counts[layer] || 0) + 1;
        } else {
          ignored.empty++;
        }
      } else {
        ignored.skipped++;
      }
    });

    // verbose logging of file details
    if (config.verbose) {
      const completedIn = (Date.now() - start) / 1000;
      console.log(`${filename} (${completedIn} seconds):`);
      Object.keys(counts).forEach((layer) => {
        console.log('  ', `${layer}:`, counts[layer], 'features');
      });
      console.log('  ', 'empty:', ignored.empty);
      console.log('  ', 'skipped:', ignored.skipped);
    }

    // flush the cache to ensure data is written to disk
    await geojsonDataset.flushAsync();

  } catch (err) {
    console.log(`Error for ${filename}:`, err);
    error = err; // throw after cleanup

  } finally {
    // close the datasets
    inputDataset.close();
    sieveDataset.close();
    tempDataset.close();
    geojsonDataset.close();

    // cleanup intermediate sieve image to save space
    if (fs.existsSync(sieveFile)) {
      if (config.debug) {
        console.log('  ', 'cleaning up', sieveFile);
      }
      fs.unlinkSync(sieveFile);
    }

    if (error) {
      throw error;
    }
  }
}

module.exports = processFile;
