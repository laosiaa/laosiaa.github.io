/*! 文章页（手机端）：加一个「返回上一页」入口，放在标题区顶部 */
(function () {
  "use strict";

  function add() {
    var info = document.querySelector("#page-header.post-bg #post-info");
    if (!info || info.querySelector(".post-back-link")) return;
    var a = document.createElement("a");
    a.className = "post-back-link";
    a.href = "/";
    a.innerHTML = "<i>←</i> 返回上一页";
    a.addEventListener("click", function (e) {
      e.preventDefault();
      if (window.history.length > 1) window.history.back();
      else window.location.href = "/";
    });
    info.insertBefore(a, info.firstChild);
  }

  function boot() { add(); [200, 700].forEach(function (t) { setTimeout(add, t); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 200); });
})();
