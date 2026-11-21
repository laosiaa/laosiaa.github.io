/*! APK 原生桥：通知栏 / 耳机按键 / 锁屏 发来的指令落到网页播放器
 *
 * Android 端 PlayerService 的 MediaSession 回调会执行
 *   window.__laosiaNative && window.__laosiaNative('play'|'pause'|'next'|'prev'|'seek:12.3')
 * 之前网页侧根本没定义这个函数（`&&` 直接短路），所以通知栏点暂停完全没反应，
 * 音乐继续响——这就是「apk 暂停了还有声音」的根源之一。
 */
(function () {
  "use strict";

  function list() {
    var out = [];
    var host = document.querySelector("#anMusic-page meting-js");
    if (host && host.aplayer) out.push(host.aplayer);
    document.querySelectorAll("meting-js").forEach(function (m) {
      if (m.aplayer && out.indexOf(m.aplayer) === -1) out.push(m.aplayer);
    });
    if (window.aplayers && window.aplayers.length) {
      for (var i = 0; i < window.aplayers.length; i++) {
        if (out.indexOf(window.aplayers[i]) === -1) out.push(window.aplayers[i]);
      }
    }
    return out;
  }

  function sounding() {
    var all = list();
    for (var i = 0; i < all.length; i++) {
      var p = all[i];
      if (p.audio && !p.audio.paused) return p;
    }
    return null;
  }

  function current() {
    return sounding() || list()[0] || null;
  }

  function pauseAll() {
    list().forEach(function (p) {
      try { if (p.audio && !p.audio.paused) p.pause(); } catch (e) {}
    });
  }

  window.__laosiaNative = function (cmd) {
    cmd = String(cmd || "");
    try {
      if (cmd === "pause") { pauseAll(); return "ok"; }   // 暂停必须停掉所有实例
      var ap = current();
      if (!ap) return "no-player";
      if (cmd === "play") { ap.play(); return "ok"; }
      if (cmd === "next") { ap.skipForward ? ap.skipForward() : ap.list.switch((ap.list.index + 1) % ap.list.audios.length); return "ok"; }
      if (cmd === "prev") { ap.skipBack ? ap.skipBack() : ap.list.switch((ap.list.index - 1 + ap.list.audios.length) % ap.list.audios.length); return "ok"; }
      if (cmd.indexOf("seek:") === 0) {
        var s = parseFloat(cmd.slice(5));
        if (isFinite(s)) ap.seek(s);
        return "ok";
      }
    } catch (e) {
      return "err:" + e.message;
    }
    return "unknown";
  };
})();
