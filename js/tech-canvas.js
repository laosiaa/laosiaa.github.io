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

  function injectCopy() {
    var host = document.getElementById("random-banner");
    if (!host || host.querySelector(".hero-copy")) return;

    var wrap = document.createElement("div");
    wrap.className = "hero-copy";
    wrap.innerHTML =
      '<div class="hero-eyebrow"><span class="hero-dot"></span>您好 ✦ 欢迎来到 Laosia 的小站</div>' +
      '<h1 class="hero-title">把踩过的坑<br>写成<em>能直接用</em>的东西</h1>' +
      '<p class="hero-sub">污水处理设备调试 · Proxmox 虚拟化 · 自建服务与折腾记录<br>热爱你来过的每次停留</p>' +
      '<div class="hero-actions">' +
        '<a class="hero-btn hero-btn--primary" href="/archives/">开始浏览</a>' +
        '<a class="hero-btn hero-btn--ghost" href="/about/">关于我</a>' +
      "</div>";
    host.appendChild(wrap);
  }

  function init() {
    var cv = document.getElementById("peoplecanvas");
    if (cv) start(cv);
    injectCopy();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  document.addEventListener("pjax:complete", init);
})();
