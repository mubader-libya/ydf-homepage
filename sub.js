/* أدوات مشتركة للصفحات الفرعية */
(function(){
  "use strict";
  var Y = window.YDF = {};
  Y.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  Y.fine = window.matchMedia("(pointer: fine)").matches;
  Y.mobile = window.matchMedia("(max-width: 900px)").matches;
  if (Y.reduce || !window.gsap) document.documentElement.classList.add("rm");

  /* الصورة إما اسم ملف محلي، أو كائن {s, l} قادم من Strapi */
  /* الصورة: اسم ملف محلي ("a6482-00" في img/act، أو "news/n6403-00")، أو كائن {s, l} من Strapi */
  Y.img = function(n, sz){ return typeof n === "string" ? "img/" + (n.indexOf("/") < 0 ? "act/" : "") + n + "-" + sz + ".webp" : n[sz]; };
  Y.srcset = function(n){ return Y.img(n,"s") + " 700w, " + Y.img(n,"l") + " 1600w"; };
  var months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  Y.date = function(s){ var p = s.split("-"); return (+p[2]) + " " + months[+p[1]-1] + " " + p[0]; };
  Y.esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); };
  /* عدد + معدود: 1 واحد، 2 مثنى، 3–10 جمع، 11+ مفرد منصوب (many) */
  Y.n = function(n, many, few){
    var one = many.replace(/اً$/, "").replace(/ً$/, "");
    if (n === 1) return one + " واحد" + (/ة$/.test(one) ? "ة" : "");
    if (n === 2) return (/ة$/.test(one) ? one.replace(/ة$/, "تان") : one + "ان");
    return n + " " + (n % 100 >= 3 && n % 100 <= 10 ? few : many);
  };
  /* مقتطف: أول فقرة حقيقية (تتجاوز سطور التاريخ والنداء القصيرة) مقصوصة إلى n كلمة */
  Y.excerpt = function(paras, n){
    var t = (paras || []).filter(function(x){ return x.length > 60; })[0] || (paras || [])[0] || "";
    var w = t.split(/\s+/); return w.length > n ? w.slice(0, n).join(" ") + "…" : t;
  };
  Y.cities = {};
  Y.place = function(c){ var g = Y.cities[c]; return g && g.abroad && g.country ? c + "، " + g.country : c; };
  /* دوران ثابت لكل قصاصة حسب رقمها، حتى لا تتغير عند كل تحميل */
  Y.tilt = function(id, k){
    var h = 0, str = String(id); for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100003;
    var x = Math.sin(h * 12.9898 + (k||0) * 78.233) * 43758.5453; return ((x - Math.floor(x)) * 2 - 1);
  };

  /* ════════════════════════════════════════════════════════════
     طبقة البيانات
     كل صفحة تطلب محتواها عبر Y.load("<اسم>")، ولا تعرف مصدره.
     المصدر: Strapi إن ضُبط YDF_CONFIG.cms، وإلا (أو عند الفشل) البيانات المحلية.
     لإضافة نوع محتوى جديد: أضف مدخلاً في ENDPOINTS بثلاثة أشياء:
       route    مسار Strapi        populate  الحقول المرتبطة
       local()  البيانات المحلية    map(json) تحويل رد Strapi إلى الشكل الموحّد
     ════════════════════════════════════════════════════════════ */
  var TYPE_AR = {dialogue:"جلسة حوارية", training:"تدريب", participation:"مشاركة", community:"رياضة ومجتمع", humanitarian:"عمل إنساني", announcement:"إعلان", meeting:"لقاء"};
  var KIND_AR = {statement:"بيان رسمي", meeting:"لقاء", project:"أخبار المشاريع", general:"أخبار المنتدى"};
  Y.TYPE_AR = TYPE_AR; Y.KIND_AR = KIND_AR;
  var THREADS = ["jisr","tour","hilal","derna"];

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
  function picker(base){
    var abs = function(u){ return /^https?:/.test(u) ? u : base + u; };
    return function(m){
      if (!m || !m.url) return null;
      var f = m.formats || {};
      return {s: abs((f.medium || f.small || m).url), l: abs((f.large || m).url)};
    };
  }
  function images(e, pic){ return [pic(e.cover)].concat((e.gallery || []).map(pic)).filter(Boolean); }
  function idOf(e){ return e.slug || e.legacyId || e.documentId; }

  var MEDIA = ["url","formats"];
  var ENDPOINTS = {
    /* الأنشطة: {id, date, t, city, proj, type, img, p} + projects + cities */
    activities: {
      route: "/api/activities",
      /* الحقول المطلوبة فقط: لا شيء تحتاجه الصفحات محذوف، ولا شيء زائد يُنقل */
      fields: ["title","slug","legacyId","date","type","body"],
      populate: {cover:MEDIA, gallery:MEDIA, city:["name","lat","lng","abroad","country","labelAlways"], project:["name","key","description","order","showAsThread"]},
      local: function(){
        var projects = {};
        Object.keys(window.PROJ || {}).forEach(function(k){ var p = PROJ[k], o = THREADS.indexOf(k); projects[k] = {n:p.n, d:p.d, order:o < 0 ? 99 : o, thread:o >= 0}; });
        return {activities:(window.ACT || []).slice(), projects:projects, cities:window.CITIES || {}};
      },
      map: function(json, base){
        var pic = picker(base), projects = {}, cities = {};
        var list = (json.data || []).map(function(a){
          var c = a.city, pr = a.project;
          if (c && c.name && !cities[c.name]) cities[c.name] = {lat: c.lat != null ? +c.lat : undefined, lng: c.lng != null ? +c.lng : undefined, abroad: c.abroad, country: c.country, label: c.labelAlways};
          if (pr && pr.key && !projects[pr.key]) projects[pr.key] = {n: pr.name, d: pr.description || "", order: pr.order || 0, thread: pr.showAsThread !== false};
          return {id: idOf(a), date: a.date, t: a.title, city: c ? c.name : null, proj: pr ? pr.key : null,
            type: TYPE_AR[a.type] || a.type || "نشاط", img: images(a, pic), p: blocksToParas(a.body)};
        }).filter(function(a){ return a.img.length; });
        return {activities:list, projects:projects, cities:cities};
      },
      count: function(d){ return d.activities.length; }
    },
    /* الأخبار: {id, date, t, kind, entity, sum, proj, img, p} */
    news: {
      route: "/api/news-items",
      fields: ["title","slug","legacyId","date","kind","entity","summary","body"],
      populate: {cover:MEDIA, gallery:MEDIA, project:["key"]},
      local: function(){ return {news:(window.NEWS || []).slice()}; },
      map: function(json, base){
        var pic = picker(base);
        return {news:(json.data || []).map(function(n){
          return {id: idOf(n), date: n.date, t: n.title, kind: n.kind || "general", entity: n.entity || null, sum: n.summary || "", proj: n.project ? n.project.key : null, img: images(n, pic), p: blocksToParas(n.body)};
        })};
      },
      count: function(d){ return d.news.length; }
    }
  };
  Y.ENDPOINTS = ENDPOINTS;

  /* بناء الاستعلام: حقول محددة، وترتيب ثابت (التاريخ ثم المعرّف لكسر التعادل)، وصفحات من 100
     (الحد الأقصى الافتراضي في Strapi لـ pageSize هو 100؛ طلب 500 كان سيُقصّ بصمت) */
  var PAGE_SIZE = 100;
  function query(ep, page){
    var q = [];
    ep.fields.forEach(function(f, i){ q.push("fields[" + i + "]=" + f); });
    Object.keys(ep.populate).forEach(function(rel){
      ep.populate[rel].forEach(function(f, i){ q.push("populate[" + rel + "][fields][" + i + "]=" + f); });
    });
    q.push("sort[0]=date:desc", "sort[1]=id:desc", "pagination[page]=" + page, "pagination[pageSize]=" + PAGE_SIZE);
    return ep.route + "?" + q.join("&");
  }
  function getJSON(url){
    return fetch(url, {headers:{Accept:"application/json"}}).then(function(r){ if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  /* هيكل تحميل مؤجَّل: لا يظهر إلا إذا تجاوز الطلب 400ms، فلا وميض للردود السريعة */
  function skeleton(){
    var timer = setTimeout(function(){ document.documentElement.classList.add("is-loading"); }, 400);
    return function(){ clearTimeout(timer); document.documentElement.classList.remove("is-loading"); };
  }

  Y.load = function(name){
    var ep = ENDPOINTS[name];
    var local = function(){ var d = ep.local(); d.source = "local"; return d; };
    var cms = (window.YDF_CONFIG && YDF_CONFIG.cms || "").replace(/\/+$/, "");
    if (!cms || !window.fetch) return Promise.resolve(local());
    var done = skeleton();
    /* الصفحة الأولى تخبرنا بعدد الصفحات، ثم تُجلب البقية بالتوازي */
    return getJSON(cms + query(ep, 1))
      .then(function(first){
        var count = (first.meta && first.meta.pagination && first.meta.pagination.pageCount) || 1, rest = [];
        for (var p = 2; p <= count; p++) rest.push(getJSON(cms + query(ep, p)));
        return Promise.all(rest).then(function(pages){
          return {data: pages.reduce(function(all, pg){ return all.concat(pg.data || []); }, first.data || [])};
        });
      })
      .then(function(j){ var d = ep.map(j, cms); if (!ep.count(d)) throw new Error("empty"); d.source = "strapi"; return d; })
      .catch(function(e){ if (window.console) console.warn("Strapi (" + name + ") غير متاح، أعرض البيانات المحلية:", e.message); return local(); })
      .then(function(d){ done(); return d; });
  };
  Y.byDate = function(a, b){ return a.date < b.date ? 1 : a.date > b.date ? -1 : String(b.id).localeCompare(String(a.id), "en", {numeric:true}); };

  /* ── المعرض المكبّر المشترك: Y.gallery(container, images, caption) ──
     يفتح أي عنصر داخل container يحمل data-i */
  var LB = null;
  function buildLB(){
    var el = document.createElement("div");
    el.className = "lightbox"; el.setAttribute("role","dialog"); el.setAttribute("aria-modal","true"); el.setAttribute("aria-label","معرض الصور");
    var ch = function(d){ return '<svg width="16" height="16" viewBox="0 0 16 16"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; };
    el.innerHTML = '<span class="lb-n"></span><button class="lb-x" aria-label="إغلاق">' + ch("M3 3l10 10M13 3 3 13") + '</button>' +
      '<button class="lb-btn lb-prev" aria-label="الصورة السابقة">' + ch("M6 3l5 5-5 5") + '</button><figure class="scrap tape"><figcaption></figcaption></figure>' +
      '<button class="lb-btn lb-next" aria-label="الصورة التالية">' + ch("M10 3 5 8l5 5") + '</button>';
    document.body.appendChild(el);
    var st = {el:el, img:el.querySelector("figure").insertBefore(new Image(), el.querySelector("figcaption")), cap:el.querySelector("figcaption"), n:el.querySelector(".lb-n"), list:[], title:"", cur:0, last:null};
    st.show = function(k){
      var L = st.list.length; st.cur = (k + L) % L;
      st.img.src = Y.img(st.list[st.cur], "l"); st.img.alt = "صورة " + (st.cur+1) + " من " + L;
      st.cap.textContent = st.title; st.n.textContent = (st.cur+1) + " من " + L;
      el.querySelector(".lb-prev").hidden = el.querySelector(".lb-next").hidden = L < 2;
      if (L > 1) new Image().src = Y.img(st.list[(st.cur+1) % L], "l");
    };
    st.close = function(){ el.classList.remove("open"); if (Y.lenis) Y.lenis.start(); if (st.last) st.last.focus(); };
    el.querySelector(".lb-x").addEventListener("click", st.close);
    el.querySelector(".lb-prev").addEventListener("click", function(e){ e.stopPropagation(); st.show(st.cur - 1); });
    el.querySelector(".lb-next").addEventListener("click", function(e){ e.stopPropagation(); st.show(st.cur + 1); });
    el.addEventListener("click", function(e){ if (e.target === el) st.close(); });
    addEventListener("keydown", function(e){
      if (!el.classList.contains("open")) return;
      if (e.key === "Escape") st.close();
      if (e.key === "Tab") {
        var fo = [].slice.call(el.querySelectorAll("button:not([hidden])")), a = fo.indexOf(document.activeElement);
        e.preventDefault(); fo[(a + (e.shiftKey ? -1 : 1) + fo.length) % fo.length].focus();
      }
      if (e.key === "ArrowLeft") st.show(st.cur + 1);
      if (e.key === "ArrowRight") st.show(st.cur - 1);
    });
    var sx = null;
    el.addEventListener("touchstart", function(e){ sx = e.touches[0].clientX; }, {passive:true});
    el.addEventListener("touchend", function(e){ if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) st.show(st.cur + (dx > 0 ? 1 : -1)); sx = null; });
    return st;
  }
  Y.gallery = function(container, list, title){
    if (!list.length) return;
    container.addEventListener("click", function(e){ var f = e.target.closest("[data-i]"); if (f) open(+f.dataset.i); });
    container.addEventListener("keydown", function(e){ var f = e.target.closest("[data-i]"); if (f && e.key === "Enter") open(+f.dataset.i); });
    function open(k){
      LB = LB || buildLB();
      LB.list = list; LB.title = title; LB.last = document.activeElement;
      LB.show(k); LB.el.classList.add("open"); if (Y.lenis) Y.lenis.stop(); LB.el.querySelector(".lb-x").focus();
    }
  };

  /* ── مسار القصة: الرئيسية ← الأنشطة ← الأخبار ── */
  Y.CHAPTERS = [["index.html","الرئيسية","home"],["activities.html","المشاركات والأنشطة","activities"],["news.html","الأخبار والمواقف","news"]];
  Y.trail = function(el, page){
    if (!el) return;
    el.innerHTML = Y.CHAPTERS.map(function(c, i){
      return (i ? '<i aria-hidden="true"></i>' : '') + (c[2] === page ? '<span aria-current="page">' + c[1] + '</span>' : '<a href="' + c[0] + '">' + c[1] + '</a>');
    }).join("");
  };
  /* بطاقة الفصل التالي قبل التذييل */
  Y.nextChapter = function(href, kicker, title, line){
    var a = document.createElement("a");
    a.className = "next-ch"; a.href = href;
    a.innerHTML = '<small>' + kicker + '</small><b>' + title + '</b><span>' + line + '</span><em aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></em>';
    var f = document.querySelector("footer"); f.parentNode.insertBefore(a, f);
  };

  /* ── الرأس والتذييل المشتركان: <header data-page="activities"></header> و <footer></footer> ── */
  Y.NAV = [["index.html","الرئيسية",""],["index.html#about","من نحن",""],["activities.html","الأنشطة","activities"],["news.html","الأخبار","news"]];
  Y.chrome = function(){
    var h = document.querySelector("header[data-page]"), f = document.querySelector("footer");
    if (h) h.innerHTML = '<a class="brand" href="index.html" aria-label="منتدى حوار الشباب، الرئيسية"><svg class="mark ink" viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="#085078" stroke-width="2.4"><circle cx="13" cy="13" r="6"/><circle cx="27" cy="27" r="6"/></g><circle cx="27" cy="13" r="4.2" fill="#008EA5"/><circle cx="13" cy="27" r="4.2" fill="#062F47"/><path d="M17.5 17.5 22.5 22.5" stroke="#085078" stroke-width="2.4" stroke-linecap="round"/></svg><span><b>منتدى حوار الشباب</b><small>ليبيا</small></span></a>' +
      '<nav aria-label="الرئيسية">' + Y.NAV.map(function(n){ return '<a class="nl" href="' + n[0] + '"' + (n[2] && n[2] === h.dataset.page ? ' aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join("") + '<a class="pill" href="https://ydf.ly/?page_id=5629">انضم</a></nav>';
    if (f && !f.children.length) f.innerHTML = '<span>© منتدى حوار الشباب، ليبيا ' + new Date().getFullYear() + '</span><a href="mailto:info@ydf.ly">info@ydf.ly</a><span class="soc">' +
      Y.SOCIAL.map(function(s){ return '<a href="' + s[0] + '">' + s[1] + '</a>'; }).join("") + '</span>';
  };
  Y.SOCIAL = [["https://www.facebook.com/YDForumLY","فيسبوك"],["https://x.com/YDForum_ly","إكس"],["https://www.instagram.com/ydforumly/","إنستغرام"],["https://www.youtube.com/channel/UC0wHgo-4RE2iXFrUI0Ld75g","يوتيوب"],["https://www.linkedin.com/company/%D9%85%D9%86%D8%AA%D8%AF%D9%89-%D8%AD%D9%88%D8%A7%D8%B1-%D8%A7%D9%84%D8%B4%D8%A8%D8%A7%D8%A8","لينكدإن"],["https://wa.me/218912000932","واتساب"]];
  if (document.readyState !== "loading") Y.chrome(); else document.addEventListener("DOMContentLoaded", Y.chrome);

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
