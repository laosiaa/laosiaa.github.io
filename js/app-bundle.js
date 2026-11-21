/*! Laosia app bundle (27 files) */
/* ---- tech-canvas.js ---- */
/*! 科技风粒子画布：接管首页 #peoplecanvas，绘制电路网格 + 流动光点 + 扫描线 */
(function () {
  "use strict";

  var PATH = [[0.02, 0.62], [0.22, 0.62], [0.30, 0.38], [0.48, 0.38],
              [0.54, 0.62], [0.74, 0.62], [0.82, 0.34], [1.0, 0.34]];
  var COL = "120, 210, 255";

  function setup(canvas) {
    var rect = canvas.getBoundingClientRect();
    // 元素还没布局好（窄屏下横幅可能被隐藏）就跳过
    if (rect.width < 40 || rect.height < 20) return null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: rect.width, h: rect.height };
  }

  function lerp(p, t) {
    var segs = [], total = 0, i;
    for (i = 0; i < p.length - 1; i++) {
      var dx = (p[i + 1][0] - p[i][0]), dy = (p[i + 1][1] - p[i][1]);
      var d = Math.hypot(dx, dy);
      segs.push(d); total += d;
    }
    var target = (t % 1) * total;
    for (i = 0; i < segs.length; i++) {
      if (target <= segs[i]) {
        var r = segs[i] ? target / segs[i] : 0;
        return [p[i][0] + (p[i + 1][0] - p[i][0]) * r, p[i][1] + (p[i + 1][1] - p[i][1]) * r];
      }
      target -= segs[i];
    }
    return p[p.length - 1];
  }

  function start(canvas) {
    var s = setup(canvas);
    if (!s) return;
    var ctx = s.ctx, W = s.w, H = s.h, t0 = performance.now();
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function draw(now) {
      var t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);

      // 网格
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(" + COL + ",0.10)";
      var step = 26, x, y;
      for (x = 0; x <= W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (y = 0; y <= H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // 扫描光带
      var sx = ((t * 0.22) % 1.35 - 0.18) * W;
      var g = ctx.createLinearGradient(sx - 40, 0, sx + 40, 0);
      g.addColorStop(0, "rgba(" + COL + ",0)");
      g.addColorStop(0.5, "rgba(" + COL + ",0.20)");
      g.addColorStop(1, "rgba(" + COL + ",0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx - 40, 0, 80, H);

      // 电路折线
      ctx.beginPath();
      PATH.forEach(function (pt, i) {
        var px = pt[0] * W, py = pt[1] * H;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.strokeStyle = "rgba(" + COL + ",0.42)";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // 节点
      PATH.forEach(function (pt) {
        ctx.beginPath();
        ctx.arc(pt[0] * W, pt[1] * H, 2.2, 0, 6.2832);
        ctx.fillStyle = "rgba(" + COL + ",0.75)";
        ctx.fill();
      });

      // 流动光点（3 个相位）
      for (var i = 0; i < 3; i++) {
        var p = lerp(PATH, t * 0.16 + i / 3);
        var cx = p[0] * W, cy = p[1] * H;
        var rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 13);
        rg.addColorStop(0, "rgba(230,248,255,0.95)");
        rg.addColorStop(0.35, "rgba(" + COL + ",0.55)");
        rg.addColorStop(1, "rgba(" + COL + ",0)");
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(cx, cy, 13, 0, 6.2832); ctx.fill();
      }

      if (!reduce) raf = requestAnimationFrame(draw);
    }
    var raf = requestAnimationFrame(draw);
    // 尺寸变化时重建
    window.addEventListener("resize", function () {
      cancelAnimationFrame(raf);
      var s2 = setup(canvas);
      if (s2) { ctx = s2.ctx; W = s2.w; H = s2.h; raf = requestAnimationFrame(draw); }
    });
  }

  function init() {
    var cv = document.getElementById("peoplecanvas");
    if (cv) start(cv);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  document.addEventListener("pjax:complete", init);
})();

;
/* ---- ai-summary.js ---- */
/*! 文章 AI 摘要（Cloudflare Workers AI 代理） */
(function () {
  "use strict";

  var meta = document.querySelector('meta[name="ai-summary-endpoint"]');
  var ENDPOINT = (meta && meta.getAttribute("content")) || "";
  var LS_PREFIX = "ai-summary:v5:";
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
      signal: (function () {
        try { var c = new AbortController(); window.__aiSummaryAbort = c; setTimeout(function () { c.abort(); }, 25000); return c.signal; }
        catch (e) { return undefined; }
      })(),
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
        if (e && e.name === "AbortError") {
          mount(card, "这篇文章的 AI 摘要还在生成中（首次约 10 秒），稍后刷新页面即可看到。");
          card.classList.add("failed");
        } else {
          mount(card, "AI 摘要生成失败：" + e.message);
          card.classList.add("failed");
        }
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
  document.addEventListener("pjax:complete", build);
})();

;
/* ---- pv-refresh.js ---- */
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

;
/* ---- img-lazy-fix.js ---- */
/*! 修复：文章图片懒加载不触发（用 rect 判断替代失效的观察器） */
(function () {
  "use strict";

  var MARGIN = 1200; // 视口上下各 1200px 内的图片直接加载

  function load(img) {
    if (img.dataset.llLoaded === "1") return;
    var src = img.getAttribute("data-lazy-src") || img.getAttribute("data-original");
    if (!src) return;
    img.dataset.llLoaded = "1";
    img.setAttribute("data-ll-fixed", "1");
    img.src = src;
    img.removeAttribute("data-lazy-src");
  }

  function scan() {
    var imgs = document.querySelectorAll("img[data-lazy-src]");
    if (!imgs.length) return;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = 0; i < imgs.length; i++) {
      var r = imgs[i].getBoundingClientRect();
      // 1px 占位图高度极小，用 top/bottom 判断
      if (r.bottom > -MARGIN && r.top < vh + MARGIN) load(imgs[i]);
    }
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    // 不用 rAF：后台标签页/无焦点窗口里 rAF 会被暂停，导致永远不再扫描
    setTimeout(function () { ticking = false; scan(); }, 120);
  }

  var beats = 0;
  function boot() {
    scan();
    setTimeout(scan, 300);
    setTimeout(scan, 1200);
    // 兜底轮询：不依赖 scroll 事件（某些内嵌/后台环境里 scroll 不派发）
    if (!window.__llTimer) {
      window.__llTimer = setInterval(function () {
        beats++;
        scan();
        if (beats > 150 || !document.querySelector("img[data-lazy-src]")) {
          clearInterval(window.__llTimer);
          window.__llTimer = null;
          beats = 0;
        }
      }, 400);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 150); });
})();

;
/* ---- essay-2col.js ---- */
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

;
/* ---- album-slideshow.js ---- */
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

    // 返回按钮：放在相册标题区右上角（幻灯片框上方、与框右边缘对齐）
    var oldBtn = root.querySelector(".alb-back");
    if (oldBtn) oldBtn.remove();
    var backEl = document.createElement("a");
    backEl.className = "alb-back";
    backEl.href = backUrl;
    backEl.textContent = "返回";
    backEl.addEventListener("click", function (e) {
      e.preventDefault();
      var url = backEl.getAttribute("href") || "/album/";
      if (window.pjax && window.pjax.loadUrl) window.pjax.loadUrl(url);
      else window.location.href = url;
    });
    var headerBox = root.querySelector(".author-content") || root;
    headerBox.appendChild(backEl);
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

;
/* ---- bangumi-page2.js ---- */
/*! 追番页：好番推荐（50 部 8.0+）+ 我的追番，支持「查看更多」与分页（每页 8 部） */
(function () {
  "use strict";

  var DATA_URL = "/bangumis/data.json";
  var REC_URL = "/bangumis/recommend.json";
  var PAGE_SIZE = 8;
  var REC_INITIAL = 4;

  function txt(el) {
    return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function card(it) {
    var a = document.createElement("a");
    a.className = "bgm-card";
    a.href = it.link || "#";
    a.target = "_blank";
    a.rel = "noopener";
    a.title = it.title + (it.des ? "\n" + it.des : "");

    var status = it.status || it.ep_status || "";
    var onair = /^更新至|^连载/.test(status);
    var badge = status
      ? '<span class="bgm-badge' + (onair ? " onair" : "") + '">' + esc(status) + "</span>"
      : "";
    var hasScore = it.score && it.score !== "-";
    var sc = '<span class="bgm-score' + (hasScore ? "" : " dim") + '">' +
      (hasScore ? esc(it.score) : "—") + "</span>";

    a.innerHTML =
      '<div class="bgm-cover">' +
      '<img class="nolazyload" src="' + esc(it.cover) + '" alt="' + esc(it.title) +
      '" referrerpolicy="no-referrer" loading="lazy">' +
      badge + sc +
      "</div>" +
      '<div class="bgm-meta">' +
      '<p class="bgm-title">' + esc(it.title) + "</p>" +
      (it.area ? '<p class="bgm-sub">' + esc(it.area) + "</p>" : "") +
      "</div>";
    return a;
  }

  function grid(items) {
    var g = document.createElement("div");
    g.className = "bgm-grid";
    if (!items.length) {
      g.innerHTML = '<p class="bgm-empty">这里还空着~</p>';
      return g;
    }
    var frag = document.createDocumentFragment();
    items.forEach(function (it) { frag.appendChild(card(it)); });
    g.appendChild(frag);
    return g;
  }

  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 1e8) return (n / 1e8).toFixed(2) + "亿";
    if (n >= 1e4) return (n / 1e4).toFixed(1) + "万";
    return String(n);
  }

  function section(title, sub) {
    var s = document.createElement("section");
    s.className = "bgm-sec";
    s.innerHTML =
      '<div class="bgm-sec-head"><h2>' + esc(title) + "</h2>" +
      (sub ? "<span class=\"bgm-sec-sub\">" + esc(sub) + "</span>" : "") + "</div>";
    return s;
  }

  /* ---------- 分页视图：初始 N 个 + 查看更多 + 翻页 ---------- */
  function pagedView(items, initial, pageSize) {
    var wrap = document.createElement("div");
    wrap.className = "bgm-paged";

    var body = document.createElement("div");
    body.className = "bgm-paged-body";

    var pager = document.createElement("div");
    pager.className = "bgm-pager";

    var more = document.createElement("button");
    more.type = "button";
    more.className = "bgm-more";
    more.innerHTML = "查看更多 <span>共 " + items.length + " 部</span>";

    var expanded = false;
    var page = 0;
    var total = items.length;
    var pages = Math.max(1, Math.ceil(total / pageSize));

    function renderAll() {
      body.innerHTML = "";
      body.appendChild(grid(expanded ? items.slice(page * pageSize, page * pageSize + pageSize) : items.slice(0, initial)));
    }

    function renderPager() {
      if (!expanded || pages <= 1) { pager.innerHTML = ""; pager.style.display = "none"; return; }
      pager.style.display = "";
      var html = "";
      html += '<button type="button" class="bgm-pg" data-go="prev"' + (page === 0 ? " disabled" : "") + ">上一页</button>";
      for (var i = 0; i < pages; i++) {
        html += '<button type="button" class="bgm-pg num' + (i === page ? " active" : "") +
          '" data-go="' + i + '">' + (i + 1) + "</button>";
      }
      html += '<button type="button" class="bgm-pg" data-go="next"' + (page === pages - 1 ? " disabled" : "") + ">下一页</button>";
      pager.innerHTML = html;
    }

    function sync() {
      renderAll();
      renderPager();
      more.innerHTML = expanded
        ? "收起 <span>已展开全部 " + total + " 部</span>"
        : "查看更多 <span>共 " + total + " 部</span>";
    }

    more.addEventListener("click", function () {
      expanded = !expanded;
      page = 0;
      sync();
      if (expanded) wrap.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    pager.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-go]");
      if (!btn || btn.disabled) return;
      var go = btn.getAttribute("data-go");
      if (go === "prev") page = Math.max(0, page - 1);
      else if (go === "next") page = Math.min(pages - 1, page + 1);
      else page = parseInt(go, 10) || 0;
      sync();
    });

    sync();
    wrap.appendChild(body);
    wrap.appendChild(pager);
    if (total > initial) wrap.appendChild(more);
    return wrap;
  }

  function normalize(b) {
    return {
      title: b.title,
      cover: b.cover,
      link: b.link,
      status: b.ep_status || "",
      score: b.score == null ? "" : String(b.score),
      area: [b.type, b.area].filter(Boolean).join(" · "),
      des: b.des || ""
    };
  }

  /* ---------- 我的追番：分类切换 + 各自分页 ---------- */
  function tabs(groups) {
    var bar = document.createElement("div");
    bar.className = "bgm-tabs";
    var holder = document.createElement("div");
    holder.className = "bgm-tab-body";

    function show(items) {
      holder.innerHTML = "";
      holder.appendChild(grid(items.slice(0, 4)));
    }

    groups.forEach(function (g, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "bgm-tab" + (i === 0 ? " active" : "");
      b.innerHTML = esc(g.label) + '<span class="bgm-tab-n">' + g.items.length + "</span>";
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(bar.children, function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        show(g.items);
      });
      bar.appendChild(b);
    });
    show(groups[0].items);
    return { bar: bar, body: holder };
  }

  function fromJson(d) {
    var all = [].concat(d.wantWatch || [], d.watching || [], d.watched || []);
    var seen = {}, uniq = [];
    all.forEach(function (b) {
      if (!b || !b.title || seen[b.title]) return;
      seen[b.title] = 1;
      uniq.push(normalize(b));
    });
    return [
      { label: "全部", items: uniq },
      { label: "想看", items: (d.wantWatch || []).map(normalize) },
      { label: "在看", items: (d.watching || []).map(normalize) },
      { label: "已看", items: (d.watched || []).map(normalize) }
    ];
  }

  function fromDom() {
    var root = document.getElementById("article-container");
    var seen = {}, uniq = [];
    Array.prototype.forEach.call(root.querySelectorAll(".bangumi-item"), function (item) {
      var a = item.querySelector(".bangumi-title a") || item.querySelector(".bangumi-picture a");
      var picA = item.querySelector(".bangumi-picture a");
      var title = txt(a) || txt(item.querySelector(".bangumi-title"));
      if (!title || seen[title]) return;
      seen[title] = 1;
      uniq.push({
        title: title,
        cover: (picA && picA.getAttribute("href")) || "",
        link: (a && a.getAttribute("href")) || "",
        status: txt(item.querySelector(".bangumi-progress-text")).replace(/^追.{1,2}状态[:：]\s*/, ""),
        score: txt(item.querySelector(".bangumi-info-item-score em")),
        area: txt(item.querySelector(".bangumi-area")),
        des: txt(item.querySelector(".bangumi-comments")).replace(/^简介[:：]\s*/, "")
      });
    });
    return [
      { label: "全部", items: uniq },
      { label: "想看", items: [] },
      { label: "在看", items: [] },
      { label: "已看", items: [] }
    ];
  }

  function hideOriginal(root) {
    var groups = root.querySelectorAll(".bangumi-show");
    if (groups[0] && groups[0].parentElement) groups[0].parentElement.style.display = "none";
    Array.prototype.forEach.call(root.querySelectorAll(".bangumi-tabs, .bangumi-pagination"), function (el) {
      el.style.display = "none";
    });
  }

  function init() {
    var root = document.getElementById("article-container");
    if (!root || root.dataset.bgmGrid === "1") return;
    if (!root.querySelector(".bangumi-item")) return;
    root.dataset.bgmGrid = "1";

    var mineP = fetch(DATA_URL, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(0); })
      .then(fromJson)
      .catch(fromDom);

    var recP = fetch(REC_URL, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(0); })
      .then(function (list) { return (list || []).map(normalize); })
      .catch(function () { return []; });

    Promise.all([mineP, recP]).then(function (res) {
      var mine = res[0];
      var rec = res[1];
      hideOriginal(root);

      var page = document.createElement("div");
      page.className = "bgm-page";

      if (rec.length) {
        var sorted = rec.slice().sort(function (a, b) {
          return (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0);
        });
        var s1 = section("好番推荐", sorted.length + " 部评分 8.0 以上的国创 · 每天自动更新");
        var head = s1.querySelector(".bgm-sec-head");
        var moreLink = document.createElement("a");
        moreLink.className = "bgm-more-link";
        moreLink.href = "/recommend/";
        moreLink.innerHTML = "查看更多 <i>›</i>";
        head.appendChild(moreLink);
        s1.appendChild(grid(sorted.slice(0, REC_INITIAL)));
        page.appendChild(s1);
      }

      var s2 = section("我的追番", "共 " + mine[0].items.length + " 部");
      var t = tabs(mine);
      var tabRow = document.createElement("div");
      tabRow.className = "bgm-tabs-row";
      var moreLink2 = document.createElement("a");
      moreLink2.className = "bgm-more-link";
      moreLink2.href = "/my-bangumi/";
      moreLink2.innerHTML = "查看更多 <i>›</i>";
      tabRow.appendChild(t.bar);
      tabRow.appendChild(moreLink2);
      s2.appendChild(tabRow);
      s2.appendChild(t.body);
      page.appendChild(s2);

      // 红果视频（红果漫剧榜综合评分前 100）
      var s3 = section("红果视频", "漫剧榜 · 按热度+收藏+点赞+分享总和排序");
      var head3 = s3.querySelector(".bgm-sec-head");
      var moreLink3 = document.createElement("a");
      moreLink3.className = "bgm-more-link";
      moreLink3.href = "/hongguo/";
      moreLink3.innerHTML = "查看更多 <i>›</i>";
      head3.appendChild(moreLink3);
      s3.appendChild(grid([]));
      page.appendChild(s3);

      fetch("/bangumis/hongguo.json", { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(0); })
        .then(function (list) {
          var arr = (list || []).slice().sort(function (a, b) {
            return (Number(b.total) || 0) - (Number(a.total) || 0);
          }).slice(0, 4).map(function (it) {
            return {
              title: it.title,
              cover: it.cover,
              link: it.link,
              status: it.ep_status || "",
              score: fmtNum(it.total),
              area: "漫剧 · 热 " + (it.heatText || ""),
              des: "综合 " + fmtNum(it.total)
            };
          });
          var holder = s3.querySelector(".bgm-grid");
          if (holder) holder.outerHTML = grid(arr).outerHTML;
        })
        .catch(function () {});

      root.appendChild(page);
    });
  }

  function boot() {
    init();
    [300, 800].forEach(function (t) { setTimeout(init, t); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 150); });
})();

;
/* ---- recommend-page.js ---- */
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

;
/* ---- my-bangumi-page.js ---- */
/*! 我的追番独立页：全部 / 想看 / 在看 / 已看，每页 8 部，可翻页 */
(function () {
  "use strict";

  var DATA_URL = "/bangumis/data.json";
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

  function norm(b) {
    return {
      title: b.title,
      cover: b.cover,
      link: b.link,
      ep_status: b.ep_status || "",
      score: b.score == null ? "" : String(b.score),
      area: [b.type, b.area].filter(Boolean).join(" · ")
    };
  }

  function groups(d) {
    var seen = {}, all = [];
    [].concat(d.wantWatch || [], d.watching || [], d.watched || []).forEach(function (b) {
      if (!b || !b.title || seen[b.title]) return;
      seen[b.title] = 1;
      all.push(norm(b));
    });
    return [
      { key: "all", label: "全部", items: all },
      { key: "want", label: "想看", items: (d.wantWatch || []).map(norm) },
      { key: "watching", label: "在看", items: (d.watching || []).map(norm) },
      { key: "watched", label: "已看", items: (d.watched || []).map(norm) }
    ];
  }

  function qs(k) {
    var m = new RegExp("[?&]" + k + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function start(gs) {
    var root = document.getElementById("mybmg-page");
    if (!root) return;

    var active = gs.filter(function (g) { return g.key === qs("cat"); })[0] || gs[0];
    var page = Math.max(1, parseInt(qs("page"), 10) || 1);

    function render() {
      var items = active.items;
      var pages = Math.max(1, Math.ceil(items.length / PER));
      if (page > pages) page = pages;
      var slice = items.slice((page - 1) * PER, page * PER);

      var html = '<div class="bgm-tabs">';
      gs.forEach(function (g) {
        html += '<button type="button" class="bgm-tab' + (g.key === active.key ? " active" : "") +
          '" data-cat="' + g.key + '">' + esc(g.label) +
          '<span class="bgm-tab-n">' + g.items.length + "</span></button>";
      });
      html += "</div>";

      html += '<div class="rec-bar">' +
        '<a class="rec-back rec-back-top" href="/bangumis/">← 返回追番页</a>' +
        "<span>共 <b>" + items.length + "</b> 部 · 第 <b>" + page + "/" + pages + "</b> 页</span>" +
        '<span class="rec-tip">B 站追番收藏 · 每天自动同步</span></div>';

      if (slice.length) {
        html += '<div class="bgm-grid">' + slice.map(function (it) {
          return card(it).outerHTML;
        }).join("") + "</div>";
      } else {
        html += '<p class="bgm-empty">这里还空着~</p>';
      }

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

    function syncUrl() {
      var parts = [];
      if (active.key !== gs[0].key) parts.push("cat=" + encodeURIComponent(active.key));
      if (page > 1) parts.push("page=" + page);
      try {
        history.replaceState(null, "", parts.length ? "?" + parts.join("&") : location.pathname);
      } catch (e) {}
    }

    root.addEventListener("click", function (e) {
      var tab = e.target.closest("button[data-cat]");
      if (tab) {
        var k = tab.getAttribute("data-cat");
        active = gs.filter(function (g) { return g.key === k; })[0] || gs[0];
        page = 1;
        render(); syncUrl();
        return;
      }
      var btn = e.target.closest("button[data-go]");
      if (!btn || btn.disabled) return;
      var pages = Math.max(1, Math.ceil(active.items.length / PER));
      var go = btn.getAttribute("data-go");
      if (go === "prev") page = Math.max(1, page - 1);
      else if (go === "next") page = Math.min(pages, page + 1);
      else page = Math.min(pages, parseInt(go, 10) || 1);
      render(); syncUrl();
      var top = root.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: top, behavior: "smooth" });
    });

    render();
  }

  function init() {
    var root = document.getElementById("mybmg-page");
    if (!root || root.dataset.done === "1") return;
    root.dataset.done = "1";
    fetch(DATA_URL, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(0); })
      .then(function (d) { start(groups(d)); })
      .catch(function () {
        root.innerHTML = '<p class="bgm-empty">数据加载失败，稍后再试~</p>';
      });
  }

  function boot() { setTimeout(init, 60); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 200); });
})();

;
/* ---- hongguo-page.js ---- */
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

;
/* ---- post-img-fit.js ---- */
/*! 文章页：正文图片等比适配 + 顶部封面完整显示（毛玻璃填充） */
(function () {
  "use strict";

  function fixBanner() {
    var cov = document.getElementById("post-top-cover");
    var img = document.getElementById("post-top-bg");
    if (!cov || !img) return;
    var src = img.currentSrc || img.src;
    if (!src) return;
    var blur = cov.querySelector(".cover-blur");
    if (!blur) {
      blur = document.createElement("div");
      blur.className = "cover-blur";
      cov.insertBefore(blur, cov.firstChild);
    }
    blur.style.backgroundImage = 'url("' + src + '")';
  }

  function markScreenshots() {
    var body = document.getElementById("article-container");
    if (!body) return;
    var imgs = body.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      var el = imgs[i];
      var w = el.naturalWidth || 0, h = el.naturalHeight || 0;
      if (!w || !h) {
        el.addEventListener("load", function (e) {
          var t = e.currentTarget;
          if (t.naturalWidth && t.naturalHeight && t.naturalWidth / t.naturalHeight >= 2.2) t.classList.add("keep-full");
        });
        continue;
      }
      if (w / h >= 2.2) el.classList.add("keep-full");   // 界面截图等超宽图不裁切
    }
  }

  function boot() { fixBanner(); markScreenshots(); setTimeout(markScreenshots, 600); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 200); });
})();

;
/* ---- post-header-aurora.js ---- */
/*! 文章页页头背景：暗黑系「极光律动」——柔和光斑漂移 + 星点闪烁 + 缓慢光扫 */
(function () {
  "use strict";

  // 与站点一致的暗夜配色：靛蓝 / 紫 / 品红 / 青
  var BLOBS = [
    { c: [111, 124, 255], x: 0.18, y: 0.30, r: 0.62, sx: 0.11, sy: 0.07, a: 0.34 },
    { c: [180, 96, 255], x: 0.52, y: 0.18, r: 0.52, sx: 0.07, sy: 0.10, a: 0.26 },
    { c: [255, 96, 150], x: 0.86, y: 0.42, r: 0.48, sx: 0.09, sy: 0.06, a: 0.22 },
    { c: [56, 205, 235], x: 0.34, y: 0.74, r: 0.44, sx: 0.05, sy: 0.09, a: 0.18 }
  ];

  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }

  function start(canvas, host) {
    var rect = host.getBoundingClientRect();
    if (rect.width < 60 || rect.height < 60) return null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var W = rect.width, H = rect.height, t0 = performance.now();
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 星点
    var stars = [];
    for (var i = 0; i < 90; i++) {
      stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.15 + 0.35,
                   p: Math.random() * Math.PI * 2, s: 0.5 + Math.random() * 1.3 });
    }

    var raf;
    function draw(now) {
      var t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);

      // 底色
      var bg = ctx.createLinearGradient(0, 0, W * 0.35, H);
      bg.addColorStop(0, "#080c18");
      bg.addColorStop(0.55, "#0a0f1e");
      bg.addColorStop(1, "#070a14");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // 极光光斑（缓慢漂移 + 呼吸）
      ctx.globalCompositeOperation = "lighter";
      for (var b = 0; b < BLOBS.length; b++) {
        var o = BLOBS[b];
        var cx = (o.x + Math.sin(t * o.sx + b) * 0.06) * W;
        var cy = (o.y + Math.cos(t * o.sy + b * 1.7) * 0.10) * H;
        var rad = o.r * Math.max(W, H) * (0.92 + Math.sin(t * 0.25 + b) * 0.05);
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        var pulse = 0.82 + Math.sin(t * 0.4 + b * 1.3) * 0.18;
        g.addColorStop(0, rgba(o.c, o.a * pulse));
        g.addColorStop(0.45, rgba(o.c, o.a * 0.35 * pulse));
        g.addColorStop(1, rgba(o.c, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.2832); ctx.fill();
      }

      // 星点闪烁
      for (var k = 0; k < stars.length; k++) {
        var st = stars[k];
        var tw = 0.35 + 0.65 * Math.abs(Math.sin(t * st.s + st.p));
        ctx.beginPath();
        ctx.arc(st.x * W, st.y * H, st.r, 0, 6.2832);
        ctx.fillStyle = "rgba(226,240,255," + (tw * 0.55).toFixed(3) + ")";
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // 缓慢光扫（律动）
      var sx = ((t * 0.075) % 1.6 - 0.3) * W;
      var gs = ctx.createLinearGradient(sx - 150, 0, sx + 150, H * 0.6);
      gs.addColorStop(0, "rgba(140,190,255,0)");
      gs.addColorStop(0.5, "rgba(150,200,255,0.07)");
      gs.addColorStop(1, "rgba(140,190,255,0)");
      ctx.fillStyle = gs;
      ctx.fillRect(0, 0, W, H);

      // 上下收边，保证文字可读
      var veil = ctx.createLinearGradient(0, 0, 0, H);
      veil.addColorStop(0, "rgba(4,6,12,0.55)");
      veil.addColorStop(0.35, "rgba(4,6,12,0)");
      veil.addColorStop(0.75, "rgba(4,6,12,0)");
      veil.addColorStop(1, "rgba(4,6,12,0.75)");
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, W, H);

      if (!reduce) raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return function stop() { cancelAnimationFrame(raf); };
  }

  var stopFn = null;

  function init() {
    var host = document.querySelector("#page-header.post-bg");
    if (!host) return;
    if (stopFn) { stopFn(); stopFn = null; }
    var old = host.querySelector("#post-header-canvas");
    if (old) old.remove();
    var cv = document.createElement("canvas");
    cv.id = "post-header-canvas";
    host.insertBefore(cv, host.firstChild);
    stopFn = start(cv, host) || null;
  }

  function boot() { setTimeout(init, 60); setTimeout(init, 700); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(init, 220); });
  window.addEventListener("resize", function () { setTimeout(init, 300); });
})();

;
/* ---- post-header-align.js ---- */
/*! 文章页页头：标题区与正文主栏同栅格（左边界、右边界、宽度对齐） */
(function () {
  "use strict";

  function align() {
    var post = document.querySelector("#post");
    var info = document.querySelector("#post-info");
    var header = document.querySelector("#page-header");
    if (!post || !info || !header) return;
    var p = post.getBoundingClientRect();
    var h = header.getBoundingClientRect();
    if (p.width < 100) return;
    info.style.setProperty("--col-left", Math.round(p.left) + "px");
    info.style.setProperty("--col-right", Math.round(h.right - p.right) + "px");
    info.style.setProperty("--col-w", Math.round(p.width) + "px");
  }

  function boot() { align(); setTimeout(align, 120); setTimeout(align, 600); setTimeout(align, 1500); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 200); });
  window.addEventListener("resize", function () {
    align();
    setTimeout(align, 250);
  });
})();

;
/* ---- meta-wordcount-order.js ---- */
/*! 文章页元信息：单行「字数 · 约X分钟读完 · 日期 · IP归属」+ 悬停说明气泡 */
(function () {
  "use strict";

  var CACHE_KEY = "la_ip_loc_v2";
  var CACHE_TTL = 30 * 60 * 1000;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function tip(node, text) {
    if (!node || !text) return;
    node.setAttribute("data-tip", text);
    node.setAttribute("title", text);
  }

  /* ---------- 缓存 ---------- */
  function cached() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o.t || Date.now() - o.t > CACHE_TTL) return null;
      return o.v;
    } catch (e) {
      return null;
    }
  }

  function save(v) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ v: v, t: Date.now() }));
    } catch (e) {}
  }

  function fetchJSON(url, timeout) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.timeout = timeout || 4500;
      xhr.onload = function () {
        if (done) return;
        done = true;
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(e);
        }
      };
      xhr.onerror = xhr.ontimeout = function () {
        if (done) return;
        done = true;
        reject(new Error("net"));
      };
      xhr.send();
    });
  }

  /* ---------- 地名归一化：「天津市」→「天津」 ---------- */
  function shortName(v) {
    return (v || "")
      .replace(/(维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|自治州|省|市|区|县)$/g, "")
      .trim();
  }

  function join(prov, city) {
    if (prov && city && prov !== city) return prov + " · " + city;
    return prov || city || "";
  }

  function fromMir6(j) {
    var d = (j && j.data) || {};
    var loc = join(shortName(d.province), shortName(d.city) || shortName(d.districts));
    if (!loc) throw new Error("empty");
    return { loc: loc, isp: (d.isp || "").trim() };
  }

  function fromIpip(j) {
    var a = (j && j.data && j.data.location) || [];
    var loc = join(shortName(a[1]), shortName(a[3]) || shortName(a[2]));
    if (!loc) throw new Error("empty");
    return { loc: loc, isp: (a[4] || "").trim() };
  }

  function fromIpsb(j) {
    var loc = shortName(j.city || j.region);
    if (!loc) throw new Error("empty");
    return { loc: loc, isp: (j.isp || j.organization || "").trim() };
  }

  function resolveLocation() {
    var c = cached();
    if (c && c.loc) return Promise.resolve(c);

    var chain = [
      ["https://api.mir6.com/api/ip?type=json", fromMir6],
      ["https://myip.ipip.net/json", fromIpip],
      ["https://api.ip.sb/geoip", fromIpsb]
    ];

    function step(i) {
      if (i >= chain.length) return Promise.reject(new Error("all failed"));
      var item = chain[i];
      return fetchJSON(item[0], 4500)
        .then(function (j) {
          var v = item[1](j);
          save(v);
          return v;
        })
        .catch(function () {
          return step(i + 1);
        });
    }
    return step(0);
  }

  /* ---------- 单行元信息 ---------- */
  function build() {
    var second = document.querySelector(".meta-secondline");
    var wc = document.querySelector(".post-meta-wordcount");
    var dateSpan = document.querySelector(".post-meta-date");
    if (!wc || !dateSpan || wc.dataset.mcMoved === "1") return;

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
    var pub = dateSpan.querySelector("time");
    var pubText = pub ? pub.textContent.trim() : "";

    dateSpan.innerHTML = "";
    dateSpan.classList.add("meta-inline");

    function sep() {
      dateSpan.appendChild(el("span", "post-meta-separator"));
    }

    function item(iconCls, text, tipText) {
      dateSpan.appendChild(el("i", "anzhiyufont " + iconCls + " post-meta-icon"));
      var s = el("span", "post-meta-label", text);
      if (tipText) tip(s, tipText);
      dateSpan.appendChild(s);
      return s;
    }

    // 1) 字数
    if (count) item("anzhiyu-icon-file-word", count, "数字总计");

    // 2) 约 X 分钟读完
    if (minText) {
      sep();
      item("anzhiyu-icon-clock", "约 " + minText + " 分钟读完", "预计阅读时长");
    }

    // 3) 日期
    if (pubText) {
      sep();
      item("anzhiyu-icon-calendar-days", pubText, "文章发布日期");
    }

    // 4) IP 归属（悬停时补上运营商）
    sep();
    var locEl = item("anzhiyu-icon-location-dot", "定位中…", "作者 IP 归属地");

    wc.dataset.mcMoved = "1";
    if (second) second.style.display = "none";

    // post-meta-group.js 会 clone 节点并 innerHTML 重排，之前拿到的 locEl 可能已脱离文档，
    // 所以每次都按 data-tip 重新查真实节点再写文字
    function applyLoc(text) {
      var labels = document.querySelectorAll(".post-meta-date.meta-inline .post-meta-label");
      var hit = false;
      for (var i = 0; i < labels.length; i++) {
        var t = labels[i].getAttribute("data-tip") || labels[i].getAttribute("title") || "";
        if (t === "作者 IP 归属地") {
          labels[i].textContent = text;
          hit = true;
        }
      }
      if (!hit && labels.length) {
        var last = labels[labels.length - 1];
        if (/定位中|未知/.test(last.textContent || "")) last.textContent = text;
      }
      if (locEl) locEl.textContent = text;
    }

    resolveLocation()
      .then(function (v) {
        applyLoc(v.loc);
        setTimeout(function () { applyLoc(v.loc); }, 400);
        setTimeout(function () { applyLoc(v.loc); }, 1200);
        setTimeout(function () { applyLoc(v.loc); }, 2400);
      })
      .catch(function () {
        applyLoc("\u672a\u77e5");
        setTimeout(function () { applyLoc("\u672a\u77e5"); }, 1200);
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
  document.addEventListener("pjax:complete", function () {
    setTimeout(build, 80);
  });
})();

;
/* ---- post-meta-group.js ---- */
/*! 文章页元信息：把「图标 + 文字」包成一个不可拆分的整体，避免手机端换行时图标与文字分离 */
(function () {
  "use strict";

  function group() {
    var meta = document.querySelector("#post-meta .meta-inline");
    if (!meta || meta.dataset.metaGrouped === "1") return;
    var nodes = Array.prototype.slice.call(meta.childNodes);
    var out = [];
    var i = 0;
    while (i < nodes.length) {
      var n = nodes[i];
      // 跳过纯空白
      if (n.nodeType === 3 && !n.textContent.trim()) { i++; continue; }
      // 图标 + 紧随的文字/分隔 → 打包
      if (n.nodeType === 1 && n.tagName === "I" && n.classList.contains("post-meta-icon")) {
        var group_ = document.createElement("span");
        group_.className = "meta-item";
        group_.appendChild(n.cloneNode(true));
        var j = i + 1;
        var filled = 0;
        while (j < nodes.length && filled < 2) {
          var m = nodes[j];
          if (m.nodeType === 3 && !m.textContent.trim()) { j++; continue; }
          if (m.nodeType === 1 && m.classList.contains("post-meta-label")) {
            group_.appendChild(m.cloneNode(true));
            filled++;
            j++;
            break;
          }
          break;
        }
        out.push(group_);
        i = j;
        continue;
      }
      if (n.nodeType === 1 && n.classList.contains("post-meta-separator")) { i++; continue; }
      i++;
    }
    if (out.length) {
      meta.innerHTML = "";
      out.forEach(function (el) { meta.appendChild(el); });
      meta.dataset.metaGrouped = "1";
    }
  }

  function boot() {
    group();
    [200, 600, 1400].forEach(function (t) { setTimeout(group, t); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 200); });
})();

;
/* ---- post-back-link.js ---- */
/*! 文章页（手机端）：加一个「返回上一页」入口，放在标题区顶部 */
(function () {
  "use strict";

  function add() {
    var info = document.querySelector("#page-header.post-bg #post-info");
    if (!info || info.querySelector(".post-back-link")) return;
    var a = document.createElement("a");
    a.className = "post-back-link";
    a.href = "/";
    a.innerHTML = "<i>←</i> 返回上一页";
    a.addEventListener("click", function (e) {
      e.preventDefault();
      if (window.history.length > 1) window.history.back();
      else window.location.href = "/";
    });
    info.insertBefore(a, info.firstChild);
  }

  function boot() { add(); [200, 700].forEach(function (t) { setTimeout(add, t); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 200); });
})();

;
/* ---- music-page-mobile.js ---- */
/*! 音乐馆手机端：重排底部控制条、音量弹层、曲库抽屉 */
(function () {
  "use strict";

  var MOBILE = "(max-width: 768px)";
  function isMobile() { return window.matchMedia(MOBILE).matches; }

  function getAplayer() {
    var m = document.querySelector("meting-js");
    if (m && m.aplayer) return m.aplayer;
    if (window.aplayers && window.aplayers.length) return window.aplayers[0];
    return null;
  }
  function apBox() { return document.querySelector("#anMusic-page .aplayer"); }
  function listEl() { return document.querySelector("#anMusic-page .aplayer-list"); }
  /* 曲库抽屉自己的遮罩。注意：绝对不能再用 #menu-mask —— 那是主题移动端侧栏菜单的遮罩，
     主题把它的 click 绑成了 sidebarFn.close()，我们把它挪走/隐藏后，侧栏菜单就再也关不掉了 */
  function maskEl() {
    var m = document.querySelector("#anMusic-page .mm-drawer-mask");
    if (m) return m;
    var page = document.getElementById("anMusic-page") || document.body;
    m = document.createElement("div");
    m.className = "mm-drawer-mask";
    m.addEventListener("click", function () { closeDrawer(); });
    page.appendChild(m);
    return m;
  }

  /* ---------- 1. 控制条重排：进度+时间+音量一行，播放键一行 ---------- */
  function restructure() {
    var ap = getAplayer();
    var el = apBox();
    if (!ap || !el) return false;
    var ctrl = el.querySelector(".aplayer-controller");
    if (!ctrl) return false;
    if (ctrl.dataset.mmDone === "1") return true;
    if (!isMobile()) return true;

    var bar = ctrl.querySelector(".aplayer-bar-wrap");
    var ptime = ctrl.querySelector(".aplayer-ptime");
    var dtime = ctrl.querySelector(".aplayer-dtime");
    var back = ctrl.querySelector(".aplayer-icon-back");
    var play = ctrl.querySelector(".aplayer-icon-play");
    var fwd = ctrl.querySelector(".aplayer-icon-forward");
    var loop = ctrl.querySelector(".aplayer-icon-loop");
    var menu = ctrl.querySelector(".aplayer-icon-menu");
    if (!bar || !play) return false;

    ctrl.dataset.mmDone = "1";

    var r1 = document.createElement("div");
    r1.className = "mm-row mm-row-1";
    if (ptime) r1.appendChild(ptime);
    r1.appendChild(bar);
    if (dtime) r1.appendChild(dtime);
    // 参考网易云：次要功能（定时、音量）收进进度条这一行
    var timerBtn = buildTimerBtn(ap);
    r1.appendChild(timerBtn);
    buildVolume(ap, r1);

    var r2 = document.createElement("div");
    r2.className = "mm-row mm-row-2";
    var modeBtn = buildModeBtn(ap);
    // 主控行只留 5 个：左（播放模式）· 中（上一首/播放/下一首，绝对居中）· 右（曲库/循环）
    var gLeft = document.createElement("div");
    gLeft.className = "mm-grp mm-grp-left";
    var gMid = document.createElement("div");
    gMid.className = "mm-grp mm-grp-mid";
    var gRight = document.createElement("div");
    gRight.className = "mm-grp mm-grp-right";
    // 曲库按钮换成「列表 + 音符」图标，避免和顶部汉堡菜单混淆
    if (menu) {
      menu.innerHTML =
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">' +
        '<path d="M4 6h9"/><path d="M4 12h9"/><path d="M4 18h6"/>' +
        '<path d="M18 4.5v9.2"/><circle cx="16.2" cy="15.6" r="2.4"/></svg>';
      menu.setAttribute("title", "曲库");
      menu.setAttribute("aria-label", "打开曲库");
    }
    [modeBtn].forEach(function (n) { if (n) gLeft.appendChild(n); });
    [back, play, fwd].forEach(function (n) { if (n) gMid.appendChild(n); });
    [menu].forEach(function (n) { if (n) gRight.appendChild(n); });
    r2.appendChild(gLeft);
    r2.appendChild(gMid);
    r2.appendChild(gRight);

    // 主题的点击处理绑在 .aplayer-time 里的原始节点上，节点被我们搬走后会失效，
    // 这里自己接管（capture 阶段 + stopImmediatePropagation，避免重复绑定导致开关两次）
    if (menu && !menu.__mmToggle) {
      menu.__mmToggle = true;
      menu.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggleDrawer();
      }, true);
    }

    ctrl.textContent = "";
    ctrl.appendChild(r1);
    ctrl.appendChild(r2);
    return true;
  }

  /* ---------- 睡眠定时：15/30/60 分钟、播完本首 ---------- */
  var TIMER_KEY = "mm-sleep-timer";
  var timerTick = null;

  function buildTimerBtn(ap) {
    var wrap = document.createElement("div");
    wrap.className = "mm-timer";
    wrap.innerHTML =
      '<button class="aplayer-icon mm-timer-btn" type="button" aria-label="定时关闭">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">' +
      '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/></svg>' +
      '<i class="mm-timer-badge"></i></button>' +
      '<div class="mm-timer-pop">' +
      '<div class="mm-timer-title">定时关闭</div>' +
      '<button data-min="15">15 分钟</button>' +
      '<button data-min="30">30 分钟</button>' +
      '<button data-min="60">60 分钟</button>' +
      '<button data-min="end">播完本首</button>' +
      '<button data-min="custom">自定义时长…</button>' +
      '<div class="mm-timer-custom">' +
      '<input class="mm-timer-input" type="number" inputmode="numeric" min="1" max="720" placeholder="分钟">' +
      '<button class="mm-timer-ok" type="button">确定</button>' +
      "</div>" +
      '<button data-min="0" class="mm-timer-cancel">取消定时</button>' +
      "</div>";

    var btn = wrap.querySelector(".mm-timer-btn");
    var badge = wrap.querySelector(".mm-timer-badge");
    var pop = wrap.querySelector(".mm-timer-pop");

    function read() {
      try { return JSON.parse(localStorage.getItem(TIMER_KEY) || "null"); } catch (e) { return null; }
    }
    function write(o) {
      try { o ? localStorage.setItem(TIMER_KEY, JSON.stringify(o)) : localStorage.removeItem(TIMER_KEY); } catch (e) {}
    }
    function label(t) {
      var m = Math.floor(t / 60), s = Math.round(t % 60);
      return m + ":" + (s < 10 ? "0" + s : s);
    }
    function clearTimer() {
      write(null);
      wrap.classList.remove("mm-timer-on");
      badge.textContent = "";
      if (timerTick) { clearInterval(timerTick); timerTick = null; }
    }
    function fire() {
      try { ap.pause(); } catch (e) {}
      clearTimer();
    }
    function start(mode, minutes) {
      write({ mode: mode, end: mode === "end" ? 0 : Date.now() + minutes * 60000 });
      wrap.classList.add("mm-timer-on");
      pop.classList.remove("mm-open");
      run();
    }
    function run() {
      var st = read();
      if (!st) return;
      wrap.classList.add("mm-timer-on");
      if (timerTick) clearInterval(timerTick);
      if (st.mode === "end") badge.textContent = "末";
      timerTick = setInterval(function () {
        var cur = read();
        if (!cur) { clearTimer(); return; }
        if (cur.mode === "end") { badge.textContent = "末"; return; }
        var left = Math.round((cur.end - Date.now()) / 1000);
        if (left <= 0) { fire(); return; }
        badge.textContent = label(left);
      }, 1000);
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      pop.classList.toggle("mm-open");
    });
    var customRow = pop.querySelector(".mm-timer-custom");
    var customInput = pop.querySelector(".mm-timer-input");
    var customOk = pop.querySelector(".mm-timer-ok");

    function applyCustom() {
      var n = parseInt(customInput.value, 10);
      if (!n || n < 1) { customInput.focus(); return; }
      if (n > 720) n = 720;
      customInput.value = "";
      customRow.classList.remove("mm-custom-on");
      start("time", n);
    }

    pop.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-min]");
      if (!b) return;
      e.stopPropagation();
      var v = b.getAttribute("data-min");
      if (v === "0") { clearTimer(); pop.classList.remove("mm-open"); return; }
      if (v === "end") { start("end", 0); return; }
      if (v === "custom") {
        customRow.classList.toggle("mm-custom-on");
        if (customRow.classList.contains("mm-custom-on")) setTimeout(function () { customInput.focus(); }, 60);
        return;
      }
      start("time", parseInt(v, 10));
    });
    customOk.addEventListener("click", function (e) { e.stopPropagation(); applyCustom(); });
    customInput.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter") applyCustom();
    });
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) pop.classList.remove("mm-open");
    });

    try {
      ap.on("ended", function () {
        var st = read();
        if (st && st.mode === "end") fire();
      });
    } catch (e) {}

    run();
    return wrap;
  }

  /* ---------- 顺序 / 随机 播放切换（手机端专用，主题默认只有循环键） ---------- */
  function buildModeBtn(ap) {
    var MODES = [
      { id: "list", label: "顺序播放", key: "list" },
      { id: "random", label: "随机播放", key: "shuffle" },
      { id: "single", label: "单曲循环", key: "single" }
    ];
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "aplayer-icon mm-mode";
    btn.innerHTML =
      '<svg class="mm-mi mm-mi-list" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h7"/><path d="M17 15l3 3-3 3"/></svg>' +
      '<svg class="mm-mi mm-mi-shuffle" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>' +
      '<svg class="mm-mi mm-mi-single" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M17 2.5 20.5 6 17 9.5"/><path d="M20.5 6H7a4.5 4.5 0 0 0-4.5 4.5"/>' +
      '<path d="M7 21.5 3.5 18 7 14.5"/><path d="M3.5 18H17a4.5 4.5 0 0 0 4.5-4.5"/>' +
      '<text x="12" y="15.5" font-size="8.5" font-family="sans-serif" fill="currentColor" stroke="none" text-anchor="middle">1</text></svg>';

    /* APlayer 1.10 的真实开关是 ap.options.order('list'|'random') 与 ap.options.loop('all'|'one'|'none')
       —— ap.mode 是「normal / mini」布局模式，改它不会影响播放顺序 */
    function opts() { return ap.options || (ap.options = {}); }
    function idx() {
      var o = opts();
      if (o.loop === "one") return 2;
      if (o.order === "random") return 1;
      return 0;
    }
    function apply(i) {
      var o = opts();
      if (i === 1) {
        o.order = "random";
        o.loop = "all";
        // 歌单可能变化，随机序长度不对时重排一次
        if (!ap.randomOrder || ap.randomOrder.length !== (ap.list.audios || []).length) {
          var arr = [];
          for (var k = 0; k < (ap.list.audios || []).length; k++) arr.push(k);
          for (var j = arr.length - 1; j > 0; j--) {
            var t = Math.floor(Math.random() * (j + 1));
            var tmp = arr[j]; arr[j] = arr[t]; arr[t] = tmp;
          }
          ap.randomOrder = arr;
        }
      } else if (i === 2) {
        o.order = "list";
        o.loop = "one";
      } else {
        o.order = "list";
        o.loop = "all";
      }
      try { ap.options = o; } catch (e) {}
    }
    function paint() {
      var i = idx();
      btn.className = "aplayer-icon mm-mode mm-mode-" + MODES[i].key;
      btn.setAttribute("title", MODES[i].label);
      btn.setAttribute("aria-label", MODES[i].label);
    }
    btn.addEventListener("click", function () {
      var i = (idx() + 1) % MODES.length;
      apply(i);
      paint();
    });
    // 从其它地方（主题循环键、记忆播放）改过顺序时同步图标
    setInterval(function () { if (btn.isConnected) paint(); }, 1500);
    paint();
    return btn;
  }

  /* ---------- 2. 音量：喇叭点开弹层，拖动滑杆 ---------- */
  function buildVolume(ap, row1) {
    var wrap = document.createElement("div");
    wrap.className = "mm-vol";
    wrap.innerHTML =
      '<button class="mm-vol-btn" type="button" aria-label="音量">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">' +
      '<path d="M3 10v4h4l5 4.5V5.5L7 10H3zm12.2 2a4.3 4.3 0 0 0-2-3.6v7.2a4.3 4.3 0 0 0 2-3.6zM13.2 3.4v2.1a6.6 6.6 0 0 1 0 13v2.1a8.7 8.7 0 0 0 0-17.2z"/>' +
      "</svg></button>" +
      '<div class="mm-vol-pop">' +
      '<input class="mm-vol-range" type="range" min="0" max="1" step="0.01" value="0.8" aria-label="音量">' +
      '<span class="mm-vol-val">80</span>' +
      "</div>";

    var btn = wrap.querySelector(".mm-vol-btn");
    var range = wrap.querySelector(".mm-vol-range");
    var val = wrap.querySelector(".mm-vol-val");

    function paint(v) {
      range.value = v;
      val.textContent = Math.round(v * 100);
      btn.style.opacity = v > 0 ? "0.9" : "0.45";
    }
    function set(v) {
      v = Math.max(0, Math.min(1, v));
      try { ap.volume(v); } catch (e) {}
      paint(v);
    }

    var cur = 0.8;
    try { cur = ap.volume(); } catch (e) {}
    paint(cur || 0.8);

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      wrap.classList.toggle("mm-open");
    });
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) wrap.classList.remove("mm-open");
    });
    range.addEventListener("input", function () { set(parseFloat(range.value)); });

    if (row1) row1.appendChild(wrap);
    return wrap;
  }

  /* ---------- 3. 曲库抽屉：头部、行内 max-height、选中即切回播放页 ---------- */
  function fixList() {
    var l = listEl();
    if (!l) return false;
    l.style.setProperty("max-height", "min(56vh, calc(100vh - 300px))", "important");
    var ol = l.querySelector("ol");
    if (ol) ol.style.setProperty("max-height", "calc(100vh - 330px)", "important");

    if (!l.querySelector(".mm-list-head")) {
      var h = document.createElement("div");
      h.className = "mm-list-head";
      var n = l.querySelectorAll("li").length;
      h.innerHTML = '<span class="mm-list-title">曲库 · ' + n + ' 首</span>' +
        '<button class="mm-list-close" type="button" aria-label="关闭">✕</button>';
      h.querySelector(".mm-list-close").addEventListener("click", closeDrawer);
      l.insertBefore(h, l.firstChild);

      // 搜索框
      var box = document.createElement("div");
      box.className = "mm-list-search";
      box.innerHTML =
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
        '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>' +
        '<input class="mm-search-input" type="search" inputmode="search" placeholder="搜索歌名 / 歌手" autocomplete="off">' +
        '<button class="mm-search-clear" type="button" aria-label="清空">✕</button>';
      // 搜索框放进标题那一行的中间（标题左 / 搜索中 / ✕右）
      h.insertBefore(box, h.querySelector(".mm-list-close"));

      var input = box.querySelector(".mm-search-input");
      var clear = box.querySelector(".mm-search-clear");
      var title = h.querySelector(".mm-list-title");

      var raf = 0;
      function apply() {
        var kw = (input.value || "").trim().toLowerCase();
        l.__mmQuery = kw;
        var lis = Array.prototype.slice.call(l.querySelectorAll("ol > li"));
        var shown = 0;
        lis.forEach(function (li) {
          var t = li.querySelector(".aplayer-list-title");
          var a = li.querySelector(".aplayer-list-author");
          var txt = ((t ? t.textContent : "") + " " + (a ? a.textContent : "")).toLowerCase();
          var hit = !kw || txt.indexOf(kw) >= 0;
          li.classList.toggle("mm-hide", !hit);
          if (hit) shown++;
        });
        title.textContent = kw ? "找到 " + shown + " 首" : "曲库 · " + lis.length + " 首";
        box.classList.toggle("mm-search-empty", !!kw && shown === 0);
      }

      function reapply() {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          raf = 0;
          apply();
        });
      }
      l.__mmReapply = reapply;

      var olEl = l.querySelector("ol");
      if (olEl && !olEl.__mmObs) {
        olEl.__mmObs = true;
        new MutationObserver(function () {
          if (l.__mmQuery) setTimeout(apply, 30);
        }).observe(olEl, { childList: true });
      }

      input.addEventListener("input", apply);
      input.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Escape") { input.value = ""; apply(); input.blur(); }
      });
      clear.addEventListener("click", function (e) {
        e.stopPropagation();
        input.value = "";
        apply();
        input.focus();
      });
      l.__mmFilter = apply;
      l.__mmSearchReset = function () { input.value = ""; apply(); };
    }
    bindSheetGestures();
    if (!l.dataset.mmBound) {
      l.dataset.mmBound = "1";
      l.addEventListener("click", function (e) {
        if (!e.target.closest("li")) return;
        setTimeout(closeDrawer, 240);
      });
    }
    return true;
  }


  /* ---------- 5. 曲库：头部长按/下拉都可关闭，方便单手 ---------- */
  function bindSheetGestures() {
    var l = listEl();
    var head = l && l.querySelector(".mm-list-head");
    if (!head || head.dataset.mmDrag === "1") return;
    head.dataset.mmDrag = "1";
    var startY = 0, moved = false;
    head.addEventListener("touchstart", function (e) {
      startY = e.touches[0].clientY;
      moved = false;
    }, { passive: true });
    head.addEventListener("touchmove", function (e) {
      var dy = e.touches[0].clientY - startY;
      if (dy > 8) moved = true;
      if (dy > 0) head.style.transform = "translateY(" + Math.min(dy, 80) + "px)";
    }, { passive: true });
    head.addEventListener("touchend", function () {
      var t = head.style.transform || "";
      var dy = parseInt((t.match(/-?\d+/) || [0])[0], 10) || 0;
      head.style.transform = "";
      if (moved && dy > 30) closeDrawer();
    });
  }

  function openDrawer() {
    var l = listEl();
    if (!l) return;
    l.classList.add("aplayer-list-hide");
    l.style.opacity = "1";
    var m = maskEl();
    if (m) m.classList.add("mm-show");
    setTimeout(function () { fixList(); scrollToCurrent(); }, 120);
    [320, 700, 1200].forEach(function (t) {
      setTimeout(function () { if (l.__mmReapply && l.__mmQuery) l.__mmReapply(); }, t);
    });
  }

  function toggleDrawer() {
    var l = listEl();
    if (!l) return;
    if (l.classList.contains("aplayer-list-hide")) closeDrawer();
    else openDrawer();
  }

  function closeDrawer() {
    var l = listEl();
    if (l) {
      l.classList.remove("aplayer-list-hide");
      if (l.__mmSearchReset) l.__mmSearchReset();
    }
    var m = maskEl();
    if (m) m.classList.remove("mm-show");
    var open = document.querySelector("#anMusic-page .mm-vol.mm-open");
    if (open) open.classList.remove("mm-open");
  }

  /* ---------- 3.5 点空白处 / 按 Esc 关闭曲库 ---------- */
  function listIsOpen() {
    var l = listEl();
    if (!l) return false;
    // 桌面：没有 hide 类表示列表展开；手机：抽屉展开时反而带着 hide 类（历史原因）
    return isMobile() ? l.classList.contains("aplayer-list-hide")
                      : !l.classList.contains("aplayer-list-hide");
  }

  function closeList() {
    var l = listEl();
    if (!l) return;
    if (isMobile()) {
      closeDrawer();
    } else {
      l.classList.add("aplayer-list-hide");
      l.style.opacity = "";
    }
    var v = document.querySelector("#anMusic-page .mm-vol.mm-open");
    if (v) v.classList.remove("mm-open");
  }

  function bindBlankClose() {
    if (document.__mmBlankBound) return;
    document.__mmBlankBound = true;

    document.addEventListener("click", function (e) {
      // 桌面端曲库是常驻面板（菜单按钮 display:none），关掉就没法再打开了，所以只处理手机抽屉
      if (!isMobile()) return;
      if (!listIsOpen()) return;
      var t = e.target;
      if (!t || !t.closest) return;
      // 点列表本身（选歌）、点菜单按钮（它自己会切换）、点抽屉遮罩（自己的 handler）都不管
      if (t.closest(".aplayer-list") || t.closest(".aplayer-icon-menu") || t.closest(".mm-drawer-mask")) return;
      closeList();
    }, true);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isMobile() && listIsOpen()) closeList();
    });
  }


  /* ---------- 4. 位置兜底：个别机型 fixed 会算偏，按实测差位移回来 ---------- */
  function ensureBottom() {
    var c = document.querySelector("#anMusic-page .aplayer-controller");
    if (!c) return;
    c.style.transform = "";
    var r = c.getBoundingClientRect();
    var diff = Math.round(r.bottom - window.innerHeight);
    if (diff > 1) c.style.transform = "translateY(" + (-diff) + "px)";
  }



  /* ---------- 打开曲库时自动滚到正在播放的那一首 ---------- */
  function scrollToCurrent() {
    var l = listEl();
    if (!l) return;
    var si = l.querySelector(".mm-search-input");
    if (si && si.value.trim()) return;   // 正在搜索就别抢滚动位置
    var ol = l.querySelector("ol");
    var cur = l.querySelector("li.aplayer-list-light");
    if (!ol || !cur) return;
    var or = ol.getBoundingClientRect();
    var cr = cur.getBoundingClientRect();
    // 目标：当前行落在列表垂直中线附近
    var delta = cr.top - or.top - (ol.clientHeight - cr.height) / 2;
    ol.scrollTop = Math.max(0, ol.scrollTop + delta);
  }


  /* 曲库开着时切歌（下一首 / 随机 / 自动播完）要跟着滚动到新当前曲 */
  function drawerOpen() {
    var l = listEl();
    return !!(l && l.classList.contains("aplayer-list-hide"));
  }
  function bindFollow(ap) {
    if (!ap || ap.__mmFollow) return;
    ap.__mmFollow = true;
    try {
      ap.on("listswitch", function () {
        if (!drawerOpen()) return;
        [120, 320, 700].forEach(function (t) { setTimeout(scrollToCurrent, t); });
      });
    } catch (e) {}
  }

  /* ---------- 启动 ---------- */
  function tick() {
    bindFollow(getAplayer());
    var ok = restructure();
    ok = fixList() && ok;
    ensureBottom();
    return ok;
  }
  function boot() {
    bindBlankClose();
    var n = 0;
    var t = setInterval(function () {
      n++;
      if (tick() || n > 45) clearInterval(t);
    }, 400);
    var k = 0;
    var t2 = setInterval(function () { k++; ensureBottom(); if (k > 20) clearInterval(t2); }, 500);
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest(".aplayer-icon-menu")) {
        setTimeout(fixList, 120);
        [80, 260, 520, 900].forEach(function (t) { setTimeout(scrollToCurrent, t); });
      }
      setTimeout(ensureBottom, 60);
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", boot);
  window.addEventListener("resize", function () { setTimeout(tick, 300); });
})();

;
/* ---- fcircle-hero-clean.js ---- */
/*! 朋友圈页：主题会给顶部横幅写一行 inline `background: url(...) !important`，
    这里把它摘掉，交给 custom.css 的渐变样式（不再显示插图） */
(function () {
  "use strict";
  function clean() {
    var el = document.querySelector(".fcirclePage");
    if (!el) return false;
    var s = el.getAttribute("style");
    if (s && /background/i.test(s)) el.removeAttribute("style");
    return true;
  }
  function boot() {
    if (clean()) return;
    var n = 0;
    var t = setInterval(function () {
      n++;
      if (clean() || n > 40) clearInterval(t);
    }, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", boot);
})();

;
/* ---- music-cover-zoom.js ---- */
/*! 音乐馆：彻底移除封面上的播放/暂停按钮（DOM 删除，不是隐藏）+ 点封面放大查看 */
(function () {
  "use strict";

  /* ---------- 1. 删除 .aplayer-button 节点 ---------- */
  function killButton() {
    // 只删音乐馆自己的按钮！之前漏了作用域，把左下角迷你播放器的 .aplayer-button 也删了，
    // 导致主题的 musicBindEvent() 拿到 null 抛错，点「播放音乐」没反应。
    var btns = document.querySelectorAll("#anMusic-page .aplayer-pic .aplayer-button");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b && b.parentNode) b.parentNode.removeChild(b);
    }
    return !!document.querySelector("#anMusic-page .aplayer-pic");
  }

  /* ---------- 2. 点封面放大 ---------- */
  var overlay = null;
  function closeZoom() {
    if (!overlay) return;
    overlay.classList.remove("mm-zoom-on");
    var el = overlay;
    overlay = null;
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") closeZoom(); }

  function coverUrl(pic) {
    var m = /url\((["']?)(.*?)\1\)/.exec(pic.style.backgroundImage || "");
    if (m && m[2] && m[2] !== "none") return m[2];
    var img = pic.querySelector("img");
    return img ? img.src : "";
  }

  /* 网易云图片默认只给 300×300，放大时换成高清参数 */
  function hires(url) {
    if (!url) return url;
    if (/param=\d+y\d+/.test(url)) return url.replace(/param=\d+y\d+/, "param=900y900");
    if (/\?param=/.test(url)) return url.replace(/\?param=.*$/, "?param=900y900");
    return url;
  }

  function openZoom(rawUrl) {
    var url = hires(rawUrl);
    if (!url) return;
    overlay = document.createElement("div");
    overlay.className = "mm-zoom";
    var im = document.createElement("img");
    im.src = url;
    im.alt = "专辑封面";
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "mm-zoom-close";
    closeBtn.setAttribute("aria-label", "关闭");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      closeZoom();
    });
    im.addEventListener("click", function (e) { e.stopPropagation(); });
    overlay.appendChild(im);
    overlay.appendChild(closeBtn);
    overlay.addEventListener("click", function (e) { e.stopPropagation(); closeZoom(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add("mm-zoom-on"); });
    document.addEventListener("keydown", onKey);
  }

  function bindPic() {
    var pic = document.querySelector("#anMusic-page .aplayer-pic");
    if (!pic || pic.dataset.mmZoom === "1") return;
    pic.dataset.mmZoom = "1";
    pic.style.cursor = "pointer";
    pic.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      // 点封面改为弹出「歌曲资料」面板（脚本：music-song-info.js）
      window.dispatchEvent(new CustomEvent("mm:songinfo"));
    }, true);
  }

  /* ---------- 3. 启动：APlayer 会重建节点，用 observer + 定时兜底 ---------- */
  function tick() {
    killButton();
    bindPic();
  }
  function boot() {
    tick();
    var n = 0;
    var t = setInterval(function () { n++; tick(); if (n > 40) clearInterval(t); }, 400);

    var mo = new MutationObserver(function () { tick(); });
    var host = document.getElementById("anMusic-page");
    if (host) mo.observe(host, { childList: true, subtree: true });

    window.addEventListener("resize", function () { setTimeout(tick, 300); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 300); });
})();

;
/* ---- music-song-info.js ---- */
/*! 音乐馆：点封面弹出「歌曲资料」——简介 / 歌手 / 发行时间 / 专辑 / 专辑内曲目 */
(function () {
  "use strict";

  // 国内直连：走博客自己的 Pages Function（workers.dev 在国内被墙，不能用）
  var API = "/music-api/play";
  var FALLBACK = "https://meting-play.laosi-see.workers.dev/play";
  var cache = {};
  var panel = null;
  var lastKey = "";
  var inflight = {};

  // 资料本地持久化：加载过的不再请求（换页/重开浏览器都算）
  var STORE = "mm-songinfo:";
  var STORE_IDX = "mm-songinfo-index";
  var STORE_MAX = 120;

  function readStored(sid) {
    try {
      var s = localStorage.getItem(STORE + sid);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }

  function saveStored(sid, d) {
    try {
      localStorage.setItem(STORE + sid, JSON.stringify(d));
      var idx = [];
      try { idx = JSON.parse(localStorage.getItem(STORE_IDX) || "[]"); } catch (e) { idx = []; }
      idx = idx.filter(function (x) { return x !== sid; });
      idx.push(sid);
      while (idx.length > STORE_MAX) {
        var old = idx.shift();
        try { localStorage.removeItem(STORE + old); } catch (e) {}
      }
      localStorage.setItem(STORE_IDX, JSON.stringify(idx));
    } catch (e) {
      // 空间满了：清掉旧资料再存一次
      try {
        var idx2 = JSON.parse(localStorage.getItem(STORE_IDX) || "[]");
        idx2.slice(0, 20).forEach(function (x) { localStorage.removeItem(STORE + x); });
        localStorage.setItem(STORE_IDX, JSON.stringify(idx2.slice(20)));
        localStorage.setItem(STORE + sid, JSON.stringify(d));
      } catch (e2) {}
    }
  }

  function getInfo(sid) {
    function get(url) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      });
    }
    return get(API + "?sid=" + sid + "&type=info")
      .catch(function () { return get(FALLBACK + "?sid=" + sid + "&type=info"); })
      .then(function (d) {
        if (!d || !d.ok) throw new Error("no data");
        return d;
      });
  }

  /* 取资料：内存 → 本地存储 → 网络；加载过的一律不再请求 */
  function ensure(sid, cb) {
    if (!sid) { if (cb) cb(null); return; }
    if (cache[sid]) { if (cb) cb(cache[sid]); return; }
    var stored = readStored(sid);
    if (stored) {
      cache[sid] = stored;
      if (cb) cb(stored);
      return;
    }
    if (inflight[sid]) {
      if (cb) inflight[sid].push(cb);
      return;
    }
    inflight[sid] = cb ? [cb] : [];
    getInfo(sid)
      .then(function (d) {
        cache[sid] = d;
        saveStored(sid, d);
        var cbs = inflight[sid] || [];
        delete inflight[sid];
        cbs.forEach(function (f) { try { f(d); } catch (e) {} });
      })
      .catch(function () {
        var cbs = inflight[sid] || [];
        delete inflight[sid];
        cbs.forEach(function (f) { try { f(null); } catch (e) {} });
      });
  }

  function getAplayer() {
    var host = document.querySelector("#anMusic-page meting-js");
    if (host && host.aplayer) return host.aplayer;
    if (window.aplayers && window.aplayers.length) return window.aplayers[0];
    return null;
  }

  function curAudio(ap) {
    try {
      return (ap.list.audios || [])[ap.list.index] || {};
    } catch (e) {
      return {};
    }
  }

  /* 歌单里没有 sid，就从播放地址里取 /play?sid=<id> */
  function sidOf(ap) {
    var a = curAudio(ap);
    var m = /[?&]sid=(\d+)/.exec(a.url || "");
    if (m) return m[1];
    var src = (ap.audio && ap.audio.currentSrc) || (ap.audio && ap.audio.src) || "";
    m = /[?&]sid=(\d+)/.exec(src);
    return m ? m[1] : "";
  }

  function fmtDate(ms) {
    if (!ms) return "未知";
    var d = new Date(ms);
    if (isNaN(d.getTime())) return "未知";
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function fmtDur(ms) {
    if (!ms) return "";
    var s = Math.round(ms / 1000);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function build() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.className = "mm-info";
    panel.innerHTML =
      '<div class="mm-info-mask"></div>' +
      '<div class="mm-info-sheet" role="dialog" aria-label="歌曲资料">' +
      '<div class="mm-info-head">' +
      '<span class="mm-info-title">歌曲资料</span>' +
      '<button class="mm-info-close" type="button" aria-label="关闭">✕</button>' +
      "</div>" +
      '<div class="mm-info-body"><div class="mm-info-loading">读取中…</div></div>' +
      "</div>";
    panel.querySelector(".mm-info-mask").addEventListener("click", close);
    panel.querySelector(".mm-info-close").addEventListener("click", close);
    document.body.appendChild(panel);
    requestAnimationFrame(function () { panel.classList.add("mm-info-on"); });
    document.addEventListener("keydown", onKey);
    return panel;
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  function close() {
    if (!panel) return;
    var el = panel;
    panel = null;
    el.classList.remove("mm-info-on");
    document.removeEventListener("keydown", onKey);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
  }

  function section(title, inner) {
    return '<div class="mm-info-sec"><div class="mm-info-sec-t">' + esc(title) + "</div>" + inner + "</div>";
  }

  function render(d, ap) {
    var s = d.song || {};
    var al = d.album || {};
    var artist = (d.artists || [])[0] || {};
    var songs = al.songs || [];
    var desc = (al.description || "").trim() || (artist.briefDesc || "").trim();

    var cur = curAudio(ap);
    var curName = cur.name || s.name || "";

    var head =
      '<div class="mm-info-hero">' +
      '<div class="mm-info-cover" style="background-image:url(\'' + esc(cur.pic || al.picUrl || "").replace(/'/g, "%27") + '\')"></div>' +
      '<div class="mm-info-meta">' +
      "<h3>" + esc(s.name || curName) + "</h3>" +
      (s.alias && s.alias.length ? '<p class="mm-info-alias">' + esc(s.alias.join(" / ")) + "</p>" : "") +
      '<p class="mm-info-ar">' + esc((d.artists || []).map(function (a) { return a.name; }).join(" / ")) + "</p>" +
      "</div></div>";

    var artistHtml =
      '<div class="mm-info-artist">' +
      '<div class="mm-info-avatar" style="background-image:url(\'' + esc(artist.picUrl || "").replace(/'/g, "%27") + '\')"></div>' +
      '<div class="mm-info-artist-meta">' +
      '<div class="mm-info-artist-name">' + esc(artist.name || "未知歌手") + "</div>" +
      '<div class="mm-info-artist-sub">' +
      (artist.alias && artist.alias.length ? esc(artist.alias.join(" / ")) + " · " : "") +
      "专辑 " + (artist.albumSize || 0) + " 张 · 歌曲 " + (artist.musicSize || 0) + " 首</div>" +
      "</div></div>";

    var releaseHtml =
      '<div class="mm-info-kv"><span>发行时间</span><b>' + esc(fmtDate(al.publishTime)) + "</b></div>" +
      '<div class="mm-info-kv"><span>专辑</span><b>' + esc(al.name || "未知") + "</b></div>" +
      (al.company ? '<div class="mm-info-kv"><span>唱片公司</span><b>' + esc(al.company) + "</b></div>" : "") +
      '<div class="mm-info-kv"><span>时长</span><b>' + esc(fmtDur(s.duration || cur.time || 0) || "—") + "</b></div>";

    var fallback =
      (artist.name || "该歌手") + " 演唱的《" + (s.name || curName) + "》，收录于专辑《" + (al.name || "未知") +
      "》（" + fmtDate(al.publishTime) + " 发行" + (al.company ? "，" + al.company : "") + "），全辑 " +
      (songs.length || al.size) + " 首。";
    var descHtml = '<p class="mm-info-desc">' + esc(desc || fallback) + "</p>";

    var songsHtml = songs.length
      ? '<ul class="mm-info-songs">' +
        songs
          .map(function (x, i) {
            var isCur = x.name === curName;
            return (
              '<li class="' + (isCur ? "is-cur" : "") + '" data-id="' + esc(x.id) + '" data-name="' + esc(x.name) + '" data-artist="' + esc(x.artist || "") + '">' +
              '<span class="mm-info-no">' + String(x.no || i + 1).padStart(2, "0") + "</span>" +
              '<span class="mm-info-name">' + esc(x.name) + "</span>" +
              '<span class="mm-info-dur">' + esc(fmtDur(x.duration)) + "</span>" +
              "</li>"
            );
          })
          .join("") +
        "</ul>"
      : '<p class="mm-info-desc">暂无曲目信息</p>';

    panel.querySelector(".mm-info-body").innerHTML =
      head +
      section("歌曲简介", descHtml) +
      section("歌手信息", artistHtml) +
      section("发行 · 专辑", releaseHtml) +
      section("本专辑其它歌曲（" + songs.length + "）", songsHtml);

    // 点专辑内曲目：歌单里有就切过去；没有就临时加进歌单再播
    panel.querySelectorAll(".mm-info-songs li").forEach(function (li) {
      li.addEventListener("click", function () {
        var name = li.getAttribute("data-name");
        var id = li.getAttribute("data-id");
        var audios = (ap.list && ap.list.audios) || [];
        for (var i = 0; i < audios.length; i++) {
          if (audios[i] && audios[i].name === name) {
            ap.list.switch(i);
            close();
            return;
          }
        }
        // 不在当前歌单：用同一个 Worker 拼一条音轨加进歌单
        try {
          var pic = (al.picUrl || "").replace(/param=\d+y\d+/, "param=300y300");
          ap.list.add([
            {
              name: name,
              artist: (li.getAttribute("data-artist") || artist.name || ""),
              url: "/music-api/play?sid=" + id,
              pic: pic,
              lrc: "/music-api/play?sid=" + id + "&type=lyric",
              cover: pic,
              type: "normal",
            },
          ]);
          ap.list.switch(ap.list.audios.length - 1);
          // 曲库数量文案跟着更新
          var title = document.querySelector("#anMusic-page .mm-list-title");
          if (title) title.textContent = "曲库 · " + ap.list.audios.length + " 首";
          close();
        } catch (e) {
          li.classList.add("mm-info-none");
        }
      });
    });
  }

  function open() {
    var ap = getAplayer();
    if (!ap) return;
    var sid = sidOf(ap);
    build();
    lastKey = sid;
    var body = panel.querySelector(".mm-info-body");
    body.innerHTML = '<div class="mm-info-loading">读取中…</div>';

    if (!sid) {
      body.innerHTML = '<div class="mm-info-loading">这首没有曲目 ID，读取不到资料。</div>';
      return;
    }
    if (cache[sid]) {
      render(cache[sid], ap);
      return;
    }
    ensure(sid, function (d) {
      if (!panel) return;
      if (d) {
        render(d, getAplayer() || ap);
      } else {
        panel.querySelector(".mm-info-body").innerHTML = '<div class="mm-info-loading">资料读取失败，稍后再试。</div>';
      }
    });
  }

  window.addEventListener("mm:songinfo", open, false);

  /* 播放到某首歌就自动把它的资料取回来（已经取过的不再请求） */
  function preloadCurrent() {
    var ap = getAplayer();
    if (!ap) return;
    ensure(sidOf(ap));
  }

  function hookPreload() {
    var ap = getAplayer();
    if (!ap) return;
    if (!ap.__mmPreloadHooked) {
      ap.__mmPreloadHooked = true;
      try {
        ap.on("listswitch", function () { setTimeout(preloadCurrent, 400); });
        ap.on("play", function () { setTimeout(preloadCurrent, 400); });
      } catch (e) {}
    }
    preloadCurrent();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hookPreload, false);
  } else {
    hookPreload();
  }
  setInterval(hookPreload, 2000);

  // 给外部（调试/其它脚本）留个入口
  window.MMSongInfo = { ensure: ensure, getCached: function (sid) { return cache[sid] || readStored(sid); } };
})();

;
/* ---- music-video-resume.js ---- */
/*! 视频抢走声音后，视频关掉/暂停时自动把音乐接着放 */
(function () {
  "use strict";

  var pending = null; // { ap, video, pausedByMutex }

  function players() {
    var out = [];
    if (window.aplayers && window.aplayers.length) out = out.concat(window.aplayers);
    document.querySelectorAll("meting-js").forEach(function (m) {
      if (m.aplayer && out.indexOf(m.aplayer) === -1) out.push(m.aplayer);
    });
    return out;
  }

  function playingNow() {
    var list = players();
    for (var i = 0; i < list.length; i++) {
      var a = list[i].audio;
      if (a && !a.paused) return list[i];
    }
    return null;
  }

  /* 视频开始出声 → APlayer 的 mutex 会自己暂停音乐，我们只负责记住“等会儿要接着放” */
  document.addEventListener(
    "play",
    function (e) {
      var t = e.target;
      if (!t || t.tagName !== "VIDEO") return;
      var ap = playingNow();
      if (!ap) return; // 本来就没在放歌，不用管
      pending = { ap: ap, video: t, pausedByMutex: false,
                  wantWas: (typeof window.__mmWantPlay === "function" ? window.__mmWantPlay() : true) };
      setTimeout(function () {
        if (pending && pending.video === t && ap.audio && ap.audio.paused) pending.pausedByMutex = true;
      }, 260);
    },
    true
  );

  /* 用户自己按了播放/暂停，就别替他恢复 */
  document.addEventListener(
    "click",
    function (e) {
      var t = e.target;
      if (t && t.closest && t.closest(".aplayer-icon-play, .mm-row-2 .aplayer-icon-play")) pending = null;
    },
    true
  );
  /* 注意：这里不要去 setActionHandler("pause")，那会覆盖 media-session-v3 的锁屏暂停处理 */

  function resume(reason) {
    if (!pending || !pending.pausedByMutex) return;
    var ap = pending.ap;
    var wantWas = pending.wantWas;
    pending = null;
    // 视频开始时音乐本来就是暂停的（用户不想听）→ 别替他恢复
    if (wantWas === false) return;
    try {
      // 用户手动暂停过就别硬放：只在 audio 仍是暂停态时恢复
      if (ap.audio && ap.audio.paused) ap.play();
    } catch (e) {}
  }

  ["pause", "ended", "emptied"].forEach(function (ev) {
    document.addEventListener(
      ev,
      function (e) {
        if (!pending || e.target !== pending.video) return;
        setTimeout(function () { resume(ev); }, ev === "ended" ? 600 : 260);
      },
      true
    );
  });

  /* 视频被移除 / 被隐藏（弹层关闭）也算“关掉” */
  function checkGone() {
    if (!pending) return;
    var v = pending.video;
    // 注意：position:fixed 的 video 其 offsetParent 恒为 null，不能用它判断可见性
    var gone = !v || !v.isConnected || v.paused || v.ended || v.getClientRects().length === 0;
    if (gone) {
      setTimeout(function () { resume("hidden"); }, 200);
    }
  }

  var mo = new MutationObserver(function () { setTimeout(checkGone, 120); });
  document.addEventListener("DOMContentLoaded", function () {
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
  });
  setInterval(checkGone, 1200);

  /* 站内 pjax 翻页（比如从视频文章离开）也当成视频关掉 */
  document.addEventListener("pjax:complete", function () {
    setTimeout(checkGone, 400);
  });

  /* 调试用：控制台里 __mvState() 能看到待恢复状态 */
  window.__mvState = function () {
    return pending ? { video: pending.video && pending.video.tagName, pausedByMutex: pending.pausedByMutex } : null;
  };
})();

;
/* ---- music-auto-next.js ---- */
/*! 播完自动接下一首：APlayer 的 ended→next 在后台/锁屏时偶尔不触发，这里兜一层 */
(function () {
  "use strict";

  var waiting = null; // { ap, idx }

  function getAp() {
    var host = document.querySelector("#anMusic-page meting-js");
    if (host && host.aplayer) return host.aplayer;
    if (window.aplayers && window.aplayers.length) return window.aplayers[0];
    return null;
  }

  function nextIdx(ap) {
    var n = (ap.list.audios || []).length;
    if (!n) return 0;
    var o = ap.options || {};
    if (o.order === "random") {
      var ro = ap.randomOrder || [];
      var i = ro.indexOf(ap.list.index);
      if (i >= 0 && ro.length === n) return ro[(i + 1) % ro.length];
      return Math.floor(Math.random() * n);
    }
    return (ap.list.index + 1) % n;
  }

  /* 试着让它继续出声；被浏览器拦就退避重试几次 */
  function kick(ap, tries) {
    tries = tries || 0;
    if (!ap || !ap.audio || !ap.audio.paused) return;
    // 用户已经暂停（例如在最后一秒按了暂停）→ 不要自动接下一首
    if (typeof window.__mmWantPlay === "function" && !window.__mmWantPlay()) return;
    try {
      var p = ap.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () {
          if (tries < 4) setTimeout(function () { kick(ap, tries + 1); }, 400 * (tries + 1));
        });
      }
    } catch (e) {}
    if (tries < 4) {
      setTimeout(function () {
        if (ap.audio && ap.audio.paused) kick(ap, tries + 1);
      }, 500 * (tries + 1));
    }
  }

  function bind(ap) {
    if (!ap || !ap.audio || ap.__mmAutoNext) return;
    ap.__mmAutoNext = true;

    ap.audio.addEventListener("ended", function () {
      var loopOne = (ap.options || {}).loop === "one";
      waiting = { ap: ap, idx: ap.list.index };
      setTimeout(function () {
        // 这段时间里 APlayer 自己切歌了（会触发 listswitch）→ 交给它
        if (!waiting || waiting.ap !== ap) return;
        var w = waiting;
        waiting = null;
        if (!ap.audio || !ap.audio.paused) return;

        if (loopOne) {
          try { ap.seek(0); } catch (e) {}
          kick(ap, 0);
          return;
        }
        // APlayer 完全没反应（后台被冻结等）才自己切
        if (ap.list.index === w.idx) {
          try { ap.list.switch(nextIdx(ap)); } catch (e) {}
        }
        setTimeout(function () { kick(ap, 0); }, 200);
      }, 900);
    });

    // APlayer 自己切歌成功时，这里只负责确保真的开始出声
    try {
      ap.on("listswitch", function () {
        if (waiting && waiting.ap === ap) waiting = null;
        setTimeout(function () { kick(ap, 0); }, 250);
      });
    } catch (e) {}
  }

  function scan() {
    bind(getAp());
  }

  scan();
  var n = 0;
  var t = setInterval(function () { n++; scan(); if (n > 40) clearInterval(t); }, 400);
  document.addEventListener("pjax:complete", function () { setTimeout(scan, 400); });
})();

;
/* ---- music-page-desktop.js ---- */
/*! 桌面端音乐馆：酷狗单曲页形态
 *  - 页面：纯黑底 + 居中大封面 + 右上「歌手 - 歌名」+ 下载
 *  - 底栏：上一首/播放/下一首 → 缩略图 + 歌名 + 进度条 + 时间 → 音量/循环/下载/分享/列表(角标)
 */
(function () {
  "use strict";

  function isDesktop() {
    return window.innerWidth > 768;
  }

  function getAp() {
    var host = document.querySelector("#anMusic-page meting-js");
    if (host && host.aplayer) return host.aplayer;
    if (window.aplayers && window.aplayers.length) return window.aplayers[0];
    return null;
  }

  function curAudio(ap) {
    try {
      return ap.list.audios[ap.list.index] || {};
    } catch (e) {
      return {};
    }
  }

  function picUrl(ap) {
    var a = curAudio(ap);
    return a.pic || a.cover || "";
  }

  function sidOf(ap) {
    var a = curAudio(ap);
    return String(a.url || "").split("sid=").pop().split("&")[0];
  }

  function downloadHref(ap) {
    var a = curAudio(ap);
    var sid = sidOf(ap);
    if (!sid) return "";
    return "/music-api/play?sid=" + sid + "&download=1&name=" + encodeURIComponent(a.name || "song");
  }

  function toast(msg) {
    try {
      if (window.anzhiyu && anzhiyu.snackbarShow) return anzhiyu.snackbarShow(msg);
    } catch (e) {}
    console.log(msg);
  }

  var SVG = {
    vol:
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>',
    loop:
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M17 2.5l3.5 3.5L17 9.5"/><path d="M20.5 6H7a4 4 0 0 0-4 4v1"/>' +
      '<path d="M7 21.5L3.5 18 7 14.5"/><path d="M3.5 18H17a4 4 0 0 0 4-4v-1"/></svg>',
    loopOne:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M17 2.5l3.5 3.5L17 9.5"/><path d="M20.5 6H7a4 4 0 0 0-4 4v1"/>' +
      '<path d="M7 21.5L3.5 18 7 14.5"/><path d="M3.5 18H17a4 4 0 0 0 4-4v-1"/>' +
      '<path d="M10.6 12.4l1.5-1.1v4.4"/></svg>',
    shuffle:
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M16 3.5h4.5V8"/><path d="M20.5 3.5L14 10"/><path d="M16 20.5h4.5V16"/><path d="M20.5 20.5L4 4"/>' +
      '<path d="M4 20.5l4.2-4.2"/></svg>',
    download:
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 3.5v10"/><path d="M8 10l4 4 4-4"/><path d="M4.5 18.5h15"/></svg>',
    share:
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/><path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4"/></svg>',
    list:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
      '<path d="M4 7h11"/><path d="M4 12h11"/><path d="M4 17h7"/><path d="M18 6.5v8"/><circle cx="16.4" cy="16.4" r="2.2"/></svg>'
  };

  /* ---------- 右上角：歌手 - 歌名（下载按钮已移除） ---------- */
  function paintTopMeta(ap) {
    var el = document.querySelector(".md-songmeta");
    if (!el) {
      el = document.createElement("div");
      el.className = "md-songmeta";
      el.innerHTML = '<div class="md-sm-title"></div>';
      document.body.appendChild(el);
    }
    /* 下载按钮不要了：直接把节点从 DOM 里删掉，不是隐藏 */
    var kill = el.querySelectorAll(".md-download");
    for (var i = 0; i < kill.length; i++) {
      if (kill[i].parentNode) kill[i].parentNode.removeChild(kill[i]);
    }
    try {
      el.style.removeProperty("left");
      el.style.removeProperty("top");
    } catch (e) {}

    var a = curAudio(ap);
    var t = el.querySelector(".md-sm-title");
    if (t) t.textContent = (a.artist ? a.artist + " - " : "") + (a.name || "");
  }

  /* ---------- 底栏 ---------- */
  function build(ap) {
    var el = document.getElementById("anMusic-page");
    if (!el) return false;
    var ctrl = el.querySelector(".aplayer-controller");
    if (!ctrl) return false;
    if (ctrl.dataset.mdDone === "1") {
      paintBar();
      return true;
    }

    var bar = ctrl.querySelector(".aplayer-bar-wrap");
    var ptime = ctrl.querySelector(".aplayer-ptime");
    var dtime = ctrl.querySelector(".aplayer-dtime");
    var back = el.querySelector(".aplayer-icon-back");
    var play = el.querySelector(".aplayer-icon-play");
    var fwd = el.querySelector(".aplayer-icon-forward");
    if (!bar || !play) return false;

    ctrl.dataset.mdDone = "1";
    ctrl.innerHTML = "";
    ctrl.classList.add("md-bar");

    /* 1. 上一首 / 播放 / 下一首 */
    var btns = document.createElement("div");
    btns.className = "md-btns";
    [back, play, fwd].forEach(function (n) {
      if (n) btns.appendChild(n);
    });

    /* 2. 缩略图 + 歌名 + 进度 + 时间 */
    var track = document.createElement("div");
    track.className = "md-track";

    var thumb = document.createElement("div");
    thumb.className = "md-cover";

    var body = document.createElement("div");
    body.className = "md-track-body";

    var title = document.createElement("div");
    title.className = "md-track-title";

    var line = document.createElement("div");
    line.className = "md-line";
    line.appendChild(bar);

    var times = document.createElement("div");
    times.className = "md-time";
    if (ptime) times.appendChild(ptime);
    var sep = document.createElement("span");
    sep.className = "md-sep";
    sep.textContent = "/";
    times.appendChild(sep);
    if (dtime) times.appendChild(dtime);
    line.appendChild(times);

    body.appendChild(title);
    body.appendChild(line);
    track.appendChild(thumb);
    track.appendChild(body);

    /* 3. 工具区：音量 / 循环 / 下载 / 分享 / 列表 */
    var tools = document.createElement("div");
    tools.className = "md-tools";

    var vol = document.createElement("div");
    vol.className = "md-vol";
    vol.innerHTML = SVG.vol;
    var range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = "1";
    range.step = "0.01";
    range.className = "md-vol-range";
    try {
      range.value = ap.volume();
    } catch (e) {}
    range.addEventListener("input", function () {
      try {
        ap.volume(parseFloat(range.value));
      } catch (e) {}
    });
    vol.appendChild(range);
    var lastVol = 1;
    vol.querySelector("svg").addEventListener("click", function () {
      try {
        var v = ap.volume();
        if (v > 0) {
          lastVol = v;
          ap.volume(0);
          range.value = 0;
        } else {
          ap.volume(lastVol || 1);
          range.value = lastVol || 1;
        }
      } catch (e) {}
    });

    var MODES = ["顺序播放", "随机播放", "单曲循环"];
    var mode = document.createElement("button");
    mode.type = "button";
    mode.className = "md-icon md-mode";
    mode.innerHTML = SVG.loop;
    function modeIdx() {
      var o = ap.options || {};
      if (o.loop === "one") return 2;
      if (o.order === "random") return 1;
      return 0;
    }
    function modePaint() {
      var i = modeIdx();
      mode.title = MODES[i];
      mode.setAttribute("aria-label", MODES[i]);
      mode.innerHTML = i === 2 ? SVG.loopOne : i === 1 ? SVG.shuffle : SVG.loop;
      mode.classList.toggle("is-on", i !== 0);
    }
    mode.addEventListener("click", function () {
      var o = ap.options || (ap.options = {});
      var i = (modeIdx() + 1) % 3;
      if (i === 1) {
        o.order = "random";
        o.loop = "all";
      } else if (i === 2) {
        o.order = "list";
        o.loop = "one";
      } else {
        o.order = "list";
        o.loop = "all";
      }
      modePaint();
      toast(MODES[i]);
    });
    modePaint();

    var dl = document.createElement("a");
    dl.className = "md-icon md-download";
    dl.title = "下载这首歌";
    dl.innerHTML = SVG.download;

    var share = document.createElement("button");
    share.type = "button";
    share.className = "md-icon md-share";
    share.title = "分享";
    share.innerHTML = SVG.share;
    share.addEventListener("click", function () {
      var a = curAudio(ap);
      var text = (a.artist ? a.artist + " - " : "") + (a.name || "") + " " + location.href;
      if (navigator.share) {
        navigator.share({ title: a.name || "Laosia 音乐馆", text: text, url: location.href }).catch(function () {});
        return;
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          toast("已复制分享链接");
        });
      }
    });

    var queue = document.createElement("button");
    queue.type = "button";
    queue.className = "md-icon md-queue";
    queue.title = "播放列表";
    queue.innerHTML = SVG.list + '<i class="md-badge">0</i>';
    queue.addEventListener("click", function () {
      document.body.classList.toggle("md-queue-open");
      var l = document.querySelector("#anMusic-page .aplayer-list");
      if (!l) return;
      if (document.body.classList.contains("md-queue-open")) {
        /* 抽屉里让面板自己撑满，清掉 enhanceList 写的内联高度 */
        l.style.removeProperty("height");
        l.style.removeProperty("max-height");
        var ol0 = l.querySelector("ol");
        if (ol0) ol0.style.removeProperty("max-height");
        /* 打开就直接定位到正在播放的那一首 */
        [60, 200, 420, 700].forEach(function (t) { setTimeout(scrollToCurrent, t); });
      } else {
        enhanceList();
      }
    });

    [vol, mode, dl, share, queue].forEach(function (n) {
      tools.appendChild(n);
    });

    ctrl.appendChild(btns);
    ctrl.appendChild(track);
    ctrl.appendChild(tools);

    function paintBar() {
      var a = curAudio(ap);
      thumb.style.backgroundImage = "url('" + String(picUrl(ap)).replace(/'/g, "%27") + "')";
      title.textContent = (a.artist ? a.artist + " - " : "") + (a.name || "");
      var href = downloadHref(ap);
      if (href && dl) {
        dl.href = href;
        dl.setAttribute("download", (a.name || "song") + ".mp3");
      }
      var badge = queue.querySelector(".md-badge");
      if (badge) badge.textContent = String(ap.list && ap.list.audios ? ap.list.audios.length : 0);
      paintTopMeta(ap);
    }
    paintBar();
    try {
      ap.on("listswitch", function () {
        setTimeout(paintBar, 60);
      });
    } catch (e) {}
    return true;
  }

  /* 把当前播放的那一行滚到列表中间 */
  function scrollToCurrent() {
    var list = document.querySelector("#anMusic-page .aplayer-list");
    if (!list) return;
    var search = list.querySelector(".md-search-input");
    if (search && search.value.trim()) return; // 正在搜索就别抢滚动
    var ol = list.querySelector("ol");
    var cur = list.querySelector("li.aplayer-list-light");
    if (!ol || !cur) return;
    var or = ol.getBoundingClientRect();
    var cr = cur.getBoundingClientRect();
    var delta = cr.top - or.top - (ol.clientHeight - cr.height) / 2;
    ol.scrollTop = Math.max(0, ol.scrollTop + delta);
  }

  /* ---------- 曲库搜索（抽屉里用） ---------- */
  function applyFilter(list, q) {
    var rows = list.querySelectorAll("ol li");
    var ql = (q || "").trim().toLowerCase();
    var shown = 0;
    for (var i = 0; i < rows.length; i++) {
      var li = rows[i];
      var t = (li.querySelector(".aplayer-list-title") || {}).textContent || "";
      var a = (li.querySelector(".aplayer-list-author") || {}).textContent || "";
      var hit = !ql || (t + " " + a).toLowerCase().indexOf(ql) >= 0;
      if (hit) li.classList.remove("md-hidden");
      else li.classList.add("md-hidden");
      if (hit) shown++;
    }
    var ol = list.querySelector("ol");
    if (ol) ol.scrollTop = 0;
    return shown;
  }

  function buildSearch(list, head) {
    if (list.querySelector(".md-search")) return;
    var box = document.createElement("div");
    box.className = "md-search";
    box.innerHTML =
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>' +
      '<input type="search" class="md-search-input" placeholder="搜索歌名 / 歌手" autocomplete="off" spellcheck="false">' +
      '<button type="button" class="md-search-clear" aria-label="清空">✕</button>';
    list.insertBefore(box, head.nextSibling);
    var input = box.querySelector(".md-search-input");
    var clear = box.querySelector(".md-search-clear");
    var count = head.querySelector(".md-list-count");
    var total = list.querySelectorAll("ol li").length;

    function run() {
      var shown = applyFilter(list, input.value);
      if (count) count.textContent = input.value.trim() ? "匹配 " + shown + " 首" : "共 " + total + " 首";
      box.classList.toggle("is-active", !!input.value.trim());
    }
    input.addEventListener("input", run);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        input.value = "";
        run();
      }
    });
    clear.addEventListener("click", function () {
      input.value = "";
      run();
      input.focus();
    });
  }

  function enhanceList() {
    var list = document.querySelector("#anMusic-page .aplayer-list");
    if (!list || !list.querySelector("ol")) return;
    var n = list.querySelectorAll("ol li").length;
    var head = list.querySelector(".md-list-head");
    if (!head) {
      head = document.createElement("div");
      head.className = "md-list-head";
      head.innerHTML = '<span class="md-list-title">播放列表</span><span class="md-list-count"></span>';
      list.insertBefore(head, list.firstChild);
      var cols = document.createElement("div");
      cols.className = "md-list-cols";
      cols.innerHTML = "<span></span><span>歌曲</span><span>歌手</span>";
      list.insertBefore(cols, head.nextSibling);
      buildSearch(list, head);
    }
    var count = head.querySelector(".md-list-count");
    var q = (list.querySelector(".md-search-input") || {}).value || "";
    if (count && !q) count.textContent = "共 " + n + " 首";

    /* APlayer 会写死内联 max-height，这里按视口高度重算 */
    var h = Math.min(560, Math.max(320, window.innerHeight - 220));
    list.style.setProperty("height", h + "px", "important");
    list.style.setProperty("max-height", h + "px", "important");
    var ol = list.querySelector("ol");
    if (ol) ol.style.setProperty("max-height", Math.max(180, h - 96) + "px", "important");
  }

  /* 桌面端：删掉右下角那三个悬浮功能键（不是隐藏，直接从 DOM 移除） */
  function dropActionButtons() {
    ["anMusicBtnGetSong", "anMusicRefreshBtn", "anMusicSwitching"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  /* 歌词面板跟着封面走：贴在封面右边，与封面同高 */
  /* 歌词面板：直接搬进 .aplayer-body 当封面的右邻居，交给 flex 排，不再靠坐标硬算 */
  function placeLrc() {
    var el = document.getElementById("anMusic-page");
    if (!el) return;
    var bodyEl = el.querySelector(".aplayer-body");
    var lrc = el.querySelector(".aplayer-lrc");
    var pic = el.querySelector(".aplayer-pic");
    var info = el.querySelector(".aplayer-info");
    var meta = document.querySelector(".md-songmeta");
    if (!bodyEl || !lrc) return;

    /* 移动端：保持 APlayer 原始结构，把桌面那套改动全部还原 */
    if (!isDesktop()) {
      var colM = el.querySelector(".md-col");
      if (colM) {
        if (lrc.parentElement === colM) {
          var ctrlM = info && info.querySelector(".aplayer-controller");
          if (info) info.insertBefore(lrc, ctrlM || null);
          else bodyEl.appendChild(lrc);
        }
        if (meta && meta.parentElement === colM && meta.parentNode) meta.parentNode.removeChild(meta);
        if (colM.parentNode) colM.parentNode.removeChild(colM);
      }
      ["left", "top", "width", "height", "position"].forEach(function (p) {
        lrc.style.removeProperty(p);
      });
      return;
    }

    /* 右半边做成一个竖列：上面歌名，下面歌词 */
    var col = bodyEl.querySelector(".md-col");
    if (!col) {
      col = document.createElement("div");
      col.className = "md-col";
      bodyEl.appendChild(col);
    }
    if (meta && meta.parentElement !== col) col.insertBefore(meta, col.firstChild);
    if (lrc.parentElement !== col) col.appendChild(lrc);
    if (meta && col.firstElementChild !== meta) col.insertBefore(meta, col.firstChild);
    ["left", "top", "width", "height"].forEach(function (p) {
      lrc.style.removeProperty(p);
    });
    if (meta) {
      ["left", "top", "right", "position"].forEach(function (p) {
        meta.style.removeProperty(p);
      });
    }
    if (pic) {
      ["left", "top", "transform", "position"].forEach(function (p) {
        pic.style.removeProperty(p);
      });
      /* 有样式表把封面写成 margin-left:178px !important，内联 important 才能压住 */
      pic.style.setProperty("margin-left", "0", "important");
      pic.style.setProperty("margin-right", "0", "important");
    }
  }

  function tick() {
    if (!isDesktop()) {
      /* 移动端（或从桌面缩回来）：还原 DOM，别留桌面那套 */
      placeLrc();
      return;
    }
    var _ap = getAp();
    if (_ap && !_ap.__mdFollow) {
      _ap.__mdFollow = true;
      try {
        _ap.on("listswitch", function () {
          if (document.body.classList.contains("md-queue-open")) {
            [80, 260, 600].forEach(function (t) { setTimeout(scrollToCurrent, t); });
          }
        });
      } catch (e) {}
    }
    dropActionButtons();
    var ap = getAp();
    if (ap) build(ap);
    enhanceList();
    placeLrc();
  }

  /* 抽屉：点空白处 / Esc 关闭 */
  document.addEventListener(
    "click",
    function (e) {
      if (!document.body.classList.contains("md-queue-open")) return;
      if (e.target.closest(".aplayer-list") || e.target.closest(".md-queue")) return;
      document.body.classList.remove("md-queue-open");
    },
    true
  );
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") document.body.classList.remove("md-queue-open");
  });

  /* 歌词文字居中：APlayer 会重建 <p>，所以持续补内联样式 */
  function centerLyrics() {
    if (!isDesktop()) return;
    var ps = document.querySelectorAll("#anMusic-page .aplayer-lrc p");
    for (var i = 0; i < ps.length; i++) {
      ps[i].style.setProperty("text-align", "center", "important");
    }
  }
  setInterval(centerLyrics, 800);

  var n = 0;
  var t = setInterval(function () {
    n++;
    centerLyrics();
    tick();
    if (n > 75) clearInterval(t);
  }, 400);
  [600, 1200, 2200, 3500, 5000, 7000].forEach(function (ms) {
    setTimeout(placeLrc, ms);
  });
  /* 播放器高度会随 meting 数据/列表开关变化，用 ResizeObserver 跟着封面重新对齐 */
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function () {
      placeLrc();
    });
    ["#anMusic-page .aplayer-body", "#anMusic-page .aplayer-pic", "#anMusic-page .aplayer"].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) ro.observe(el);
    });
  }
  try {
    var apx = getAp();
    if (apx) {
      ["play", "canplay", "listswitch"].forEach(function (ev) {
        apx.on(ev, function () {
          setTimeout(placeLrc, 120);
        });
      });
    }
  } catch (e) {}
  window.addEventListener("resize", function () {
    setTimeout(tick, 300);
    setTimeout(function () { var ap = getAp(); if (ap) paintTopMeta(ap); }, 360);
  });
  document.addEventListener("pjax:complete", function () {
    setTimeout(function () {
      var ctrl = document.querySelector("#anMusic-page .aplayer-controller");
      if (ctrl) ctrl.dataset.mdDone = "";
      document.body.classList.remove("md-queue-open");
      tick();
    }, 500);
  });
})();

;
/* ---- music-karaoke.js ---- */
/*! 桌面端：底部卡拉OK歌词条（逐字/逐行填充高亮） */
(function () {
  "use strict";

  var ACCENT = "var(--anzhiyu-main, #f5c542)";
  var strip = null;
  var lineEl = null;
  var nextEl = null;
  var lines = [];
  var lrcKey = "";
  var lastIdx = -1;

  function isDesktop() {
    return window.innerWidth > 768;
  }

  function getAp() {
    var host = document.querySelector("#anMusic-page meting-js");
    if (host && host.aplayer) return host.aplayer;
    if (window.aplayers && window.aplayers.length) return window.aplayers[0];
    return null;
  }

  function ensure() {
    if (strip && strip.isConnected) return;
    strip = document.createElement("div");
    strip.className = "md-karaoke";
    strip.innerHTML = '<div class="md-k-line"></div><div class="md-k-next"></div>';
    document.body.appendChild(strip);
    lineEl = strip.querySelector(".md-k-line");
    nextEl = strip.querySelector(".md-k-next");
  }

  function parseLrc(text) {
    var out = [];
    String(text || "")
      .split(/\r?\n/)
      .forEach(function (raw) {
        var m = /\[(\d{1,2}):(\d{1,2}(?:[.:]\d{1,3})?)\](.*)$/.exec(raw);
        if (!m) return;
        var sec = parseInt(m[1], 10) * 60 + parseFloat(String(m[2]).replace(":", "."));
        var txt = (m[3] || "").trim();
        if (!txt) return;
        out.push({ t: sec, text: txt });
      });
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }

  function loadLyric(ap) {
    var cur = {};
    try { cur = ap.list.audios[ap.list.index] || {}; } catch (e) {}
    var url = cur.lrc || "";
    if (!url || url === lrcKey) return;
    lrcKey = url;
    lines = [];
    lastIdx = -1;
    fetch(url)
      .then(function (r) { return r.text(); })
      .then(function (t) {
        if (url !== lrcKey) return;
        lines = parseLrc(t);
      })
      .catch(function () {});
  }

  function render(t) {
    if (!lines.length) {
      if (lineEl) lineEl.textContent = "";
      if (nextEl) nextEl.textContent = "";
      return;
    }
    var i = -1;
    for (var k = 0; k < lines.length; k++) {
      if (lines[k].t <= t + 0.15) i = k;
      else break;
    }
    if (i < 0) {
      lineEl.textContent = "";
      lineEl.style.backgroundImage = "none";
      lineEl.style.color = "rgba(255,255,255,.25)";
      nextEl.textContent = lines[0] ? lines[0].text : "";
      return;
    }
    var cur = lines[i];
    var next = lines[i + 1];
    var end = next ? next.t : cur.t + 4;
    var span = Math.max(0.4, end - cur.t);
    var pct = Math.min(100, Math.max(0, ((t - cur.t) / span) * 100));

    if (lastIdx !== i) {
      lastIdx = i;
      lineEl.textContent = cur.text;
    }
    lineEl.style.backgroundImage =
      "linear-gradient(90deg," + ACCENT + " 0%," + ACCENT + " " + pct.toFixed(1) + "%," +
      "rgba(255,255,255,.28) " + pct.toFixed(1) + "%,rgba(255,255,255,.28) 100%)";
    lineEl.style.color = "transparent";
    nextEl.textContent = next ? next.text : "";
  }

  function tick() {
    if (!isDesktop()) {
      if (strip && strip.isConnected) strip.parentNode.removeChild(strip);
      strip = null;
      return;
    }
    var ap = getAp();
    if (!ap || !ap.audio) return;
    ensure();
    loadLyric(ap);
    render(ap.audio.currentTime || 0);
  }

  var n = 0;
  var t = setInterval(function () {
    n++;
    tick();
    if (n > 45) clearInterval(t);
  }, 400);
  setInterval(tick, 250);
  window.addEventListener("resize", function () { setTimeout(tick, 200); });
  document.addEventListener("pjax:complete", function () { setTimeout(tick, 400); });

  /* 调试/验收用：__mdKaraoke(秒) 直接把歌词条渲染到指定时间 */
  window.__mdKaraoke = function (sec) {
    var ap = getAp();
    if (!ap) return null;
    ensure();
    loadLyric(ap);
    render(sec);
    return { lines: lines.length, text: lineEl ? lineEl.textContent : "" };
  };
})();

;
/* ---- music-stream-refresh-v2.js ---- */
/*! 音乐馆：音频直链过期导致「An audio error has occurred」的修正
 *
 * 播放地址是 /music-api/play?sid=<id>，Worker 会 302 到带时间戳的 CDN 直链（约 20 分钟过期）。
 * 媒体元素一旦解析过就记住那条直链；暂停久了、或从锁屏/通知栏直接点播放，
 * 请求打到过期链接 → 403 → APlayer 弹英文提示并 2 秒后跳下一首。
 *
 * 三层防护：
 *  1) 点播放前检查：距上次取链超过 15 分钟，先换新链（保住进度）再播 —— 覆盖锁屏/通知栏/网页按钮所有入口；
 *  2) 暂停期间每 6 分钟悄悄换一次链；
 *  3) 万一还是报错：立刻换新链续播，并在 APlayer 自动跳歌后把曲目切回来。
 */
(function () {
  "use strict";

  var REFRESH_MS = 6 * 60 * 1000;   // 暂停期间换链间隔
  var STALE_MS = 15 * 60 * 1000;    // 超过这个时间没取链，播放前先换
  var timer = null;
  var lastPauseAt = 0;
  var lastLoadAt = 0;
  var stallAttempts = 0;
  var lastRecoverAt = 0;
  var undo = null;                  // 报错后要切回来的曲目
  var wantPlay = false;             // 用户当前是否「想播放」——所有自动续播都必须先问它

  function getAplayer() {
    var host = document.querySelector("#anMusic-page meting-js");
    if (host && host.aplayer) return host.aplayer;
    if (window.aplayers && window.aplayers.length) return window.aplayers[0];
    return null;
  }

  function cur(ap) {
    try {
      return (ap.list.audios || [])[ap.list.index] || {};
    } catch (e) {
      return {};
    }
  }

  function freshUrl(item) {
    return item.url + (item.url.indexOf("?") >= 0 ? "&" : "?") + "_r=" + Date.now();
  }

  function markLoad() {
    lastLoadAt = Date.now();
  }

  /* 换成新直链并保住进度，之后执行 done() */
  function reload(done) {
    var ap = getAplayer();
    if (!ap || !ap.audio) return false;
    var item = cur(ap);
    if (!item.url) return false;
    var au = ap.audio;
    var t = au.currentTime || 0;

    try {
      au.preload = "metadata";
      au.src = freshUrl(item);
      au.load();
      markLoad();
    } catch (e) {
      return false;
    }

    var go = function () {
      try {
        if (t > 0.5 && Math.abs((au.currentTime || 0) - t) > 1) au.currentTime = t;
      } catch (e) {}
      au.removeEventListener("loadedmetadata", go);
      if (typeof done === "function") {
        try { done(); } catch (e) {}
      }
    };
    au.addEventListener("loadedmetadata", go);
    setTimeout(go, 1500);
    return true;
  }

  /* 包一层 play / pause：记录「用户到底想不想播放」。
     注意：内部恢复一律用 __srfOrigPlay，绕开这层，避免把自动续播当成用户意图。 */
  function wrapPlay(au) {
    if (au.__srfPlay || typeof au.play !== "function") return;
    au.__srfPlay = true;
    var orig = au.play;
    au.__srfOrigPlay = orig;

    au.play = function () {
      wantPlay = true;                     // 走到这里 = 有人真的要播（按钮/锁屏/APlayer 切歌）
      try {
        if (lastLoadAt && Date.now() - lastLoadAt > STALE_MS && !au.__srfReloading) {
          au.__srfReloading = true;
          var ok = reload(function () {
            au.__srfReloading = false;
            if (!wantPlay) return;         // 换链这一两秒里用户按了暂停 → 就别出声
            try {
              var p = orig.call(au);
              if (p && p.catch) p.catch(function () {});
            } catch (e) {}
          });
          if (ok) return Promise.resolve();
          au.__srfReloading = false;
        }
      } catch (e) {}
      return orig.apply(au, arguments);
    };

    if (typeof au.pause === "function" && !au.__srfPause) {
      au.__srfPause = true;
      var opause = au.pause;
      au.__srfOrigPause = opause;
      au.pause = function () {
        wantPlay = false;                  // 明确的暂停 = 不想播了
        return opause.apply(au, arguments);
      };
    }
  }

  /* 暂停期间定时换链 */
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var ap = getAplayer();
      if (!ap || !ap.audio || !ap.audio.paused) return;
      if (reload()) schedule();
    }, REFRESH_MS);
  }

  /* 报错兜底：换链续播，并把 APlayer 自动跳到的下一首切回来 */
  function onError(au) {
    var ap = getAplayer();
    if (!ap) return;
    undo = { idx: ap.list.index, t: au.currentTime || 0, at: Date.now() };
    reload(function () {
      if (!wantPlay) return;               // 暂停状态下报错 → 只换链，不出声
      try {
        var p = au.__srfOrigPlay ? au.__srfOrigPlay.call(au) : au.play();
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    });
  }

  /* 播放卡死看门狗：点了播放但进度不走 → 重新取链再来一次 */
  function watchdog(au, round) {
    var t0 = au.currentTime || 0;
    setTimeout(function () {
      if (au.paused) return;
      if (Math.abs((au.currentTime || 0) - t0) > 0.3) return;
      if (round === 0 && (au.readyState < 2 || au.networkState !== 1)) {
        watchdog(au, 1);
        return;
      }
      var now = Date.now();
      if (now - lastRecoverAt < 12000 || stallAttempts >= 2) return;
      lastRecoverAt = now;
      stallAttempts++;
      reload(function () {
        if (!wantPlay) return;             // 卡死恢复期间用户暂停了 → 不再出声
        try {
          var p = au.__srfOrigPlay ? au.__srfOrigPlay.call(au) : au.play();
          if (p && p.catch) p.catch(function () {});
        } catch (e) {}
      });
    }, round === 0 ? 1800 : 2500);
  }

  function bind() {
    var ap = getAplayer();
    if (!ap || !ap.audio || ap.__streamRefresh) return;
    ap.__streamRefresh = true;
    var au = ap.audio;
    markLoad();
    wrapPlay(au);

    au.addEventListener("pause", function () {
      lastPauseAt = Date.now();
      schedule();
    });
    au.addEventListener("play", function () {
      clearTimeout(timer);
      stallAttempts = 0;
      markLoad();
      watchdog(au, 0);
    });
    au.addEventListener("ended", function () {
      clearTimeout(timer);
    });
    au.addEventListener("error", function () {
      if (!au.error) return;
      onError(au);
    });

    try {
      ap.on("listswitch", function () {
        clearTimeout(timer);
        stallAttempts = 0;
        markLoad();
        // 报错后 4 秒内 APlayer 自己跳了歌：切回原来那首
        if (undo && Date.now() - undo.at < 4000) {
          var target = undo.idx;
          var t = undo.t;
          undo = null;
          setTimeout(function () {
            try {
              if (ap.list.index !== target) ap.list.switch(target);
              setTimeout(function () {
                try {
                  if (t > 0.5) ap.audio.currentTime = t;
                  if (!wantPlay) return;   // 用户已经暂停 → 只回位，不自动出声
                  var p = ap.audio.__srfOrigPlay ? ap.audio.__srfOrigPlay.call(ap.audio) : ap.audio.play();
                  if (p && p.catch) p.catch(function () {});
                } catch (e) {}
              }, 500);
            } catch (e) {}
          }, 150);
        }
        if (au.paused) schedule();
      });
    } catch (e) {}

    // 手机端：切后台定时器会被冻结，回到前台先补一次刷新
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      if (!au.paused) return;
      if (Date.now() - lastPauseAt < 120000) return;
      reload();
      schedule();
    });

    if (au.paused) schedule();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, false);
  } else {
    bind();
  }
  setInterval(bind, 2000);

  // 调试钩子
  window.__mmRefreshStream = function () { return reload(); };
  window.__mmForceStale = function () { lastLoadAt = Date.now() - STALE_MS - 1000; return true; };
  window.__mmWantPlay = function () { return wantPlay; };
  window.__mmSetWantPlay = function (v) { wantPlay = !!v; return wantPlay; };
})();

;
/* ---- music-remember.js ---- */
/*! 音乐馆：记忆播放（曲目 / 进度 / 音量 / 播放模式），刷新或下次进入自动接着放 */
(function () {
  "use strict";

  var KEY = "mm-play-state-v1";
  var MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 天内有效
  var lastSave = 0;
  var restored = false;

  function read() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!o || !o.at || Date.now() - o.at > MAX_AGE) return null;
      return o;
    } catch (e) {
      return null;
    }
  }
  function write(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) {}
  }

  function getAp() {
    var m = document.querySelector("meting-js");
    if (m && m.aplayer && m.aplayer.audio) return m.aplayer;
    if (window.aplayers && window.aplayers.length && window.aplayers[0].audio) return window.aplayers[0];
    return null;
  }

  function save(ap, force) {
    if (!ap || !ap.list) return;
    var now = Date.now();
    if (!force && now - lastSave < 2000) return;
    lastSave = now;
    var idx = ap.list.index;
    var a = (ap.list.audios && ap.list.audios[idx]) || {};
    var t = ap.audio ? ap.audio.currentTime || 0 : 0;
    write({
      i: idx,
      name: a.name || "",
      artist: a.artist || "",
      t: Math.max(0, Math.round(t * 10) / 10),
      vol: ap.volume(),
      order: (ap.options || {}).order || "list",
      loop: (ap.options || {}).loop || "all",
      playing: !!(ap.audio && !ap.audio.paused),
      at: now,
    });
  }

  function findIndexBy(ap, name, artist) {
    var list = (ap.list && ap.list.audios) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].name === name && (!artist || list[i].artist === artist)) return i;
    }
    return -1;
  }

  function restore(ap) {
    if (restored || !ap) return;
    var st = read();
    if (!st) { restored = true; return; }
    restored = true;

    // 音量 & 播放模式
    try { if (typeof st.vol === "number") ap.volume(st.vol); } catch (e) {}
    // 顺序/循环状态（ap.mode 是布局模式，别存它）
    try {
      ap.options = ap.options || {};
      if (st.order) ap.options.order = st.order;
      if (st.loop) ap.options.loop = st.loop;
    } catch (e) {}

    // 曲目：同名优先，找不到再用索引
    var idx = -1;
    if (st.name) idx = findIndexBy(ap, st.name, st.artist);
    if (idx < 0 && typeof st.i === "number" && st.i < (ap.list.audios || []).length) idx = st.i;
    if (idx < 0) return;

    var seekTo = st.t || 0;
    if (ap.list.index !== idx) {
      try { ap.list.switch(idx); } catch (e) {}
    }
    function resume() {
      // 打开页面不自动播放（用户要求），只恢复曲目/进度/音量/模式，按播放键从上次位置继续
      return;
      if (!st.playing) return;
      var go = function () {
        try {
          var r = ap.play();
          if (r && r.catch) r.catch(function () {});
        } catch (e) {}
      };
      go();
      // 被自动播放策略拦下时，等用户第一次点屏幕/按键再续播
      var once = function () {
        document.removeEventListener("pointerdown", once, true);
        document.removeEventListener("keydown", once, true);
        if (ap.audio && ap.audio.paused) go();
      };
      setTimeout(function () {
        if (ap.audio && ap.audio.paused) {
          document.addEventListener("pointerdown", once, true);
          document.addEventListener("keydown", once, true);
        }
      }, 600);
    }

    // 元数据就绪后再定位：监听事件 + 轮询双保险，避免时长未知导致 seek 失败
    var done = false;
    function trySeek() {
      if (done) return;
      var d = ap.audio ? ap.audio.duration : 0;
      if (!d || !isFinite(d)) return;
      done = true;
      try { if (seekTo > 0.5 && seekTo < d - 2) ap.seek(seekTo); } catch (e) {}
      resume();
    }
    if (ap.audio) {
      ap.audio.preload = "metadata";
      ["loadedmetadata", "durationchange", "canplay", "canplaythrough"].forEach(function (ev) {
        ap.audio.addEventListener(ev, trySeek);
      });
      try { if (!ap.audio.duration) ap.audio.load(); } catch (e) {}
    }
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      trySeek();
      if (done || tries > 40) {
        clearInterval(timer);
        if (!done) resume();
      }
    }, 250);
  }

  function bind(ap) {
    if (!ap || ap.__mmRemember) return;
    ap.__mmRemember = true;

    restore(ap);

    if (ap.audio) {
      ap.audio.addEventListener("timeupdate", function () { save(ap); }, { passive: true });
      ap.audio.addEventListener("pause", function () { save(ap, true); });
      ap.audio.addEventListener("play", function () { save(ap, true); });
      ap.audio.addEventListener("ended", function () { save(ap, true); });
    }
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") save(ap, true);
    });
    window.addEventListener("pagehide", function () { save(ap, true); });
    window.addEventListener("beforeunload", function () { save(ap, true); });
  }

  function boot() {
    var n = 0;
    var t = setInterval(function () {
      n++;
      var ap = getAp();
      if (ap && ap.list && ap.list.audios && ap.list.audios.length) {
        bind(ap);
        clearInterval(t);
      } else if (n > 50) {
        clearInterval(t);
      }
    }, 300);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", boot);
})();

;
/* ---- media-session-v3.js ---- */
/*! 媒体会话 v3：只有“真正在出声”的播放器实例才能接管锁屏/通知栏 */
(function () {
  "use strict";

  if (!("mediaSession" in navigator)) return;

  var players = [];
  var active = null;      // 最近真正播放过的实例（用于暂停时保留锁屏信息）
  var lastPos = 0;
  var handlersBound = false;

  function bigPic(url) {
    if (!url) return "";
    if (/param=\d+y\d+/.test(url)) return url.replace(/param=\d+y\d+/, "param=600y600");
    return url;
  }

  function trackOf(ap) {
    var idx = ap.list.index;
    return (ap.list.audios || [])[idx] || {};
  }

  /* 正在出声的实例（audio 未暂停且已加载） */
  function sounding() {
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      if (p.audio && !p.audio.paused && p.audio.currentTime > 0) return p;
      if (p.audio && !p.audio.paused && p.audio.readyState > 0) return p;
    }
    return null;
  }

  function paintMeta(ap) {
    var a = trackOf(ap);
    var pic = bigPic(a.pic || "");
    var artwork = pic
      ? [
          { src: pic, sizes: "512x512", type: "image/jpeg" },
          { src: pic, sizes: "256x256", type: "image/jpeg" },
          { src: pic, sizes: "128x128", type: "image/jpeg" },
        ]
      : [];
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: a.name || "未知曲目",
        artist: a.artist || "Laosia 音乐馆",
        album: "Laosia 音乐馆",
        artwork: artwork,
      });
    } catch (e) {}
  }

  function paintState(ap) {
    try {
      navigator.mediaSession.playbackState =
        ap && ap.audio && !ap.audio.paused ? "playing" : "paused";
    } catch (e) {}
  }

  function position(ap, force) {
    if (!ap || !ap.audio || !ap.audio.duration || !isFinite(ap.audio.duration)) return;
    var now = Date.now();
    if (!force && now - lastPos < 900) return;
    lastPos = now;
    try {
      navigator.mediaSession.setPositionState({
        duration: ap.audio.duration,
        playbackRate: ap.audio.playbackRate || 1,
        position: Math.min(ap.audio.currentTime, ap.audio.duration),
      });
    } catch (e) {}
  }

  /* 只有“正在出声”的那个实例才会改锁屏内容；
     但 iOS 有时在 play 的瞬间 readyState/currentTime 还没就绪，sounding() 会返回 null，
     这时退回到 active（最近真正播放过的实例），否则锁屏会退回显示网页标题。 */
  function sync(force) {
    var ap = sounding() || active;
    if (!ap) return;              // 从来没播过 → 保持锁屏现状，不抢
    if (sounding()) active = ap;
    paintMeta(ap);
    paintState(ap);
    position(ap, !!force);
    bindHandlers();
  }

  function bindHandlers() {
    if (handlersBound) return;
    handlersBound = true;
    try {
      navigator.mediaSession.setActionHandler("play", function () {
        var a = active; if (a) a.play();
      });
      navigator.mediaSession.setActionHandler("pause", function () {
        var a = active; if (a) a.pause();
      });
      navigator.mediaSession.setActionHandler("previoustrack", function () {
        var a = active; if (a) a.skipBack();
      });
      navigator.mediaSession.setActionHandler("nexttrack", function () {
        var a = active; if (a) a.skipForward();
      });
      navigator.mediaSession.setActionHandler("seekto", function (d) {
        var a = active;
        if (a && d && typeof d.seekTime === "number") a.seek(d.seekTime);
      });
      navigator.mediaSession.setActionHandler("seekbackward", function () {
        var a = active;
        if (a && a.audio) a.seek(Math.max(0, a.audio.currentTime - 10));
      });
      navigator.mediaSession.setActionHandler("seekforward", function () {
        var a = active;
        if (a && a.audio) a.seek(Math.min(a.audio.duration || 0, a.audio.currentTime + 10));
      });
    } catch (e) {}
  }

  function attach(ap) {
    if (!ap || !ap.list || ap.__ms3) return;
    ap.__ms3 = true;
    players.push(ap);

    if (ap.audio) {
      ap.audio.addEventListener("play", function () {
        active = ap;
        // 等一拍，等 APlayer 把 index / src 切好
        setTimeout(function () { sync(true); }, 120);
      }, { passive: true });
      ap.audio.addEventListener("playing", function () { setTimeout(function () { sync(true); }, 60); }, { passive: true });
      ap.audio.addEventListener("pause", function () {
        if (active === ap) paintState(ap);   // 只改状态，不动标题
      }, { passive: true });
      ap.audio.addEventListener("loadedmetadata", function () { if (!ap.audio.paused) sync(true); }, { passive: true });
      ap.audio.addEventListener("timeupdate", function () {
        if (active === ap && !ap.audio.paused) position(ap, false);
      }, { passive: true });
    }

    ["listswitch", "ended"].forEach(function (ev) {
      try {
        ap.on(ev, function () {
          if (!ap.audio || ap.audio.paused) return;  // 没在放就不抢锁屏
          active = ap;
          setTimeout(function () { sync(true); }, 150);
        });
      } catch (e) {}
    });
  }

  function scan() {
    var found = [];
    if (window.aplayers && window.aplayers.length) {
      for (var i = 0; i < window.aplayers.length; i++) found.push(window.aplayers[i]);
    }
    document.querySelectorAll("meting-js").forEach(function (m) {
      if (m.aplayer && found.indexOf(m.aplayer) === -1) found.push(m.aplayer);
    });
    for (var j = 0; j < found.length; j++) {
      var p = found[j];
      if (p && p.list && (p.list.audios || []).length) attach(p);
    }
    return players.length > 0;
  }

  /* 看门狗：只有正在出声时才校准，避免暂停的实例把锁屏改掉 */
  function watchdog() {
    var ap = sounding();
    if (ap) {
      var a = trackOf(ap);
      var md = navigator.mediaSession.metadata;
      if (!md || md.title !== (a.name || "") || md.artist !== (a.artist || "")) {
        active = ap;
        paintMeta(ap);
        paintState(ap);
      }
      return;
    }
    // 没有实例在放，但锁屏信息整个丢了（iOS 常见）→ 用最近播放过的实例补回去
    if (!navigator.mediaSession.metadata && active && active.list) {
      paintMeta(active);
      try { navigator.mediaSession.playbackState = "paused"; } catch (e) {}
    }
  }

  function boot() {
    scan();
    var n = 0;
    var t = setInterval(function () { n++; if (scan() || n > 40) clearInterval(t); }, 400);
    if (!window.__ms3Watch) window.__ms3Watch = setInterval(watchdog, 2000);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") setTimeout(function () { sync(false); }, 300);
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  document.addEventListener("pjax:complete", function () { setTimeout(boot, 400); });
})();
