#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把 .cache/wikitext/<NN>.txt（维基文库《周易》各卦原始 wikitext，繁体）
解析成 lib/engine/data/hexagrams.json —— 64 卦繁体原文（卦辞/彖/大象/六爻爻辞+小象）。

用法：
  python build_hexagrams.py --report

处理规则：
  * `-{...}-` 语言转换标记 → 取原文（`-{T|周易/乾}-` 整段删除）
  * `{{Header2 ...}}` → 删除；`{{另|磐|盤}}` → 取首选“磐”；`{{*|一作太和}}` 编者夹注 → 删除
  * `<span ...>` 等 HTML 标签、`'''` 加粗 → 删除
  * 列表标记 `*` `**` `*#` `*:` 与定义列表 `;` → 删除
  * 不做繁简转换，保留繁体原貌
  * 用页面里的“X下Y上”自校上下卦，防止卦序表与原文不符
"""
import argparse
import datetime
import json
import os
import re
import sys

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.cache', 'wikitext')
DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
OUT = os.path.join(DATA, 'hexagrams.json')

# 通行本（王弼本）六十四卦经序：卦序、简体卦名、上卦、下卦、卦全名
KING_WEN = [
    (1, '乾', '乾', '乾', '乾为天'), (2, '坤', '坤', '坤', '坤为地'),
    (3, '屯', '坎', '震', '水雷屯'), (4, '蒙', '艮', '坎', '山水蒙'),
    (5, '需', '坎', '乾', '水天需'), (6, '讼', '乾', '坎', '天水讼'),
    (7, '师', '坤', '坎', '地水师'), (8, '比', '坎', '坤', '水地比'),
    (9, '小畜', '巽', '乾', '风天小畜'), (10, '履', '乾', '兑', '天泽履'),
    (11, '泰', '坤', '乾', '地天泰'), (12, '否', '乾', '坤', '天地否'),
    (13, '同人', '乾', '离', '天火同人'), (14, '大有', '离', '乾', '火天大有'),
    (15, '谦', '坤', '艮', '地山谦'), (16, '豫', '震', '坤', '雷地豫'),
    (17, '随', '兑', '震', '泽雷随'), (18, '蛊', '艮', '巽', '山风蛊'),
    (19, '临', '坤', '兑', '地泽临'), (20, '观', '巽', '坤', '风地观'),
    (21, '噬嗑', '离', '震', '火雷噬嗑'), (22, '贲', '艮', '离', '山火贲'),
    (23, '剥', '艮', '坤', '山地剥'), (24, '复', '坤', '震', '地雷复'),
    (25, '无妄', '乾', '震', '天雷无妄'), (26, '大畜', '艮', '乾', '山天大畜'),
    (27, '颐', '艮', '震', '山雷颐'), (28, '大过', '兑', '巽', '泽风大过'),
    (29, '坎', '坎', '坎', '坎为水'), (30, '离', '离', '离', '离为火'),
    (31, '咸', '兑', '艮', '泽山咸'), (32, '恒', '震', '巽', '雷风恒'),
    (33, '遯', '乾', '艮', '天山遯'), (34, '大壮', '震', '乾', '雷天大壮'),
    (35, '晋', '离', '坤', '火地晋'), (36, '明夷', '坤', '离', '地火明夷'),
    (37, '家人', '巽', '离', '风火家人'), (38, '睽', '离', '兑', '火泽睽'),
    (39, '蹇', '坎', '艮', '水山蹇'), (40, '解', '震', '坎', '雷水解'),
    (41, '损', '艮', '兑', '山泽损'), (42, '益', '巽', '震', '风雷益'),
    (43, '夬', '兑', '乾', '泽天夬'), (44, '姤', '乾', '巽', '天风姤'),
    (45, '萃', '兑', '坤', '泽地萃'), (46, '升', '坤', '巽', '地风升'),
    (47, '困', '兑', '坎', '泽水困'), (48, '井', '坎', '巽', '水风井'),
    (49, '革', '兑', '离', '泽火革'), (50, '鼎', '离', '巽', '火风鼎'),
    (51, '震', '震', '震', '震为雷'), (52, '艮', '艮', '艮', '艮为山'),
    (53, '渐', '巽', '艮', '风山渐'), (54, '归妹', '震', '兑', '雷泽归妹'),
    (55, '丰', '震', '离', '雷火丰'), (56, '旅', '离', '艮', '火山旅'),
    (57, '巽', '巽', '巽', '巽为风'), (58, '兑', '兑', '兑', '兑为泽'),
    (59, '涣', '巽', '坎', '风水涣'), (60, '节', '坎', '兑', '水泽节'),
    (61, '中孚', '巽', '兑', '风泽中孚'), (62, '小过', '震', '艮', '雷山小过'),
    (63, '既济', '坎', '离', '水火既济'), (64, '未济', '离', '坎', '火水未济'),
]

# 繁体卦名（维基文库子页名 / 经文中的写法）
TRAD_NAME = {
    1: '乾', 2: '坤', 3: '屯', 4: '蒙', 5: '需', 6: '訟', 7: '師', 8: '比', 9: '小畜', 10: '履',
    11: '泰', 12: '否', 13: '同人', 14: '大有', 15: '謙', 16: '豫', 17: '隨', 18: '蠱', 19: '臨', 20: '觀',
    21: '噬嗑', 22: '賁', 23: '剝', 24: '復', 25: '無妄', 26: '大畜', 27: '頤', 28: '大過', 29: '坎', 30: '離',
    31: '咸', 32: '恒', 33: '遯', 34: '大壯', 35: '晉', 36: '明夷', 37: '家人', 38: '睽', 39: '蹇', 40: '解',
    41: '損', 42: '益', 43: '夬', 44: '姤', 45: '萃', 46: '升', 47: '困', 48: '井', 49: '革', 50: '鼎',
    51: '震', 52: '艮', 53: '漸', 54: '歸妹', 55: '豐', 56: '旅', 57: '巽', 58: '兌', 59: '渙', 60: '節',
    61: '中孚', 62: '小過', 63: '既濟', 64: '未濟',
}

TRIGRAM_BINARY = {
    '乾': '111', '兑': '110', '兑t': '110', '離': '101', '离': '101', '震': '100',
    '巽': '011', '坎': '010', '艮': '001', '坤': '000',
}
TRIGRAM_SYMBOL = {
    '乾': '☰', '兑': '☱', '离': '☲', '震': '☳', '巽': '☴', '坎': '☵', '艮': '☶', '坤': '☷',
}
TRAD2SIM_TRIGRAM = {'兌': '兑', '兑': '兑', '離': '离', '离': '离'}

YAO_RE = re.compile(r'^(初[六九]|[六九][二三四五]|上[六九]|用[六九])')
TRI_LINE_RE = re.compile(r'^([乾兌兑離离震巽坎艮坤])下([乾兌兑離离震巽坎艮坤])上$')


def log(msg):
    sys.stdout.write(str(msg) + '\n')
    sys.stdout.flush()


# ============================================================
# wikitext 清洗
# ============================================================

def preprocess(text):
    """模板、语言转换标记、HTML 标签、列表标记。"""
    # 语言转换标记：-{T|周易/乾}- 整段删除；-{乾}- / -{无}- 取原文
    text = re.sub(r'-\{T\|[^{}]*\}-', '', text)
    text = re.sub(r'-\{(.*?)\}-', lambda m: m.group(1), text, flags=re.S)
    # 模板：Header2 整块删除（可跨行）；{{另|磐|盤}} 取首选；{{*|一作…}} 夹注删除
    text = re.sub(r'\{\{[Hh]eader2.*?\}\}', '', text, flags=re.S)
    text = re.sub(r'\{\{另\|([^|}]*)(?:\|[^{}]*)?\}\}', lambda m: m.group(1), text)
    text = re.sub(r'\{\{\*\|[^{}]*\}\}', '', text)
    text = re.sub(r'\{\{[^{}]*\}\}', '', text, flags=re.S)  # 兜底
    # HTML 标签、加粗/斜体
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace("'''", '').replace("''", '')
    # 链接：[[File:…]] 删除；[[../坤|坤]] → 坤；[[周易]] → 周易
    text = re.sub(r'\[\[(?:File|Image|文件|檔案):[^\]]*\]\]', '', text, flags=re.S)
    text = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', lambda m: m.group(1), text)
    # 全角空格、多余空白
    text = text.replace('\u3000', ' ').replace('\xa0', ' ').replace('\r', '')
    return text


def wikitext_to_lines(text):
    lines = []
    for raw in text.split('\n'):
        s = raw.strip()
        s = re.sub(r'^[*#:;]+', '', s).strip()  # 列表标记
        s = re.sub(r'^[-–—]+$', '', s).strip()
        s = re.sub(r'\s+', '', s)  # 中文古籍无空格
        if s:
            lines.append(s)
    return lines


def extract_composition(lines):
    """从页面里取“X下Y上”，用于自校上下卦。"""
    for l in lines[:20]:
        m = TRI_LINE_RE.match(l)
        if m:
            return TRAD2SIM_TRIGRAM.get(m.group(1), m.group(1)), TRAD2SIM_TRIGRAM.get(m.group(2), m.group(2))
    return None, None


def parse_page(text):
    """一卦 wikitext → {guaCi, tuan, xiang, yao[], yong}"""
    lines = wikitext_to_lines(preprocess(text))
    lower, upper = extract_composition(lines)
    start = None
    for i, l in enumerate(lines):
        if l.startswith('易經') or l.startswith('易经'):
            start = i
            break
    if start is None:
        raise ValueError('找不到“易經：”起首')
    body = lines[start + 1:]

    gua_ci = ''
    yaos = []
    tuan_lines = []
    xiang_lines = []
    yong = None
    phase = 'guaci'

    for l in body:
        if l.startswith('文言'):
            break
        if l.startswith('彖曰') or l.startswith('《彖》曰'):
            phase = 'tuan'
            tuan_lines.append(l)
            continue
        if l.startswith('象曰') or l.startswith('《象》曰'):
            phase = 'xiang'
            xiang_lines.append(l)
            continue
        if phase == 'xiang':
            xiang_lines.append(l)
            continue
        if phase == 'tuan':
            tuan_lines.append(l)
            continue
        m = YAO_RE.match(l)
        if m:
            if m.group(1).startswith('用'):
                yong = {'text': l}
            else:
                yaos.append({'text': l})
            continue
        if not gua_ci:
            gua_ci = l
        elif yaos:
            yaos[-1]['text'] += l
        else:
            gua_ci += l

    if len(yaos) != 6:
        raise ValueError('爻辞数目异常：%d（应为 6）' % len(yaos))

    # 彖、象标号独立成行时与后文合并
    if len(tuan_lines) > 1 and tuan_lines[0] in ('彖曰：', '《彖》曰：'):
        tuan_lines[0] = tuan_lines[0] + tuan_lines[1]
        tuan_lines.pop(1)
    tuan = ''.join(tuan_lines)

    xiang_all = [x for x in xiang_lines if x]
    if xiang_all and xiang_all[0] in ('象曰：', '《象》曰：') and len(xiang_all) > 1:
        xiang_all[0] = xiang_all[0] + xiang_all[1]
        xiang_all.pop(1)
    da_xiang = xiang_all[0] if xiang_all else ''
    xiao = [x.replace('象曰：', '', 1) if x.startswith('象曰：') else x for x in xiang_all[1:]]
    if len(xiao) < 6:
        pieces = []
        for l in xiao:
            pieces.extend([p + '。' for p in l.split('。') if p.strip()])
        xiao = pieces
    if len(xiao) not in (6, 7):
        raise ValueError('小象数目异常：%d %r' % (len(xiao), xiao))

    for i, y in enumerate(yaos):
        y['pos'] = i + 1
        y['xiang'] = xiao[i] if i < len(xiao) else ''
    if yong is not None and len(xiao) == 7:
        yong['xiang'] = xiao[6]

    return {
        'guaCi': gua_ci,
        'tuan': tuan,
        'xiang': da_xiang,
        'yao': yaos,
        'yong': yong,
        'lower': lower,
        'upper': upper,
    }


def build(report=False):
    out = []
    errors = []
    for idx in range(1, 65):
        path = os.path.join(CACHE, '%02d.txt' % idx)
        number, name_sim, upper, lower, full_name = KING_WEN[idx - 1]
        if not os.path.exists(path):
            errors.append((idx, '缺少缓存'))
            continue
        with open(path, encoding='utf-8') as f:
            text = f.read()
        try:
            parsed = parse_page(text)
        except Exception as exc:
            errors.append((idx, '%s：%s' % (name_sim, exc)))
            continue
        # 自校：页面“X下Y上”应与卦序表一致
        if parsed['lower'] and (parsed['lower'], parsed['upper']) != (lower, upper):
            errors.append((idx, '%s：页面上下卦 %s下%s上 与卦序表 %s下%s上 不符'
                           % (name_sim, parsed['lower'], parsed['upper'], lower, upper)))
            continue
        binary = TRIGRAM_BINARY[lower] + TRIGRAM_BINARY[upper]  # 自下而上，初爻最左
        rec = {
            'number': number,
            'name': name_sim,
            'nameTrad': TRAD_NAME[number],
            'fullName': full_name,
            'binary': binary,
            'upper': upper,
            'lower': lower,
            'symbols': [TRIGRAM_SYMBOL[lower], TRIGRAM_SYMBOL[upper]],
            'guaCi': parsed['guaCi'],
            'tuan': parsed['tuan'],
            'xiang': parsed['xiang'],
            'yao': parsed['yao'],
            'yong': parsed['yong'],
        }
        out.append(rec)
        if report:
            log('%02d %-4s %-6s %s下%s上 卦辞=%r 彖=%d字 象=%r 爻=%d 小象=%d%s' % (
                number, full_name, binary, lower, upper,
                rec['guaCi'][:26], len(rec['tuan']), rec['xiang'][:24],
                len(rec['yao']), sum(1 for y in rec['yao'] if y['xiang']),
                ' 用爻' if rec['yong'] else ''))

    if errors:
        log('\n解析失败：')
        for idx, msg in errors:
            log('  %02d %s' % (idx, msg))

    if len(out) == 64 and not errors:
        bins = {r['binary'] for r in out}
        assert len(bins) == 64, 'binary 不唯一'
        assert all(len(r['yao']) == 6 for r in out), '有卦爻辞不足 6'
        assert all(r['guaCi'] for r in out), '有卦缺卦辞'
        assert all(r['tuan'].startswith('彖曰') for r in out), '有卦缺彖'
        assert all(r['xiang'].startswith('象曰') for r in out), '有卦缺大象'
        payload = {
            'source': '中文维基文库《周易》64 卦子页（https://zh.wikisource.org/wiki/周易/乾 等），繁体原文',
            'sourceApi': 'https://zh.wikisource.org/w/api.php?action=query&prop=revisions&rvprop=content（原始 wikitext）',
            'fetchedAt': datetime.date.today().isoformat(),
            'license': '古籍原文属公有领域；维基文库转录文本依 CC BY-SA 4.0',
            'note': '已删去维基文库编者夹注（{{*|一作某}}、{{另|A|B}} 只取首选字）与排版标记；保留繁体原貌，未作繁简转换。',
            'hexagrams': out,
        }
        os.makedirs(DATA, exist_ok=True)
        with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(payload, f, ensure_ascii=False, indent=1)
        log('\n已写入 %s（64 卦，%d 字节）' % (OUT, os.path.getsize(OUT)))
    else:
        log('\n尚有 %d 卦未通过，未写入 JSON' % (64 - len(out)))
    return 0 if not errors and len(out) == 64 else 1


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--report', action='store_true')
    args = ap.parse_args()
    sys.exit(build(report=args.report))
