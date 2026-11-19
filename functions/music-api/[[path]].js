/**
 * 音频地址解析器（Cloudflare Pages Function 版）
 *
 * 为什么要有这个：原来的解析器部署在 *.workers.dev 上，那个域名在国内基本被墙，
 * 不加代理时播放器拿不到音频地址 —— 但博客本身（blog.521251.xyz，Cloudflare Pages）
 * 国内是能直连的。所以把同一套逻辑放进 Pages Function，跟着站点一起发布：
 *
 *   GET https://blog.521251.xyz/music-api/play?sid=<歌曲id>          → 302 到音频直链
 *   GET https://blog.521251.xyz/music-api/play?sid=<id>&type=lyric  → 返回 LRC 文本
 *   GET https://blog.521251.xyz/music-api/play?sid=<id>&type=pic    → 302 到封面图
 *   GET https://blog.521251.xyz/music-api/health                    → 健康检查
 *
 * NetEase 免费接口对 VIP/版权曲只给 30 秒试听，GD Studio 的接口能拿整首，
 * 但它给的是带时间戳、几十分钟就过期的直链，所以每次播放都现取一次。
 */

const GD = "https://music-api.gdstudio.xyz/api.php";
// 备用「取链」服务：GD Studio 从 Cloudflare 出口会间歇性 520，需要有降级方案
const MIRRORS = ["https://api.qijieya.cn/meting/", "https://api.injahow.cn/meting/"];
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36";
const hdrs = { "User-Agent": UA, Referer: "https://music.gdstudio.xyz/" };

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,HEAD,OPTIONS",
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...CORS,
    },
  });
}

async function resolveNetease(sid, brList) {
  for (const br of brList) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(
          `${GD}?types=url&source=netease&id=${encodeURIComponent(sid)}&br=${br}`,
          {
            headers: hdrs,
            cf: { cacheTtl: 0 },
          }
        );
        if (!r.ok) continue;
        const j = await r.json();
        const url = Array.isArray(j.url) ? j.url[0] : j.url;
        if (url) return { url, br: j.br || br, size: j.size || 0, provider: "gdstudio" };
      } catch (e) {
        /* 换个码率或重试 */
      }
    }
  }
  return null;
}

/** 取一个 3xx 的 Location（不跟随），失败返回 null */
async function locationOf(url) {
  try {
    const r = await fetch(url, { headers: hdrs, redirect: "manual", cf: { cacheTtl: 0 } });
    const loc = r.headers.get("location");
    if (loc && /^https?:/i.test(loc)) return loc;
  } catch (e) {
    /* ignore */
  }
  return null;
}

/** HEAD 一下真实音频，判断是不是 30 秒试听（试听约 480KB，整首通常 >1MB） */
async function looksLikeFullTrack(url) {
  try {
    const r = await fetch(url, { method: "HEAD", headers: hdrs, cf: { cacheTtl: 0 } });
    const len = parseInt(r.headers.get("content-length") || "0", 10);
    if (!len) return true; // 拿不到长度就不下结论
    return len > 700000;
  } catch (e) {
    return true;
  }
}

async function fromMirrors(sid, allowTrial) {
  let trial = null;
  for (const base of MIRRORS) {
    const loc = await locationOf(`${base}?type=url&id=${encodeURIComponent(sid)}`);
    if (!loc) continue;
    const full = await looksLikeFullTrack(loc);
    if (full) return { url: loc, provider: new URL(base).hostname, trial: false };
    if (!trial) trial = { url: loc, provider: new URL(base).hostname, trial: true };
  }
  return allowTrial ? trial : null;
}

/** 多上游降级：GD Studio → 镜像站（整首）→ 镜像站（试听兜底） */
async function resolveAudio(sid, brList) {
  const gd = await resolveNetease(sid, brList);
  if (gd) return gd;
  const full = await fromMirrors(sid, false);
  if (full) return full;
  return await fromMirrors(sid, true);
}

async function resolveLyric(sid) {
  try {
    const r = await fetch(`${GD}?types=lyric&source=netease&id=${encodeURIComponent(sid)}`, {
      headers: hdrs,
      cf: { cacheTtl: 0 },
    });
    if (r.ok) {
      const j = await r.json();
      const lrc = Array.isArray(j.lyric) ? j.lyric[0] : j.lyric || j.lrc;
      if (lrc) return lrc;
    }
  } catch (e) {
    /* 走镜像 */
  }
  for (const base of MIRRORS) {
    try {
      const r = await fetch(`${base}?type=lrc&id=${encodeURIComponent(sid)}`, {
        headers: hdrs,
        cf: { cacheTtl: 0 },
      });
      if (!r.ok) continue;
      const t = await r.text();
      if (t && t.includes("[") && t.length > 30) return t;
    } catch (e) {
      /* next */
    }
  }
  return null;
}

async function resolvePic(sid) {
  try {
    const r = await fetch(`${GD}?types=pic&source=netease&id=${encodeURIComponent(sid)}`, {
      headers: hdrs,
      cf: { cacheTtl: 0 },
    });
    if (r.ok) {
      const j = await r.json();
      const pic = Array.isArray(j.url) ? j.url[0] : j.url;
      if (pic) return pic;
    }
  } catch (e) {
    /* 走镜像 */
  }
  for (const base of MIRRORS) {
    const loc = await locationOf(`${base}?type=pic&id=${encodeURIComponent(sid)}`);
    if (loc) return loc;
  }
  return null;
}

/* ---------- 曲目资料（歌手 / 专辑 / 发行时间 / 专辑内曲目） ---------- */
const NE = "https://music.163.com";

function neHeaders() {
  return { "User-Agent": UA, Referer: "https://music.163.com/", Cookie: "appver=2.0.2" };
}

async function neJson(url) {
  try {
    const r = await fetch(url, { headers: neHeaders(), cf: { cacheTtl: 3600 } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

async function songInfo(sid) {
  const detail = await neJson(`${NE}/api/song/detail/?id=${sid}&ids=%5B${sid}%5D`);
  const song = detail && detail.songs && detail.songs[0];
  if (!song) return null;

  const album = song.album || {};
  const artists = (song.artists || []).map((a) => ({ id: a.id, name: a.name }));

  let artistInfo = null;
  if (artists[0]) {
    const ar = await neJson(`${NE}/api/artist/${artists[0].id}`);
    const a = ar && ar.artist;
    if (a) {
      artistInfo = {
        id: a.id,
        name: a.name,
        alias: a.alias || [],
        picUrl: a.picUrl || a.img1v1Url || "",
        briefDesc: a.briefDesc || "",
        albumSize: a.albumSize || 0,
        musicSize: a.musicSize || 0,
      };
    }
  }

  let albumSongs = [];
  let albumExtra = {};
  if (album.id) {
    const al = await neJson(`${NE}/api/v1/album/${album.id}`);
    if (al) {
      albumExtra = al.album || {};
      albumSongs = (al.songs || []).map((s) => ({
        id: s.id,
        name: s.name,
        artist: ((s.ar || [])[0] || {}).name || "",
        no: s.no || 0,
        duration: s.dt || 0,
      }));
    }
  }

  return {
    ok: true,
    song: { id: song.id, name: song.name, alias: song.alias || [], duration: song.duration || 0 },
    artists: artists.map((a) => (artistInfo && a.id === artistInfo.id ? { ...a, ...artistInfo } : a)),
    album: {
      id: album.id || 0,
      name: album.name || "",
      picUrl: album.picUrl || "",
      publishTime: album.publishTime || albumExtra.publishTime || 0,
      company: album.company || albumExtra.company || "",
      description: album.description || albumExtra.description || "",
      size: album.size || albumSongs.length,
      songs: albumSongs,
    },
  };
}

async function handle(request) {
  const u = new URL(request.url);
  // 兼容 /music-api/play 与 /music/api/play 两种前缀
  const path = u.pathname.replace(/^\/(music-api|music\/api)(?=\/|$)/, "") || "/";

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (path === "/play" || path === "/url") {
    const sid = (u.searchParams.get("sid") || u.searchParams.get("id") || "").trim();
    if (!sid || !/^\d+$/.test(sid)) return json({ ok: false, error: "need numeric sid" }, 400);

    const kind = (u.searchParams.get("type") || "url").toLowerCase();

    // 曲目资料：歌手 / 专辑 / 发行时间 / 专辑内曲目（国内直连，走本站域名）
    if (kind === "info") {
      const cacheKey = new Request(`https://blog.521251.xyz/music-api/_info?sid=${sid}`, { method: "GET" });
      const cache = caches.default;
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
      const info = await songInfo(sid);
      if (!info) return json({ ok: false, error: "no info", sid }, 404);
      const res = new Response(JSON.stringify(info), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=86400",
          ...CORS,
        },
      });
      await cache.put(cacheKey, res.clone());
      return res;
    }

    if (kind === "pic") {
      const pic = await resolvePic(sid);
      if (!pic) return json({ ok: false, error: "no pic", sid }, 404);
      return new Response(null, {
        status: 302,
        headers: { location: pic, "cache-control": "public, max-age=86400", ...CORS },
      });
    }

    if (kind === "lyric" || kind === "lrc") {
      const lrc = await resolveLyric(sid);
      if (!lrc) return json({ ok: false, error: "no lyric", sid }, 404);
      return new Response(lrc, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=86400",
          ...CORS,
        },
      });
    }

    const br = u.searchParams.get("br");
    const brList = br ? [br, "320", "192", "128"] : ["320", "192", "128"];

    // 解析结果缓存 5 分钟：上游对同一出口 IP 有频率限制，重复播放/多人同时听时
    // 打满就会 404，缓存一下既快又稳。
    const cacheKey = new Request(`https://blog.521251.xyz/music-api/_resolved?sid=${sid}`, {
      method: "GET",
    });
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) {
      const loc = await hit.text();
      if (loc) {
        return new Response(null, {
          status: 302,
          headers: { location: loc, "cache-control": "no-store", ...CORS },
        });
      }
    }

    const got = await resolveAudio(sid, [...new Set(brList)]);
    if (!got) return json({ ok: false, error: "unavailable", sid }, 404);

    await cache.put(
      cacheKey,
      new Response(got.url, {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "max-age=300" },
      })
    );

    return new Response(null, {
      status: 302,
      headers: { location: got.url, "cache-control": "no-store", ...CORS },
    });
  }

  if (path === "/" || path === "/health") {
    return json({
      ok: true,
      service: "meting-play (pages function)",
      usage: "/play?sid=<netease id>[&type=url|pic|lyric]",
    });
  }

  if (path === "/resolve") {
    const sid = u.searchParams.get("sid") || "";
    if (!/^\d+$/.test(sid)) return json({ ok: false, error: "need numeric sid" }, 400);
    const got = await resolveAudio(sid, ["320", "192", "128"]);
    return json(got ? { ok: true, ...got } : { ok: false, sid }, got ? 200 : 404);
  }

  // 诊断用：把上游的原始响应暴露出来，排查"整库 404"这类问题
  if (path === "/debug") {
    const sid = (u.searchParams.get("sid") || "190449").trim();
    const out = { sid, colo: request.cf && request.cf.colo, tries: [] };
    for (const [label, url] of [
      ["gdstudio", `${GD}?types=url&source=netease&id=${encodeURIComponent(sid)}&br=320`],
      ["injahow", `https://api.injahow.cn/meting/?type=url&id=${encodeURIComponent(sid)}`],
      ["qijieya", `https://api.qijieya.cn/meting/?type=url&id=${encodeURIComponent(sid)}`],
    ]) {
      try {
        const r = await fetch(url, {
          headers: { "User-Agent": UA, Referer: "https://music.gdstudio.xyz/" },
          cf: { cacheTtl: 0 },
          redirect: "manual",
        });
        let body = "";
        try {
          body = (await r.text()).slice(0, 200);
        } catch (e) {
          body = "(no text body)";
        }
        out.tries.push({
          label,
          status: r.status,
          ct: r.headers.get("content-type"),
          location: r.headers.get("location"),
          clen: r.headers.get("content-length"),
          body,
        });
      } catch (e) {
        out.tries.push({ label, error: String(e).slice(0, 160) });
      }
    }
    return json(out);
  }

  return json({ ok: false, error: "not found" }, 404);
}

export async function onRequest(context) {
  return handle(context.request);
}
