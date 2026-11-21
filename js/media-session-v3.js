/*! 媒体会话 v3：只有“真正在出声”的播放器实例才能接管锁屏/通知栏 */
(function () {
  "use strict";

  if (!("mediaSession" in navigator)) return;

  var players = [];
  var active = null;      // 最近真正播放过的实例（用于暂停时保留锁屏信息）
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

  /* 正在出声的实例（audio 未暂停且已加载） */
  function sounding() {
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      if (p.audio && !p.audio.paused && p.audio.currentTime > 0) return p;
      if (p.audio && !p.audio.paused && p.audio.readyState > 0) return p;
    }
    return null;
  }

  /* 把所有实例都停掉：锁屏/通知栏点暂停时，不能只停 active 那一个
     （音乐页播放器 + 左下角迷你播放器是两个 APlayer 实例，
      只停其中一个就会出现「已经暂停了但还有声音」） */
  function pauseAll(except) {
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      if (!p || p === except || !p.audio || p.audio.paused) continue;
      try { p.pause(); } catch (e) {}
    }
  }

  /* 同时只允许一个实例出声（主题没开 mutex 时靠这里兜住） */
  function soloPlay(winner) {
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      if (!p || p === winner || !p.audio || p.audio.paused) continue;
      try { p.pause(); } catch (e) {}
    }
  }

  function paintMeta(ap) {
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
  }

  function paintState(ap) {
    try {
      navigator.mediaSession.playbackState =
        ap && ap.audio && !ap.audio.paused ? "playing" : "paused";
    } catch (e) {}
  }

  function position(ap, force) {
    if (!ap || !ap.audio || !ap.audio.duration || !isFinite(ap.audio.duration)) return;
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

  /* 只有“正在出声”的那个实例才会改锁屏内容；
     但 iOS 有时在 play 的瞬间 readyState/currentTime 还没就绪，sounding() 会返回 null，
     这时退回到 active（最近真正播放过的实例），否则锁屏会退回显示网页标题。 */
  function sync(force) {
    var ap = sounding() || active;
    if (!ap) return;              // 从来没播过 → 保持锁屏现状，不抢
    if (sounding()) active = ap;
    paintMeta(ap);
    paintState(ap);
    position(ap, !!force);
    bindHandlers();
  }

  function bindHandlers() {
    if (handlersBound) return;
    handlersBound = true;
    try {
      navigator.mediaSession.setActionHandler("play", function () {
        var a = active; if (a) a.play();
      });
      navigator.mediaSession.setActionHandler("pause", function () {
        pauseAll(null);          // 所有实例一起停，避免另一个播放器还在响
      });
      navigator.mediaSession.setActionHandler("previoustrack", function () {
        var a = active; if (a) a.skipBack();
      });
      navigator.mediaSession.setActionHandler("nexttrack", function () {
        var a = active; if (a) a.skipForward();
      });
      navigator.mediaSession.setActionHandler("seekto", function (d) {
        var a = active;
        if (a && d && typeof d.seekTime === "number") a.seek(d.seekTime);
      });
      navigator.mediaSession.setActionHandler("seekbackward", function () {
        var a = active;
        if (a && a.audio) a.seek(Math.max(0, a.audio.currentTime - 10));
      });
      navigator.mediaSession.setActionHandler("seekforward", function () {
        var a = active;
        if (a && a.audio) a.seek(Math.min(a.audio.duration || 0, a.audio.currentTime + 10));
      });
    } catch (e) {}
  }

  function attach(ap) {
    if (!ap || !ap.list || ap.__ms3) return;
    ap.__ms3 = true;
    players.push(ap);

    if (ap.audio) {
      ap.audio.addEventListener("play", function () {
        active = ap;
        soloPlay(ap);            // 同时只让一个实例出声
        // 等一拍，等 APlayer 把 index / src 切好
        setTimeout(function () { sync(true); }, 120);
      }, { passive: true });
      ap.audio.addEventListener("playing", function () { setTimeout(function () { sync(true); }, 60); }, { passive: true });
      ap.audio.addEventListener("pause", function () {
        if (active === ap) paintState(ap);   // 只改状态，不动标题
      }, { passive: true });
      ap.audio.addEventListener("loadedmetadata", function () { if (!ap.audio.paused) sync(true); }, { passive: true });
      ap.audio.addEventListener("timeupdate", function () {
        if (active === ap && !ap.audio.paused) position(ap, false);
      }, { passive: true });
    }

    ["listswitch", "ended"].forEach(function (ev) {
      try {
        ap.on(ev, function () {
          if (!ap.audio || ap.audio.paused) return;  // 没在放就不抢锁屏
          active = ap;
          setTimeout(function () { sync(true); }, 150);
        });
      } catch (e) {}
    });
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

  /* 看门狗：只有正在出声时才校准，避免暂停的实例把锁屏改掉 */
  function watchdog() {
    var ap = sounding();
    if (ap) {
      var a = trackOf(ap);
      var md = navigator.mediaSession.metadata;
      if (!md || md.title !== (a.name || "") || md.artist !== (a.artist || "")) {
        active = ap;
        paintMeta(ap);
        paintState(ap);
      }
      return;
    }
    // 没有实例在放，但锁屏信息整个丢了（iOS 常见）→ 用最近播放过的实例补回去
    if (!navigator.mediaSession.metadata && active && active.list) {
      paintMeta(active);
      try { navigator.mediaSession.playbackState = "paused"; } catch (e) {}
    }
  }

  function boot() {
    scan();
    var n = 0;
    var t = setInterval(function () { n++; if (scan() || n > 40) clearInterval(t); }, 400);
    if (!window.__ms3Watch) window.__ms3Watch = setInterval(watchdog, 2000);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") setTimeout(function () { sync(false); }, 300);
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 400); });
})();
