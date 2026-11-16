/*! 音乐馆：彻底移除封面上的播放/暂停按钮（DOM 删除，不是隐藏）+ 点封面放大查看 */
(function () {
  "use strict";

  /* ---------- 1. 删除 .aplayer-button 节点 ---------- */
  function killButton() {
    var btns = document.querySelectorAll("#anMusic-page .aplayer-pic .aplayer-button, .aplayer-pic .aplayer-button");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b && b.parentNode) b.parentNode.removeChild(b);
    }
    return !!document.querySelector("#anMusic-page .aplayer-pic");
  }

  /* ---------- 2. 点封面放大 ---------- */
  var overlay = null;
  function closeZoom() {
    if (!overlay) return;
    overlay.classList.remove("mm-zoom-on");
    var el = overlay;
    overlay = null;
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") closeZoom(); }

  function coverUrl(pic) {
    var m = /url\((["']?)(.*?)\1\)/.exec(pic.style.backgroundImage || "");
    if (m && m[2] && m[2] !== "none") return m[2];
    var img = pic.querySelector("img");
    return img ? img.src : "";
  }

  /* 网易云图片默认只给 300×300，放大时换成高清参数 */
  function hires(url) {
    if (!url) return url;
    if (/param=\d+y\d+/.test(url)) return url.replace(/param=\d+y\d+/, "param=900y900");
    if (/\?param=/.test(url)) return url.replace(/\?param=.*$/, "?param=900y900");
    return url;
  }

  function openZoom(rawUrl) {
    var url = hires(rawUrl);
    if (!url) return;
    overlay = document.createElement("div");
    overlay.className = "mm-zoom";
    var im = document.createElement("img");
    im.src = url;
    im.alt = "专辑封面";
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "mm-zoom-close";
    closeBtn.setAttribute("aria-label", "关闭");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      closeZoom();
    });
    im.addEventListener("click", function (e) { e.stopPropagation(); });
    overlay.appendChild(im);
    overlay.appendChild(closeBtn);
    overlay.addEventListener("click", function (e) { e.stopPropagation(); closeZoom(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add("mm-zoom-on"); });
    document.addEventListener("keydown", onKey);
  }

  function bindPic() {
    var pic = document.querySelector("#anMusic-page .aplayer-pic");
    if (!pic || pic.dataset.mmZoom === "1") return;
    pic.dataset.mmZoom = "1";
    pic.style.cursor = "zoom-in";
    pic.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openZoom(coverUrl(pic));
    }, true);
  }

  /* ---------- 3. 启动：APlayer 会重建节点，用 observer + 定时兜底 ---------- */
  function tick() {
    killButton();
    bindPic();
  }
  function boot() {
    tick();
    var n = 0;
    var t = setInterval(function () { n++; tick(); if (n > 40) clearInterval(t); }, 400);

    var mo = new MutationObserver(function () { tick(); });
    var host = document.getElementById("anMusic-page");
    if (host) mo.observe(host, { childList: true, subtree: true });

    window.addEventListener("resize", function () { setTimeout(tick, 300); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 300); });
})();
