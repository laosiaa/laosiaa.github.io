/*! 好番推荐独立页：50 部评分 8.0+ 国创，每页 8 部，可翻页 */
(function () {
  "use strict";

  var REC_URL = "/bangumis/recommend.json";
  var PAGE_SIZE = 8;
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

  function normalize(b) {
    return {
      title: b.title,
      cover: b.cover,
      link: b.link,
      ep_status: b.ep_status || "",
      score: b.score == null ? "" : String(b.score),
      area: [b.type, b.area].filter(Boolean).join(" · ")
    };
  }

  function qs(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? parseInt(decodeURIComponent(m[1]), 10) : 1;
  }

  function start(list) {
    var root = document.getElementById("rec-page");
    if (!root) return;

    var pages = Math.max(1, Math.ceil(list.length / PER));
    var page = Math.min(Math.max(1, qs("page") || 1), pages);

    function render() {
      var slice = list.slice((page - 1) * PER, page * PER);
      var html = '<div class="rec-bar">' +
        '<a class="rec-back rec-back-top" href="/bangumis/">← 返回追番页</a>' +
        "<span>共 <b>" + list.length + "</b> 部 · 第 <b>" + page + "/" + pages + "</b> 页</span>" +
        '<span class="rec-tip">评分 8.0 以上的国创精选 · 每天自动更新</span></div>';

      html += '<div class="bgm-grid">' + slice.map(function (it) {
        return card(it).outerHTML;
      }).join("") + "</div>";

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

    root.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-go]");
      if (!btn || btn.disabled) return;
      var go = btn.getAttribute("data-go");
      if (go === "prev") page = Math.max(1, page - 1);
      else if (go === "next") page = Math.min(pages, page + 1);
      else page = parseInt(go, 10) || 1;
      render();
      try {
        history.replaceState(null, "", page > 1 ? "?page=" + page : location.pathname);
      } catch (err) {}
      var top = root.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: top, behavior: "smooth" });
    });

    render();
  }

  function init() {
    var root = document.getElementById("rec-page");
    if (!root || root.dataset.done === "1") return;
    root.dataset.done = "1";
    fetch(REC_URL, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(0); })
      .then(function (list) {
        var arr = (list || []).map(normalize).sort(function (a, b) {
          return (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0);
        });
        start(arr);
      })
      .catch(function () {
        root.innerHTML = '<p class="bgm-empty">数据加载失败，稍后再试~</p>';
      });
  }

  function boot() { setTimeout(init, 60); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 200); });
})();
