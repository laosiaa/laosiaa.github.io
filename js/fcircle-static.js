/*! 朋友圈（静态版）—— 读取 /fcircle/data.json 渲染，无需后端 */
(function () {
  "use strict";
  var DATA_URL = "/fcircle/data.json";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(d) {
    if (!d) return "";
    var s = String(d).slice(0, 10);
    return s.replace(/-/g, "/");
  }

  function render(root, data) {
    var st = data.statistical_data || {};
    var arts = data.article_data || [];
    var html = "";

    html += '<div class="cf-friends-stat" style="display:flex;flex-wrap:wrap;gap:.6rem 1.4rem;'
      + 'padding:.2rem 0 1rem;font-size:.9rem;opacity:.85">'
      + "<span>👥 友链 <b>" + esc(st.friends_num || 0) + "</b></span>"
      + "<span>🟢 活跃 <b>" + esc(st.active_num || 0) + "</b></span>"
      + "<span>📝 文章 <b>" + esc(st.article_num || 0) + "</b></span>"
      + "<span>🕒 更新于 <b>" + esc(st.last_update_time || "-") + "</b></span>"
      + "</div>";

    if (!arts.length) {
      html += '<div class="cf-empty" style="padding:2rem 0;text-align:center;opacity:.7">'
        + "暂无数据：在 <code>source/_data/flink.json</code> 里加友链后重新生成即可</div>";
    } else {
      html += '<div class="cf-article-list" style="display:grid;gap:.75rem">';
      arts.forEach(function (a) {
        var av = a.avatar
          ? '<img class="cf-article-avatar" src="' + esc(a.avatar) + '" alt="' + esc(a.author) + '" loading="lazy" '
            + 'style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex:0 0 auto" '
            + 'onerror="this.style.visibility=&#39;hidden&#39;">'
          : "";
        html += '<a class="cf-article" href="' + esc(a.link) + '" target="_blank" rel="noopener nofollow" '
          + 'style="display:flex;align-items:center;gap:.7rem;padding:.6rem .85rem;border-radius:10px;'
          + 'background:rgba(128,128,128,.06);text-decoration:none;transition:.2s">'
          + av
          + '<span style="flex:1;min-width:0">'
          + '<span class="cf-article-title" style="display:block;overflow:hidden;text-overflow:ellipsis;'
          + 'white-space:nowrap;font-weight:600">' + esc(a.title) + "</span>"
          + '<span class="cf-article-time" style="display:block;font-size:.78rem;opacity:.65;margin-top:2px">'
          + esc(a.author) + " · " + esc(fmtDate(a.created)) + "</span>"
          + "</span></a>";
      });
      html += "</div>";
      html += '<p style="text-align:center;font-size:.8rem;opacity:.55;margin-top:1rem">'
        + "数据随站点发布更新，如需实时请接入 friend-circle 后端</p>";
    }
    root.innerHTML = html;
  }

  function start() {
    var root = document.getElementById("hexo-circle-of-friends-root");
    if (!root) return;
    root.innerHTML = '<div style="padding:1.5rem 0;text-align:center;opacity:.6">正在加载朋友圈…</div>';
    fetch(DATA_URL, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) { render(root, d); })
      .catch(function (e) {
        root.innerHTML = '<div style="padding:1.5rem 0;text-align:center;opacity:.7">'
          + "朋友圈数据加载失败：" + esc(e.message) + "</div>";
      });
  }

  // pjax 与首次加载都要生效
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
  document.addEventListener("pjax:complete", start);
})();
