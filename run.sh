# !/bin/bash

set -ex

# download data
if [ ! -d "./data" ]; then
  echo "Downloading ESA data"
  mkdir ./data
  aws s3 --no-sign-request --no-progress sync s3://esa-worldcover/v200/2021/map ./data
else
  echo "Data exists, skipping download."
fi

# download any existing output data
# (to pickup on a previous run)
mkdir -p ./output/geojson
aws s3 --no-progress sync s3://$S3_BUCKET/landcover/geojson/ ./output/geojson/

# run node script to parse GeoTIFF images -> GeoJSON
node --max-old-space-size=8192 main.js \
  --layers forest,shrub,grass,crop,snow \
  --parallel $PARALLEL \
  --verbose --debug

# upload data to S3
aws s3 sync ./output/geojson/ s3://$S3_BUCKET/landcover/geojson/

# combine all geojson files into single file
# (filters out empty files)
cat ./output/geojson/* > ./output/global_landcover.geojson

# create tiles from geojson output
tippecanoe -Z 0 -z 8 -P -pf -ac -aN -aD -f -M 100000 -l global_landcover -o ./output/global_landcover.mbtiles ./output/global_landcover.geojson

# upload data to S3
aws s3 cp ./output/global_landcover.mbtiles s3://$S3_BUCKET/tiles/
