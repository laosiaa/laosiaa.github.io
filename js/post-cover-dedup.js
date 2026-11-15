/*! 文章页：正文首图若与页头封面相同，隐藏这份重复（避免标题下方再出现一张大图） */
(function () {
  "use strict";

  function norm(u) {
    try { return decodeURIComponent(u).split("?")[0]; } catch (e) { return u.split("?")[0]; }
  }

  function run() {
    var coverImg = document.getElementById("post-top-bg");
    var body = document.getElementById("article-container");
    if (!coverImg || !body) return;
    var cover = norm(coverImg.src || "");
    if (!cover) return;

    var imgs = body.querySelectorAll("img");
    for (var i = 0; i < Math.min(imgs.length, 3); i++) {
      var el = imgs[i];
      if (norm(el.src || "") === cover || norm(el.getAttribute("data-src") || "") === cover) {
        var holder = el.closest("p") || el.closest("a") || el;
        holder.classList.add("post-cover-dup");
      }
    }
  }

  function boot() { run(); setTimeout(run, 400); setTimeout(run, 1200); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 150); });
})();
