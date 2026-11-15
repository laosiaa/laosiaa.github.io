/*! 红果视频独立页：红果漫剧榜 综合评分前 100 部，每页 8 部 */
(function () {
  "use strict";

  var DATA_URL = "/bangumis/hongguo.json";
  var PER = 8;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1e8) return (n / 1e8).toFixed(2) + "亿";
    if (n >= 1e4) return (n / 1e4).toFixed(1) + "万";
    return String(n);
  }

  function card(it) {
    var a = document.createElement("a");
    a.className = "bgm-card";
    a.href = it.link || "#";
    a.target = "_blank";
    a.rel = "noopener";
    a.title = (it.title || "") + "\n综合评分 " + fmt(it.total) +
      "（热度 " + (it.heatText || "") + " + 收藏 " + (it.favoriteText || "") +
      " + 点赞 " + (it.likeText || "") + " + 分享 " + fmt(it.share) + "）";
    a.innerHTML =
      '<div class="bgm-cover">' +
      '<img class="nolazyload" src="' + esc(it.cover) + '" alt="' + esc(it.title) +
      '" referrerpolicy="no-referrer" loading="lazy">' +
      (it.ep_status ? '<span class="bgm-badge">' + esc(it.ep_status) + "</span>" : "") +
      '<span class="bgm-score">' + esc(fmt(it.total)) + "</span>" +
      "</div>" +
      '<div class="bgm-meta"><p class="bgm-title">' + esc(it.title) + "</p>" +
      '<p class="bgm-sub">漫剧 · 热 ' + esc(it.heatText || "") + "</p></div>";
    return a;
  }

  function qs(k) {
    var m = new RegExp("[?&]" + k + "=([^&]*)").exec(location.search);
    return m ? parseInt(decodeURIComponent(m[1]), 10) : 1;
  }

  function start(list) {
    var root = document.getElementById("hg-page");
    if (!root) return;

    var pages = Math.max(1, Math.ceil(list.length / PER));
    var page = Math.min(Math.max(1, qs("page") || 1), pages);

    function render() {
      var slice = list.slice((page - 1) * PER, page * PER);

      var html = '<div class="rec-bar">' +
        '<a class="rec-back rec-back-top" href="/bangumis/">← 返回追番页</a>' +
        "<span>共 <b>" + list.length + "</b> 部 · 第 <b>" + page + "/" + pages + "</b> 页</span>" +
        '<span class="rec-tip">红果漫剧榜 · 综合评分 = 热度 + 收藏 + 点赞 + 分享</span></div>';

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
      else page = Math.min(pages, parseInt(go, 10) || 1);
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
    var root = document.getElementById("hg-page");
    if (!root || root.dataset.done === "1") return;
    root.dataset.done = "1";
    fetch(DATA_URL, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(0); })
      .then(function (list) {
        var arr = (list || []).slice().sort(function (a, b) {
          return (Number(b.total) || 0) - (Number(a.total) || 0);
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
