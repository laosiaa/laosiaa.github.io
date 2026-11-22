/*! 左下角悬浮播放器：保证点哪儿都能播放/暂停
 *  主题只在 <a id="nav-music-hoverTips"> 上绑了 onclick，一旦 APlayer 的 UI 盖住它
 *  （悬浮器展开/封面或歌名区域），点击就落空 —— 表现为「能播放、不能暂停」。
 *  这里在捕获阶段接管：#nav-music 内除真正的播放器控件外，点任何地方都切换播放状态。
 */
(function () {
  "use strict";

  function getAp() {
    var host = document.querySelector("#nav-music meting-js");
    return host && host.aplayer ? host.aplayer : null;
  }

  function sync(on) {
    var nm = document.getElementById("nav-music");
    if (!nm) return;
    nm.classList.toggle("playing", on);
    nm.classList.toggle("stretch", on);
    try {
      window.anzhiyu_musicPlaying = on;
      var menuBtn = document.getElementById("menu-music-toggle");
      if (menuBtn) {
        menuBtn.innerHTML = on
          ? '<i class="anzhiyufont anzhiyu-icon-pause"></i><span>暂停音乐</span>'
          : '<i class="anzhiyufont anzhiyu-icon-play"></i><span>播放音乐</span>';
      }
      var tips = document.getElementById("nav-music-hoverTips");
      if (tips && !on) tips.innerHTML = "音乐已暂停";
      var consoleEl = document.getElementById("consoleMusic");
      if (consoleEl) consoleEl.classList.toggle("on", on);
    } catch (e) {}
  }

  function toggle() {
    var ap = getAp();
    if (!ap || !ap.audio) return;
    if (ap.audio.paused) {
      ap.play();
      sync(true);
    } else {
      ap.pause();
      sync(false);
    }
  }

  // 真正的播放器控件（进度条 / 音量 / 上下曲 / 列表 / 歌词 / 提示条）交给 APlayer 自己处理
  var CONTROL =
    ".aplayer-bar-wrap, .aplayer-icon, .aplayer-list, .aplayer-lrc, .aplayer-time, .aplayer-volume-wrap, .aplayer-thumb, .aplayer-notice";

  // 用坐标命中而不是 e.target：某些状态下图层 pointer-events:none，target 会变成 <body>
  function hitWidget(e) {
    var nm = document.getElementById("nav-music");
    if (!nm) return false;
    var b = nm.getBoundingClientRect();
    if (!b.width || !b.height) return false;
    return (
      e.clientX >= b.left - 4 &&
      e.clientX <= b.right + 4 &&
      e.clientY >= b.top - 4 &&
      e.clientY <= b.bottom + 4
    );
  }

  function isControl(t) {
    return !!(t && t.closest && t.closest(CONTROL));
  }

  // 随机切一首（尽量避开当前这首）
  function randomSong() {
    var ap = getAp();
    if (!ap || !ap.list || !ap.list.audios || !ap.list.audios.length) return;
    var n = ap.list.audios.length;
    var cur = ap.list.index;
    var idx = cur;
    if (n > 1) {
      do {
        idx = Math.floor(Math.random() * n);
      } while (idx === cur);
    }
    try {
      ap.list.switch(idx);
    } catch (e) {}
    try {
      var p = ap.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
    sync(true);
  }

  /* 单击 = 播放/暂停，双击 = 随机换一首。
     pointerup 与 click 是同一手势（相隔 ~1ms），100ms 内只算一次；
     单击动作延迟 280ms 执行，等第二击；300ms 内来第二击就当双击。 */
  var lastEvt = 0;
  var pending = null;

  function handle(e) {
    if (!hitWidget(e) || isControl(e.target)) return;
    // 一律拦截：否则主题那个 <a> 上的 onclick 会再切一次，等于没切
    e.preventDefault();
    e.stopPropagation();
    var now = Date.now();
    if (now - lastEvt < 100) return; // pointerup + click 同一次手势
    lastEvt = now;

    if (pending) {
      clearTimeout(pending);
      pending = null;
      randomSong();
      return;
    }
    pending = setTimeout(function () {
      pending = null;
      toggle();
    }, 280);
  }

  document.addEventListener("click", handle, true);
  // 兜底：个别情况下 click 会被吞（pointer-events 切换 / 拖拽结束）
  document.addEventListener("pointerup", handle, true);

  // 外部（键盘 M、右键菜单、控制台按钮）调用主题的 musicToggle 时，保证图标/类名跟音频状态一致
  document.addEventListener("visibilitychange", function () {
    var ap = getAp();
    if (ap && ap.audio) sync(!ap.audio.paused);
  });
})();
