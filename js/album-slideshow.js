/*! 相册详情页：把图集改成幻灯片轮播（默认 5 秒自动切换） */
(function () {
  "use strict";

  var INTERVAL = 5000;

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
          var src = a.getAttribute("href") || (img && img.getAttribute("src"));
          if (!src) return;
          slides.push({ src: src, thumb: img ? img.getAttribute("src") : src, cap: cap, meta: meta.join(" · ") });
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
      if (!src) return;
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

  function build(slides) {
    var wrap = document.createElement("div");
    wrap.className = "alb-slides";
    wrap.innerHTML =
      '<div class="alb-stage">' +
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
    var img = wrap.querySelector(".alb-img");
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

    function render(i) {
      var s = slides[i];
      img.classList.add("fade");
      img.src = s.src;
      img.onload = function () { img.classList.remove("fade"); };
      img.onerror = function () { img.classList.remove("fade"); };
      // 预加载下一张
      var nx = slides[(i + 1) % slides.length];
      if (nx) { var pre = new Image(); pre.src = nx.src; }
      capMain.textContent = s.cap || "";
      capMeta.textContent = s.meta || "";
      wrap.querySelector(".alb-cap").style.display = s.cap || s.meta ? "" : "none";
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
      render(idx);
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

    render(0);
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

    var node = build(slides);
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
