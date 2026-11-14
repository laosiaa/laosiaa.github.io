/*! 文章页元信息重排：约 X 分钟读完 · 日期 · N 字 · 地点（不再显示阅读量） */
(function () {
  "use strict";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fix() {
    var second = document.querySelector(".meta-secondline");
    if (!second) return;
    var wc = second.querySelector(".post-meta-wordcount");
    if (!wc || wc.dataset.mcMoved === "1") return;

    var countNode = wc.querySelector(".word-count");
    var count = countNode ? countNode.textContent.trim() : "";
    var minText = "";
    var spans = wc.querySelectorAll("span");
    for (var i = 0; i < spans.length; i++) {
      if (/\u5206\u949f/.test(spans[i].textContent) && !spans[i].className) {
        minText = spans[i].textContent.replace(/[^0-9.]/g, "");
        break;
      }
    }

    var dateSpan = document.querySelector(".post-meta-date");
    var pub = dateSpan ? dateSpan.querySelector("time") : null;
    var pubText = pub ? pub.textContent.trim() : "";

    if (dateSpan && minText) {
      dateSpan.innerHTML = "";
      dateSpan.appendChild(el("i", "anzhiyufont anzhiyu-icon-clock post-meta-icon"));
      dateSpan.appendChild(el("span", "post-meta-label", "\u7ea6 " + minText + " \u5206\u949f\u8bfb\u5b8c"));
      if (pubText) {
        dateSpan.appendChild(el("span", "post-meta-separator"));
        dateSpan.appendChild(el("i", "anzhiyufont anzhiyu-icon-calendar-days post-meta-icon"));
        dateSpan.appendChild(el("time", "post-meta-date-created", pubText));
      }
      dateSpan.title = "\u9884\u8ba1\u9605\u8bfb\u65f6\u957f " + minText + " \u5206\u949f";
    }

    if (count) {
      wc.innerHTML = "";
      wc.appendChild(el("i", "anzhiyufont anzhiyu-icon-file-word post-meta-icon"));
      wc.appendChild(el("span", "post-meta-label", count + " \u5b57"));
      wc.title = "\u672c\u6587\u5171 " + count + " \u5b57";
    }
    wc.dataset.mcMoved = "1";

    var kids = second.children;
    for (var k = kids.length - 1; k > 0; k--) {
      if (
        kids[k].classList.contains("post-meta-separator") &&
        kids[k - 1].classList.contains("post-meta-separator")
      ) {
        kids[k].remove();
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fix);
  else fix();
  document.addEventListener("pjax:complete", function () {
    setTimeout(fix, 80);
  });
})();
