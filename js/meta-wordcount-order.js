/*! 文章页元信息：单行「字数 · 约X分钟读完 · 日期 · IP归属」，IP 归属走真实定位接口 */
(function () {
  "use strict";

  var CACHE_KEY = "la_ip_loc_v1";
  var CACHE_TTL = 30 * 60 * 1000; // 30 分钟

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function log(m) {
    if (window.console && console.debug) console.debug("[meta]", m);
  }

  /* ---------- IP 归属 ---------- */
  function cachedLoc() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o.t || Date.now() - o.t > CACHE_TTL) return null;
      return o.v;
    } catch (e) {
      return null;
    }
  }

  function saveLoc(v) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ v: v, t: Date.now() }));
    } catch (e) {}
  }

  function fetchJSON(url, timeout) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.timeout = timeout || 4000;
      xhr.onload = function () {
        if (done) return;
        done = true;
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(e);
        }
      };
      xhr.onerror = xhr.ontimeout = function () {
        if (done) return;
        done = true;
        reject(new Error("net"));
      };
      xhr.send();
    });
  }

  function resolveLocation() {
    var c = cachedLoc();
    if (c) return Promise.resolve(c);
    // 首选：ipip.net（中文，CORS *），失败退 ip.sb（英文）
    return fetchJSON("https://myip.ipip.net/json", 4000)
      .then(function (j) {
        var arr = (j && j.data && j.data.location) || [];
        var parts = [];
        if (arr[1]) parts.push(arr[1]);
        if (arr[2] && arr[2] !== arr[1]) parts.push(arr[2]);
        if (arr[4]) parts.push(arr[4]);
        if (!parts.length) throw new Error("empty");
        return parts.join(" · ");
      })
      .catch(function () {
        return fetchJSON("https://api.ip.sb/geoip", 4000).then(function (j) {
          var s = [j.city, j.country_code || j.country].filter(Boolean).join(" · ");
          if (!s) throw new Error("empty");
          return s;
        });
      })
      .then(function (v) {
        saveLoc(v);
        return v;
      });
  }

  /* ---------- 单行元信息 ---------- */
  function build() {
    var second = document.querySelector(".meta-secondline");
    var wc = document.querySelector(".post-meta-wordcount");
    var dateSpan = document.querySelector(".post-meta-date");
    if (!wc || !dateSpan || wc.dataset.mcMoved === "1") return;

    var countNode = wc.querySelector(".word-count");
    var count = countNode ? countNode.textContent.trim() : "";
    var minText = "";
    var spans = wc.querySelectorAll("span");
    for (var i = 0; i < spans.length; i++) {
      if (/\u5206\u949f/.test(spans[i].textContent) && !spans[i].className) {
        minText = spans[i].textContent.replace(/[^0-9.]/g, "");
        break;
      }
    }
    var pub = dateSpan.querySelector("time");
    var pubText = pub ? pub.textContent.trim() : "";

    dateSpan.innerHTML = "";
    dateSpan.removeAttribute("style");
    dateSpan.classList.add("meta-inline");

    function sep() {
      dateSpan.appendChild(el("span", "post-meta-separator"));
    }

    // 1) 字数（纯数字，不带「字」）
    if (count) {
      dateSpan.appendChild(el("i", "anzhiyufont anzhiyu-icon-file-word post-meta-icon"));
      dateSpan.appendChild(el("span", "post-meta-label", count));
      dateSpan.lastChild.title = "\u672c\u6587\u5171 " + count + " \u5b57";
    }

    // 2) 约 X 分钟读完
    if (minText) {
      sep();
      dateSpan.appendChild(el("i", "anzhiyufont anzhiyu-icon-clock post-meta-icon"));
      dateSpan.appendChild(el("span", "post-meta-label", "\u7ea6 " + minText + " \u5206\u949f\u8bfb\u5b8c"));
    }

    // 3) 日期
    if (pubText) {
      sep();
      dateSpan.appendChild(el("i", "anzhiyufont anzhiyu-icon-calendar-days post-meta-icon"));
      dateSpan.appendChild(el("time", "post-meta-date-created", pubText));
    }

    // 4) IP 归属
    sep();
    dateSpan.appendChild(el("i", "anzhiyufont anzhiyu-icon-location-dot post-meta-icon"));
    var loc = el("span", "post-meta-label ip-loc", "\u5b9a\u4f4d\u4e2d\u2026");
    dateSpan.appendChild(loc);

    wc.dataset.mcMoved = "1";
    if (second) second.style.display = "none";

    resolveLocation()
      .then(function (v) {
        loc.textContent = v;
        loc.title = "IP \u5f52\u5c5e\uff1a" + v;
      })
      .catch(function () {
        loc.textContent = "\u672a\u77e5";
        loc.title = "IP \u5f52\u5c5e\u83b7\u53d6\u5931\u8d25";
        log("ip location failed");
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
  document.addEventListener("pjax:complete", function () {
    setTimeout(build, 80);
  });
})();
