/*! 追番页：好番推荐（50 部 8.0+）+ 我的追番，支持「查看更多」与分页（每页 8 部） */
(function () {
  "use strict";

  var DATA_URL = "/bangumis/data.json";
  var REC_URL = "/bangumis/recommend.json";
  var PAGE_SIZE = 8;
  var REC_INITIAL = 4;

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
    var sc = '<span class="bgm-score' + (hasScore ? "" : " dim") + '">' +
      (hasScore ? esc(it.score) : "—") + "</span>";

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

  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 1e8) return (n / 1e8).toFixed(2) + "亿";
    if (n >= 1e4) return (n / 1e4).toFixed(1) + "万";
    return String(n);
  }

  function section(title, sub) {
    var s = document.createElement("section");
    s.className = "bgm-sec";
    s.innerHTML =
      '<div class="bgm-sec-head"><h2>' + esc(title) + "</h2>" +
      (sub ? "<span class=\"bgm-sec-sub\">" + esc(sub) + "</span>" : "") + "</div>";
    return s;
  }

  /* ---------- 分页视图：初始 N 个 + 查看更多 + 翻页 ---------- */
  function pagedView(items, initial, pageSize) {
    var wrap = document.createElement("div");
    wrap.className = "bgm-paged";

    var body = document.createElement("div");
    body.className = "bgm-paged-body";

    var pager = document.createElement("div");
    pager.className = "bgm-pager";

    var more = document.createElement("button");
    more.type = "button";
    more.className = "bgm-more";
    more.innerHTML = "查看更多 <span>共 " + items.length + " 部</span>";

    var expanded = false;
    var page = 0;
    var total = items.length;
    var pages = Math.max(1, Math.ceil(total / pageSize));

    function renderAll() {
      body.innerHTML = "";
      body.appendChild(grid(expanded ? items.slice(page * pageSize, page * pageSize + pageSize) : items.slice(0, initial)));
    }

    function renderPager() {
      if (!expanded || pages <= 1) { pager.innerHTML = ""; pager.style.display = "none"; return; }
      pager.style.display = "";
      var html = "";
      html += '<button type="button" class="bgm-pg" data-go="prev"' + (page === 0 ? " disabled" : "") + ">上一页</button>";
      for (var i = 0; i < pages; i++) {
        html += '<button type="button" class="bgm-pg num' + (i === page ? " active" : "") +
          '" data-go="' + i + '">' + (i + 1) + "</button>";
      }
      html += '<button type="button" class="bgm-pg" data-go="next"' + (page === pages - 1 ? " disabled" : "") + ">下一页</button>";
      pager.innerHTML = html;
    }

    function sync() {
      renderAll();
      renderPager();
      more.innerHTML = expanded
        ? "收起 <span>已展开全部 " + total + " 部</span>"
        : "查看更多 <span>共 " + total + " 部</span>";
    }

    more.addEventListener("click", function () {
      expanded = !expanded;
      page = 0;
      sync();
      if (expanded) wrap.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    pager.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-go]");
      if (!btn || btn.disabled) return;
      var go = btn.getAttribute("data-go");
      if (go === "prev") page = Math.max(0, page - 1);
      else if (go === "next") page = Math.min(pages - 1, page + 1);
      else page = parseInt(go, 10) || 0;
      sync();
    });

    sync();
    wrap.appendChild(body);
    wrap.appendChild(pager);
    if (total > initial) wrap.appendChild(more);
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

  /* ---------- 我的追番：分类切换 + 各自分页 ---------- */
  function tabs(groups) {
    var bar = document.createElement("div");
    bar.className = "bgm-tabs";
    var holder = document.createElement("div");
    holder.className = "bgm-tab-body";

    function show(items) {
      holder.innerHTML = "";
      holder.appendChild(grid(items.slice(0, 4)));
    }

    groups.forEach(function (g, i) {
      var b = document.createElement("button");
      b.type = "button";
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
        var sorted = rec.slice().sort(function (a, b) {
          return (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0);
        });
        var s1 = section("好番推荐", sorted.length + " 部评分 8.0 以上的国创 · 每天自动更新");
        var head = s1.querySelector(".bgm-sec-head");
        var moreLink = document.createElement("a");
        moreLink.className = "bgm-more-link";
        moreLink.href = "/recommend/";
        moreLink.innerHTML = "查看更多 <i>›</i>";
        head.appendChild(moreLink);
        s1.appendChild(grid(sorted.slice(0, REC_INITIAL)));
        page.appendChild(s1);
      }

      var s2 = section("我的追番", "共 " + mine[0].items.length + " 部");
      var t = tabs(mine);
      var tabRow = document.createElement("div");
      tabRow.className = "bgm-tabs-row";
      var moreLink2 = document.createElement("a");
      moreLink2.className = "bgm-more-link";
      moreLink2.href = "/my-bangumi/";
      moreLink2.innerHTML = "查看更多 <i>›</i>";
      tabRow.appendChild(t.bar);
      tabRow.appendChild(moreLink2);
      s2.appendChild(tabRow);
      s2.appendChild(t.body);
      page.appendChild(s2);

      // 红果视频（红果漫剧榜综合评分前 100）
      var s3 = section("红果视频", "漫剧榜 · 按热度+收藏+点赞+分享总和排序");
      var head3 = s3.querySelector(".bgm-sec-head");
      var moreLink3 = document.createElement("a");
      moreLink3.className = "bgm-more-link";
      moreLink3.href = "/hongguo/";
      moreLink3.innerHTML = "查看更多 <i>›</i>";
      head3.appendChild(moreLink3);
      s3.appendChild(grid([]));
      page.appendChild(s3);

      fetch("/bangumis/hongguo.json", { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(0); })
        .then(function (list) {
          var arr = (list || []).slice().sort(function (a, b) {
            return (Number(b.total) || 0) - (Number(a.total) || 0);
          }).slice(0, 4).map(function (it) {
            return {
              title: it.title,
              cover: it.cover,
              link: it.link,
              status: it.ep_status || "",
              score: fmtNum(it.total),
              area: "漫剧 · 热 " + (it.heatText || ""),
              des: "综合 " + fmtNum(it.total)
            };
          });
          var holder = s3.querySelector(".bgm-grid");
          if (holder) holder.outerHTML = grid(arr).outerHTML;
        })
        .catch(function () {});

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
