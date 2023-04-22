# Global Landcover
This repo contains scripts for generating tilesets from the ESA Worldcover dataset.
* [Data](https://esa-worldcover.org/en/data-access)
* [User Manual](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/docs/WorldCover_PUM_V2.0.pdf)

## Installation
#### Install gdal-async with shared libs
```bash
$ npm install gdal-async --build-from-source --shared_gdal
```

## Usage
```
$ node main.js <options>

  -h, --help               Display the usage guide.
  --layers type            Comma-separated list of layers to include in the
                           output. Available values are:
                           forest,shrub,grass,crop,built,bare,snow,water,wetland,mangroves,moss.
                           Defaults to all.
  -t, --threshold number   Threshold used for GDAL sieve operation (in pixels).
                           Defaults to 2048.
  -s, --simplify number    Polygon simplification tolerance (in degrees).
                           Defaults to 0.01
  -p, --parallel number    Number of worker processes to run.
                           Defaults to #CPUs/2.
  -v, --verbose            More detailed logging.
```

## Output

Output is 1.4 GB of GeoJSON, with ~3.4M features.

Converted to `.mbtiles` with a max tilesize of 500K is 270MB.

![image](https://user-images.githubusercontent.com/814934/233757099-c9c8e181-428d-4431-9f93-0c83d61485cf.png)

