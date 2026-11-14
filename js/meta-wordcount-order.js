/*! 文章页元信息：把「字数」挪到「阅读量」后面，并把文案简化为「字数」 */
(function () {
  "use strict";

  function fix() {
    var lines = document.querySelectorAll(".meta-secondline");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var wc = line.querySelector(".post-meta-wordcount");
      if (!wc || wc.dataset.mcMoved === "1") continue;
      var pv = line.querySelector(".post-meta-pv-cv");
      if (!pv) continue;

      // 文案：主题默认是「字数总计」，这里简化为「字数」
      var label = wc.querySelector(".post-meta-label");
      if (label) label.textContent = "字数" + (label.textContent.indexOf(":") > -1 ? ":" : "");

      // 连同它前面的分隔符一起搬到「阅读量」后面
      var sep = wc.previousElementSibling;
      var hasSep = sep && sep.classList && sep.classList.contains("post-meta-separator");
      pv.after(wc);
      if (hasSep) pv.after(sep);
      wc.dataset.mcMoved = "1";
    }

    // 去掉相邻的重复分隔符（搬动后可能出现两个连在一起）
    for (var j = 0; j < lines.length; j++) {
      var kids = lines[j].children;
      for (var k = kids.length - 1; k > 0; k--) {
        if (
          kids[k].classList.contains("post-meta-separator") &&
          kids[k - 1].classList.contains("post-meta-separator")
        ) {
          kids[k].remove();
        }
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fix);
  else fix();
  document.addEventListener("pjax:complete", function () { setTimeout(fix, 60); });
})();
