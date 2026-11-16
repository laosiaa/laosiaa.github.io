/*! 音乐馆手机端：给底部控制条补一个音量滑块（APlayer 自带音量条在手机上不可用） */
(function () {
  "use strict";

  function getPlayer() {
    var m = document.querySelector("meting-js");
    if (m && m.aplayer) return m.aplayer;
    if (window.aplayers && window.aplayers.length) return window.aplayers[0];
    var el = document.querySelector(".aplayer");
    return el && el.player ? el.player : null;
  }

  function build() {
    var ap = getPlayer();
    var box = document.querySelector("#anMusic-page .aplayer");
    if (!ap || !box) return false;
    var ctrl = box.querySelector(".aplayer-controller");
    if (!ctrl || ctrl.querySelector(".mm-vol")) return true;

    var wrap = document.createElement("div");
    wrap.className = "mm-vol";
    wrap.innerHTML =
      '<button class="mm-vol-btn" type="button" aria-label="静音">' +
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M3 10v4h4l5 4.5V5.5L7 10H3zm12.7 2a4.5 4.5 0 0 0-2.2-3.86v7.72A4.5 4.5 0 0 0 15.7 12zm-2.2-7.6v2.06a6.6 6.6 0 0 1 0 11.08v2.06a8.6 8.6 0 0 0 0-15.2z"/></svg>' +
      "</button>" +
      '<input class="mm-vol-range" type="range" min="0" max="1" step="0.01" value="0.7" aria-label="音量">';

    var range = wrap.querySelector(".mm-vol-range");
    var btn = wrap.querySelector(".mm-vol-btn");
    var last = 0.7;

    function setVol(v) {
      v = Math.max(0, Math.min(1, v));
      try { ap.volume(v); } catch (e) {}
      range.value = v;
      if (v > 0) last = v;
      btn.style.opacity = v > 0 ? "0.85" : "0.45";
    }

    var cur = 0.7;
    try { cur = ap.volume(); } catch (e) {}
    setVol(cur || 0.7);

    range.addEventListener("input", function () { setVol(parseFloat(range.value)); });
    btn.addEventListener("click", function () {
      var now = 0;
      try { now = ap.volume(); } catch (e) {}
      setVol(now > 0 ? 0 : last || 0.7);
    });

    ctrl.appendChild(wrap);
    return true;
  }

  function boot() {
    if (build()) return;
    var n = 0;
    var t = setInterval(function () {
      n++;
      if (build() || n > 40) clearInterval(t);
    }, 400);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", boot);
})();

/* 曲库抽屉头部：标题 + 关闭按钮 */
(function () {
  "use strict";
  function head() {
    var list = document.querySelector("#anMusic-page .aplayer-list");
    if (!list || list.querySelector(".mm-list-head")) return !!list;
    var h = document.createElement("div");
    h.className = "mm-list-head";
    var n = list.querySelectorAll("li").length;
    h.innerHTML = '<span class="mm-list-title">曲库 · ' + n + ' 首</span>' +
      '<button class="mm-list-close" type="button" aria-label="关闭">✕</button>';
    h.querySelector(".mm-list-close").addEventListener("click", function () {
      var menu = document.querySelector("#anMusic-page .aplayer-icon-menu");
      if (menu) menu.click();
    });
    list.insertBefore(h, list.firstChild);
    return true;
  }
  function boot() { if (head()) return; var n = 0; var t = setInterval(function () { n++; if (head() || n > 40) clearInterval(t); }, 400); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", boot);
})();
