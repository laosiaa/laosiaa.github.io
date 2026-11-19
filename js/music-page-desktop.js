/*! 桌面端音乐馆：仿网易云网页版底部播放条（左：封面+歌名；中：上一首/播放/下一首 + 进度；右：模式/音量/曲库） */
(function () {
  "use strict";

  function isDesktop() {
    return window.innerWidth > 768;
  }

  function getAp() {
    var host = document.querySelector("#anMusic-page meting-js");
    if (host && host.aplayer) return host.aplayer;
    if (window.aplayers && window.aplayers.length) return window.aplayers[0];
    return null;
  }

  function picUrl(ap) {
    try {
      var a = ap.list.audios[ap.list.index] || {};
      return a.pic || a.cover || "";
    } catch (e) {
      return "";
    }
  }

  function build(ap) {
    var el = document.getElementById("anMusic-page");
    if (!el) return false;
    var ctrl = el.querySelector(".aplayer-controller");
    if (!ctrl || ctrl.dataset.mdDone === "1") return !!ctrl;

    var bar = ctrl.querySelector(".aplayer-bar-wrap");
    var ptime = ctrl.querySelector(".aplayer-ptime");
    var dtime = ctrl.querySelector(".aplayer-dtime");
    var back = el.querySelector(".aplayer-icon-back");
    var play = el.querySelector(".aplayer-icon-play");
    var fwd = el.querySelector(".aplayer-icon-forward");
    var menu = el.querySelector(".aplayer-icon-menu");
    if (!bar || !play) return false;

    ctrl.dataset.mdDone = "1";
    ctrl.innerHTML = "";
    ctrl.classList.add("md-bar");

    /* 左：封面 + 歌名/歌手 */
    var left = document.createElement("div");
    left.className = "md-left";
    var cover = document.createElement("div");
    cover.className = "md-cover";
    var meta = document.createElement("div");
    meta.className = "md-meta";
    var t1 = document.createElement("div");
    t1.className = "md-title";
    var t2 = document.createElement("div");
    t2.className = "md-artist";
    meta.appendChild(t1);
    meta.appendChild(t2);
    left.appendChild(cover);
    left.appendChild(meta);

    function paintMeta() {
      cover.style.backgroundImage = "url('" + String(picUrl(ap)).replace(/'/g, "%27") + "')";
      try {
        var a = ap.list.audios[ap.list.index] || {};
        t1.textContent = a.name || "";
        t2.textContent = a.artist || "";
      } catch (e) {}
    }
    paintMeta();
    try {
      ap.on("listswitch", function () { setTimeout(paintMeta, 60); });
    } catch (e) {}

    /* 中：上一首 / 播放 / 下一首 */
    var btns = document.createElement("div");
    btns.className = "md-btns";
    [back, play, fwd].forEach(function (n) {
      if (n) btns.appendChild(n);
    });

    /* 进度：时间 + 进度条 + 时间 */
    var prog = document.createElement("div");
    prog.className = "md-prog";
    if (ptime) prog.appendChild(ptime);
    prog.appendChild(bar);
    if (dtime) prog.appendChild(dtime);

    /* 右：模式 / 音量 / 曲库 */
    var right = document.createElement("div");
    right.className = "md-right";

    var MODES = ["顺序播放", "随机播放", "单曲循环"];
    var mode = document.createElement("button");
    mode.type = "button";
    mode.className = "md-icon md-mode";
    mode.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h7"/><path d="M17 15l3 3-3 3"/></svg>';
    function modeIdx() {
      var o = ap.options || {};
      if (o.loop === "one") return 2;
      if (o.order === "random") return 1;
      return 0;
    }
    function modePaint() {
      mode.title = MODES[modeIdx()];
      mode.classList.toggle("is-on", modeIdx() !== 0);
    }
    mode.addEventListener("click", function () {
      var o = ap.options || (ap.options = {});
      var i = (modeIdx() + 1) % 3;
      if (i === 1) { o.order = "random"; o.loop = "all"; }
      else if (i === 2) { o.order = "list"; o.loop = "one"; }
      else { o.order = "list"; o.loop = "all"; }
      modePaint();
    });
    modePaint();

    var vol = document.createElement("div");
    vol.className = "md-vol";
    vol.innerHTML =
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">' +
      '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>';
    var range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = "1";
    range.step = "0.01";
    range.className = "md-vol-range";
    try { range.value = ap.volume(); } catch (e) {}
    range.addEventListener("input", function () {
      try { ap.volume(parseFloat(range.value)); } catch (e) {}
    });
    vol.appendChild(range);
    var lastVol = 1;
    vol.querySelector("svg").addEventListener("click", function () {
      try {
        var v = ap.volume();
        if (v > 0) { lastVol = v; ap.volume(0); range.value = 0; }
        else { ap.volume(lastVol || 1); range.value = lastVol || 1; }
      } catch (e) {}
    });

    if (menu) {
      menu.className = "md-icon md-menu";
      menu.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">' +
        '<path d="M4 6h9"/><path d="M4 12h9"/><path d="M4 18h6"/><path d="M18 4.5v9.2"/><circle cx="16.2" cy="15.6" r="2.4"/></svg>';
      menu.title = "播放列表";
      /* 网易云顺序：模式 → 音量 → 播放列表 */
    }
    right.appendChild(mode);
    right.appendChild(vol);
    if (menu) right.appendChild(menu);

    ctrl.appendChild(left);
    ctrl.appendChild(btns);
    ctrl.appendChild(prog);
    ctrl.appendChild(right);
    return true;
  }

  function tick() {
    if (!isDesktop()) return;
    build(getAp());
  }

  var n = 0;
  var t = setInterval(function () {
    n++;
    if (tick() || n > 45) clearInterval(t);
  }, 400);
  window.addEventListener("resize", function () { setTimeout(tick, 300); });
  document.addEventListener("pjax:complete", function () {
    setTimeout(function () {
      var ctrl = document.querySelector("#anMusic-page .aplayer-controller");
      if (ctrl) ctrl.dataset.mdDone = "";
      tick();
    }, 500);
  });
})();
