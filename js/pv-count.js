/*! 阅读量 / 站点访问量（Vercount API 直连，支持 pjax） */
(function () {
  "use strict";

  var API = "https://events.vercount.one/api/v2/log";
  var pending = false;

  function uvCookieName() {
    return "vercount_uv_" + (location.host || "unknown-host").replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function isNewVisitor() {
    return document.cookie.indexOf(uvCookieName() + "=") === -1;
  }

  function markVisitor() {
    document.cookie = uvCookieName() + "=1; path=/; max-age=31536000; samesite=lax";
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (!el || val === undefined || val === null) return;
    el.textContent = String(val);     // 直接替换掉 spinner
  }

  function fill(d) {
    if (!d) return;
    if (d.page_pv !== undefined) setText("busuanzi_value_page_pv", d.page_pv);
    if (d.site_pv !== undefined) setText("busuanzi_value_site_pv", d.site_pv);
    if (d.site_uv !== undefined) setText("busuanzi_value_site_uv", d.site_uv);
  }

  function hit() {
    if (pending) return;
    // 只有在页面上真的存在计数元素时才请求，避免无谓调用
    if (!document.getElementById("busuanzi_value_page_pv") &&
        !document.getElementById("busuanzi_value_site_pv") &&
        !document.getElementById("busuanzi_value_site_uv")) return;

    pending = true;
    var isNew = isNewVisitor();
    if (isNew) markVisitor();

    var url = location.href.split("#")[0];
    var ctrl = null, timer = null;
    try {
      ctrl = new AbortController();
      timer = setTimeout(function () { ctrl.abort(); }, 8000);
    } catch (e) {}

    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url, isNewUv: isNew }),
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (timer) clearTimeout(timer);
        // 兼容 {status:'success',data:{...}} 与扁平结构
        fill(j && j.data ? j.data : j);
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        // 失败就把 spinner 收掉，显示 "—"，避免一直转圈
        ["busuanzi_value_page_pv", "busuanzi_value_site_pv", "busuanzi_value_site_uv"].forEach(function (id) {
          var el = document.getElementById(id);
          if (el && el.querySelector(".anzhiyu-icon-spinner")) el.textContent = "—";
        });
      })
      .then(function () { pending = false; });
  }

  function run() { setTimeout(hit, 60); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  document.addEventListener("pjax:complete", run);
})();
