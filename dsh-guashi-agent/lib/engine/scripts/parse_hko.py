#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把香港天文台《公历农历对照表》文本（T<年>e.txt）解析成结构化数据，
用作 almanac.js 测试的权威期望值。

来源：香港天文台 Gregorian-Lunar Calendar Conversion Table
      https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2026e.txt
输出：scripts/.cache/hko-expect.json
"""
import json
import os
import re

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.cache')

# 天文台英文节气名 → 中文名（2026 年表实测拼写）
EN2CN = {
    'Moderate Cold': '小寒', 'Severe Cold': '大寒', 'Spring Commences': '立春',
    'Spring Showers': '雨水', 'Insects Waken': '惊蛰', 'Vernal Equinox': '春分',
    'Bright & Clear': '清明', 'Corn Rain': '谷雨', 'Summer Commences': '立夏',
    'Corn Forms': '小满', 'Corn on Ear': '芒种', 'Summer Solstice': '夏至',
    'Moderate Heat': '小暑', 'Great Heat': '大暑', 'Autumn Commences': '立秋',
    'End of Heat': '处暑', 'White Dew': '白露', 'Autumnal Equinox': '秋分',
    'Cold Dew': '寒露', 'Frost': '霜降', 'Winter Commences': '立冬',
    'Light Snow': '小雪', 'Heavy Snow': '大雪', 'Winter Solstice': '冬至',
}
MONTH_RE = re.compile(r'^(Leap )?(\d+)(?:st|nd|rd|th) Lunar Month$', re.I)


def parse_year(path):
    with open(path, encoding='utf-8-sig') as f:
        lines = f.read().splitlines()
    terms = {}
    month_starts = []
    for line in lines:
        s = line.strip()
        m = re.match(r'^(\d{4})/(\d{1,2})/(\d{1,2})\s+(.*)$', s)
        if not m:
            continue
        y, mo, d, rest = int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(4).strip()
        iso = '%04d-%02d-%02d' % (y, mo, d)
        cols = [c.strip() for c in re.split(r'\s{2,}', rest) if c.strip()]
        mm = next((MONTH_RE.match(c) for c in cols if MONTH_RE.match(c)), None)
        if mm:
            month_starts.append({'date': iso, 'month': int(mm.group(2)), 'leap': bool(mm.group(1))})
        for c in cols:
            if c in EN2CN:
                terms[EN2CN[c]] = iso
    return {
        'terms': terms,
        'months': _mark_leap(month_starts),
        'lunarNewYear': next((x['date'] for x in _mark_leap(month_starts)
                              if x['month'] == 1 and not x['leap']), None),
    }


def _mark_leap(month_starts):
    """天文台英文表不写 Leap，而是重复同一月号；同一农历年内重复出现的第二次即闰月。"""
    seen = set()
    out = []
    for m in month_starts:
        item = dict(m)
        if item['month'] == 1 and not item['leap']:
            seen = set()  # 跨农历年，重置（年首的十二月属上一农历年）
        if item['month'] in seen and not item['leap']:
            item['leap'] = True
        seen.add(item['month'])
        out.append(item)
    return out


def main():
    os.makedirs(CACHE, exist_ok=True)
    out = {'note': '来源：香港天文台《公历农历对照表》T<年>e.txt（Hong Kong Observatory）', 'years': {}}
    for fn in sorted(os.listdir(CACHE)):
        m = re.match(r'^T(\d{4})e\.txt$', fn)
        if not m:
            continue
        y = int(m.group(1))
        out['years'][str(y)] = parse_year(os.path.join(CACHE, fn))
    dest = os.path.join(CACHE, 'hko-expect.json')
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1, sort_keys=True)
    for y, v in sorted(out['years'].items()):
        print('%s: 节气 %d/24, 月首 %d, 春节 %s'
              % (y, len(v['terms']), len(v['months']), v['lunarNewYear']))


if __name__ == '__main__':
    main()
