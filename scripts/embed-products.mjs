import fs from 'node:fs';
const products = JSON.parse(fs.readFileSync('dist/data/products.json', 'utf8'));
fs.writeFileSync('dist/products-inline.js', `window.__RAYMOND_PRODUCTS__=${JSON.stringify(products)};\n`);
console.log(`Embedded ${products.length} products in dist/products-inline.js`);
