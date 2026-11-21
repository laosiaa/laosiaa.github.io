/*! 播完自动接下一首：APlayer 的 ended→next 在后台/锁屏时偶尔不触发，这里兜一层 */
(function () {
  "use strict";

  var waiting = null; // { ap, idx }

  function getAp() {
    var host = document.querySelector("#anMusic-page meting-js");
    if (host && host.aplayer) return host.aplayer;
    if (window.aplayers && window.aplayers.length) return window.aplayers[0];
    return null;
  }

  function nextIdx(ap) {
    var n = (ap.list.audios || []).length;
    if (!n) return 0;
    var o = ap.options || {};
    if (o.order === "random") {
      var ro = ap.randomOrder || [];
      var i = ro.indexOf(ap.list.index);
      if (i >= 0 && ro.length === n) return ro[(i + 1) % ro.length];
      return Math.floor(Math.random() * n);
    }
    return (ap.list.index + 1) % n;
  }

  /* 试着让它继续出声；被浏览器拦就退避重试几次 */
  function kick(ap, tries) {
    tries = tries || 0;
    if (!ap || !ap.audio || !ap.audio.paused) return;
    // 用户已经暂停（例如在最后一秒按了暂停）→ 不要自动接下一首
    if (typeof window.__mmWantPlay === "function" && !window.__mmWantPlay()) return;
    try {
      var p = ap.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () {
          if (tries < 4) setTimeout(function () { kick(ap, tries + 1); }, 400 * (tries + 1));
        });
      }
    } catch (e) {}
    if (tries < 4) {
      setTimeout(function () {
        if (ap.audio && ap.audio.paused) kick(ap, tries + 1);
      }, 500 * (tries + 1));
    }
  }

  function bind(ap) {
    if (!ap || !ap.audio || ap.__mmAutoNext) return;
    ap.__mmAutoNext = true;

    ap.audio.addEventListener("ended", function () {
      var loopOne = (ap.options || {}).loop === "one";
      waiting = { ap: ap, idx: ap.list.index };
      setTimeout(function () {
        // 这段时间里 APlayer 自己切歌了（会触发 listswitch）→ 交给它
        if (!waiting || waiting.ap !== ap) return;
        var w = waiting;
        waiting = null;
        if (!ap.audio || !ap.audio.paused) return;

        if (loopOne) {
          try { ap.seek(0); } catch (e) {}
          kick(ap, 0);
          return;
        }
        // APlayer 完全没反应（后台被冻结等）才自己切
        if (ap.list.index === w.idx) {
          try { ap.list.switch(nextIdx(ap)); } catch (e) {}
        }
        setTimeout(function () { kick(ap, 0); }, 200);
      }, 900);
    });

    // APlayer 自己切歌成功时，这里只负责确保真的开始出声
    try {
      ap.on("listswitch", function () {
        if (waiting && waiting.ap === ap) waiting = null;
        setTimeout(function () { kick(ap, 0); }, 250);
      });
    } catch (e) {}
  }

  function scan() {
    bind(getAp());
  }

  scan();
  var n = 0;
  var t = setInterval(function () { n++; scan(); if (n > 40) clearInterval(t); }, 400);
  document.addEventListener("pjax:complete", function () { setTimeout(scan, 400); });
})();
