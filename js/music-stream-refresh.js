/*! 音乐馆：长时间暂停后「点播放报音频错误」的修正
 *
 * 播放地址是 /music-api/play?sid=<id>，Worker 会 302 到带时间戳的 CDN 直链（约 20 分钟过期）。
 * 暂停后播放器仍然记着那条已过期的直链，隔一阵再点播放 → 403 → APlayer 弹
 * "An audio error has occurred..." 并自动跳下一首。
 *
 * 做法：暂停期间每 6 分钟悄悄把 audio.src 重置回原始地址（重新 302 拿新直链）并保持进度，
 * 这样用户再点播放时拿到的一定是有效链接；不暂停时完全不干预。
 */
(function () {
  "use strict";

  var REFRESH_MS = 6 * 60 * 1000; // 暂停超过这么久就换一次直链
  var timer = null;
  var lastPauseAt = 0;

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

  /* 把 audio 的 src 换成原始接口地址（重新解析直链），并保住播放进度 */
  function refreshSrc() {
    var ap = getAplayer();
    if (!ap || !ap.audio) return false;
    var au = ap.audio;
    var item = cur(ap);
    if (!item.url) return false;
    if (!au.paused) return false; // 正在放就别碰

    var t = au.currentTime || 0;
    try {
      au.preload = "metadata";
      // 加时间戳确保一定重新走一次 302（Worker 的跳转是 no-store，但媒体元素可能复用旧解析结果）
      au.src = item.url + (item.url.indexOf("?") >= 0 ? "&" : "?") + "_r=" + Date.now();
      au.load();
    } catch (e) {
      return false;
    }

    if (t > 0.5) {
      var restore = function () {
        try {
          if (Math.abs((au.currentTime || 0) - t) > 1) au.currentTime = t;
        } catch (e) {}
        au.removeEventListener("loadedmetadata", restore);
      };
      au.addEventListener("loadedmetadata", restore);
      setTimeout(restore, 1500);
    }
    return true;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (refreshSrc()) schedule(); // 还暂停着就继续每 6 分钟换一次
    }, REFRESH_MS);
  }

  function bind() {
    var ap = getAplayer();
    if (!ap || !ap.audio || ap.__streamRefresh) return;
    ap.__streamRefresh = true;
    var au = ap.audio;

    au.addEventListener("pause", function () {
      lastPauseAt = Date.now();
      schedule();
    });
    au.addEventListener("play", function () {
      clearTimeout(timer);
      stallAttempts = 0;
      watchdog(au, 0);
    });
    au.addEventListener("ended", function () {
      clearTimeout(timer);
    });
    // 切歌时清掉计时，避免拿上一首的地址去刷新
    try {
      ap.on("listswitch", function () {
        clearTimeout(timer);
        stallAttempts = 0;
        if (au.paused) schedule();
      });
    } catch (e) {}

    // 手机端：App 切后台后定时器会被冻结，回到前台先补一次刷新
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      if (!au.paused) return;
      if (Date.now() - lastPauseAt < 120000) return;
      refreshSrc();
      schedule();
    });

    if (au.paused) schedule();
  }

  /* 播放卡死看门狗：点了播放但进度不走 → 重新解析直链再来一次
   * （App 冷启动恢复上次曲目后，媒体元素有时停在“已加载但不动”的状态，刷新页面才好） */
  var stallAttempts = 0;
  var lastRecoverAt = 0;

  function watchdog(au, round) {
    var t0 = au.currentTime || 0;
    setTimeout(function () {
      if (au.paused) return;
      if (Math.abs((au.currentTime || 0) - t0) > 0.3) return; // 在走，正常
      if (round === 0 && au.readyState < 2) {
        watchdog(au, 1); // 还在下载，再给 2.5 秒
        return;
      }
      if (round === 0 && au.networkState !== 1) {
        watchdog(au, 1);
        return;
      }
      recover();
    }, round === 0 ? 1800 : 2500);
  }

  function recover() {
    var now = Date.now();
    if (now - lastRecoverAt < 12000) return;
    if (stallAttempts >= 2) return;
    lastRecoverAt = now;
    stallAttempts++;

    var ap = getAplayer();
    if (!ap || !ap.audio) return;
    var item = cur(ap);
    if (!item.url) return;
    var au = ap.audio;
    var t = au.currentTime || 0;

    try {
      au.src = item.url + (item.url.indexOf("?") >= 0 ? "&" : "?") + "_r=" + now;
      au.load();
    } catch (e) {
      return;
    }
    var go = function () {
      try {
        if (t > 0.5 && Math.abs((au.currentTime || 0) - t) > 1) au.currentTime = t;
      } catch (e) {}
      try {
        var p = au.play();
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
      au.removeEventListener("loadedmetadata", go);
    };
    au.addEventListener("loadedmetadata", go);
    setTimeout(go, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, false);
  } else {
    bind();
  }
  setInterval(bind, 2000);

  // 调试钩子
  window.__mmRefreshStream = refreshSrc;
})();
