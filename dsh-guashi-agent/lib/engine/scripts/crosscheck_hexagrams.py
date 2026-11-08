#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""交叉核对：先把早期逐页 action=parse 的 HTML 缓存（21 页）解析一遍，
与 data/hexagrams.json（由原始 wikitext 解析）逐字比对。

用法：python crosscheck_hexagrams.py
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
DATA = os.path.join(os.path.dirname(HERE), 'data', 'hexagrams.json')

YAO_RE = re.compile(r'^(初[六九]|[六九][二三四五]|上[六九]|用[六九])')


def html_lines(raw_html):
    from lxml import html as LH
    doc = LH.fromstring(raw_html)
    for el in list(doc.iter()):
        if not isinstance(el.tag, str):
            continue
        if el.tag in ('style', 'script', 'noscript'):
            el.drop_tree()
            continue
        if el.tag == 'small' and ('一作' in (el.text_content() or '') or '〈' in (el.text_content() or '')):
            el.drop_tree()
            continue
        if 'variant-tooltip' in (el.get('class') or ''):
            el.drop_tree()
            continue
        if el.tag in ('p', 'div', 'dd', 'dt', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'tr', 'table'):
            el.tail = '\n' + (el.tail or '')
    text = doc.text_content()
    out = []
    for x in text.splitlines():
        s = x.replace('\u3000', ' ').replace('\xa0', ' ')
        s = re.sub(r'〈[^〉]*〉', '', s)
        s = re.sub(r'\[\d+\]', '', s)
        s = re.sub(r'\s+', '', s)
        if s:
            out.append(s)
    return out


def parse_html(raw_html):
    lines = html_lines(raw_html)
    start = next((i for i, l in enumerate(lines) if l.startswith('易經')), None)
    if start is None:
        raise ValueError('no start')
    body = lines[start + 1:]
    gua_ci, yaos, tuan, xiang, yong = '', [], [], [], None
    phase = 'guaci'
    for l in body:
        if l.startswith('文言'):
            break
        if l.startswith('彖曰') or l.startswith('《彖》曰'):
            phase = 'tuan'; tuan.append(l); continue
        if l.startswith('象曰') or l.startswith('《象》曰'):
            phase = 'xiang'; xiang.append(l); continue
        if phase == 'xiang':
            xiang.append(l); continue
        if phase == 'tuan':
            tuan.append(l); continue
        m = YAO_RE.match(l)
        if m:
            if m.group(1).startswith('用'):
                yong = l
            else:
                yaos.append(l)
            continue
        if not gua_ci:
            gua_ci = l
        elif yaos:
            yaos[-1] += l
        else:
            gua_ci += l
    if len(tuan) > 1 and tuan[0] in ('彖曰：', '《彖》曰：'):
        tuan[0] += tuan[1]; tuan.pop(1)
    xiang = [x for x in xiang if x]
    if xiang and xiang[0] in ('象曰：', '《象》曰：') and len(xiang) > 1:
        xiang[0] += xiang[1]; xiang.pop(1)
    da = xiang[0] if xiang else ''
    xiao = [x.replace('象曰：', '', 1) if x.startswith('象曰：') else x for x in xiang[1:]]
    if len(xiao) < 6:
        pieces = []
        for l in xiao:
            pieces.extend([p + '。' for p in l.split('。') if p.strip()])
        xiao = pieces
    return {'guaCi': gua_ci, 'tuan': ''.join(tuan), 'xiang': da, 'yao': yaos, 'xiao': xiao, 'yong': yong}


def main():
    payload = json.load(open(DATA, encoding='utf-8'))
    by_num = {h['number']: h for h in payload['hexagrams']}
    checked = bad = 0
    for idx in range(1, 22):
        path = os.path.join(CACHE, '%02d.json' % idx)
        if not os.path.exists(path) or not os.path.getsize(path):
            continue
        raw = json.load(open(path, encoding='utf-8'))
        html = raw.get('html') or ''
        if not html:
            continue
        try:
            h = parse_html(html)
        except Exception as exc:
            print('%02d HTML 解析失败：%s' % (idx, exc)); bad += 1; continue
        rec = by_num[idx]
        diffs = []
        if h['guaCi'] != rec['guaCi']:
            diffs.append('卦辞\n    HTML: %r\n    JSON: %r' % (h['guaCi'], rec['guaCi']))
        if h['tuan'] != rec['tuan']:
            diffs.append('彖\n    HTML: %r\n    JSON: %r' % (h['tuan'], rec['tuan']))
        if h['xiang'] != rec['xiang']:
            diffs.append('大象\n    HTML: %r\n    JSON: %r' % (h['xiang'], rec['xiang']))
        for i, y in enumerate(rec['yao']):
            if h['yao'][i] != y['text']:
                diffs.append('爻%d\n    HTML: %r\n    JSON: %r' % (i + 1, h['yao'][i], y['text']))
            if i < len(h['xiao']) and h['xiao'][i] != y['xiang']:
                diffs.append('小象%d\n    HTML: %r\n    JSON: %r' % (i + 1, h['xiao'][i], y['xiang']))
        checked += 1
        if diffs:
            bad += 1
            print('%02d %s 不一致：' % (idx, rec['fullName']))
            for d in diffs:
                print('  ' + d)
        else:
            print('%02d %s 一致 ✓' % (idx, rec['fullName']))
    print('\n核对 %d 卦，其中 %d 卦有差异' % (checked, bad))
    return 0 if bad == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
