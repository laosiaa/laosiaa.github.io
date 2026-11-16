/*! 文章页页头：标题区与正文主栏同栅格（左边界、右边界、宽度对齐） */
(function () {
  "use strict";

  function align() {
    var post = document.querySelector("#post");
    var info = document.querySelector("#post-info");
    var header = document.querySelector("#page-header");
    if (!post || !info || !header) return;
    var p = post.getBoundingClientRect();
    var h = header.getBoundingClientRect();
    if (p.width < 100) return;
    info.style.setProperty("--col-left", Math.round(p.left) + "px");
    info.style.setProperty("--col-right", Math.round(h.right - p.right) + "px");
    info.style.setProperty("--col-w", Math.round(p.width) + "px");
  }

  function boot() { align(); setTimeout(align, 120); setTimeout(align, 600); setTimeout(align, 1500); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 200); });
  window.addEventListener("resize", function () {
    align();
    setTimeout(align, 250);
  });
})();
