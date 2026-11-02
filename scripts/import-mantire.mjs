import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RATE = 1.30;
const verifiedAt = '2026-10-26';
const fixText = (value = '') => String(value)
  .replaceAll('Â', '').replaceAll('Ã—', '×').replaceAll('â€™', '’')
  .replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'")
  .replace(/\s+/g, ' ').trim();
const stripHtml = html => fixText(String(html || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, ' '));
const field = (html, labels) => {
  const items = [...String(html || '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(x => stripHtml(x[1]));
  for (const label of labels) {
    const hit = items.find(x => new RegExp(`^${label}\\b`, 'i').test(x));
    if (hit) return fixText(hit.replace(new RegExp(`^${label}\\s*[:\-]?\\s*`, 'i'), '')) || null;
  }
  return null;
};
const metres = value => {
  const match = String(value || '').match(/(\d+(?:\.\d+)?)\s*(?:m|meter|metre)/i);
  return match ? Number(match[1]) : null;
};
const classifyPattern = (title, raw) => {
  const text = `${raw || ''} ${title}`.toLowerCase();
  if (text.includes('windowpane') || text.includes('gingham') || text.includes('check')) return 'Check';
  if (text.includes('stripe') || text.includes('lining')) return 'Stripe';
  if (text.includes('jacquard')) return 'Jacquard';
  if (text.includes('dobby') || text.includes('dotted')) return 'Dobby';
  if (text.includes('print')) return 'Printed';
  if (text.includes('slub')) return 'Slub';
  if (text.includes('tweed')) return 'Tweed';
  if (text.includes('textur')) return 'Textured';
  if (text.includes('plain') || text.includes('matti')) return 'Plain';
  return raw ? fixText(raw) : null;
};
const uniqueBy = (items, key) => [...new Map(items.map(x => [x[key], x])).values()];

const sourceFiles = [1, 2, 3, 4].map(n => path.join(os.tmpdir(), `mantire-raymond-${n}.json`));
const rawProducts = sourceFiles.flatMap(file => JSON.parse(fs.readFileSync(file, 'utf8')).products || []);
const unique = uniqueBy(rawProducts, 'id');
const products = unique.map(product => {
  const variants = (product.variants || []).map(v => ({
    id: String(v.id), title: fixText(v.title), sku: fixText(v.sku) || null,
    lengthMeters: metres(v.option1 || v.title), sourcePriceINR: Number(v.price),
    sourceOriginalPriceINR: v.compare_at_price ? Number(v.compare_at_price) : null,
    isAvailable: Boolean(v.available)
  }));
  const selected = variants.find(v => v.isAvailable) || variants[0] || {};
  const title = fixText(product.title);
  const fabric = field(product.body_html, ['Fabric', 'Material', 'Composition']);
  const colour = field(product.body_html, ['Colour', 'Color']);
  const patternRaw = field(product.body_html, ['Pattern', 'Pattran', 'Design']);
  const width = field(product.body_html, ['Width']);
  const length = selected.lengthMeters || metres(field(product.body_html, ['Length'])) || null;
  const sourcePrice = Number(selected.sourcePriceINR);
  const sourceOriginal = Number(selected.sourceOriginalPriceINR) || null;
  const pricingBasis = /any length|cut to order/i.test(title) ? 'variableLength' : 'fixedCut';
  const tags = (product.tags || []).map(fixText);
  const images = (product.images || []).map(x => x.src).filter(Boolean);
  const description = stripHtml(product.body_html).slice(0, 600) || null;
  return {
    id: `mantire-${product.id}`,
    slug: product.handle,
    name: title,
    brand: fixText(product.vendor) || 'Raymond',
    category: fixText(product.product_type) || 'Fabric',
    fabricType: fabric,
    composition: fabric,
    colour,
    pattern: classifyPattern(title, patternRaw),
    fabricWidth: width,
    availableLengthMeters: [...new Set(variants.map(v => v.lengthMeters).filter(Boolean))],
    sourceListedLengthMeters: length,
    sourcePriceINR: sourcePrice,
    sourceOriginalPriceINR: sourceOriginal,
    convertedPriceBDT: Math.round(sourcePrice * RATE),
    convertedOriginalPriceBDT: sourceOriginal ? Math.round(sourceOriginal * RATE) : null,
    pricePerMeterBDT: pricingBasis === 'fixedCut' && length ? Math.round((sourcePrice * RATE / length) * 100) / 100 : null,
    pricePerYardBDT: pricingBasis === 'fixedCut' && length ? Math.round((sourcePrice * RATE / length * .9144) * 100) / 100 : null,
    pricingBasis,
    productCode: selected.sku || null,
    imageUrl: images[0] || null,
    additionalImageUrls: images.slice(1),
    sourceProductUrl: `https://mantire.in/products/${product.handle}`,
    sourceName: 'ManTire',
    sourceVerifiedAt: verifiedAt,
    publishedAt: product.published_at || null,
    isAvailable: variants.some(v => v.isAvailable),
    isFeatured: false,
    isLuxury: tags.some(t => /luxury/i.test(t)) || /luxury|exotic|regio italia|chairman/i.test(title),
    description,
    careInstructions: null,
    variants
  };
});

const duplicateCount = rawProducts.length - unique.length;
const invalid = products.filter(p => !p.id || !p.name || !p.sourceProductUrl || !Number.isFinite(p.sourcePriceINR));
const report = {
  generatedAt: verifiedAt,
  source: 'ManTire public Shopify Raymond collection feed',
  sourceEndpoint: 'https://mantire.in/collections/raymond/products.json',
  pagesProcessed: 4,
  totalRecordsProcessed: rawProducts.length,
  validProductRecords: products.length - invalid.length,
  duplicateRecords: duplicateCount,
  productsWithPrimaryImages: products.filter(p => p.imageUrl).length,
  workingSourceImageUrls: new Set(products.flatMap(p => [p.imageUrl, ...p.additionalImageUrls].filter(Boolean))).size,
  missingPrimaryImages: products.filter(p => !p.imageUrl).length,
  missingPrices: products.filter(p => !Number.isFinite(p.sourcePriceINR)).length,
  missingLengths: products.filter(p => !p.sourceListedLengthMeters).length,
  invalidCurrencyConversions: products.filter(p => !Number.isFinite(p.convertedPriceBDT) || p.convertedPriceBDT <= 0).length,
  excludedRecordIds: invalid.map(p => p.id),
  notes: ['One catalogue record represents one Shopify product; all variants and listed lengths are retained inside that record.', 'All image URLs come directly from the public product feed.', 'INR values are preserved and BDT values use the configured 1.30 demonstration rate.']
};

fs.writeFileSync('dist/data/products.json', JSON.stringify(products.filter(p => !invalid.includes(p)), null, 2) + '\n');
fs.writeFileSync('data-validation-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
