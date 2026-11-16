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
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36";

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
            headers: { "User-Agent": UA, Referer: "https://music.gdstudio.xyz/" },
            cf: { cacheTtl: 0 },
          }
        );
        if (!r.ok) continue;
        const j = await r.json();
        const url = Array.isArray(j.url) ? j.url[0] : j.url;
        if (url) return { url, br: j.br || br, size: j.size || 0 };
      } catch (e) {
        /* 换个码率或重试 */
      }
    }
  }
  return null;
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

    if (kind === "pic") {
      const r = await fetch(`${GD}?types=pic&source=netease&id=${encodeURIComponent(sid)}`, {
        headers: { "User-Agent": UA, Referer: "https://music.gdstudio.xyz/" },
      });
      const j = r.ok ? await r.json() : null;
      const pic = j && (Array.isArray(j.url) ? j.url[0] : j.url);
      if (!pic) return json({ ok: false, error: "no pic", sid }, 404);
      return new Response(null, {
        status: 302,
        headers: { location: pic, "cache-control": "public, max-age=86400", ...CORS },
      });
    }

    if (kind === "lyric" || kind === "lrc") {
      const r = await fetch(`${GD}?types=lyric&source=netease&id=${encodeURIComponent(sid)}`, {
        headers: { "User-Agent": UA, Referer: "https://music.gdstudio.xyz/" },
      });
      const j = r.ok ? await r.json() : null;
      const lrc = j && (Array.isArray(j.lyric) ? j.lyric[0] : j.lyric || j.lrc);
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
    const got = await resolveNetease(sid, [...new Set(brList)]);
    if (!got) return json({ ok: false, error: "unavailable", sid }, 404);

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
    const got = await resolveNetease(sid, ["320", "192", "128"]);
    return json(got ? { ok: true, ...got } : { ok: false, sid }, got ? 200 : 404);
  }

  return json({ ok: false, error: "not found" }, 404);
}

export async function onRequest(context) {
  return handle(context.request);
}
