// DEAL HUNTER WORKER - clean build

const CORS_HEADERS = {
[`Access-Control-Allow-Origin`]: `*`,
[`Access-Control-Allow-Methods`]: `GET, OPTIONS`,
[`Access-Control-Allow-Headers`]: `*`
};

const BROWSER_HEADERS = {
[`User-Agent`]: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36`,
[`Accept`]: `text/html,application/xhtml+xml,application/xml`,
[`Accept-Language`]: `en-GB,en`
};

const EMPTY = ``;

const GLITCH_KEYWORDS = [
`price error`, `pricing error`, `glitch`, `mistake`, `incorrect price`,
`accidental`, `misprice`, `wrong price`, `priced at 1`, `0.01`,
`price glitch`, `error price`, `rrp mistake`
];

const EXCLUSION_KEYWORDS = [
`voucher code`, `cashback only`, `insurance`, `broadband`, `mobile contract`,
`sim only`, `hotel`, `flight`, `referral`, `newsletter`, `loyalty points`,
`free trial`, `subscription only`, `monthly payment`, `finance deal`
];

const RESALE_RETAILERS = {
amazon: { name: `Amazon`, trust: 4.2 },
currys: { name: `Currys`, trust: 3.8 },
argos: { name: `Argos`, trust: 3.9 },
johnlewis: { name: `John Lewis`, trust: 4.3 },
very: { name: `Very`, trust: 3.5 },
ao: { name: `AO`, trust: 4.4 },
ebay: { name: `eBay`, trust: 4.1 },
boots: { name: `Boots`, trust: 4.0 },
superdrug: { name: `Superdrug`, trust: 4.1 },
smyths: { name: `Smyths Toys`, trust: 4.2 },
costco: { name: `Costco`, trust: 4.5 },
nike: { name: `Nike`, trust: 3.7 },
adidas: { name: `Adidas`, trust: 3.8 },
scan: { name: `Scan`, trust: 4.3 },
ebuyer: { name: `Ebuyer`, trust: 4.2 },
overclockers: { name: `Overclockers`, trust: 4.4 },
next: { name: `Next`, trust: 4.2 },
asos: { name: `ASOS`, trust: 4.0 },
jdsports: { name: `JD Sports`, trust: 3.6 },
game: { name: `GAME`, trust: 3.7 },
zavvi: { name: `Zavvi`, trust: 4.0 },
hmv: { name: `HMV`, trust: 3.9 },
apple: { name: `Apple`, trust: 4.4 },
dunelm: { name: `Dunelm`, trust: 4.3 },
wayfair: { name: `Wayfair`, trust: 3.9 },
ikea: { name: `IKEA`, trust: 4.1 },
lookfantastic: { name: `Look Fantastic`, trust: 4.2 },
feelunique: { name: `Feelunique`, trust: 4.3 },
decathlon: { name: `Decathlon`, trust: 4.3 },
selfridges: { name: `Selfridges`, trust: 4.2 }
};

export default {
async fetch(request) {
if (request.method === `OPTIONS`) {
return new Response(null, { headers: CORS_HEADERS });
}

```
try {
  const hotRes = await fetch(`https://www.hotukdeals.com/rss/hot`, { headers: BROWSER_HEADERS, cf: { cacheTtl: 60 } });
  const newRes = await fetch(`https://www.hotukdeals.com/rss/new`, { headers: BROWSER_HEADERS, cf: { cacheTtl: 60 } });

  const hotXml = await hotRes.text();
  const newXml = await newRes.text();

  const hotItems = parseRssItems(hotXml).map(function (i) { i.source = `hot`; return i; });
  const newItems = parseRssItems(newXml).map(function (i) { i.source = `new`; return i; });

  const merged = [];
  const combined = hotItems.concat(newItems);
  for (let i = 0; i < combined.length; i++) {
    const item = combined[i];
    if (!item.link) continue;
    const existing = merged.find(function (m) { return m.link === item.link; });
    if (existing) {
      if (item.source === `hot`) existing.source = `hot`;
      continue;
    }
    merged.push(item);
  }

  const processed = [];
  for (let i = 0; i < merged.length; i++) {
    const p = processItem(merged[i]);
    if (p !== null) processed.push(p);
  }

  processed.sort(function (a, b) { return b.score - a.score; });

  const body = JSON.stringify({
    fetched: new Date().toISOString(),
    hotCount: hotItems.length,
    newCount: newItems.length,
    total: processed.length,
    deals: processed
  });

  const headers = {};
  headers[`Access-Control-Allow-Origin`] = `*`;
  headers[`Content-Type`] = `application/json; charset=utf-8`;
  headers[`Cache-Control`] = `public, max-age=30`;

  return new Response(body, { headers: headers });

} catch (err) {
  const errHeaders = {};
  errHeaders[`Access-Control-Allow-Origin`] = `*`;
  errHeaders[`Content-Type`] = `application/json`;
  return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: errHeaders });
}
```

}
};

function parseRssItems(xml) {
const items = [];
const itemRegex = /<item>([\s\S]*?)</item>/g;
let match;
while ((match = itemRegex.exec(xml)) !== null) {
const itemXml = match[1];
items.push({
title: extractTag(itemXml, `title`),
link: extractTag(itemXml, `link`) || extractTag(itemXml, `guid`),
description: extractTag(itemXml, `description`),
pubDate: extractTag(itemXml, `pubDate`)
});
}
return items;
}

function extractTag(xml, tag) {
const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`);
const m = xml.match(regex);
if (!m) return EMPTY;
let content = m[1];
content = content.replace(/^\s*<![CDATA[/, EMPTY).replace(/]]>\s*$/, EMPTY);
return content.trim();
}

function cleanText(text) {
return text
.replace(/^\d+\u00b0\s*-?\s*/, EMPTY)
.replace(/<[^>]+>/g, EMPTY)
.replace(/\u0026amp;/g, `\u0026`)
.replace(/\u0026lt;/g, `<`)
.replace(/\u0026gt;/g, `>`)
.replace(/\u0026quot;/g, `\u0022`)
.replace(/\u0026apos;/g, `\u0027`)
.replace(/\u0026#\d+;/g, EMPTY)
.replace(/\u0026[a-z]+;/g, EMPTY)
.replace(/\s+/g, ` `)
.trim();
}

function processItem(item) {
const titleClean = cleanText(item.title);
const descClean = item.description || EMPTY;
const fullTextLower = (titleClean + ` ` + descClean).toLowerCase();

const isGlitch = GLITCH_KEYWORDS.some(function (k) { return fullTextLower.indexOf(k) !== -1; });
const isExcluded = !isGlitch && EXCLUSION_KEYWORDS.some(function (k) { return fullTextLower.indexOf(k) !== -1; });
if (isExcluded) return null;

const fullText = titleClean + ` ` + descClean;
const temp = extractTemp(fullText);
const prices = extractPrices(fullText);
const discount = extractDiscount(fullText, prices);
const retailerInfo = extractRetailer(titleClean, descClean, item.link);
const externalLink = extractExternalLink(descClean);
const category = extractCategory(fullText);

if (!isGlitch) {
const rrp = prices.was || prices.now;
if (!rrp || rrp < 20) return null;
}

const time = new Date(item.pubDate || Date.now());
const ageMins = Math.floor((Date.now() - time.getTime()) / 60000);

let score = 0;
if (isGlitch) score += 500;

if (ageMins < 5) score += 150;
else if (ageMins < 15) score += 100;
else if (ageMins < 60) score += 50;
else if (ageMins < 240) score += 20;

if (discount >= 90) score += 100;
else if (discount >= 70) score += 50;
else if (discount >= 50) score += 25;
else if (discount >= 30) score += 10;

if (retailerInfo) {
if (retailerInfo.trust >= 4.0) score += 50;
else if (retailerInfo.trust < 3.0) score -= 50;
} else {
score -= 20;
}

score += Math.min(Math.floor(temp / 20), 50);

let alertLevel = `noise`;
if (score >= 600) alertLevel = `critical`;
else if (score >= 400) alertLevel = `high`;
else if (score >= 200) alertLevel = `medium`;

if (alertLevel === `noise` && !isGlitch) return null;

return {
id: item.link,
title: titleClean,
hotukLink: item.link,
externalLink: externalLink,
retailer: retailerInfo ? retailerInfo.name : null,
retailerTrust: retailerInfo ? retailerInfo.trust : null,
priceNow: prices.now,
priceWas: prices.was,
priceConfidence: prices.confidence,
discount: discount,
temp: temp,
category: category,
isGlitch: isGlitch,
source: item.source,
pubDate: time.toISOString(),
ageMins: ageMins,
score: score,
alertLevel: alertLevel
};
}

function extractTemp(text) {
const m = text.match(/(\d{2,4})\u00b0/);
return m ? parseInt(m[1]) : 0;
}

function extractPrices(text) {
const wasNow = text.match(/\u00a3([\d,]+(?:.\d{2})?)\s*(?\s*(?:was|RRP|rrp|instead of)\s*\u00a3([\d,]+(?:.\d{2})?)/i);
if (wasNow) {
const now = parseFloat(wasNow[1].replace(/,/g, EMPTY));
const was = parseFloat(wasNow[2].replace(/,/g, EMPTY));
if (now > 0 && was > 0 && was > now && was < now * 50) {
return { now: now, was: was, confidence: `high` };
}
}

const wasFirst = text.match(/was\s*\u00a3([\d,]+(?:.\d{2})?)[^\u00a3]{0,30}\u00a3([\d,]+(?:.\d{2})?)/i);
if (wasFirst) {
const was = parseFloat(wasFirst[1].replace(/,/g, EMPTY));
const now = parseFloat(wasFirst[2].replace(/,/g, EMPTY));
if (now > 0 && was > 0 && was > now && was < now * 50) {
return { now: now, was: was, confidence: `high` };
}
}

const two = text.match(/\u00a3([\d,]+(?:.\d{2})?)[^\u00a3]{0,20}\u00a3([\d,]+(?:.\d{2})?)/);
if (two) {
const a = parseFloat(two[1].replace(/,/g, EMPTY));
const b = parseFloat(two[2].replace(/,/g, EMPTY));
if (a > 0 && b > 0 && a !== b) {
const high = Math.max(a, b);
const low = Math.min(a, b);
if (high < low * 50) {
return { now: low, was: high, confidence: `medium` };
}
}
}

const single = text.match(/\u00a3([\d,]+(?:.\d{2})?)/);
if (single) {
return { now: parseFloat(single[1].replace(/,/g, EMPTY)), was: null, confidence: `low` };
}

return { now: null, was: null, confidence: `none` };
}

function extractDiscount(text, prices) {
const m = text.match(/(\d{2,3})%\s*off/i) || text.match(/save\s+(\d{2,3})%/i);
if (m) {
const pct = parseInt(m[1]);
if (pct <= 100) return pct;
}
if (prices.now && prices.was && prices.was > prices.now) {
return Math.round(((prices.was - prices.now) / prices.was) * 100);
}
return 0;
}

function extractRetailer(title, desc, link) {
const hay = (title + ` ` + desc + ` ` + (link || EMPTY)).toLowerCase();
const keys = Object.keys(RESALE_RETAILERS);
for (let i = 0; i < keys.length; i++) {
if (hay.indexOf(keys[i]) !== -1) return RESALE_RETAILERS[keys[i]];
}
try {
const url = new URL(link);
const host = url.hostname.replace(`www.`, EMPTY);
if (host.indexOf(`hotukdeals`) === -1) {
const parts = host.split(`.`);
const brand = parts.length >= 2 ? parts[parts.length - 2] : host;
if (brand.length >= 3) {
return { name: brand.charAt(0).toUpperCase() + brand.slice(1), trust: null };
}
}
} catch (e) { }
return null;
}

function extractExternalLink(desc) {
const hrefRegex = /href=[\u0022\u0027]([^\u0022\u0027]+)[\u0022\u0027]/g;
let m;
while ((m = hrefRegex.exec(desc)) !== null) {
const link = m[1];
if (link.indexOf(`http`) === 0 && link.indexOf(`hotukdeals`) === -1) return link;
}
return null;
}

function extractCategory(text) {
const cats = {
Electronics: [`tv`, `laptop`, `headphones`, `speaker`, `tablet`, `phone`, `camera`, `monitor`],
Gaming: [`playstation`, `ps5`, `ps4`, `xbox`, `nintendo`, `switch`, `gaming`],
Toys: [`lego`, `toy`, `kids`, `children`, `barbie`, `doll`, `figure`],
Fashion: [`trainers`, `shoes`, `jacket`, `coat`, `dress`, `jeans`, `nike`, `adidas`],
Beauty: [`perfume`, `fragrance`, `makeup`, `skincare`, `cream`, `lipstick`],
Watches: [`watch`, `rolex`, `seiko`, `casio`, `tissot`],
Computing: [`ssd`, `gpu`, `cpu`, `ram`, `keyboard`, `mouse`, `desktop`],
Home: [`vacuum`, `dyson`, `kettle`, `iron`, `bedding`, `towel`]
};
const lower = text.toLowerCase();
const keys = Object.keys(cats);
for (let i = 0; i < keys.length; i++) {
const cat = keys[i];
const kws = cats[cat];
for (let j = 0; j < kws.length; j++) {
if (lower.indexOf(kws[j]) !== -1) return cat;
}
}
return `General`;
}
