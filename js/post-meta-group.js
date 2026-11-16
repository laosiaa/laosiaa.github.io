/*! 文章页元信息：把「图标 + 文字」包成一个不可拆分的整体，避免手机端换行时图标与文字分离 */
(function () {
  "use strict";

  function group() {
    var meta = document.querySelector("#post-meta .meta-inline");
    if (!meta || meta.dataset.metaGrouped === "1") return;
    var nodes = Array.prototype.slice.call(meta.childNodes);
    var out = [];
    var i = 0;
    while (i < nodes.length) {
      var n = nodes[i];
      // 跳过纯空白
      if (n.nodeType === 3 && !n.textContent.trim()) { i++; continue; }
      // 图标 + 紧随的文字/分隔 → 打包
      if (n.nodeType === 1 && n.tagName === "I" && n.classList.contains("post-meta-icon")) {
        var group_ = document.createElement("span");
        group_.className = "meta-item";
        group_.appendChild(n.cloneNode(true));
        var j = i + 1;
        var filled = 0;
        while (j < nodes.length && filled < 2) {
          var m = nodes[j];
          if (m.nodeType === 3 && !m.textContent.trim()) { j++; continue; }
          if (m.nodeType === 1 && m.classList.contains("post-meta-label")) {
            group_.appendChild(m.cloneNode(true));
            filled++;
            j++;
            break;
          }
          break;
        }
        out.push(group_);
        i = j;
        continue;
      }
      if (n.nodeType === 1 && n.classList.contains("post-meta-separator")) { i++; continue; }
      i++;
    }
    if (out.length) {
      meta.innerHTML = "";
      out.forEach(function (el) { meta.appendChild(el); });
      meta.dataset.metaGrouped = "1";
    }
  }

  function boot() {
    group();
    [200, 600, 1400].forEach(function (t) { setTimeout(group, t); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 200); });
})();
