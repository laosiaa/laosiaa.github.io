/*! 追番页：把插件渲染的长列表改造成海报网格 + 胶囊标签 */
(function () {
  "use strict";

  function txt(el) {
    return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
  }

  function parseItem(item) {
    var a = item.querySelector(".bangumi-title a") || item.querySelector(".bangumi-picture a");
    var img = item.querySelector(".bangumi-picture img");
    var cover = (img && (img.getAttribute("data-src") || img.getAttribute("src"))) || "";
    if (/^data:/.test(cover)) cover = (img && img.getAttribute("data-ll-src")) || "";
    var picA = item.querySelector(".bangumi-picture a");
    if (picA && picA.getAttribute("href")) cover = picA.getAttribute("href");

    var status = txt(item.querySelector(".bangumi-progress-text")).replace(/^追.{1,2}状态[:：]\s*/, "");

    var stats = [];
    Array.prototype.forEach.call(item.querySelectorAll(".bangumi-info-item"), function (row) {
      var label = txt(row.querySelector(".bangumi-info-label"));
      var val = txt(row.querySelector("em"));
      if (label && val) stats.push({ k: label, v: val });
    });

    var score = txt(item.querySelector(".bangumi-info-item-score em"));
    var area = txt(item.querySelector(".bangumi-area"));
    var des = txt(item.querySelector(".bangumi-comments")).replace(/^简介[:：]\s*/, "");

    return {
      title: txt(a) || txt(item.querySelector(".bangumi-title")),
      link: (a && a.getAttribute("href")) || "",
      cover: cover,
      status: status,
      stats: stats,
      score: score,
      area: area,
      des: des
    };
  }

  function build(data, tabs) {
    var wrap = document.createElement("div");
    wrap.className = "bgm-wrap";

    var bar = document.createElement("div");
    bar.className = "bgm-tabs";
    data.forEach(function (g, i) {
      var b = document.createElement("button");
      b.className = "bgm-tab" + (i === 0 ? " active" : "");
      b.innerHTML = g.label + '<span class="bgm-tab-n">' + g.items.length + "</span>";
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(bar.children, function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        render(g.items);
      });
      bar.appendChild(b);
    });
    wrap.appendChild(bar);

    var grid = document.createElement("div");
    grid.className = "bgm-grid";
    wrap.appendChild(grid);

    function card(it) {
      var a = document.createElement("a");
      a.className = "bgm-card";
      a.href = it.link || "#";
      a.target = "_blank";
      a.rel = "noopener";
      a.title = it.title + (it.des ? " · " + it.des : "");

      var badge = it.status ? '<span class="bgm-badge">' + it.status + "</span>" : "";
      var sc = it.score && it.score !== "-" ? '<span class="bgm-score">' + it.score + "</span>" : "";

      a.innerHTML =
        '<div class="bgm-cover"><img class="nolazyload" src="' + it.cover + '" alt="' + it.title + '" referrerpolicy="no-referrer" loading="lazy">' +
        badge + sc + "</div>" +
        '<div class="bgm-meta"><p class="bgm-title">' + it.title + "</p>" +
        (it.area ? '<p class="bgm-sub">' + it.area + "</p>" : "") +
        "</div>";
      return a;
    }

    function render(items) {
      grid.innerHTML = "";
      var frag = document.createDocumentFragment();
      items.forEach(function (it) { frag.appendChild(card(it)); });
      grid.appendChild(frag);
    }

    render(data[0].items);
    return wrap;
  }

  function init() {
    var root = document.getElementById("article-container");
    if (!root || root.dataset.bgmGrid === "1") return;

    var groups = root.querySelectorAll(".bangumi-show");
    if (!groups.length) return;

    var tabEls = root.querySelectorAll(".bangumi-tab");
    var data = [];
    var seen = {};

    Array.prototype.forEach.call(groups, function (g, gi) {
      var label = tabEls[gi] ? txt(tabEls[gi]).replace(/\s*\(\d+\)\s*$/, "") : "全部";
      var items = [];
      Array.prototype.forEach.call(g.querySelectorAll(".bangumi-item"), function (item) {
        var d = parseItem(item);
        if (!d.title) return;
        var key = d.title;
        if (gi === 0) {
          if (seen[key]) return;
          seen[key] = 1;
        }
        items.push(d);
      });
      if (items.length || gi > 0) data.push({ label: label, items: items });
    });

    if (!data.length) return;

    // 隐藏插件原始结构（标签行 + 列表 + 分页）
    var container = groups[0].parentElement;
    if (container) container.style.display = "none";
    Array.prototype.forEach.call(root.children, function (el) {
      if (el.querySelector && el.querySelector(".bangumi-tab")) el.style.display = "none";
    });

    root.appendChild(build(data, tabEls));
    root.dataset.bgmGrid = "1";
  }

  function boot() {
    init();
    [200, 600].forEach(function (t) { setTimeout(init, t); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 150); });
})();
