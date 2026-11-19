/*! 桌面端：底部卡拉OK歌词条（逐字/逐行填充高亮） */
(function () {
  "use strict";

  var ACCENT = "var(--anzhiyu-main, #f5c542)";
  var strip = null;
  var lineEl = null;
  var nextEl = null;
  var lines = [];
  var lrcKey = "";
  var lastIdx = -1;

  function isDesktop() {
    return window.innerWidth > 768;
  }

  function getAp() {
    var host = document.querySelector("#anMusic-page meting-js");
    if (host && host.aplayer) return host.aplayer;
    if (window.aplayers && window.aplayers.length) return window.aplayers[0];
    return null;
  }

  function ensure() {
    if (strip && strip.isConnected) return;
    strip = document.createElement("div");
    strip.className = "md-karaoke";
    strip.innerHTML = '<div class="md-k-line"></div><div class="md-k-next"></div>';
    document.body.appendChild(strip);
    lineEl = strip.querySelector(".md-k-line");
    nextEl = strip.querySelector(".md-k-next");
  }

  function parseLrc(text) {
    var out = [];
    String(text || "")
      .split(/\r?\n/)
      .forEach(function (raw) {
        var m = /\[(\d{1,2}):(\d{1,2}(?:[.:]\d{1,3})?)\](.*)$/.exec(raw);
        if (!m) return;
        var sec = parseInt(m[1], 10) * 60 + parseFloat(String(m[2]).replace(":", "."));
        var txt = (m[3] || "").trim();
        if (!txt) return;
        out.push({ t: sec, text: txt });
      });
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }

  function loadLyric(ap) {
    var cur = {};
    try { cur = ap.list.audios[ap.list.index] || {}; } catch (e) {}
    var url = cur.lrc || "";
    if (!url || url === lrcKey) return;
    lrcKey = url;
    lines = [];
    lastIdx = -1;
    fetch(url)
      .then(function (r) { return r.text(); })
      .then(function (t) {
        if (url !== lrcKey) return;
        lines = parseLrc(t);
      })
      .catch(function () {});
  }

  function render(t) {
    if (!lines.length) {
      if (lineEl) lineEl.textContent = "";
      if (nextEl) nextEl.textContent = "";
      return;
    }
    var i = -1;
    for (var k = 0; k < lines.length; k++) {
      if (lines[k].t <= t + 0.15) i = k;
      else break;
    }
    if (i < 0) {
      lineEl.textContent = "";
      lineEl.style.backgroundImage = "none";
      lineEl.style.color = "rgba(255,255,255,.25)";
      nextEl.textContent = lines[0] ? lines[0].text : "";
      return;
    }
    var cur = lines[i];
    var next = lines[i + 1];
    var end = next ? next.t : cur.t + 4;
    var span = Math.max(0.4, end - cur.t);
    var pct = Math.min(100, Math.max(0, ((t - cur.t) / span) * 100));

    if (lastIdx !== i) {
      lastIdx = i;
      lineEl.textContent = cur.text;
    }
    lineEl.style.backgroundImage =
      "linear-gradient(90deg," + ACCENT + " 0%," + ACCENT + " " + pct.toFixed(1) + "%," +
      "rgba(255,255,255,.28) " + pct.toFixed(1) + "%,rgba(255,255,255,.28) 100%)";
    lineEl.style.color = "transparent";
    nextEl.textContent = next ? next.text : "";
  }

  function tick() {
    if (!isDesktop()) {
      if (strip && strip.isConnected) strip.parentNode.removeChild(strip);
      strip = null;
      return;
    }
    var ap = getAp();
    if (!ap || !ap.audio) return;
    ensure();
    loadLyric(ap);
    render(ap.audio.currentTime || 0);
  }

  var n = 0;
  var t = setInterval(function () {
    n++;
    tick();
    if (n > 45) clearInterval(t);
  }, 400);
  setInterval(tick, 250);
  window.addEventListener("resize", function () { setTimeout(tick, 200); });
  document.addEventListener("pjax:complete", function () { setTimeout(tick, 400); });

  /* 调试/验收用：__mdKaraoke(秒) 直接把歌词条渲染到指定时间 */
  window.__mdKaraoke = function (sec) {
    var ap = getAp();
    if (!ap) return null;
    ensure();
    loadLyric(ap);
    render(sec);
    return { lines: lines.length, text: lineEl ? lineEl.textContent : "" };
  };
})();
