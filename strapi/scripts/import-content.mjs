#!/usr/bin/env node
/*
  ينقل المحتوى الحالي إلى Strapi مرة واحدة:
  الأنشطة (act-data.js وصور img/act) والأخبار (news-data.js وصور img/news).
  آمن للتكرار: يتخطى المدن والمشاريع والأنشطة الموجودة مسبقاً.

  التشغيل من جذر مستودع الموقع:
    STRAPI_URL=https://cms.ydf.ly STRAPI_TOKEN=<Full access API token> node strapi/scripts/import-content.mjs

  في PowerShell:
    $env:STRAPI_URL="https://cms.ydf.ly"; $env:STRAPI_TOKEN="..."; node strapi/scripts/import-content.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const URL_ = (process.env.STRAPI_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.STRAPI_TOKEN || '';
const ROOT = process.env.SITE_ROOT || process.cwd();
if (!URL_ || !TOKEN) {
  console.error('STRAPI_URL و STRAPI_TOKEN مطلوبان.');
  process.exit(1);
}

const TYPE_KEY = {
  'جلسة حوارية': 'dialogue', 'تدريب': 'training', 'مشاركة': 'participation',
  'رياضة ومجتمع': 'community', 'عمل إنساني': 'humanitarian', 'إعلان': 'announcement', 'لقاء': 'meeting',
};
const THREAD_ORDER = ['jisr', 'tour', 'hilal', 'derna'];

const ctx = { window: {} };
for (const f of ['act-data.js', 'news-data.js']) vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx);
const { ACT, PROJ, CITIES, NEWS } = ctx.window;
const imgFile = (n) => path.join(ROOT, 'img', n.includes('/') ? '' : 'act', `${n}-l.webp`);
const blocks = (paras) => paras.map((t) => ({ type: 'paragraph', children: [{ type: 'text', text: t }] }));

async function api(method, route, body) {
  const res = await fetch(URL_ + route, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${route} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const q = (s) => encodeURIComponent(s);

async function upload(file) {
  const fd = new FormData();
  fd.append('files', new Blob([fs.readFileSync(file)], { type: 'image/webp' }), path.basename(file));
  const res = await fetch(URL_ + '/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: fd });
  if (!res.ok) throw new Error(`upload ${file} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json())[0].id;
}

/* المدن */
const cityDoc = {};
for (const [name, g] of Object.entries(CITIES)) {
  const found = await api('GET', `/api/cities?filters[name][$eq]=${q(name)}`);
  if (found.data.length) { cityDoc[name] = found.data[0].documentId; continue; }
  const r = await api('POST', '/api/cities', { data: {
    name, lat: g.lat ?? null, lng: g.lng ?? null, abroad: !!g.abroad, country: g.country || null, labelAlways: !!g.label,
  } });
  cityDoc[name] = r.data.documentId;
  console.log('مدينة +', name);
}

/* المشاريع */
const projDoc = {};
for (const [key, p] of Object.entries(PROJ)) {
  const found = await api('GET', `/api/projects?filters[key][$eq]=${q(key)}`);
  if (found.data.length) { projDoc[key] = found.data[0].documentId; continue; }
  const o = THREAD_ORDER.indexOf(key);
  const r = await api('POST', '/api/projects?status=published', { data: {
    name: p.n, key, description: p.d, order: o < 0 ? 99 : o, showAsThread: o >= 0,
  } });
  projDoc[key] = r.data.documentId;
  console.log('مشروع +', p.n);
}

/* الأنشطة */
let made = 0, skipped = 0;
for (const a of ACT) {
  const found = await api('GET', `/api/activities?filters[legacyId][$eq]=${a.id}`);
  if (found.data.length) { skipped++; continue; }
  const ids = [];
  for (const n of a.img) ids.push(await upload(imgFile(n)));
  const data = {
    title: a.t,
    date: a.date,
    type: TYPE_KEY[a.type] || 'dialogue',
    legacyId: a.id,
    cover: ids[0],
    gallery: ids.slice(1),
    body: blocks(a.p),
  };
  if (a.city && cityDoc[a.city]) data.city = { connect: [cityDoc[a.city]] };
  if (a.proj && projDoc[a.proj]) data.project = { connect: [projDoc[a.proj]] };
  await api('POST', '/api/activities?status=published', { data });
  made++;
  console.log(`نشاط + (${made}) ${a.t} — ${ids.length} صورة`);
}
console.log(`\nتم: ${made} نشاطاً جديداً، و ${skipped} موجود مسبقاً.`);

/* الأخبار */
let nMade = 0, nSkipped = 0;
for (const n of NEWS) {
  const found = await api('GET', `/api/news-items?filters[legacyId][$eq]=${n.id}`);
  if (found.data.length) { nSkipped++; continue; }
  const ids = [];
  for (const f of n.img) ids.push(await upload(imgFile(f)));
  const data = { title: n.t, date: n.date, kind: n.kind, entity: n.entity || null, legacyId: n.id, body: blocks(n.p) };
  if (n.sum) data.summary = n.sum;
  if (n.proj && projDoc[n.proj]) data.project = { connect: [projDoc[n.proj]] };
  if (ids.length) { data.cover = ids[0]; data.gallery = ids.slice(1); }
  await api('POST', '/api/news-items?status=published', { data });
  nMade++;
  console.log(`خبر + (${nMade}) ${n.t} — ${ids.length} صورة`);
}
console.log(`الأخبار: ${nMade} جديد، و ${nSkipped} موجود مسبقاً.`);
