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
