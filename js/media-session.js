/*! 媒体会话：让手机锁屏/通知栏显示当前歌曲名、歌手与封面，并支持锁屏控制 */
(function () {
  "use strict";

  if (!("mediaSession" in navigator)) return;

  function getPlayers() {
    var out = [];
    if (window.aplayers && window.aplayers.length) {
      for (var i = 0; i < window.aplayers.length; i++) out.push(window.aplayers[i]);
    }
    document.querySelectorAll("meting-js").forEach(function (m) {
      if (m.aplayer && out.indexOf(m.aplayer) === -1) out.push(m.aplayer);
    });
    document.querySelectorAll(".aplayer").forEach(function (el) {
      var p = el.player || (el.aplayer && el.aplayer.player);
      if (p && out.indexOf(p) === -1) out.push(p);
    });
    return out;
  }

  function bigPic(url) {
    if (!url) return "";
    if (/param=\d+y\d+/.test(url)) return url.replace(/param=\d+y\d+/, "param=600y600");
    return url;
  }

  function attach(ap) {
    if (!ap || !ap.list || ap.__msBound) return;
    ap.__msBound = true;

    var lastPos = 0;

    function meta() {
      var idx = ap.list.index;
      var a = (ap.list.audios || [])[idx] || {};
      var pic = bigPic(a.pic || "");
      var artwork = pic
        ? [
            { src: pic, sizes: "512x512", type: "image/jpeg" },
            { src: pic, sizes: "256x256", type: "image/jpeg" },
            { src: pic, sizes: "128x128", type: "image/jpeg" },
          ]
        : [];
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: a.name || "未知曲目",
          artist: a.artist || "Laosia 音乐馆",
          album: "Laosia 音乐馆",
          artwork: artwork,
        });
      } catch (e) {}
      state();
    }

    function state() {
      try {
        navigator.mediaSession.playbackState =
          ap.audio && !ap.audio.paused ? "playing" : "paused";
      } catch (e) {}
    }

    function position(force) {
      if (!ap.audio || !ap.audio.duration || !isFinite(ap.audio.duration)) return;
      var now = Date.now();
      if (!force && now - lastPos < 900) return;
      lastPos = now;
      try {
        navigator.mediaSession.setPositionState({
          duration: ap.audio.duration,
          playbackRate: ap.audio.playbackRate || 1,
          position: Math.min(ap.audio.currentTime, ap.audio.duration),
        });
      } catch (e) {}
    }

    // APlayer 事件
    ["listswitch", "play", "pause", "ended", "stoped"].forEach(function (ev) {
      try { ap.on(ev, function () { meta(); position(true); }); } catch (e) {}
    });

    if (ap.audio) {
      ["play", "pause", "loadedmetadata", "durationchange"].forEach(function (ev) {
        ap.audio.addEventListener(ev, function () { meta(); position(true); }, { passive: true });
      });
      ap.audio.addEventListener("timeupdate", function () { position(false); }, { passive: true });
    }

    // 锁屏按钮
    try {
      navigator.mediaSession.setActionHandler("play", function () { ap.play(); });
      navigator.mediaSession.setActionHandler("pause", function () { ap.pause(); });
      navigator.mediaSession.setActionHandler("previoustrack", function () { ap.skipBack(); });
      navigator.mediaSession.setActionHandler("nexttrack", function () { ap.skipForward(); });
      navigator.mediaSession.setActionHandler("seekto", function (d) {
        if (d && typeof d.seekTime === "number") ap.seek(d.seekTime);
      });
      navigator.mediaSession.setActionHandler("seekbackward", function () {
        if (ap.audio) ap.seek(Math.max(0, ap.audio.currentTime - 10));
      });
      navigator.mediaSession.setActionHandler("seekforward", function () {
        if (ap.audio) ap.seek(Math.min(ap.audio.duration || 0, ap.audio.currentTime + 10));
      });
    } catch (e) {}

    meta();
  }

  function tick() {
    var ps = getPlayers();
    for (var i = 0; i < ps.length; i++) {
      if (ps[i] && ps[i].list && (ps[i].list.audios || []).length) attach(ps[i]);
    }
  }

  function boot() {
    tick();
    var n = 0;
    var t = setInterval(function () { n++; tick(); if (n > 40) clearInterval(t); }, 400);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 400); });
})();
