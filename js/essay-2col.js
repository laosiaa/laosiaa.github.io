/*! 即刻短文页：把「正文卡 + 元信息条」包成一张卡，便于两列排布 */
(function () {
  "use strict";

  function wrapCards() {
    var page = document.getElementById("essay_page");
    if (!page) return;
    var ul = page.querySelector("#waterfall");
    if (!ul) return;

    // 已经包过就只清理瀑布流残留的内联定位
    var cards = ul.querySelectorAll(".es-card");
    if (cards.length) {
      for (var i = 0; i < cards.length; i++) {
        var li = cards[i].querySelector("li.bber-item");
        var bb = cards[i].querySelector(".bber-bottom");
        if (li) {
          li.style.position = "";
          li.style.top = "";
          li.style.left = "";
        }
        if (bb) {
          bb.style.position = "";
          bb.style.top = "";
          bb.style.left = "";
        }
      }
      return;
    }

    var kids = Array.prototype.slice.call(ul.children);
    var frag = document.createDocumentFragment();
    var cur = null;

    kids.forEach(function (node) {
      var isItem = node.tagName === "LI" && node.classList.contains("bber-item");
      var isBottom = node.classList.contains("bber-bottom");
      var isHr = node.tagName === "HR";

      if (isItem) {
        cur = document.createElement("div");
        cur.className = "es-card";
        frag.appendChild(cur);
        cur.appendChild(node);
      } else if (isHr) {
        // 分隔线丢掉
      } else if (isBottom) {
        if (cur) cur.appendChild(node);
        else frag.appendChild(node);
      } else {
        frag.appendChild(node);
      }
    });

    ul.innerHTML = "";
    ul.appendChild(frag);

    // 清掉瀑布流写死的内联定位 / 高度
    ul.style.position = "";
    ul.style.height = "";
    for (var i = 0; i < cards.length; i++) {}
    ul.querySelectorAll("li.bber-item, .bber-bottom").forEach(function (el) {
      el.style.position = "";
      el.style.top = "";
      el.style.left = "";
      el.style.width = "";
    });
  }

  function boot() {
    wrapCards();
    // 瀑布流脚本可能稍后才跑，重试几次
    [120, 400, 900].forEach(function (t) {
      setTimeout(wrapCards, t);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  document.addEventListener("pjax:complete", function () {
    setTimeout(boot, 120);
  });
})();
