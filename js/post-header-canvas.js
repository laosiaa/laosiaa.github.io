/*! 文章页页头：动感科技背景（电路网格 + 流动光点 + 扫描光带） */
(function () {
  "use strict";

  var PATH = [[0.02, 0.70], [0.18, 0.70], [0.26, 0.42], [0.44, 0.42],
              [0.50, 0.66], [0.68, 0.66], [0.78, 0.32], [1.0, 0.32]];
  var COL = "120, 210, 255";

  function lerp(p, t) {
    var segs = [], total = 0, i, dx, dy, d;
    for (i = 0; i < p.length - 1; i++) {
      dx = p[i + 1][0] - p[i][0];
      dy = p[i + 1][1] - p[i][1];
      d = Math.sqrt(dx * dx + dy * dy);
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
    var raf;

    function draw(now) {
      var t = (now - t0) / 1000, x, y, i;
      ctx.clearRect(0, 0, W, H);

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(" + COL + ",0.08)";
      var step = 28;
      for (x = 0; x <= W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (y = 0; y <= H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      var sx = ((t * 0.20) % 1.35 - 0.18) * W;
      var g = ctx.createLinearGradient(sx - 60, 0, sx + 60, 0);
      g.addColorStop(0, "rgba(" + COL + ",0)");
      g.addColorStop(0.5, "rgba(" + COL + ",0.16)");
      g.addColorStop(1, "rgba(" + COL + ",0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx - 60, 0, 120, H);

      ctx.beginPath();
      PATH.forEach(function (pt, k) {
        var px = pt[0] * W, py = pt[1] * H;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.strokeStyle = "rgba(" + COL + ",0.38)";
      ctx.lineWidth = 1.3;
      ctx.stroke();

      PATH.forEach(function (pt) {
        ctx.beginPath();
        ctx.arc(pt[0] * W, pt[1] * H, 2, 0, 6.2832);
        ctx.fillStyle = "rgba(" + COL + ",0.65)";
        ctx.fill();
      });

      for (i = 0; i < 3; i++) {
        var p = lerp(PATH, t * 0.15 + i / 3);
        var cx = p[0] * W, cy = p[1] * H;
        var rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
        rg.addColorStop(0, "rgba(230,248,255,0.9)");
        rg.addColorStop(0.35, "rgba(" + COL + ",0.5)");
        rg.addColorStop(1, "rgba(" + COL + ",0)");
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(cx, cy, 12, 0, 6.2832); ctx.fill();
      }

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
