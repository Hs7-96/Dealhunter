// DEAL HUNTER WORKER v2 - multi-source, no filtering, frontend controls

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*"
};

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml,application/json",
  "Accept-Language": "en-GB,en"
};

const GLITCH_KEYWORDS = [
  "price error","pricing error","glitch","mistake","incorrect price",
  "accidental","misprice","wrong price","priced at 1","0.01",
  "price glitch","error price","rrp mistake"
];

const EXCLUSION_CATEGORIES = {
  voucher: ["voucher code","cashback only","referral","loyalty points"],
  service: ["insurance","broadband","mobile contract","sim only"],
  travel: ["hotel","flight","holiday package"],
  subscription: ["free trial","subscription only","monthly payment","finance deal"],
  grocery: ["grocery","supermarket"]
};

const RESALE_RETAILERS = {
  amazon:{name:"Amazon",trust:4.2},
  currys:{name:"Currys",trust:3.8},
  argos:{name:"Argos",trust:3.9},
  johnlewis:{name:"John Lewis",trust:4.3},
  very:{name:"Very",trust:3.5},
  ao:{name:"AO",trust:4.4},
  ebay:{name:"eBay",trust:4.1},
  boots:{name:"Boots",trust:4.0},
  superdrug:{name:"Superdrug",trust:4.1},
  smyths:{name:"Smyths Toys",trust:4.2},
  costco:{name:"Costco",trust:4.5},
  nike:{name:"Nike",trust:3.7},
  adidas:{name:"Adidas",trust:3.8},
  scan:{name:"Scan",trust:4.3},
  ebuyer:{name:"Ebuyer",trust:4.2},
  overclockers:{name:"Overclockers",trust:4.4},
  next:{name:"Next",trust:4.2},
  asos:{name:"ASOS",trust:4.0},
  jdsports:{name:"JD Sports",trust:3.6},
  game:{name:"GAME",trust:3.7},
  zavvi:{name:"Zavvi",trust:4.0},
  hmv:{name:"HMV",trust:3.9},
  apple:{name:"Apple",trust:4.4},
  dunelm:{name:"Dunelm",trust:4.3},
  wayfair:{name:"Wayfair",trust:3.9},
  ikea:{name:"IKEA",trust:4.1},
  lookfantastic:{name:"Look Fantastic",trust:4.2},
  feelunique:{name:"Feelunique",trust:4.3},
  decathlon:{name:"Decathlon",trust:4.3},
  selfridges:{name:"Selfridges",trust:4.2},
  tesco:{name:"Tesco",trust:3.8},
  asda:{name:"ASDA",trust:3.7},
  sainsburys:{name:"Sainsbury's",trust:3.9},
  morrisons:{name:"Morrisons",trust:3.8},
  bm:{name:"B&M",trust:4.0},
  wilko:{name:"Wilko",trust:3.9},
  lidl:{name:"Lidl",trust:4.1},
  aldi:{name:"Aldi",trust:4.2}
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      const sources = [
        fetchSource("hukd-hot", "https://www.hotukdeals.com/rss/hot", "rss"),
        fetchSource("hukd-new", "https://www.hotukdeals.com/rss/new", "rss"),
        fetchSource("latestdeals", "https://www.latestdeals.co.uk/feeds/latest-deals-rss.xml", "rss"),
        fetchSource("reddit-hukd", "https://www.reddit.com/r/HotUKDeals/new.json?limit=50", "reddit"),
        fetchSource("reddit-ukdeals", "https://www.reddit.com/r/UKDeals/new.json?limit=50", "reddit"),
        fetchSource("bitterwallet", "https://www.bitterwallet.com/feed", "rss")
      ];

      const results = await Promise.allSettled(sources);
      const allItems = [];
      const sourceStatus = {};

      results.forEach(function(r, idx) {
        const sourceName = ["hukd-hot","hukd-new","latestdeals","reddit-hukd","reddit-ukdeals","bitterwallet"][idx];
        if (r.status === "fulfilled" && r.value) {
          sourceStatus[sourceName] = r.value.length;
          for (let i = 0; i < r.value.length; i++) allItems.push(r.value[i]);
        } else {
          sourceStatus[sourceName] = 0;
        }
      });

      const seen = {};
      const deduped = [];
      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        const key = dedupKey(item);
        if (seen[key]) {
          seen[key].sources.push(item.source);
          continue;
        }
        item.sources = [item.source];
        seen[key] = item;
        deduped.push(item);
      }

      const processed = [];
      for (let i = 0; i < deduped.length; i++) {
        const p = processItem(deduped[i]);
        if (p !== null) processed.push(p);
      }

      processed.sort(function(a, b){ return b.score - a.score; });

      const body = JSON.stringify({
        fetched: new Date().toISOString(),
        sourceStatus: sourceStatus,
        total: processed.length,
        deals: processed
      });

      const headers = {};
      headers["Access-Control-Allow-Origin"] = "*";
      headers["Content-Type"] = "application/json; charset=utf-8";
      headers["Cache-Control"] = "public, max-age=30";

      return new Response(body, { headers: headers });

    } catch (err) {
      const errHeaders = {};
      errHeaders["Access-Control-Allow-Origin"] = "*";
      errHeaders["Content-Type"] = "application/json";
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: errHeaders });
    }
  }
};

async function fetchSource(name, url, type) {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, cf: { cacheTtl: 60 } });
    if (!res.ok) return [];
    const text = await res.text();
    if (type === "reddit") return parseReddit(text, name);
    return parseRss(text, name);
  } catch (e) {
    return [];
  }
}

function parseRss(xml, sourceName) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, "title");
    const link = extractTag(itemXml, "link") || extractTag(itemXml, "guid");
    if (!title || !link) continue;
    items.push({
      title: title,
      link: link,
      description: extractTag(itemXml, "description"),
      pubDate: extractTag(itemXml, "pubDate"),
      source: sourceName
    });
  }
  return items;
}

function parseReddit(jsonText, sourceName) {
  const items = [];
  try {
    const data = JSON.parse(jsonText);
    if (!data.data || !data.data.children) return [];
    for (let i = 0; i < data.data.children.length; i++) {
      const post = data.data.children[i].data;
      if (!post.title) continue;
      items.push({
        title: post.title,
        link: "https://www.reddit.com" + post.permalink,
        description: post.selftext || post.url || "",
        pubDate: new Date(post.created_utc * 1000).toISOString(),
        source: sourceName,
        redditScore: post.score || 0,
        redditUrl: post.url
      });
    }
  } catch (e) {}
  return items;
}

function extractTag(xml, tag) {
  const regex = new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">");
  const m = xml.match(regex);
  if (!m) return "";
  let content = m[1];
  content = content.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
  return content.trim();
}

function dedupKey(item) {
  const titleNorm = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 40);
  return titleNorm;
}

function cleanText(text) {
  return text
    .replace(/^\d+\u00b0\s*-?\s*/, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\u0026amp;/g, "\u0026")
    .replace(/\u0026lt;/g, "<")
    .replace(/\u0026gt;/g, ">")
    .replace(/\u0026quot;/g, "\u0022")
    .replace(/\u0026apos;/g, "\u0027")
    .replace(/\u0026#\d+;/g, "")
    .replace(/\u0026[a-z]+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function processItem(item) {
  const titleClean = cleanText(item.title);
  const descClean = item.description || "";
  const fullTextLower = (titleClean + " " + descClean).toLowerCase();
  const fullText = titleClean + " " + descClean;

  const isGlitch = GLITCH_KEYWORDS.some(function(k){ return fullTextLower.indexOf(k) !== -1; });

  const exclusionFlags = {};
  const keys = Object.keys(EXCLUSION_CATEGORIES);
  for (let i = 0; i < keys.length; i++) {
    const cat = keys[i];
    const words = EXCLUSION_CATEGORIES[cat];
    exclusionFlags[cat] = words.some(function(w){ return fullTextLower.indexOf(w) !== -1; });
  }

  const temp = extractTemp(fullText);
  const prices = extractPrices(fullText);
  const discount = extractDiscount(fullText, prices);
  const retailerInfo = extractRetailer(titleClean, descClean, item.link);
  const externalLink = extractExternalLink(descClean) || item.redditUrl || null;
  const category = extractCategory(fullText);

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
    exclusionFlags: exclusionFlags,
    source: item.source,
    sources: item.sources || [item.source],
    pubDate: time.toISOString(),
    ageMins: ageMins,
    score: score
  };
}

function extractTemp(text) {
  const m = text.match(/(\d{2,4})\u00b0/);
  return m ? parseInt(m[1]) : 0;
}

function extractPrices(text) {
  const wasNow = text.match(/\u00a3([\d,]+(?:\.\d{2})?)\s*\(?\s*(?:was|RRP|rrp|instead of)\s*\u00a3([\d,]+(?:\.\d{2})?)/i);
  if (wasNow) {
    const now = parseFloat(wasNow[1].replace(/,/g, ""));
    const was = parseFloat(wasNow[2].replace(/,/g, ""));
    if (now > 0 && was > 0 && was > now && was < now * 50) {
      return { now: now, was: was, confidence: "high" };
    }
  }
  const wasFirst = text.match(/was\s*\u00a3([\d,]+(?:\.\d{2})?)[^\u00a3]{0,30}\u00a3([\d,]+(?:\.\d{2})?)/i);
  if (wasFirst) {
    const was = parseFloat(wasFirst[1].replace(/,/g, ""));
    const now = parseFloat(wasFirst[2].replace(/,/g, ""));
    if (now > 0 && was > 0 && was > now && was < now * 50) {
      return { now: now, was: was, confidence: "high" };
    }
  }
  const two = text.match(/\u00a3([\d,]+(?:\.\d{2})?)[^\u00a3]{0,20}\u00a3([\d,]+(?:\.\d{2})?)/);
  if (two) {
    const a = parseFloat(two[1].replace(/,/g, ""));
    const b = parseFloat(two[2].replace(/,/g, ""));
    if (a > 0 && b > 0 && a !== b) {
      const high = Math.max(a, b);
      const low = Math.min(a, b);
      if (high < low * 50) {
        return { now: low, was: high, confidence: "medium" };
      }
    }
  }
  const single = text.match(/\u00a3([\d,]+(?:\.\d{2})?)/);
  if (single) {
    return { now: parseFloat(single[1].replace(/,/g, "")), was: null, confidence: "low" };
  }
  return { now: null, was: null, confidence: "none" };
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
  const hay = (title + " " + desc + " " + (link || "")).toLowerCase();
  const keys = Object.keys(RESALE_RETAILERS);
  for (let i = 0; i < keys.length; i++) {
    if (hay.indexOf(keys[i]) !== -1) return RESALE_RETAILERS[keys[i]];
  }
  try {
    const url = new URL(link);
    const host = url.hostname.replace("www.", "");
    if (host.indexOf("hotukdeals") === -1 && host.indexOf("reddit") === -1 && host.indexOf("latestdeals") === -1 && host.indexOf("bitterwallet") === -1) {
      const parts = host.split(".");
      const brand = parts.length >= 2 ? parts[parts.length - 2] : host;
      if (brand.length >= 3) {
        return { name: brand.charAt(0).toUpperCase() + brand.slice(1), trust: null };
      }
    }
  } catch (e) {}
  return null;
}

function extractExternalLink(desc) {
  const hrefRegex = /href=[\u0022\u0027]([^\u0022\u0027]+)[\u0022\u0027]/g;
  let m;
  while ((m = hrefRegex.exec(desc)) !== null) {
    const link = m[1];
    if (link.indexOf("http") === 0 && link.indexOf("hotukdeals") === -1 && link.indexOf("reddit") === -1 && link.indexOf("latestdeals") === -1 && link.indexOf("bitterwallet") === -1) return link;
  }
  return null;
}

function extractCategory(text) {
  const cats = {
    Electronics: ["tv","laptop","headphones","speaker","tablet","phone","camera","monitor","soundbar"],
    Gaming: ["playstation","ps5","ps4","xbox","nintendo","switch","gaming"],
    Toys: ["lego","toy","kids","children","barbie","doll","figure"],
    Fashion: ["trainers","shoes","jacket","coat","dress","jeans","nike","adidas"],
    Beauty: ["perfume","fragrance","makeup","skincare","cream","lipstick"],
    Watches: ["watch","rolex","seiko","casio","tissot"],
    Computing: ["ssd","gpu","cpu","ram","keyboard","mouse","desktop"],
    Home: ["vacuum","dyson","kettle","iron","bedding","towel"],
    Food: ["crisps","chocolate","sweets","snacks","drink"]
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
  return "General";
}
