/*! 修复：文章图片懒加载不触发（用 rect 判断替代失效的观察器） */
(function () {
  "use strict";

  var MARGIN = 1200; // 视口上下各 1200px 内的图片直接加载

  function load(img) {
    if (img.dataset.llLoaded === "1") return;
    var src = img.getAttribute("data-lazy-src") || img.getAttribute("data-original");
    if (!src) return;
    img.dataset.llLoaded = "1";
    img.setAttribute("data-ll-fixed", "1");
    img.src = src;
    img.removeAttribute("data-lazy-src");
  }

  function scan() {
    var imgs = document.querySelectorAll("img[data-lazy-src]");
    if (!imgs.length) return;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = 0; i < imgs.length; i++) {
      var r = imgs[i].getBoundingClientRect();
      // 1px 占位图高度极小，用 top/bottom 判断
      if (r.bottom > -MARGIN && r.top < vh + MARGIN) load(imgs[i]);
    }
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    // 不用 rAF：后台标签页/无焦点窗口里 rAF 会被暂停，导致永远不再扫描
    setTimeout(function () { ticking = false; scan(); }, 120);
  }

  function boot() {
    scan();
    setTimeout(scan, 300);
    setTimeout(scan, 1200);
    setTimeout(scan, 2500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 150); });
})();
