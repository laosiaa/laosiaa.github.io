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

  document.addEventListener(
    "click",
    function (e) {
      var nm = document.getElementById("nav-music");
      if (!nm || !nm.contains(e.target)) return;
      // 真正的播放器控件（进度条、音量、上一首/下一首、列表、歌词）交给 APlayer 自己处理
      if (
        e.target.closest(
          ".aplayer-bar-wrap, .aplayer-icon, .aplayer-list, .aplayer-lrc, .aplayer-time, .aplayer-volume-wrap, .aplayer-thumb"
        )
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      toggle();
    },
    true
  );

  // 外部（键盘 M、右键菜单、控制台按钮）调用主题的 musicToggle 时，保证图标/类名跟音频状态一致
  document.addEventListener("visibilitychange", function () {
    var ap = getAp();
    if (ap && ap.audio) sync(!ap.audio.paused);
  });
})();
