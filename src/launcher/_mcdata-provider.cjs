/*
  Will replace the 'node_modules/minecraft-data/data.js'
  Our version adds:
    - dynamic version import
    - automatic gzip decompression "on-the-fly"
    - decompressed versions caching
  API is fully compatible with original 'node_modules/minecraft-data/data.js'
*/

/* eslint-disable */
const {readFileSync} = require("fs");
const {gunzipSync} = require("zlib");


function importVersionData(path) {
  try {
    const dataRaw = readFileSync(path);
    const data = gunzipSync(dataRaw, { level: 2 }).toString("utf-8");
    const dataJson = JSON.parse(data);
    return dataJson;
  }
  catch (error) {
    throw new Error("Cannot read version file '" + path + "'");
  }
}


module.exports = require("./_real-index")(importVersionData);
