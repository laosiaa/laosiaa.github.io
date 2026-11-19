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
