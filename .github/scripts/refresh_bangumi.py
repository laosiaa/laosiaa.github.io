#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""GitHub Actions 版追番数据抓取：只写三个 JSON，不碰 hexo。

输出（默认 ./bangumis）：
  data.json       我的追番（想看/在看/已看），B 站公开接口
  recommend.json  好番推荐：国创评分 >= 8.0 的前 50 部
  hongguo.json    红果漫剧榜按「热度+收藏+点赞+分享」排序前 100 部

用法：python refresh_bangumi.py --out bangumis [--vmid 286920626]
接口全部免登录；任何一路失败都不影响其他路，且不覆盖已有文件（宁可留旧数据）。
"""
import argparse
import json
import os
import re
import sys
import time

import requests

BS = chr(92)
UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": "https://www.bilibili.com/",
}
STATUS = {"wantWatch": 1, "watching": 2, "watched": 3}


def fmt(n):
    """2260197799 -> 22.6亿 ; 7262590 -> 726万"""
    if not isinstance(n, (int, float)) or n <= 0:
        return "-"
    if n >= 1e8:
        v = f"{n / 1e8:.1f}亿"
    elif n >= 1e4:
        v = f"{n / 1e4:.0f}万"
    else:
        return str(int(n))
    return v.replace(".0亿", "亿").replace(".0万", "万")


def write_json(path, data):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2 if path.endswith("data.json") else 1)
    os.replace(tmp, path)
    print(f"写入 {path}: {len(data) if isinstance(data, list) else sum(len(v) for v in data.values())} 条")


# ---------------- 我的追番 ----------------
def fetch_follow(vmid, status, headers):
    url = ("https://api.bilibili.com/x/space/bangumi/follow/list"
           f"?type=1&follow_status={status}&pn=1&ps=30&vmid={vmid}")
    r = requests.get(url, headers=headers, timeout=25)
    j = r.json()
    if j.get("code") != 0:
        print(f"  ! status={status} code={j.get('code')} msg={j.get('message')}", file=sys.stderr)
        return [], 0
    d = j.get("data") or {}
    return d.get("list") or [], d.get("total") or 0


def build_item(b):
    st = b.get("stat") or {}
    rt = b.get("rating") or {}
    ep = b.get("new_ep") or {}
    areas = "、".join(a.get("name", "") for a in (b.get("areas") or []) if a.get("name"))
    des = (b.get("evaluate") or b.get("summary") or "").replace("\n", " ").strip()
    sid = b.get("season_id")
    return {
        "title": b.get("title") or "",
        "cover": (b.get("cover") or "").replace("http://", "https://"),
        "link": f"https://www.bilibili.com/bangumi/play/ss{sid}" if sid else
                f"https://www.bilibili.com/bangumi/media/md{b.get('media_id')}/",
        "id": b.get("media_id"),
        "type": b.get("season_type_name") or "",
        "area": areas or "-",
        "ep_status": ep.get("index_show") or "",
        "new_ep": "",
        "progress": False,
        "score": rt.get("score") if rt.get("score") else "-",
        "view": fmt(st.get("view")),
        "follow": fmt(st.get("follow")),
        "coin": fmt(st.get("coin")),
        "danmaku": fmt(st.get("danmaku")),
        "totalCount": b.get("total_count") or 0,
        "des": des,
    }


def gen_follow(vmid):
    headers = dict(UA, Referer=f"https://space.bilibili.com/{vmid}")
    out = {}
    for key, st in STATUS.items():
        lst, total = fetch_follow(vmid, st, headers)
        out[key] = [build_item(b) for b in lst]
        print(f"{key}: 接口 total={total} 生成 {len(out[key])} 条")
    return out


# ---------------- 好番推荐 ----------------
def fetch_pgc_page(page, pagesize=30):
    params = {
        "season_type": 4, "order": 3, "sort": 0, "page": page, "pagesize": pagesize,
        "type": 1, "area": -1, "style": -1, "season_version": -1,
        "spoken_language_type": -1, "is_finish": -1, "copyright": -1,
        "season_status": -1, "season_month": -1, "year": -1,
        "without_any": 1, "day": -1, "platform": "web",
    }
    r = requests.get("https://api.bilibili.com/pgc/season/index/result",
                     params=params, headers=UA, timeout=30)
    r.raise_for_status()
    return (r.json().get("data") or {}).get("list") or []


def gen_recommend(want=50, min_score=8.0, max_pages=12):
    out, seen, page = [], set(), 1
    while len(out) < want and page <= max_pages:
        try:
            lst = fetch_pgc_page(page)
        except Exception as e:
            print(f"! 推荐第 {page} 页失败 {type(e).__name__}", file=sys.stderr)
            page += 1
            continue
        for it in lst:
            title = (it.get("title") or "").strip()
            try:
                s = float(it.get("score") or "")
            except (TypeError, ValueError):
                continue
            if not title or title in seen or s < min_score:
                continue
            seen.add(title)
            out.append({
                "title": title,
                "cover": it.get("cover") or "",
                "link": it.get("link") or "",
                "score": it.get("score"),
                "ep_status": it.get("index_show") or "",
                "type": "国创",
                "area": "中国大陆",
            })
            if len(out) >= want:
                break
        page += 1
    out.sort(key=lambda x: float(x["score"]), reverse=True)
    print(f"推荐：{len(out)} 部，评分 {out[0]['score']} ~ {out[-1]['score']}" if out else "推荐：0 部")
    return out


# ---------------- 红果漫剧榜 ----------------
def extract_json(text, start):
    depth, instr, esc = 0, False, False
    for k in range(start, len(text)):
        ch = text[k]
        if instr:
            if esc:
                esc = False
            elif ch == BS:
                esc = True
            elif ch == '"':
                instr = False
        else:
            if ch == '"':
                instr = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start:k + 1]
    return None


def num(text):
    if not text:
        return 0
    m = re.search(r"([\d.]+)\s*(亿|万)?", text)
    if not m:
        return 0
    v = float(m.group(1))
    unit = m.group(2)
    if unit == "亿":
        v *= 100000000
    elif unit == "万":
        v *= 10000
    return int(v)


def fetch_hongguo(page):
    r = requests.get("https://hongguoduanju.com/rank/hot-comic-drama",
                     params={"page": page}, headers={"User-Agent": UA["User-Agent"],
                                                      "Accept-Language": "zh-CN,zh;q=0.9"},
                     timeout=45, allow_redirects=True)
    r.raise_for_status()
    s = r.text
    i = s.find('"rankList":[')
    if i < 0:
        return []
    raw = extract_json(s, s.rfind("{", 0, i))
    if not raw:
        return []
    out = []
    for it in (json.loads(raw).get("rankList") or []):
        heat, fav = num(it.get("heatText")), num(it.get("favoriteText"))
        like, share = num(it.get("likeText")), num(it.get("shareText"))
        out.append({
            "title": it.get("title") or "",
            "cover": it.get("cover") or "",
            "link": "https://hongguoduanju.com" + (it.get("href") or ""),
            "series_id": it.get("seriesId") or "",
            "ep_status": ("全 %d 集" % it["episodeCount"]) if it.get("episodeCount") else "",
            "score": (it.get("scoreText") or "").replace("分", ""),
            "heat": heat, "favorite": fav, "like": like, "share": share,
            "total": heat + fav + like + share,
            "heatText": it.get("heatText") or "",
            "favoriteText": it.get("favoriteText") or "",
            "likeText": it.get("likeText") or "",
            "tags": it.get("tags") or [],
            "des": (it.get("description") or "")[:120],
        })
    return out


SEASON_RE = re.compile(r"[（(]?第[0-9一二三四五六七八九十百千零两]+\s*(季|部|章|期|篇)[）)]?")


def base_title(t):
    return re.sub(r"\s+", "", SEASON_RE.sub("", t or "")).strip()


def gen_hongguo(want=100, max_pages=12):
    seen_id, best, order = set(), {}, []
    for p in range(1, max_pages + 1):
        try:
            items = fetch_hongguo(p)
        except Exception as e:
            # 超出末页时整页 404，正常结束
            if "404" in str(e):
                print(f"第 {p} 页 404，榜单到底了")
                break
            print(f"第 {p} 页失败: {e}")
            continue
        if not items:
            break
        for it in items:
            sid = it["series_id"] or it["title"]
            if not it["title"] or sid in seen_id:
                continue
            seen_id.add(sid)
            key = base_title(it["title"])
            if key not in best:
                best[key] = it
                order.append(key)
            elif it["total"] > best[key]["total"]:
                best[key] = it
        print(f"第 {p} 页: 累计同名 {len(best)}（原始 {len(seen_id)}）")
        if len(best) >= want:
            break
        time.sleep(0.6)
    rows = sorted((best[k] for k in order), key=lambda x: x["total"], reverse=True)[:want]
    if rows:
        print(f"红果：{len(rows)} 部，最高综合 {rows[0]['total']}，最低 {rows[-1]['total']}")
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="bangumis", help="输出目录（仓库里的 bangumis/）")
    ap.add_argument("--vmid", default="286920626")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    rc = 0
    try:
        follow = gen_follow(a.vmid)
        if sum(len(v) for v in follow.values()):
            write_json(os.path.join(a.out, "data.json"), follow)
        else:
            print("! 追番列表为空，保留旧文件", file=sys.stderr)
            rc = 1
    except Exception as e:
        print(f"! 追番抓取失败 {type(e).__name__}: {e}", file=sys.stderr)
        rc = 1

    try:
        rec = gen_recommend(50)
        if rec:
            write_json(os.path.join(a.out, "recommend.json"), rec)
        else:
            rc = 1
    except Exception as e:
        print(f"! 推荐抓取失败 {type(e).__name__}: {e}", file=sys.stderr)
        rc = 1

    try:
        hg = gen_hongguo(100, 12)
        if hg:
            write_json(os.path.join(a.out, "hongguo.json"), hg)
        else:
            rc = 1
    except Exception as e:
        print(f"! 红果抓取失败 {type(e).__name__}: {e}", file=sys.stderr)
        rc = 1

    print("完成" if rc == 0 else "部分失败（保留旧数据的文件未覆盖）")
    return rc


if __name__ == "__main__":
    sys.exit(main())
