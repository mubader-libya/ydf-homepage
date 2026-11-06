/* أدوات مشتركة للصفحات الفرعية */
(function(){
  "use strict";
  var Y = window.YDF = {};
  Y.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  Y.fine = window.matchMedia("(pointer: fine)").matches;
  Y.mobile = window.matchMedia("(max-width: 900px)").matches;
  if (Y.reduce || !window.gsap) document.documentElement.classList.add("rm");

  /* الصورة إما اسم ملف محلي، أو كائن {s, l} قادم من Strapi */
  Y.img = function(n, sz){ return typeof n === "string" ? "img/act/" + n + "-" + sz + ".webp" : n[sz]; };
  Y.srcset = function(n){ return Y.img(n,"s") + " 700w, " + Y.img(n,"l") + " 1600w"; };
  var months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  Y.date = function(s){ var p = s.split("-"); return (+p[2]) + " " + months[+p[1]-1] + " " + p[0]; };
  Y.esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); };
  /* عدد + معدود: 1 واحد، 2 مثنى، 3–10 جمع، 11+ مفرد منصوب (many) */
  Y.n = function(n, many, few){
    var one = many.replace(/اً$/, "");
    if (n === 1) return one + " واحد" + (/ة$/.test(one) ? "ة" : "");
    if (n === 2) return (/ة$/.test(one) ? one.replace(/ة$/, "تان") : one + "ان");
    return n + " " + (n % 100 >= 3 && n % 100 <= 10 ? few : many);
  };
  Y.cities = {};
  Y.place = function(c){ var g = Y.cities[c]; return g && g.abroad && g.country ? c + "، " + g.country : c; };
  /* دوران ثابت لكل قصاصة حسب رقمها، حتى لا تتغير عند كل تحميل */
  Y.tilt = function(id, k){
    var h = 0, str = String(id); for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100003;
    var x = Math.sin(h * 12.9898 + (k||0) * 78.233) * 43758.5453; return ((x - Math.floor(x)) * 2 - 1);
  };

  /* ── طبقة البيانات: Strapi إن وُجد، وإلا البيانات المحلية ──
     الشكل الموحّد لكل نشاط: {id, date, t, city, proj, type, img:[...], p:[...]}
     projects: {key:{n, d, order, thread}}   cities: {name:{lat, lng, abroad, country, label}} */
  var TYPE_AR = {dialogue:"جلسة حوارية", training:"تدريب", participation:"مشاركة", community:"رياضة ومجتمع", humanitarian:"عمل إنساني", announcement:"إعلان", meeting:"لقاء"};
  Y.TYPE_AR = TYPE_AR;
  var THREADS = ["jisr","tour","hilal","derna"];
  function local(){
    var projects = {};
    Object.keys(window.PROJ || {}).forEach(function(k){ var p = PROJ[k], o = THREADS.indexOf(k); projects[k] = {n:p.n, d:p.d, order:o < 0 ? 99 : o, thread:o >= 0}; });
    return {source:"local", activities:(window.ACT || []).slice(), projects:projects, cities:window.CITIES || {}};
  }
  function blocksToParas(b){
    if (!b) return [];
    if (typeof b === "string") return b.split(/\n\s*\n/).map(function(x){ return x.trim(); }).filter(Boolean);
    var out = [];
    (function walk(nodes){
      nodes.forEach(function(n){
        if (n.type === "list") { walk(n.children); return; }
        var t = (function txt(c){ return (c || []).map(function(x){ return x.text != null ? x.text : txt(x.children); }).join(""); })(n.children).trim();
        if (t) out.push(t);
      });
    })(b);
    return out;
  }
  function fromStrapi(json, base){
    var abs = function(u){ return /^https?:/.test(u) ? u : base + u; };
    var pic = function(m){
      if (!m || !m.url) return null;
      var f = m.formats || {};
      return {s: abs((f.medium || f.small || m).url), l: abs((f.large || m).url)};
    };
    var projects = {}, cities = {};
    var acts = (json.data || []).map(function(a){
      var c = a.city, pr = a.project;
      if (c && c.name && !cities[c.name]) cities[c.name] = {lat: c.lat != null ? +c.lat : undefined, lng: c.lng != null ? +c.lng : undefined, abroad: c.abroad, country: c.country, label: c.labelAlways};
      if (pr && pr.key && !projects[pr.key]) projects[pr.key] = {n: pr.name, d: pr.description || "", order: pr.order || 0, thread: pr.showAsThread !== false};
      var imgs = [pic(a.cover)].concat((a.gallery || []).map(pic)).filter(Boolean);
      return {id: a.slug || a.legacyId || a.documentId, date: a.date, t: a.title, city: c ? c.name : null, proj: pr ? pr.key : null,
        type: TYPE_AR[a.type] || a.type || "نشاط", img: imgs, p: blocksToParas(a.body)};
    }).filter(function(a){ return a.img.length; });
    return {source:"strapi", activities:acts, projects:projects, cities:cities};
  }
  Y.data = function(){
    var cms = (window.YDF_CONFIG && YDF_CONFIG.cms || "").replace(/\/+$/, "");
    if (!cms || !window.fetch) return Promise.resolve(local());
    var q = "/api/activities?populate[cover]=true&populate[gallery]=true&populate[city]=true&populate[project]=true&sort[0]=date:desc&pagination[pageSize]=500";
    return fetch(cms + q, {headers:{Accept:"application/json"}})
      .then(function(r){ if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(j){ var d = fromStrapi(j, cms); if (!d.activities.length) throw new Error("empty"); return d; })
      .catch(function(e){ if (window.console) console.warn("Strapi غير متاح، أعرض البيانات المحلية:", e.message); return local(); });
  };
  Y.byDate = function(a, b){ return a.date < b.date ? 1 : a.date > b.date ? -1 : String(b.id).localeCompare(String(a.id), "en", {numeric:true}); };

  /* تمرير ناعم وظهور عام */
  Y.init = function(){
    if (document.documentElement.classList.contains("rm")) return false;
    gsap.registerPlugin(ScrollTrigger);
    if (window.Lenis && !Y.mobile) {
      var lenis = Y.lenis = new Lenis({lerp:.09, smoothWheel:true});
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function(t){ lenis.raf(t*1000); });
      gsap.ticker.lagSmoothing(0);
    }
    gsap.utils.toArray(".rv").forEach(function(el){
      gsap.from(el, {opacity:0, y:26, duration:1.2, ease:"power3.out", scrollTrigger:{trigger:el, start:"top 88%"}});
    });
    return true;
  };
  Y.scrollTo = function(el){
    if (Y.lenis) Y.lenis.scrollTo(el, {offset:-90});
    else window.scrollTo({top: el.getBoundingClientRect().top + scrollY - 90, behavior: Y.reduce ? "auto" : "smooth"});
  };

  /* الأزرار المغناطيسية */
  Y.magnets = function(){
    var ms = [].slice.call(document.querySelectorAll("[data-magnet]"));
    if (!Y.fine || Y.reduce || !ms.length) return;
    addEventListener("pointermove", function(e){
      ms.forEach(function(b){
        var r = b.getBoundingClientRect(); if (r.bottom < -200 || r.top > innerHeight + 200) return;
        var dx = e.clientX - (r.left + r.width/2), dy = e.clientY - (r.top + r.height/2), d = Math.hypot(dx, dy), t = Math.max(0, 1 - d/220);
        b.style.setProperty("--g", (t*t).toFixed(3));
        b.style.transform = "translate(" + (dx*.22*t).toFixed(1) + "px," + (dy*.3*t).toFixed(1) + "px)";
        b.classList.toggle("near", d < Math.max(r.width, r.height)*.75);
      });
    });
  };

  /* حبر يتشكل عند الظهور */
  Y.inkIn = function(sel){
    var map = document.getElementById("inkInMap");
    if (!map || document.documentElement.classList.contains("rm")) return;
    var els = document.querySelectorAll(sel);
    els.forEach(function(e){ e.classList.add("live"); });
    gsap.fromTo(map, {attr:{scale:70}}, {attr:{scale:2.6}, duration:1.8, ease:"power2.out", onComplete:function(){ els.forEach(function(e){ e.classList.remove("live"); }); }});
  };
})();
