/*! 朋友圈页：主题会给顶部横幅写一行 inline `background: url(...) !important`，
    这里把它摘掉，交给 custom.css 的渐变样式（不再显示插图） */
(function () {
  "use strict";
  function clean() {
    var el = document.querySelector(".fcirclePage");
    if (!el) return false;
    var s = el.getAttribute("style");
    if (s && /background/i.test(s)) el.removeAttribute("style");
    return true;
  }
  function boot() {
    if (clean()) return;
    var n = 0;
    var t = setInterval(function () {
      n++;
      if (clean() || n > 40) clearInterval(t);
    }, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", boot);
})();
