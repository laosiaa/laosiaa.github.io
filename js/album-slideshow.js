/*! 相册详情页：幻灯片轮播（3 秒自动切换 + 每次不同的华丽转场） */
(function () {
  "use strict";

  var INTERVAL = 3000;

  // 轮换使用的转场（顺序循环，相邻两次必然不同）
  var FX = [
    "fade",      // 交叉淡入
    "slide-in",  // 自右向左推入
    "zoom-in",   // 放大冲入
    "flip",      // 3D 横向翻页
    "wipe",      // 左侧擦除展开
    "blur",      // 模糊渐清
    "circle",    // 圆形扩散
    "slide-out", // 自左向右推入
    "zoom-out",  // 缩小浮现
    "rotate",    // 旋转甩入
    "wipe-up",   // 自下而上擦除
    "flip-v"     // 3D 纵向翻页
  ];
  var fxIdx = 0;

  function textOf(el, sel) {
    var n = el.querySelector(sel);
    return n ? (n.textContent || "").trim() : "";
  }

  function collect() {
    var slides = [];
    var root = document.getElementById("album_detail");
    if (!root) return slides;

    // 类型 1（瀑布流）：li.album-item
    var items = root.querySelectorAll("li.album-item");
    if (items.length) {
      Array.prototype.forEach.call(items, function (li) {
        var cap = textOf(li, ".datacont");
        var meta = [];
        var t = li.querySelector(".album-info-time time");
        if (t) {
          var dt = t.getAttribute("datetime") || t.textContent;
          var d = new Date(dt);
          if (!isNaN(d)) {
            meta.push(d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate());
          }
        }
        var addr = textOf(li, ".album-info-address");
        var from = textOf(li, ".album-info-from");
        if (from) meta.push(from);
        if (addr) meta.push(addr);

        var imgs = li.querySelectorAll(".album-content-img");
        Array.prototype.forEach.call(imgs, function (a) {
          var img = a.querySelector("img");
          // 主题懒加载会把 <img> 的 src 换成 1px 占位图，真实地址取 <a href>
          var full = a.getAttribute("href");
          var raw = (img && (img.getAttribute("data-src") || img.getAttribute("data-original") || img.getAttribute("src"))) || "";
          if (!full && !raw) return;
          if (!full && /^data:/.test(raw)) return;
          var src = full || raw;
          slides.push({ src: src, thumb: /^data:/.test(raw) ? src : (raw || src), cap: cap, meta: meta.join(" · ") });
        });
      });
      return slides;
    }

    // 类型 2（justified gallery）：.fj-gallery-item
    var gitems = root.querySelectorAll(".fj-gallery-item");
    Array.prototype.forEach.call(gitems, function (it) {
      var a = it.querySelector("a");
      if (!a) return;
      var src = a.getAttribute("href") || (it.querySelector("img") || {}).src;
      var img = it.querySelector("img");
      if (!src || /^data:/.test(src)) return;
      slides.push({
        src: src,
        thumb: a.getAttribute("data-thumb") ||
               (img && (img.getAttribute("data-src") || img.getAttribute("src"))) || src,
        cap: a.getAttribute("data-caption") || "",
        meta: textOf(it, ".tag-address")
      });
    });
    return slides;
  }

  function build(slides, backUrl) {
    var wrap = document.createElement("div");
    wrap.className = "alb-slides";
    wrap.innerHTML =
      '<div class="alb-stage">' +
      '<a class="alb-back" href="' + (backUrl || "/album/") + '">返回</a>' +
      '<img class="alb-img nolazyload" alt="">' +
      '<img class="alb-img nolazyload" alt="">' +
      '<button class="alb-nav alb-prev" aria-label="上一张">‹</button>' +
      '<button class="alb-nav alb-next" aria-label="下一张">›</button>' +
      '<div class="alb-cap"><span class="alb-cap-main"></span><span class="alb-cap-meta"></span></div>' +
      '<div class="alb-count"><b>1</b> / ' + slides.length + "</div>" +
      "</div>" +
      '<div class="alb-bar">' +
      '<button class="alb-toggle" aria-label="暂停/播放">❚❚</button>' +
      '<div class="alb-thumbs"></div>' +
      "</div>";

    var stage = wrap.querySelector(".alb-stage");
    var layers = wrap.querySelectorAll(".alb-img");
    var capBox = wrap.querySelector(".alb-cap");
    var capMain = wrap.querySelector(".alb-cap-main");
    var capMeta = wrap.querySelector(".alb-cap-meta");
    var counter = wrap.querySelector(".alb-count");
    var thumbs = wrap.querySelector(".alb-thumbs");
    var toggle = wrap.querySelector(".alb-toggle");

    slides.forEach(function (s, i) {
      var b = document.createElement("button");
      b.className = "alb-thumb" + (i === 0 ? " active" : "");
      b.setAttribute("aria-label", "第 " + (i + 1) + " 张");
      b.style.backgroundImage = "url('" + s.thumb + "')";
      b.addEventListener("click", function () {
        go(i);
        restart();
      });
      thumbs.appendChild(b);
    });
    var thumbEls = wrap.querySelectorAll(".alb-thumb");

    var idx = 0;
    var timer = null;
    var playing = true;
    var cur = 0;      // 当前显示的图层
    var first = true; // 首帧不做转场
    var gen = 0;      // 转场代号

    function reset(el) {
      el.className = "alb-img nolazyload";
      el.style.opacity = "";
      el.style.transform = "";
      el.style.clipPath = "";
      el.style.filter = "";
    }

    function paint(i) {
      var s = slides[i];
      var inEl = first ? layers[0] : layers[1 - cur];
      var outEl = first ? layers[1] : layers[cur];
      var fx = FX[fxIdx++ % FX.length];
      var my = ++gen; // 代号，防止上一轮的收尾把这一轮清掉

      // 预加载下一张
      var nx = slides[(i + 1) % slides.length];
      if (nx) { var pre = new Image(); pre.src = nx.src; }

      reset(inEl);
      inEl.src = s.src;
      inEl.style.zIndex = "2";
      outEl.style.zIndex = "1";

      if (first) {
        inEl.style.opacity = "1";
      } else {
        inEl.classList.add("alb-fx", "alb-fx-" + fx);
      }

      // 转场结束后收尾（animationend + 兜底定时器，且只对当前这一轮生效）
      var finish = function () {
        if (my !== gen) return;
        reset(inEl);
        inEl.style.opacity = "1";
        inEl.style.zIndex = "2";
        reset(outEl);
        outEl.style.opacity = "0";
        outEl.style.zIndex = "1";
      };
      if (!first) {
        inEl.addEventListener("animationend", finish, { once: true });
        window.setTimeout(finish, 1100);
      }

      cur = first ? 0 : 1 - cur;
      first = false;

      capMain.textContent = s.cap || "";
      capMeta.textContent = s.meta || "";
      capBox.style.display = s.cap || s.meta ? "" : "none";
      capBox.classList.remove("alb-cap-in");
      void capBox.offsetWidth;
      capBox.classList.add("alb-cap-in");

      counter.innerHTML = "<b>" + (i + 1) + "</b> / " + slides.length;
      Array.prototype.forEach.call(thumbEls, function (t, k) {
        t.classList.toggle("active", k === i);
      });
      var act = thumbEls[i];
      if (act && thumbs.scrollWidth > thumbs.clientWidth) {
        thumbs.scrollTo({ left: act.offsetLeft - thumbs.clientWidth / 2 + act.clientWidth / 2, behavior: "smooth" });
      }
    }

    function go(i) {
      idx = (i + slides.length) % slides.length;
      paint(idx);
    }
    function next() { go(idx + 1); }
    function prev() { go(idx - 1); }

    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() {
      stop();
      if (!playing || slides.length < 2) return;
      timer = setInterval(next, INTERVAL);
    }
    function restart() { start(); }

    var backEl = wrap.querySelector(".alb-back");
    if (backEl) {
      backEl.addEventListener("click", function (e) {
        e.preventDefault();
        var url = backEl.getAttribute("href") || "/album/";
        if (window.pjax && window.pjax.loadUrl) window.pjax.loadUrl(url);
        else window.location.href = url;
      });
    }

    wrap.querySelector(".alb-next").addEventListener("click", function (e) { e.stopPropagation(); next(); restart(); });
    wrap.querySelector(".alb-prev").addEventListener("click", function (e) { e.stopPropagation(); prev(); restart(); });

    toggle.addEventListener("click", function () {
      playing = !playing;
      toggle.textContent = playing ? "❚❚" : "▶";
      if (playing) start(); else stop();
    });

    stage.addEventListener("mouseenter", stop);
    stage.addEventListener("mouseleave", function () { if (playing) start(); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { next(); restart(); }
      if (e.key === "ArrowLeft") { prev(); restart(); }
    });

    var sx = 0, sy = 0;
    stage.addEventListener("touchstart", function (e) {
      if (!e.touches || !e.touches[0]) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener("touchend", function (e) {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) next(); else prev();
        restart();
      }
    }, { passive: true });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else if (playing) start();
    });

    paint(0);
    start();
    return wrap;
  }

  function init() {
    var root = document.getElementById("album_detail");
    if (!root || root.dataset.albSlides === "1") return;
    var slides = collect();
    if (slides.length < 1) return;

    // 隐藏原来的网格 / 瀑布流
    var old = root.querySelectorAll(".timeline, .type-gallery");
    Array.prototype.forEach.call(old, function (el) {
      el.style.display = "none";
    });

    // 眉标补上张数信息
    var tipEl = root.querySelector(".author-content-item-tips");
    if (tipEl && tipEl.textContent.indexOf("张") < 0) {
      tipEl.textContent = tipEl.textContent.trim() + " · 共 " + slides.length + " 张";
    }

    // 页头原来的「返回」按钮：取出跳转地址，隐藏原按钮，改放到幻灯片右上角
    var backUrl = "/album/";
    var oldBack = root.querySelector(".banner-button");
    if (oldBack) {
      var oc = oldBack.getAttribute("onclick") || "";
      var m = /pjax\.loadUrl\(["']([^"']+)["']\)/.exec(oc);
      if (m) backUrl = m[1];
      var grp = oldBack.closest(".banner-button-group") || oldBack;
      grp.style.display = "none";
    }

    var node = build(slides, backUrl);
    root.insertBefore(node, old[0] || root.firstChild);
    root.dataset.albSlides = "1";
  }

  function boot() {
    init();
    [200, 600].forEach(function (t) { setTimeout(init, t); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  document.addEventListener("pjax:complete", function () {
    setTimeout(boot, 150);
  });
})();
