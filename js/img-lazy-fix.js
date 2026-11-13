/*! 修复：文章图片懒加载不触发（vanilla-lazyload 观察器不工作时，用自建 IntersectionObserver 兜底） */
(function () {
  "use strict";

  var io = null;

  function load(img) {
    if (!img || img.dataset.llLoaded === "1") return;
    var src = img.getAttribute("data-lazy-src") || img.getAttribute("data-original");
    if (!src) return;
    img.dataset.llLoaded = "1";
    img.setAttribute("data-ll-fixed", "1");
    img.src = src;
    img.removeAttribute("data-lazy-src");
  }

  function scan() {
    var imgs = Array.prototype.slice.call(document.querySelectorAll("img[data-lazy-src]"));
    if (!imgs.length) return;

    if (!("IntersectionObserver" in window)) {
      imgs.forEach(load);
      return;
    }
    if (!io) {
      io = new IntersectionObserver(
        function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting) {
              load(entries[i].target);
              io.unobserve(entries[i].target);
            }
          }
        },
        { rootMargin: "800px 0px" }
      );
    }
    imgs.forEach(function (img) {
      if (img.dataset.llLoaded !== "1") io.observe(img);
    });
  }

  /* 首屏立刻补一次；滚动/换页也补 */
  function boot() {
    scan();
    setTimeout(scan, 600);
    setTimeout(scan, 1800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  document.addEventListener("pjax:complete", function () { setTimeout(boot, 150); });
  window.addEventListener("scroll", function () {
    if (!window.__llScrollT) {
      window.__llScrollT = setTimeout(function () { window.__llScrollT = null; scan(); }, 300);
    }
  }, { passive: true });
})();
