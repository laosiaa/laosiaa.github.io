/*! 让 Vercount（不蒜子兼容脚本）在 pjax 换页后重新执行，修复「阅读量一直转圈」 */
(function () {
  "use strict";

  var SRC = "https://events.vercount.one/js";
  var lastUrl = "";

  function reloadCounter() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;

    // 移除上一次注入的脚本
    var old = document.querySelectorAll('script[data-pv-refresh]');
    for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);

    // 页面没有计数元素就不必加载
    if (!document.getElementById("busuanzi_value_page_pv") &&
        !document.getElementById("busuanzi_value_site_pv") &&
        !document.getElementById("busuanzi_value_site_uv")) return;

    var s = document.createElement("script");
    s.src = SRC + "?t=" + Date.now();   // 加时间戳，强制重新执行
    s.async = true;
    s.setAttribute("data-pv-refresh", "1");
    document.body.appendChild(s);

    // 兜底：3 秒后仍在转圈就把 spinner 换成 —，不再一直转
    setTimeout(function () {
      var ids = ["busuanzi_value_page_pv", "busuanzi_value_site_pv", "busuanzi_value_site_uv"];
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.querySelector(".anzhiyu-icon-spinner")) el.textContent = "—";
      });
    }, 3000);
  }

  // 首次加载交给主题自己注入的脚本，这里只处理 pjax 之后的页面
  document.addEventListener("pjax:complete", function () { setTimeout(reloadCounter, 120); });
  // 兜底：有些 pjax 实现不派发事件，就监听 DOM 变化
  window.addEventListener("popstate", function () { setTimeout(reloadCounter, 200); });
  setTimeout(function () { lastUrl = location.href; }, 0);
})();
