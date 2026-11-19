/*! 音乐馆：记忆播放（曲目 / 进度 / 音量 / 播放模式），刷新或下次进入自动接着放 */
(function () {
  "use strict";

  var KEY = "mm-play-state-v1";
  var MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 天内有效
  var lastSave = 0;
  var restored = false;

  function read() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!o || !o.at || Date.now() - o.at > MAX_AGE) return null;
      return o;
    } catch (e) {
      return null;
    }
  }
  function write(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) {}
  }

  function getAp() {
    var m = document.querySelector("meting-js");
    if (m && m.aplayer && m.aplayer.audio) return m.aplayer;
    if (window.aplayers && window.aplayers.length && window.aplayers[0].audio) return window.aplayers[0];
    return null;
  }

  function save(ap, force) {
    if (!ap || !ap.list) return;
    var now = Date.now();
    if (!force && now - lastSave < 2000) return;
    lastSave = now;
    var idx = ap.list.index;
    var a = (ap.list.audios && ap.list.audios[idx]) || {};
    var t = ap.audio ? ap.audio.currentTime || 0 : 0;
    write({
      i: idx,
      name: a.name || "",
      artist: a.artist || "",
      t: Math.max(0, Math.round(t * 10) / 10),
      vol: ap.volume(),
      order: (ap.options || {}).order || "list",
      loop: (ap.options || {}).loop || "all",
      playing: !!(ap.audio && !ap.audio.paused),
      at: now,
    });
  }

  function findIndexBy(ap, name, artist) {
    var list = (ap.list && ap.list.audios) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].name === name && (!artist || list[i].artist === artist)) return i;
    }
    return -1;
  }

  function restore(ap) {
    if (restored || !ap) return;
    var st = read();
    if (!st) { restored = true; return; }
    restored = true;

    // 音量 & 播放模式
    try { if (typeof st.vol === "number") ap.volume(st.vol); } catch (e) {}
    // 顺序/循环状态（ap.mode 是布局模式，别存它）
    try {
      ap.options = ap.options || {};
      if (st.order) ap.options.order = st.order;
      if (st.loop) ap.options.loop = st.loop;
    } catch (e) {}

    // 曲目：同名优先，找不到再用索引
    var idx = -1;
    if (st.name) idx = findIndexBy(ap, st.name, st.artist);
    if (idx < 0 && typeof st.i === "number" && st.i < (ap.list.audios || []).length) idx = st.i;
    if (idx < 0) return;

    var seekTo = st.t || 0;
    if (ap.list.index !== idx) {
      try { ap.list.switch(idx); } catch (e) {}
    }
    function resume() {
      if (!st.playing) return;
      var go = function () {
        try {
          var r = ap.play();
          if (r && r.catch) r.catch(function () {});
        } catch (e) {}
      };
      go();
      // 被自动播放策略拦下时，等用户第一次点屏幕/按键再续播
      var once = function () {
        document.removeEventListener("pointerdown", once, true);
        document.removeEventListener("keydown", once, true);
        if (ap.audio && ap.audio.paused) go();
      };
      setTimeout(function () {
        if (ap.audio && ap.audio.paused) {
          document.addEventListener("pointerdown", once, true);
          document.addEventListener("keydown", once, true);
        }
      }, 600);
    }

    // 元数据就绪后再定位：监听事件 + 轮询双保险，避免时长未知导致 seek 失败
    var done = false;
    function trySeek() {
      if (done) return;
      var d = ap.audio ? ap.audio.duration : 0;
      if (!d || !isFinite(d)) return;
      done = true;
      try { if (seekTo > 0.5 && seekTo < d - 2) ap.seek(seekTo); } catch (e) {}
      resume();
    }
    if (ap.audio) {
      ap.audio.preload = "metadata";
      ["loadedmetadata", "durationchange", "canplay", "canplaythrough"].forEach(function (ev) {
        ap.audio.addEventListener(ev, trySeek);
      });
      try { if (!ap.audio.duration) ap.audio.load(); } catch (e) {}
    }
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      trySeek();
      if (done || tries > 40) {
        clearInterval(timer);
        if (!done) resume();
      }
    }, 250);
  }

  function bind(ap) {
    if (!ap || ap.__mmRemember) return;
    ap.__mmRemember = true;

    restore(ap);

    if (ap.audio) {
      ap.audio.addEventListener("timeupdate", function () { save(ap); }, { passive: true });
      ap.audio.addEventListener("pause", function () { save(ap, true); });
      ap.audio.addEventListener("play", function () { save(ap, true); });
      ap.audio.addEventListener("ended", function () { save(ap, true); });
    }
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") save(ap, true);
    });
    window.addEventListener("pagehide", function () { save(ap, true); });
    window.addEventListener("beforeunload", function () { save(ap, true); });
  }

  function boot() {
    var n = 0;
    var t = setInterval(function () {
      n++;
      var ap = getAp();
      if (ap && ap.list && ap.list.audios && ap.list.audios.length) {
        bind(ap);
        clearInterval(t);
      } else if (n > 50) {
        clearInterval(t);
      }
    }, 300);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", boot);
})();
