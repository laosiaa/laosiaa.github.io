/*! 视频抢走声音后，视频关掉/暂停时自动把音乐接着放 */
(function () {
  "use strict";

  var pending = null; // { ap, video, pausedByMutex }

  function players() {
    var out = [];
    if (window.aplayers && window.aplayers.length) out = out.concat(window.aplayers);
    document.querySelectorAll("meting-js").forEach(function (m) {
      if (m.aplayer && out.indexOf(m.aplayer) === -1) out.push(m.aplayer);
    });
    return out;
  }

  function playingNow() {
    var list = players();
    for (var i = 0; i < list.length; i++) {
      var a = list[i].audio;
      if (a && !a.paused) return list[i];
    }
    return null;
  }

  /* 视频开始出声 → APlayer 的 mutex 会自己暂停音乐，我们只负责记住“等会儿要接着放” */
  document.addEventListener(
    "play",
    function (e) {
      var t = e.target;
      if (!t || t.tagName !== "VIDEO") return;
      var ap = playingNow();
      if (!ap) return; // 本来就没在放歌，不用管
      pending = { ap: ap, video: t, pausedByMutex: false,
                  wantWas: (typeof window.__mmWantPlay === "function" ? window.__mmWantPlay() : true) };
      setTimeout(function () {
        if (pending && pending.video === t && ap.audio && ap.audio.paused) pending.pausedByMutex = true;
      }, 260);
    },
    true
  );

  /* 用户自己按了播放/暂停，就别替他恢复 */
  document.addEventListener(
    "click",
    function (e) {
      var t = e.target;
      if (t && t.closest && t.closest(".aplayer-icon-play, .mm-row-2 .aplayer-icon-play")) pending = null;
    },
    true
  );
  /* 注意：这里不要去 setActionHandler("pause")，那会覆盖 media-session-v3 的锁屏暂停处理 */

  function resume(reason) {
    if (!pending || !pending.pausedByMutex) return;
    var ap = pending.ap;
    var wantWas = pending.wantWas;
    pending = null;
    // 视频开始时音乐本来就是暂停的（用户不想听）→ 别替他恢复
    if (wantWas === false) return;
    try {
      // 用户手动暂停过就别硬放：只在 audio 仍是暂停态时恢复
      if (ap.audio && ap.audio.paused) ap.play();
    } catch (e) {}
  }

  ["pause", "ended", "emptied"].forEach(function (ev) {
    document.addEventListener(
      ev,
      function (e) {
        if (!pending || e.target !== pending.video) return;
        setTimeout(function () { resume(ev); }, ev === "ended" ? 600 : 260);
      },
      true
    );
  });

  /* 视频被移除 / 被隐藏（弹层关闭）也算“关掉” */
  function checkGone() {
    if (!pending) return;
    var v = pending.video;
    // 注意：position:fixed 的 video 其 offsetParent 恒为 null，不能用它判断可见性
    var gone = !v || !v.isConnected || v.paused || v.ended || v.getClientRects().length === 0;
    if (gone) {
      setTimeout(function () { resume("hidden"); }, 200);
    }
  }

  var mo = new MutationObserver(function () { setTimeout(checkGone, 120); });
  document.addEventListener("DOMContentLoaded", function () {
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
  });
  setInterval(checkGone, 1200);

  /* 站内 pjax 翻页（比如从视频文章离开）也当成视频关掉 */
  document.addEventListener("pjax:complete", function () {
    setTimeout(checkGone, 400);
  });

  /* 调试用：控制台里 __mvState() 能看到待恢复状态 */
  window.__mvState = function () {
    return pending ? { video: pending.video && pending.video.tagName, pausedByMutex: pending.pausedByMutex } : null;
  };
})();
