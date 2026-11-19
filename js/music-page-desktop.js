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

  /* ---------- 右上角：歌手 - 歌名 + 下载 ---------- */
  function paintTopMeta(ap) {
    var el = document.querySelector(".md-songmeta");
    if (!el) {
      el = document.createElement("div");
      el.className = "md-songmeta";
      el.innerHTML = '<div class="md-sm-title"></div><a class="md-download" rel="noopener">下载这首歌</a>';
      document.body.appendChild(el);
    }
    // 贴着封面右侧放（封面现在是居中的），这样整体视觉重心在屏幕中间
    try {
      var pic = document.querySelector("#anMusic-page .aplayer-pic");
      if (pic) {
        var r = pic.getBoundingClientRect();
        if (r.width) {
          el.style.left = Math.round(r.right + 30) + "px";
          el.style.top = Math.round(r.top + 12) + "px";
          // 「封面 + 右侧文字」整组居中：封面左移半个文字块宽度
          var mw = el.getBoundingClientRect().width || 0;
          pic.style.setProperty("margin-left", mw ? Math.round(-(mw + 30) / 2) + "px" : "0px", "important");
        }
      }
    } catch (e) {}

    var a = curAudio(ap);
    var t = el.querySelector(".md-sm-title");
    if (t) t.textContent = (a.artist ? a.artist + " - " : "") + (a.name || "");
    var dl = el.querySelector(".md-download");
    var href = downloadHref(ap);
    if (dl && href) {
      dl.href = href;
      dl.setAttribute("download", (a.name || "song") + ".mp3");
    }
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
      mode.title = MODES[modeIdx()];
      mode.classList.toggle("is-on", modeIdx() !== 0);
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
      if (href) {
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
    if (!bodyEl || !lrc) return;
    if (lrc.parentElement !== bodyEl) bodyEl.appendChild(lrc);
    ["left", "top", "width", "height"].forEach(function (p) {
      lrc.style.removeProperty(p);
    });
  }

  function tick() {
    if (!isDesktop()) return;
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

  var n = 0;
  var t = setInterval(function () {
    n++;
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
