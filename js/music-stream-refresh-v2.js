/*! 音乐馆：音频直链过期导致「An audio error has occurred」的修正
 *
 * 播放地址是 /music-api/play?sid=<id>，Worker 会 302 到带时间戳的 CDN 直链（约 20 分钟过期）。
 * 媒体元素一旦解析过就记住那条直链；暂停久了、或从锁屏/通知栏直接点播放，
 * 请求打到过期链接 → 403 → APlayer 弹英文提示并 2 秒后跳下一首。
 *
 * 三层防护：
 *  1) 点播放前检查：距上次取链超过 15 分钟，先换新链（保住进度）再播 —— 覆盖锁屏/通知栏/网页按钮所有入口；
 *  2) 暂停期间每 6 分钟悄悄换一次链；
 *  3) 万一还是报错：立刻换新链续播，并在 APlayer 自动跳歌后把曲目切回来。
 */
(function () {
  "use strict";

  var REFRESH_MS = 6 * 60 * 1000;   // 暂停期间换链间隔
  var STALE_MS = 15 * 60 * 1000;    // 超过这个时间没取链，播放前先换
  var timer = null;
  var lastPauseAt = 0;
  var lastLoadAt = 0;
  var stallAttempts = 0;
  var lastRecoverAt = 0;
  var undo = null;                  // 报错后要切回来的曲目

  function getAplayer() {
    var host = document.querySelector("#anMusic-page meting-js");
    if (host && host.aplayer) return host.aplayer;
    if (window.aplayers && window.aplayers.length) return window.aplayers[0];
    return null;
  }

  function cur(ap) {
    try {
      return (ap.list.audios || [])[ap.list.index] || {};
    } catch (e) {
      return {};
    }
  }

  function freshUrl(item) {
    return item.url + (item.url.indexOf("?") >= 0 ? "&" : "?") + "_r=" + Date.now();
  }

  function markLoad() {
    lastLoadAt = Date.now();
  }

  /* 换成新直链并保住进度，之后执行 done() */
  function reload(done) {
    var ap = getAplayer();
    if (!ap || !ap.audio) return false;
    var item = cur(ap);
    if (!item.url) return false;
    var au = ap.audio;
    var t = au.currentTime || 0;

    try {
      au.preload = "metadata";
      au.src = freshUrl(item);
      au.load();
      markLoad();
    } catch (e) {
      return false;
    }

    var go = function () {
      try {
        if (t > 0.5 && Math.abs((au.currentTime || 0) - t) > 1) au.currentTime = t;
      } catch (e) {}
      au.removeEventListener("loadedmetadata", go);
      if (typeof done === "function") {
        try { done(); } catch (e) {}
      }
    };
    au.addEventListener("loadedmetadata", go);
    setTimeout(go, 1500);
    return true;
  }

  /* 包一层 play：链接太旧就先换链再播（锁屏/通知栏触发也走这里） */
  function wrapPlay(au) {
    if (au.__srfPlay || typeof au.play !== "function") return;
    au.__srfPlay = true;
    var orig = au.play;

    au.play = function () {
      try {
        if (lastLoadAt && Date.now() - lastLoadAt > STALE_MS && !au.__srfReloading) {
          au.__srfReloading = true;
          var ok = reload(function () {
            au.__srfReloading = false;
            try {
              var p = orig.call(au);
              if (p && p.catch) p.catch(function () {});
            } catch (e) {}
          });
          if (ok) return Promise.resolve();
          au.__srfReloading = false;
        }
      } catch (e) {}
      return orig.apply(au, arguments);
    };
  }

  /* 暂停期间定时换链 */
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var ap = getAplayer();
      if (!ap || !ap.audio || !ap.audio.paused) return;
      if (reload()) schedule();
    }, REFRESH_MS);
  }

  /* 报错兜底：换链续播，并把 APlayer 自动跳到的下一首切回来 */
  function onError(au) {
    var ap = getAplayer();
    if (!ap) return;
    undo = { idx: ap.list.index, t: au.currentTime || 0, at: Date.now() };
    reload(function () {
      try {
        var p = au.play();
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    });
  }

  /* 播放卡死看门狗：点了播放但进度不走 → 重新取链再来一次 */
  function watchdog(au, round) {
    var t0 = au.currentTime || 0;
    setTimeout(function () {
      if (au.paused) return;
      if (Math.abs((au.currentTime || 0) - t0) > 0.3) return;
      if (round === 0 && (au.readyState < 2 || au.networkState !== 1)) {
        watchdog(au, 1);
        return;
      }
      var now = Date.now();
      if (now - lastRecoverAt < 12000 || stallAttempts >= 2) return;
      lastRecoverAt = now;
      stallAttempts++;
      reload(function () {
        try {
          var p = au.play();
          if (p && p.catch) p.catch(function () {});
        } catch (e) {}
      });
    }, round === 0 ? 1800 : 2500);
  }

  function bind() {
    var ap = getAplayer();
    if (!ap || !ap.audio || ap.__streamRefresh) return;
    ap.__streamRefresh = true;
    var au = ap.audio;
    markLoad();
    wrapPlay(au);

    au.addEventListener("pause", function () {
      lastPauseAt = Date.now();
      schedule();
    });
    au.addEventListener("play", function () {
      clearTimeout(timer);
      stallAttempts = 0;
      markLoad();
      watchdog(au, 0);
    });
    au.addEventListener("ended", function () {
      clearTimeout(timer);
    });
    au.addEventListener("error", function () {
      if (!au.error) return;
      onError(au);
    });

    try {
      ap.on("listswitch", function () {
        clearTimeout(timer);
        stallAttempts = 0;
        markLoad();
        // 报错后 4 秒内 APlayer 自己跳了歌：切回原来那首
        if (undo && Date.now() - undo.at < 4000) {
          var target = undo.idx;
          var t = undo.t;
          undo = null;
          setTimeout(function () {
            try {
              if (ap.list.index !== target) ap.list.switch(target);
              setTimeout(function () {
                try {
                  if (t > 0.5) ap.audio.currentTime = t;
                  var p = ap.audio.play();
                  if (p && p.catch) p.catch(function () {});
                } catch (e) {}
              }, 500);
            } catch (e) {}
          }, 150);
        }
        if (au.paused) schedule();
      });
    } catch (e) {}

    // 手机端：切后台定时器会被冻结，回到前台先补一次刷新
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      if (!au.paused) return;
      if (Date.now() - lastPauseAt < 120000) return;
      reload();
      schedule();
    });

    if (au.paused) schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, false);
  } else {
    bind();
  }
  setInterval(bind, 2000);

  // 调试钩子
  window.__mmRefreshStream = function () { return reload(); };
  window.__mmForceStale = function () { lastLoadAt = Date.now() - STALE_MS - 1000; return true; };
})();
