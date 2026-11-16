/*! 文章页元信息：单行「字数 · 约X分钟读完 · 日期 · IP归属」+ 悬停说明气泡 */
(function () {
  "use strict";

  var CACHE_KEY = "la_ip_loc_v2";
  var CACHE_TTL = 30 * 60 * 1000;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function tip(node, text) {
    if (!node || !text) return;
    node.setAttribute("data-tip", text);
    node.setAttribute("title", text);
  }

  /* ---------- 缓存 ---------- */
  function cached() {
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

  function save(v) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ v: v, t: Date.now() }));
    } catch (e) {}
  }

  function fetchJSON(url, timeout) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.timeout = timeout || 4500;
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

  /* ---------- 地名归一化：「天津市」→「天津」 ---------- */
  function shortName(v) {
    return (v || "")
      .replace(/(维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|自治州|省|市|区|县)$/g, "")
      .trim();
  }

  function join(prov, city) {
    if (prov && city && prov !== city) return prov + " · " + city;
    return prov || city || "";
  }

  function fromMir6(j) {
    var d = (j && j.data) || {};
    var loc = join(shortName(d.province), shortName(d.city) || shortName(d.districts));
    if (!loc) throw new Error("empty");
    return { loc: loc, isp: (d.isp || "").trim() };
  }

  function fromIpip(j) {
    var a = (j && j.data && j.data.location) || [];
    var loc = join(shortName(a[1]), shortName(a[3]) || shortName(a[2]));
    if (!loc) throw new Error("empty");
    return { loc: loc, isp: (a[4] || "").trim() };
  }

  function fromIpsb(j) {
    var loc = shortName(j.city || j.region);
    if (!loc) throw new Error("empty");
    return { loc: loc, isp: (j.isp || j.organization || "").trim() };
  }

  function resolveLocation() {
    var c = cached();
    if (c && c.loc) return Promise.resolve(c);

    var chain = [
      ["https://api.mir6.com/api/ip?type=json", fromMir6],
      ["https://myip.ipip.net/json", fromIpip],
      ["https://api.ip.sb/geoip", fromIpsb]
    ];

    function step(i) {
      if (i >= chain.length) return Promise.reject(new Error("all failed"));
      var item = chain[i];
      return fetchJSON(item[0], 4500)
        .then(function (j) {
          var v = item[1](j);
          save(v);
          return v;
        })
        .catch(function () {
          return step(i + 1);
        });
    }
    return step(0);
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
    dateSpan.classList.add("meta-inline");

    function sep() {
      dateSpan.appendChild(el("span", "post-meta-separator"));
    }

    function item(iconCls, text, tipText) {
      dateSpan.appendChild(el("i", "anzhiyufont " + iconCls + " post-meta-icon"));
      var s = el("span", "post-meta-label", text);
      if (tipText) tip(s, tipText);
      dateSpan.appendChild(s);
      return s;
    }

    // 1) 字数
    if (count) item("anzhiyu-icon-file-word", count, "数字总计");

    // 2) 约 X 分钟读完
    if (minText) {
      sep();
      item("anzhiyu-icon-clock", "约 " + minText + " 分钟读完", "预计阅读时长");
    }

    // 3) 日期
    if (pubText) {
      sep();
      item("anzhiyu-icon-calendar-days", pubText, "文章发布日期");
    }

    // 4) IP 归属（悬停时补上运营商）
    sep();
    var locEl = item("anzhiyu-icon-location-dot", "定位中…", "作者 IP 归属地");

    wc.dataset.mcMoved = "1";
    if (second) second.style.display = "none";

    // post-meta-group.js 会 clone 节点并 innerHTML 重排，之前拿到的 locEl 可能已脱离文档，
    // 所以每次都按 data-tip 重新查真实节点再写文字
    function applyLoc(text) {
      var labels = document.querySelectorAll(".post-meta-date.meta-inline .post-meta-label");
      var hit = false;
      for (var i = 0; i < labels.length; i++) {
        var t = labels[i].getAttribute("data-tip") || labels[i].getAttribute("title") || "";
        if (t === "作者 IP 归属地") {
          labels[i].textContent = text;
          hit = true;
        }
      }
      if (!hit && labels.length) {
        var last = labels[labels.length - 1];
        if (/定位中|未知/.test(last.textContent || "")) last.textContent = text;
      }
      if (locEl) locEl.textContent = text;
    }

    resolveLocation()
      .then(function (v) {
        applyLoc(v.loc);
        setTimeout(function () { applyLoc(v.loc); }, 400);
        setTimeout(function () { applyLoc(v.loc); }, 1200);
        setTimeout(function () { applyLoc(v.loc); }, 2400);
      })
      .catch(function () {
        applyLoc("\u672a\u77e5");
        setTimeout(function () { applyLoc("\u672a\u77e5"); }, 1200);
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
  document.addEventListener("pjax:complete", function () {
    setTimeout(build, 80);
  });
})();
