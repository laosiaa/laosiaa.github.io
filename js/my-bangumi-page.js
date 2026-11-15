/*! 我的追番独立页：全部 / 想看 / 在看 / 已看，每页 8 部，可翻页 */
(function () {
  "use strict";

  var DATA_URL = "/bangumis/data.json";
  var PER = 8;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function card(it) {
    var status = it.ep_status || "";
    var onair = /^更新至|^连载/.test(status);
    var has = it.score && it.score !== "-";
    var a = document.createElement("a");
    a.className = "bgm-card";
    a.href = it.link || "#";
    a.target = "_blank";
    a.rel = "noopener";
    a.title = it.title;
    a.innerHTML =
      '<div class="bgm-cover">' +
      '<img class="nolazyload" src="' + esc(it.cover) + '" alt="' + esc(it.title) +
      '" referrerpolicy="no-referrer" loading="lazy">' +
      (status ? '<span class="bgm-badge' + (onair ? " onair" : "") + '">' + esc(status) + "</span>" : "") +
      '<span class="bgm-score' + (has ? "" : " dim") + '">' + (has ? esc(it.score) : "—") + "</span>" +
      "</div>" +
      '<div class="bgm-meta"><p class="bgm-title">' + esc(it.title) + "</p>" +
      (it.area ? '<p class="bgm-sub">' + esc(it.area) + "</p>" : "") +
      "</div>";
    return a;
  }

  function norm(b) {
    return {
      title: b.title,
      cover: b.cover,
      link: b.link,
      ep_status: b.ep_status || "",
      score: b.score == null ? "" : String(b.score),
      area: [b.type, b.area].filter(Boolean).join(" · ")
    };
  }

  function groups(d) {
    var seen = {}, all = [];
    [].concat(d.wantWatch || [], d.watching || [], d.watched || []).forEach(function (b) {
      if (!b || !b.title || seen[b.title]) return;
      seen[b.title] = 1;
      all.push(norm(b));
    });
    return [
      { key: "all", label: "全部", items: all },
      { key: "want", label: "想看", items: (d.wantWatch || []).map(norm) },
      { key: "watching", label: "在看", items: (d.watching || []).map(norm) },
      { key: "watched", label: "已看", items: (d.watched || []).map(norm) }
    ];
  }

  function qs(k) {
    var m = new RegExp("[?&]" + k + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function start(gs) {
    var root = document.getElementById("mybmg-page");
    if (!root) return;

    var active = gs.filter(function (g) { return g.key === qs("cat"); })[0] || gs[0];
    var page = Math.max(1, parseInt(qs("page"), 10) || 1);

    function render() {
      var items = active.items;
      var pages = Math.max(1, Math.ceil(items.length / PER));
      if (page > pages) page = pages;
      var slice = items.slice((page - 1) * PER, page * PER);

      var html = '<div class="bgm-tabs">';
      gs.forEach(function (g) {
        html += '<button type="button" class="bgm-tab' + (g.key === active.key ? " active" : "") +
          '" data-cat="' + g.key + '">' + esc(g.label) +
          '<span class="bgm-tab-n">' + g.items.length + "</span></button>";
      });
      html += "</div>";

      html += '<div class="rec-bar">' +
        '<a class="rec-back rec-back-top" href="/bangumis/">← 返回追番页</a>' +
        "<span>共 <b>" + items.length + "</b> 部 · 第 <b>" + page + "/" + pages + "</b> 页</span>" +
        '<span class="rec-tip">B 站追番收藏 · 每天自动同步</span></div>';

      if (slice.length) {
        html += '<div class="bgm-grid">' + slice.map(function (it) {
          return card(it).outerHTML;
        }).join("") + "</div>";
      } else {
        html += '<p class="bgm-empty">这里还空着~</p>';
      }

      if (pages > 1) {
        html += '<div class="bgm-pager">';
        html += '<button type="button" class="bgm-pg" data-go="prev"' + (page === 1 ? " disabled" : "") + ">上一页</button>";
        for (var i = 1; i <= pages; i++) {
          html += '<button type="button" class="bgm-pg num' + (i === page ? " active" : "") +
            '" data-go="' + i + '">' + i + "</button>";
        }
        html += '<button type="button" class="bgm-pg" data-go="next"' + (page === pages ? " disabled" : "") + ">下一页</button>";
        html += "</div>";
      }

      root.innerHTML = html;
    }

    function syncUrl() {
      var parts = [];
      if (active.key !== gs[0].key) parts.push("cat=" + encodeURIComponent(active.key));
      if (page > 1) parts.push("page=" + page);
      try {
        history.replaceState(null, "", parts.length ? "?" + parts.join("&") : location.pathname);
      } catch (e) {}
    }

    root.addEventListener("click", function (e) {
      var tab = e.target.closest("button[data-cat]");
      if (tab) {
        var k = tab.getAttribute("data-cat");
        active = gs.filter(function (g) { return g.key === k; })[0] || gs[0];
        page = 1;
        render(); syncUrl();
        return;
      }
      var btn = e.target.closest("button[data-go]");
      if (!btn || btn.disabled) return;
      var pages = Math.max(1, Math.ceil(active.items.length / PER));
      var go = btn.getAttribute("data-go");
      if (go === "prev") page = Math.max(1, page - 1);
      else if (go === "next") page = Math.min(pages, page + 1);
      else page = Math.min(pages, parseInt(go, 10) || 1);
      render(); syncUrl();
      var top = root.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: top, behavior: "smooth" });
    });

    render();
  }

  function init() {
    var root = document.getElementById("mybmg-page");
    if (!root || root.dataset.done === "1") return;
    root.dataset.done = "1";
    fetch(DATA_URL, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(0); })
      .then(function (d) { start(groups(d)); })
      .catch(function () {
        root.innerHTML = '<p class="bgm-empty">数据加载失败，稍后再试~</p>';
      });
  }

  function boot() { setTimeout(init, 60); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 200); });
})();
