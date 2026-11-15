/*! 追番页：把插件渲染的长列表改造成海报网格 + 胶囊标签 */
(function () {
  "use strict";

  var DATA_URL = "/bangumis/data.json";

  function txt(el) {
    return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
  }

  function card(it) {
    var a = document.createElement("a");
    a.className = "bgm-card";
    a.href = it.link || "#";
    a.target = "_blank";
    a.rel = "noopener";
    a.title = it.title + (it.des ? "\n" + it.des : "");

    var badge = it.status ? '<span class="bgm-badge">' + it.status + "</span>" : "";
    var sc = it.score && it.score !== "-" ? '<span class="bgm-score">' + it.score + "</span>" : "";

    a.innerHTML =
      '<div class="bgm-cover">' +
      '<img class="nolazyload" src="' + (it.cover || "") + '" alt="' + (it.title || "") +
      '" referrerpolicy="no-referrer" loading="lazy">' +
      badge + sc +
      "</div>" +
      '<div class="bgm-meta">' +
      '<p class="bgm-title">' + (it.title || "") + "</p>" +
      (it.area ? '<p class="bgm-sub">' + it.area + "</p>" : "") +
      "</div>";
    return a;
  }

  function build(groups) {
    var wrap = document.createElement("div");
    wrap.className = "bgm-wrap";

    var bar = document.createElement("div");
    bar.className = "bgm-tabs";
    var grid = document.createElement("div");
    grid.className = "bgm-grid";

    function render(items) {
      grid.innerHTML = "";
      if (!items.length) {
        grid.innerHTML = '<p class="bgm-empty">这里还空着~</p>';
        return;
      }
      var frag = document.createDocumentFragment();
      items.forEach(function (it) { frag.appendChild(card(it)); });
      grid.appendChild(frag);
    }

    groups.forEach(function (g, i) {
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
    wrap.appendChild(grid);
    render(groups[0].items);
    return wrap;
  }

  function normalize(b) {
    return {
      title: b.title,
      cover: b.cover,
      link: b.link,
      status: b.ep_status || "",
      score: b.score == null ? "" : String(b.score),
      area: [b.type, b.area].filter(Boolean).join(" · "),
      des: b.des || ""
    };
  }

  function fromJson(d) {
    var all = [].concat(d.wantWatch || [], d.watching || [], d.watched || []);
    var seen = {};
    var uniq = [];
    all.forEach(function (b) {
      if (!b || !b.title || seen[b.title]) return;
      seen[b.title] = 1;
      uniq.push(normalize(b));
    });
    return [
      { label: "全部", items: uniq },
      { label: "想看", items: (d.wantWatch || []).map(normalize) },
      { label: "在看", items: (d.watching || []).map(normalize) },
      { label: "已看", items: (d.watched || []).map(normalize) }
    ];
  }

  function fromDom() {
    var root = document.getElementById("article-container");
    var seen = {};
    var uniq = [];
    Array.prototype.forEach.call(root.querySelectorAll(".bangumi-item"), function (item) {
      var a = item.querySelector(".bangumi-title a") || item.querySelector(".bangumi-picture a");
      var picA = item.querySelector(".bangumi-picture a");
      var title = txt(a) || txt(item.querySelector(".bangumi-title"));
      if (!title || seen[title]) return;
      seen[title] = 1;
      uniq.push({
        title: title,
        cover: (picA && picA.getAttribute("href")) || "",
        link: (a && a.getAttribute("href")) || "",
        status: txt(item.querySelector(".bangumi-progress-text")).replace(/^追.{1,2}状态[:：]\s*/, ""),
        score: txt(item.querySelector(".bangumi-info-item-score em")),
        area: txt(item.querySelector(".bangumi-area")),
        des: txt(item.querySelector(".bangumi-comments")).replace(/^简介[:：]\s*/, "")
      });
    });
    return [
      { label: "全部", items: uniq },
      { label: "想看", items: [] },
      { label: "在看", items: [] },
      { label: "已看", items: [] }
    ];
  }

  function hideOriginal(root) {
    var groups = root.querySelectorAll(".bangumi-show");
    if (groups[0] && groups[0].parentElement) groups[0].parentElement.style.display = "none";
    Array.prototype.forEach.call(root.querySelectorAll(".bangumi-tabs, .bangumi-pagination"), function (el) {
      el.style.display = "none";
    });
  }

  function init() {
    var root = document.getElementById("article-container");
    if (!root || root.dataset.bgmGrid === "1") return;
    if (!root.querySelector(".bangumi-item")) return;
    root.dataset.bgmGrid = "1";

    fetch(DATA_URL, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(0); })
      .then(fromJson)
      .catch(fromDom)
      .then(function (groups) {
        hideOriginal(root);
        root.appendChild(build(groups));
      });
  }

  function boot() {
    init();
    [300, 800].forEach(function (t) { setTimeout(init, t); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 150); });
})();
