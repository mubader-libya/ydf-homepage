/* أدوات مشتركة للصفحات الفرعية */
(function(){
  "use strict";
  var Y = window.YDF = {};
  Y.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  Y.fine = window.matchMedia("(pointer: fine)").matches;
  Y.mobile = window.matchMedia("(max-width: 900px)").matches;
  if (Y.reduce || !window.gsap) document.documentElement.classList.add("rm");

  Y.img = function(n, sz){ return "img/act/" + n + "-" + sz + ".webp"; };
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
  Y.place = function(c){ return c === "يكاترينبورغ" ? "يكاترينبورغ، روسيا" : c; };
  /* دوران ثابت لكل قصاصة حسب رقمها، حتى لا تتغير عند كل تحميل */
  Y.tilt = function(id, k){ var x = Math.sin(id * 12.9898 + (k||0) * 78.233) * 43758.5453; return ((x - Math.floor(x)) * 2 - 1); };

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
