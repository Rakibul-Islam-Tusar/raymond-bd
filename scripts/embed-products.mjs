import fs from 'node:fs';
const products = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));
fs.writeFileSync('products-inline.js', `window.__RAYMOND_PRODUCTS__=${JSON.stringify(products)};\n`);
console.log(`Embedded ${products.length} products in products-inline.js`);
