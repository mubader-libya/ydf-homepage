/* قائمة الهاتف: تُبنى من روابط الرأس نفسها، فلا تحتاج تعديلاً عند إضافة صفحة */
(function(){
  "use strict";
  function build(){
    var nav = document.querySelector("header nav");
    if (!nav || document.querySelector(".menu-btn")) return;
    var links = [].slice.call(nav.querySelectorAll("a.nl")), join = nav.querySelector("a.pill");
    var btn = document.createElement("button");
    btn.className = "menu-btn"; btn.type = "button"; btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", "menuSheet");
    btn.innerHTML = '<i aria-hidden="true"></i>القائمة';
    nav.insertBefore(btn, join || null);
    var sheet = document.createElement("div");
    sheet.className = "menu-sheet"; sheet.id = "menuSheet"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "القائمة");
    sheet.innerHTML = '<div class="ms-top"><b>منتدى حوار الشباب</b><button class="ms-x" type="button" aria-label="إغلاق القائمة"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 3l10 10M13 3 3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>' +
      '<ul>' + links.map(function(a, i){ return '<li><a href="' + a.getAttribute("href") + '"' + (a.getAttribute("aria-current") ? ' aria-current="page"' : '') + '>' + a.textContent + '<span>' + ["١","٢","٣","٤","٥","٦","٧","٨"][i] + '</span></a></li>'; }).join("") + '</ul>' +
      (join ? '<a class="ms-join" href="' + join.getAttribute("href") + '">التسجيل في العضوية</a>' : '');
    document.body.appendChild(sheet);
    var x = sheet.querySelector(".ms-x");
    function set(open){
      sheet.classList.toggle("open", open); btn.setAttribute("aria-expanded", open ? "true" : "false");
      document.documentElement.classList.toggle("menu-open", open);
      (open ? x : btn).focus();
    }
    btn.addEventListener("click", function(){ set(true); });
    x.addEventListener("click", function(){ set(false); });
    sheet.addEventListener("click", function(e){ if (e.target.closest("ul a, .ms-join")) set(false); });
    addEventListener("keydown", function(e){
      if (!sheet.classList.contains("open")) return;
      if (e.key === "Escape") set(false);
      if (e.key === "Tab") {
        var f = [].slice.call(sheet.querySelectorAll("a, button")), k = f.indexOf(document.activeElement);
        e.preventDefault(); f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ setTimeout(build); }); else setTimeout(build);
})();
