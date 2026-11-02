// Detailed geographic polygon definitions for realistic equirectangular Earth map
// Width: 2048, Height: 1024
// Longitude: -180 to +180 -> x = ((lon + 180) / 360) * 2048
// Latitude: +90 to -90 -> y = ((90 - lat) / 180) * 1024

function geoToPixel(lon, lat, w = 2048, h = 1024) {
  return [
    Math.round(((lon + 180) / 360) * w),
    Math.round(((90 - lat) / 180) * h)
  ];
}

console.log("London:", geoToPixel(-0.12, 51.5));
console.log("NYC:", geoToPixel(-74.0, 40.7));
console.log("Tokyo:", geoToPixel(139.7, 35.6));
console.log("Sydney:", geoToPixel(151.2, -33.8));
