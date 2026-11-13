/*! 文章 AI 摘要（Cloudflare Workers AI 代理） */
(function () {
  "use strict";

  var meta = document.querySelector('meta[name="ai-summary-endpoint"]');
  var ENDPOINT = (meta && meta.getAttribute("content")) || "";
  var LS_PREFIX = "ai-summary:v1:";
  var TTL = 7 * 24 * 3600 * 1000;

  if (!ENDPOINT) return; // 未配置 Worker 地址时静默不工作

  function isPostPage() {
    // /YYYY/MM/DD/slug/ 才算文章页
    return /^\/\d{4}\/\d{2}\/\d{2}\/[^\/]+\/?$/.test(location.pathname);
  }

  function articleText() {
    var el = document.querySelector("#article-container");
    if (!el) return "";
    var clone = el.cloneNode(true);
    // 去掉标题、代码块、目录、版权、按钮等噪声
    clone.querySelectorAll("pre, .code-tools, .toc, .copy-btn, .post-copyright, .reward, #ai-summary").forEach(function (n) {
      n.remove();
    });
    return (clone.innerText || "").replace(/\s+/g, " ").trim();
  }

  function cacheGet(key) {
    try {
      var raw = localStorage.getItem(LS_PREFIX + key);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || Date.now() - o.t > TTL) return null;
      return o.s;
    } catch (e) { return null; }
  }
  function cacheSet(key, s) {
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify({ t: Date.now(), s: s })); } catch (e) {}
  }

  function box(title) {
    var d = document.createElement("div");
    d.id = "ai-summary";
    d.className = "ai-summary-card";
    d.innerHTML =
      '<div class="ai-summary-head"><span class="ai-summary-badge">AI</span>' +
      '<span class="ai-summary-title">' + (title || "AI 摘要") + "</span>" +
      '<button type="button" class="ai-summary-toggle" aria-label="收起">收起</button></div>' +
      '<div class="ai-summary-body">生成中…</div>';
    return d;
  }

  function mount(card, text) {
    var body = card.querySelector(".ai-summary-body");
    body.textContent = text;
  }

  function inject(card) {
    var target = document.querySelector("#article-container");
    if (!target) return false;
    var first = target.firstElementChild;
    // 插到 article 内部最前面（标题下方）
    if (first && /^(H1|HEADER)$/i.test(first.tagName)) first.insertAdjacentElement("afterend", card);
    else target.insertBefore(card, target.firstChild);
    return true;
  }

  function build() {
    if (!isPostPage()) return;
    if (document.getElementById("ai-summary")) return;
    var text = articleText();
    if (text.length < 200) return;

    var key = location.pathname;
    var card = box();
    if (!inject(card)) return;

    var toggle = card.querySelector(".ai-summary-toggle");
    toggle.addEventListener("click", function () {
      card.classList.toggle("collapsed");
      toggle.textContent = card.classList.contains("collapsed") ? "展开" : "收起";
    });

    var hit = cacheGet(key);
    if (hit) { mount(card, hit); return; }

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key, content: text.slice(0, 6000) }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok && d.summary) {
          mount(card, d.summary);
          cacheSet(key, d.summary);
        } else {
          mount(card, "AI 摘要暂时不可用（" + ((d && d.error) || "未知错误") + "）");
          card.classList.add("failed");
        }
      })
      .catch(function (e) {
        mount(card, "AI 摘要生成失败：" + e.message);
        card.classList.add("failed");
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
  document.addEventListener("pjax:complete", build);
})();
