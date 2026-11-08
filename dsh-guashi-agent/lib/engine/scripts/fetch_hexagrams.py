#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""抓取中文维基文库《周易》64 卦子页的**原始 wikitext**（繁体），分批查询。

用法：
  python fetch_hexagrams.py            # 抓取/续抓（已存在缓存自动跳过）
  python fetch_hexagrams.py --list     # 只列 周易 子页

要点：
  * action=query&prop=revisions&rvprop=content 支持一次 50 个标题，
    64 卦只需 2 个请求，远低于逐页 action=parse（会被 429 限流）。
  * 请求间隔 >= 3 秒（与项目其他成员共用出口 IP）。
  * 写入 lib/engine/scripts/.cache/wikitext/<序号>.txt，由 build_hexagrams.py 解析。
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = 'https://zh.wikisource.org/w/api.php'
UA = 'DSH-GuaShi-Engine/1.0 (local divination engine; python-urllib; contact: local)'
DELAY = 3.5
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.cache', 'wikitext')

# 六十四卦按通行本（王弼本）经序，繁体卦名（维基文库子页名）
NAMES = [
    '乾', '坤', '屯', '蒙', '需', '訟', '師', '比', '小畜', '履',
    '泰', '否', '同人', '大有', '謙', '豫', '隨', '蠱', '臨', '觀',
    '噬嗑', '賁', '剝', '復', '無妄', '大畜', '頤', '大過', '坎', '離',
    '咸', '恆', '遯', '大壯', '晉', '明夷', '家人', '睽', '蹇', '解',
    '損', '益', '夬', '姤', '萃', '升', '困', '井', '革', '鼎',
    '震', '艮', '漸', '歸妹', '豐', '旅', '巽', '兌', '渙', '節',
    '中孚', '小過', '既濟', '未濟',
]

_last = [0.0]


def log(msg):
    sys.stdout.write(str(msg) + '\n')
    sys.stdout.flush()


def api(params, retries=6):
    params = dict(params)
    params.setdefault('format', 'json')
    params.setdefault('formatversion', '2')
    url = API + '?' + urllib.parse.urlencode(params)
    for attempt in range(retries):
        wait = DELAY - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': UA,
                'Accept': 'application/json',
                'Accept-Language': 'zh-Hant,zh;q=0.9',
            })
            with urllib.request.urlopen(req, timeout=90) as resp:
                raw = resp.read()
            _last[0] = time.time()
            return json.loads(raw.decode('utf-8'))
        except urllib.error.HTTPError as exc:
            _last[0] = time.time()
            if exc.code == 404:
                return None
            if exc.code in (429, 503, 502):
                back = 30 * (attempt + 1)
                log('  [warn] HTTP %s，退避 %ss 后重试' % (exc.code, back))
                time.sleep(back)
                continue
            log('  [warn] HTTP %s，第 %s 次重试' % (exc.code, attempt + 1))
            time.sleep(10 * (attempt + 1))
        except Exception as exc:
            _last[0] = time.time()
            log('  [warn] %s，第 %s 次重试' % (exc, attempt + 1))
            time.sleep(10 * (attempt + 1))
    raise RuntimeError('请求失败：%s' % url)


def fetch_batch(titles):
    """一次查询多个页面的 wikitext，返回 {title: content}"""
    out = {}
    data = api({
        'action': 'query', 'prop': 'revisions', 'rvprop': 'content',
        'rvslots': 'main', 'titles': '|'.join(titles), 'redirects': '1',
    })
    if not data or 'query' not in data:
        return out
    for p in data['query']['pages']:
        if p.get('missing'):
            continue
        try:
            out[p['title']] = p['revisions'][0]['slots']['main']['content']
        except Exception:
            continue
    return out


def cmd_fetch():
    os.makedirs(CACHE, exist_ok=True)
    todo = []
    for i, name in enumerate(NAMES, 1):
        path = os.path.join(CACHE, '%02d.txt' % i)
        if not (os.path.exists(path) and os.path.getsize(path) > 200):
            todo.append((i, name, '周易/' + name))
    if not todo:
        log('全部已缓存，无需抓取。')
        return 0
    log('待抓取 %d 页，分 %d 批' % (len(todo), (len(todo) + 49) // 50))
    ok = fail = 0
    for start in range(0, len(todo), 50):
        chunk = todo[start:start + 50]
        titles = [t for _, _, t in chunk]
        got = fetch_batch(titles)
        for i, name, title in chunk:
            content = got.get(title)
            if not content:
                log('%02d %s  [缺页/无内容]' % (i, title))
                fail += 1
                continue
            with open(os.path.join(CACHE, '%02d.txt' % i), 'w', encoding='utf-8', newline='\n') as f:
                f.write(content)
            ok += 1
            log('%02d %s  ok  %d 字符' % (i, title, len(content)))
    log('完成：成功 %d，失败 %d' % (ok, fail))
    return 0 if fail == 0 else 1


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--list', action='store_true')
    args = ap.parse_args()
    sys.exit(cmd_fetch())
