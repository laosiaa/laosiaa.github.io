/*! 音乐馆：点封面弹出「歌曲资料」——简介 / 歌手 / 发行时间 / 专辑 / 专辑内曲目 */
(function () {
  "use strict";

  var API = "https://meting-play.laosi-see.workers.dev/play";
  var cache = {};
  var panel = null;
  var lastKey = "";

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
      '<div class="mm-info-cover" style="background-image:url(\'' + esc(al.picUrl || cur.pic || "").replace(/'/g, "%27") + '\')"></div>' +
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

    var descHtml = '<p class="mm-info-desc">' + esc(desc || "这张专辑暂无官方简介。") + "</p>";

    var songsHtml = songs.length
      ? '<ul class="mm-info-songs">' +
        songs
          .map(function (x, i) {
            var isCur = x.name === curName;
            return (
              '<li class="' + (isCur ? "is-cur" : "") + '" data-id="' + esc(x.id) + '" data-name="' + esc(x.name) + '">' +
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

    // 点专辑内曲目：在歌单里能找到就切过去
    panel.querySelectorAll(".mm-info-songs li").forEach(function (li) {
      li.addEventListener("click", function () {
        var name = li.getAttribute("data-name");
        var audios = (ap.list && ap.list.audios) || [];
        for (var i = 0; i < audios.length; i++) {
          if (audios[i] && audios[i].name === name) {
            ap.list.switch(i);
            close();
            return;
          }
        }
        li.classList.add("mm-info-none");
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
    fetch(API + "?sid=" + sid + "&type=info")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) throw new Error("no data");
        cache[sid] = d;
        if (panel) render(d, getAplayer() || ap);
      })
      .catch(function () {
        if (panel) panel.querySelector(".mm-info-body").innerHTML = '<div class="mm-info-loading">资料读取失败，稍后再试。</div>';
      });
  }

  window.addEventListener("mm:songinfo", open, false);
})();
