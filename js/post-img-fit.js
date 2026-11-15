/*! 文章页：正文图片等比适配 + 顶部封面完整显示（毛玻璃填充） */
(function () {
  "use strict";

  function fixBanner() {
    var cov = document.getElementById("post-top-cover");
    var img = document.getElementById("post-top-bg");
    if (!cov || !img) return;
    var src = img.currentSrc || img.src;
    if (!src) return;
    var blur = cov.querySelector(".cover-blur");
    if (!blur) {
      blur = document.createElement("div");
      blur.className = "cover-blur";
      cov.insertBefore(blur, cov.firstChild);
    }
    blur.style.backgroundImage = 'url("' + src + '")';
  }

  function markScreenshots() {
    var body = document.getElementById("article-container");
    if (!body) return;
    var imgs = body.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      var el = imgs[i];
      var w = el.naturalWidth || 0, h = el.naturalHeight || 0;
      if (!w || !h) {
        el.addEventListener("load", function (e) {
          var t = e.currentTarget;
          if (t.naturalWidth && t.naturalHeight && t.naturalWidth / t.naturalHeight > 1.6) t.classList.add("keep-full");
        });
        continue;
      }
      if (w / h > 1.6) el.classList.add("keep-full");   // 界面截图等超宽图不裁切
    }
  }

  function boot() { fixBanner(); markScreenshots(); setTimeout(markScreenshots, 600); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 200); });
})();
