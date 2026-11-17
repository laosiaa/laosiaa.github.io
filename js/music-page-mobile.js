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
  function maskEl() { return document.getElementById("menu-mask"); }

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

    function idx() {
      var m = String(ap.mode || "");
      if (m === "random") return 1;
      if (m === "single") return 2;
      return 0;
    }
    function paint() {
      var i = idx();
      btn.className = "aplayer-icon mm-mode mm-mode-" + MODES[i].key;
      btn.setAttribute("title", MODES[i].label);
      btn.setAttribute("aria-label", MODES[i].label);
    }
    btn.addEventListener("click", function () {
      var next = MODES[(idx() + 1) % MODES.length];
      try { ap.mode = next.id; } catch (e) {}
      paint();
    });
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
      h.parentNode.insertBefore(box, h.nextSibling);

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
    if (m) {
      m.style.display = "block";
      m.style.animation = "0.5s ease 0s 1 normal none running to_show";
    }
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
    if (m) { m.style.display = "none"; m.style.animation = ""; }
    var open = document.querySelector("#anMusic-page .mm-vol.mm-open");
    if (open) open.classList.remove("mm-open");
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

  /* 点遮罩关闭曲库后，主题不会把遮罩收起来，这里补一刀 */
  document.addEventListener("click", function (e) {
    var m = maskEl();
    if (!m || e.target !== m) return;
    setTimeout(function () {
      var l = listEl();
      if (l && !l.classList.contains("aplayer-list-hide")) {
        m.style.display = "none";
        m.style.animation = "";
      }
    }, 60);
  }, true);

  /* ---------- 启动 ---------- */
  function tick() {
    var ok = restructure();
    ok = fixList() && ok;
    ensureBottom();
    return ok;
  }
  function boot() {
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
