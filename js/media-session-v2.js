/*! 媒体会话 v2：让手机锁屏/通知栏显示当前歌曲名、歌手与封面，并支持锁屏控制 */
(function () {
  "use strict";

  if (!("mediaSession" in navigator)) return;

  var players = [];
  var active = null;
  var lastPos = 0;
  var handlersBound = false;

  function bigPic(url) {
    if (!url) return "";
    if (/param=\d+y\d+/.test(url)) return url.replace(/param=\d+y\d+/, "param=600y600");
    return url;
  }

  function trackOf(ap) {
    var idx = ap.list.index;
    return (ap.list.audios || [])[idx] || {};
  }

  function render(force) {
    // 首页迷你播放器与音乐馆可能同时在，优先交给正在播放的那个
    var playing = null;
    for (var i = 0; i < players.length; i++) {
      if (players[i].audio && !players[i].audio.paused) { playing = players[i]; break; }
    }
    var ap = playing || active || players[0];
    if (!ap || !ap.list) return;
    active = ap;

    var a = trackOf(ap);
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

    try {
      navigator.mediaSession.playbackState =
        ap.audio && !ap.audio.paused ? "playing" : "paused";
    } catch (e) {}

    position(ap, !!force);
    bindHandlers();
  }

  function position(ap, force) {
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

  function bindHandlers() {
    if (handlersBound) return;
    handlersBound = true;
    function cur() { return active; }
    try {
      navigator.mediaSession.setActionHandler("play", function () { var a = cur(); if (a) a.play(); });
      navigator.mediaSession.setActionHandler("pause", function () { var a = cur(); if (a) a.pause(); });
      navigator.mediaSession.setActionHandler("previoustrack", function () { var a = cur(); if (a) a.skipBack(); });
      navigator.mediaSession.setActionHandler("nexttrack", function () { var a = cur(); if (a) a.skipForward(); });
      navigator.mediaSession.setActionHandler("seekto", function (d) {
        var a = cur();
        if (a && d && typeof d.seekTime === "number") a.seek(d.seekTime);
      });
      navigator.mediaSession.setActionHandler("seekbackward", function () {
        var a = cur();
        if (a && a.audio) a.seek(Math.max(0, a.audio.currentTime - 10));
      });
      navigator.mediaSession.setActionHandler("seekforward", function () {
        var a = cur();
        if (a && a.audio) a.seek(Math.min(a.audio.duration || 0, a.audio.currentTime + 10));
      });
    } catch (e) {}
  }

  function attach(ap) {
    if (!ap || !ap.list || ap.__msBound) return;
    ap.__msBound = true;
    players.push(ap);

    ["listswitch", "play", "pause", "ended", "stoped"].forEach(function (ev) {
      try {
        ap.on(ev, function () {
          if (ev === "play" || ev === "listswitch") active = ap;
          // listswitch 事件触发时 APlayer 的 index 可能还没更新，挪到下一拍再读
          if (ev === "listswitch") setTimeout(function () { render(true); }, 60);
          else render(true);
        });
      } catch (e) {}
    });

    if (ap.audio) {
      ["play", "pause", "loadedmetadata", "durationchange"].forEach(function (ev) {
        ap.audio.addEventListener(ev, function () {
          if (ev === "play") active = ap;
          render(true);
        }, { passive: true });
      });
      ap.audio.addEventListener("timeupdate", function () {
        if (active === ap) position(ap, false);
      }, { passive: true });
    }

    if (!active) active = ap;
    render(true);
  }

  function scan() {
    var found = [];
    if (window.aplayers && window.aplayers.length) {
      for (var i = 0; i < window.aplayers.length; i++) found.push(window.aplayers[i]);
    }
    document.querySelectorAll("meting-js").forEach(function (m) {
      if (m.aplayer && found.indexOf(m.aplayer) === -1) found.push(m.aplayer);
    });
    for (var j = 0; j < found.length; j++) {
      var p = found[j];
      if (p && p.list && (p.list.audios || []).length) attach(p);
    }
    return players.length > 0;
  }

  function boot() {
    scan();
    var n = 0;
    var t = setInterval(function () { n++; if (scan() || n > 40) clearInterval(t); }, 400);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 400); });
})();
