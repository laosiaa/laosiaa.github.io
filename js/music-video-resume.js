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
      pending = { ap: ap, video: t, pausedByMutex: false };
      setTimeout(function () {
        if (pending && pending.video === t && ap.audio && ap.audio.paused) pending.pausedByMutex = true;
      }, 260);
    },
    true
  );

  function resume(reason) {
    if (!pending || !pending.pausedByMutex) return;
    var ap = pending.ap;
    pending = null;
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
    if (!v || !v.isConnected || v.paused || v.ended || v.offsetParent === null) {
      setTimeout(function () { resume("hidden"); }, 200);
    }
  }

  var mo = new MutationObserver(function () { setTimeout(checkGone, 120); });
  document.addEventListener("DOMContentLoaded", function () {
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
  });
  setInterval(checkGone, 1200);
})();
