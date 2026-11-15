/*! 追番页：好番推荐 + 我的追番（海报网格） */
(function () {
  "use strict";

  var DATA_URL = "/bangumis/data.json";
  var REC_URL = "/bangumis/recommend.json";

  function txt(el) {
    return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function card(it) {
    var a = document.createElement("a");
    a.className = "bgm-card";
    a.href = it.link || "#";
    a.target = "_blank";
    a.rel = "noopener";
    a.title = it.title + (it.des ? "\n" + it.des : "");

    var status = it.status || it.ep_status || "";
    var onair = /^更新至|^连载/.test(status);
    var badge = status
      ? '<span class="bgm-badge' + (onair ? " onair" : "") + '">' + esc(status) + "</span>"
      : "";
    var hasScore = it.score && it.score !== "-";
    var sc = '<span class="bgm-score' + (hasScore ? "" : " dim") + '">' + (hasScore ? esc(it.score) : "—") + "</span>";

    a.innerHTML =
      '<div class="bgm-cover">' +
      '<img class="nolazyload" src="' + esc(it.cover) + '" alt="' + esc(it.title) +
      '" referrerpolicy="no-referrer" loading="lazy">' +
      badge + sc +
      "</div>" +
      '<div class="bgm-meta">' +
      '<p class="bgm-title">' + esc(it.title) + "</p>" +
      (it.area ? '<p class="bgm-sub">' + esc(it.area) + "</p>" : "") +
      "</div>";
    return a;
  }

  function grid(items) {
    var g = document.createElement("div");
    g.className = "bgm-grid";
    if (!items.length) {
      g.innerHTML = '<p class="bgm-empty">这里还空着~</p>';
      return g;
    }
    var frag = document.createDocumentFragment();
    items.forEach(function (it) { frag.appendChild(card(it)); });
    g.appendChild(frag);
    return g;
  }

  function section(title, sub) {
    var s = document.createElement("section");
    s.className = "bgm-sec";
    s.innerHTML =
      '<div class="bgm-sec-head"><h2>' + esc(title) + "</h2>" +
      (sub ? "<span>" + esc(sub) + "</span>" : "") + "</div>";
    return s;
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

  function tabs(groups) {
    var bar = document.createElement("div");
    bar.className = "bgm-tabs";
    var holder = document.createElement("div");
    holder.className = "bgm-tab-body";

    function show(items) {
      holder.innerHTML = "";
      holder.appendChild(grid(items));
    }

    groups.forEach(function (g, i) {
      var b = document.createElement("button");
      b.className = "bgm-tab" + (i === 0 ? " active" : "");
      b.innerHTML = esc(g.label) + '<span class="bgm-tab-n">' + g.items.length + "</span>";
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(bar.children, function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        show(g.items);
      });
      bar.appendChild(b);
    });
    show(groups[0].items);
    return { bar: bar, body: holder };
  }

  function fromJson(d) {
    var all = [].concat(d.wantWatch || [], d.watching || [], d.watched || []);
    var seen = {}, uniq = [];
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
    var seen = {}, uniq = [];
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

    var mineP = fetch(DATA_URL, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(0); })
      .then(fromJson)
      .catch(fromDom);

    var recP = fetch(REC_URL, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(0); })
      .then(function (list) { return (list || []).map(normalize); })
      .catch(function () { return []; });

    Promise.all([mineP, recP]).then(function (res) {
      var mine = res[0];
      var rec = res[1];
      hideOriginal(root);

      var page = document.createElement("div");
      page.className = "bgm-page";

      if (rec.length) {
        var s1 = section("好番推荐", "评分 9.0 以上的国创 · 每天自动更新");
        s1.appendChild(grid(rec));
        page.appendChild(s1);
      }

      var s2 = section("我的追番", "共 " + mine[0].items.length + " 部");
      var t = tabs(mine);
      s2.appendChild(t.bar);
      s2.appendChild(t.body);
      page.appendChild(s2);

      root.appendChild(page);
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
