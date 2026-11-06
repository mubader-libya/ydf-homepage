// اختبار حمل محلي: N زائر متزامن، كل زائر يتصفح الصفحات الخمس كالمتصفح
// (الصفحة ثم ملفاتها بست وصلات متوازية، مع ذاكرة تخزين لكل زائر حتى لا يُعاد تنزيل نفس الملف)
// الاستعمال: node load.mjs http://localhost:4700 100
const BASE = process.argv[2] || "http://localhost:4700";
const USERS = +(process.argv[3] || 100);
const PAGES = ["/", "/activities.html", "/news.html", "/activity.html?id=6315", "/news-item.html?id=6112"];
const FIRST_SCREEN_IMAGES = {
  "/activities.html": ["img/act/a6482-00-s.webp", "img/act/a6459-00-s.webp", "img/act/a6431-00-s.webp", "img/act/a5481-00-s.webp", "img/act/a5975-00-s.webp"],
  "/activity.html?id=6315": ["img/act/a6315-00-l.webp"],
  "/news-item.html?id=6112": ["img/news/n6112-00-l.webp"],
};

const lat = [], pageTimes = {}, errors = {};
let bytes = 0, requests = 0;

async function get(url) {
  const t = performance.now();
  try {
    const r = await fetch(url, { headers: { "Accept-Encoding": "gzip, br" } });
    const b = await r.arrayBuffer();
    requests++; bytes += b.byteLength; lat.push(performance.now() - t);
    if (!r.ok) errors[r.status] = (errors[r.status] || 0) + 1;
    return r.headers.get("content-type")?.includes("html") ? new TextDecoder().decode(b) : "";
  } catch (e) {
    errors[e.cause?.code || e.message] = (errors[e.cause?.code || e.message] || 0) + 1; return "";
  }
}
async function pool(urls, n) { // ست وصلات متوازية كالمتصفح
  let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < urls.length) await get(urls[i++]); }));
}
async function visitor() {
  const cache = new Set();
  for (const p of PAGES) {
    const t = performance.now();
    const html = await get(BASE + p);
    const refs = [...html.matchAll(/(?:href|src)="([^"#]+\.(?:css|js|woff2|webp|svg)(?:\?[^"]*)?)"/g)].map(m => m[1]).filter(u => !/^https?:/.test(u));
    const want = [...new Set(refs.concat(FIRST_SCREEN_IMAGES[p] || []))].filter(u => !cache.has(u));
    want.forEach(u => cache.add(u));
    await pool(want.map(u => BASE + "/" + u.replace(/^\//, "")), 6);
    (pageTimes[p] ||= []).push(performance.now() - t);
  }
}
const pct = (a, q) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * q))] : 0; };

const t0 = performance.now();
await Promise.all(Array.from({ length: USERS }, visitor));
const secs = (performance.now() - t0) / 1000;
console.log(`زوار متزامنون: ${USERS} | المدة: ${secs.toFixed(1)} ث | الطلبات: ${requests} (${(requests / secs).toFixed(0)}/ث) | البيانات: ${(bytes / 1048576).toFixed(1)} م.ب (بعد فك الضغط)`);
console.log(`زمن الطلب الواحد: الوسيط ${pct(lat, .5).toFixed(0)} مللي ث | p95 ${pct(lat, .95).toFixed(0)} | p99 ${pct(lat, .99).toFixed(0)} | الأقصى ${pct(lat, 1).toFixed(0)}`);
for (const p of PAGES) console.log(`  ${p.padEnd(26)} زمن الزيارة: الوسيط ${pct(pageTimes[p], .5).toFixed(0)} مللي ث | p95 ${pct(pageTimes[p], .95).toFixed(0)}`);
console.log(`الأخطاء: ${Object.keys(errors).length ? JSON.stringify(errors) : "لا شيء"}`);
