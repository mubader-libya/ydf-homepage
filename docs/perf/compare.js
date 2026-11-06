const fs=require('fs'),path=require('path');const D=__dirname;
const routes=['index','activities_html','activity_html_id_6315','news_html','news_item_html_id_6112'];
const M=[['performance','score',x=>x],['first-contentful-paint','FCP',x=>x/1000],['largest-contentful-paint','LCP',x=>x/1000],['total-blocking-time','TBT',x=>x],['cumulative-layout-shift','CLS',x=>x],['speed-index','SI',x=>x/1000]];
const med=a=>{a=a.filter(v=>v!=null).sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:null};
function load(set,r){const out={};for(const [k,l,f] of M){const v=[];for(const i of [1,2,3]){const p=path.join(D,set,`${r}-${i}.json`);if(!fs.existsSync(p))continue;const j=JSON.parse(fs.readFileSync(p));v.push(k==='performance'?Math.round(j.categories.performance.score*100):f(j.audits[k].numericValue));}out[l]=med(v);out.n=v.length;}return out;}
for(const r of routes){const b=load('base',r),a=load(process.argv[2]||'after',r);console.log(r,`(runs ${b.n}/${a.n})`);for(const [,l] of M){const fx=v=>v==null?'—':(l==='CLS'?v.toFixed(3):l==='TBT'||l==='score'?String(Math.round(v)):v.toFixed(2));console.log(`  ${l.padEnd(5)} ${fx(b[l]).padStart(7)} → ${fx(a[l]).padStart(7)}`);}}
