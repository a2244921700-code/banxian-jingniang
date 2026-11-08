#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""build_index.py —— 生成知识库总目 INDEX.md 与机器可读清单 _META/manifest.json。

设计见 docs/KNOWLEDGE-POLICY.md：
  - A 类 text：可直接读取的 .md/.txt（原文、编者整理）
  - B 类 ocr：11-现代书籍里由 PDF 提取的 .md（机器提取，须核原书）
  - C 类 pdf：影印/扫描件，readable=false，不参与正文检索
  - M 类 meta：INDEX.md、_目录.md、_书目与使用说明.md 等，供导航，不参与检索

用法：
  python build_index.py --root D:\\DSH_GuaShi\\知识库
"""

import argparse
import datetime
import json
import os
import re

SECTION_NAMES = {
    '01-易经经传': '经部：周易经传与注疏',
    '02-梅花易数': '梅花易数',
    '03-六爻卜筮': '六爻卜筮',
    '04-其他术数': '其他术数',
    '05-现代研究': '现代研究（编者整理）',
    '06-术语与文言': '术语与文言',
    '07-卦例': '卦例',
    '08-奇门遁甲': '奇门遁甲',
    '09-大六壬': '大六壬',
    '10-太乙神数': '太乙神数',
    '11-八字命理': '八字命理（子平）',
    '12-紫微斗数': '紫微斗数',
    '13-七政四余': '七政四余（星学）',
    '11-现代书籍': '现代书籍（个人研习用，PDF/文本）',
}

ORDER = list(SECTION_NAMES.keys())
META_NAMES = {'INDEX.md'}
META_PREFIX = '_'
MODERN_SECTION = '11-现代书籍'

TIERS = {
    'text': 'A 类：可直接读取的文本（.md/.txt 原文或编者整理）',
    'ocr': 'B 类：机器提取文本（由 PDF 提取，未校对，引用须核原书）',
    'digest': 'B 类：编者摘要/要点（自己的话，非原文）',
    'pdf': 'C 类：影印/扫描 PDF，无文本层，不可直接检索',
    'meta': 'M 类：目录/书目等元文件，仅供导航',
}


def read_head(path, max_lines=30):
    try:
        with open(path, encoding='utf-8') as handle:
            lines = []
            for _ in range(max_lines):
                line = handle.readline()
                if not line:
                    break
                lines.append(line.rstrip('\n'))
            return lines
    except OSError:
        return []


def char_count(path):
    try:
        with open(path, encoding='utf-8') as handle:
            return len(handle.read())
    except OSError:
        return 0


def describe(path):
    head = read_head(path)
    title = ''
    source = ''
    note = ''
    for line in head:
        if not title and line.startswith('# '):
            title = line[2:].strip()
        if not source and (line.startswith('- 来源：') or line.startswith('来源：')):
            source = re.sub(r'^-?\s*来源：', '', line).strip()
        if not note and (line.startswith('- 性质：') or line.startswith('性质：')):
            note = re.sub(r'^-?\s*性质：', '', line).strip()
    if not title:
        title = os.path.splitext(os.path.basename(path))[0]
    return title, source, note


def classify(section, name, path, files_in_dir):
    """返回 (kind, readable, quality)。"""
    if name in META_NAMES or name.startswith(META_PREFIX):
        return 'meta', True, 'meta'
    lower = name.lower()
    if lower.endswith('.pdf'):
        return 'pdf', False, 'scan-only'
    if lower.endswith(('.md', '.txt')):
        if section == MODERN_SECTION:
            stem = os.path.splitext(name)[0]
            if stem + '.pdf' in files_in_dir:
                return 'ocr', True, 'ocr-uncorrected'
            return 'digest', True, 'editorial'
        return 'text', True, 'clean'
    return 'other', False, 'unknown'


def collect(root):
    entries = []
    for section in ORDER:
        directory = os.path.join(root, section)
        if not os.path.isdir(directory):
            continue
        names = sorted(
            item for item in os.listdir(directory)
            if os.path.isfile(os.path.join(directory, item))
        )
        name_set = set(names)
        for name in names:
            lower = name.lower()
            if not lower.endswith(('.md', '.txt', '.pdf')):
                continue
            path = os.path.join(directory, name)
            kind, readable, quality = classify(section, name, path, name_set)
            entry = {
                'path': ('%s/%s' % (section, name)).replace('\\', '/'),
                'section': section,
                'name': name,
                'kind': kind,
                'readable': readable,
                'quality': quality,
            }
            if kind in ('pdf',):
                entry['bytes'] = os.path.getsize(path)
            else:
                entry['chars'] = char_count(path)
                title, source, note = describe(path)
                entry['title'] = title
                if source:
                    entry['source'] = source[:200]
                elif note:
                    entry['source'] = note[:200]
            entries.append(entry)
    return entries


def build_index_md(root, entries, generated_at):
    stats = {'text': 0, 'ocr': 0, 'digest': 0, 'pdf': 0, 'meta': 0, 'totalChars': 0}
    for entry in entries:
        stats[entry['kind']] = stats.get(entry['kind'], 0) + 1
        if entry.get('readable') and entry.get('kind') != 'meta':
            stats['totalChars'] += entry.get('chars', 0)
    lines = [
        '# 卦师·鲸娘 · 知识库总目',
        '',
        '- 生成日期：%s（自动生成，勿手改；改内容后重跑 tools/build_index.py）' % generated_at,
        '- 机器可读清单：`_META/manifest.json`（`gua_kb` 据此判断哪些文件可直接检索）。',
        '- 读取策略见 `docs/KNOWLEDGE-POLICY.md`：**A 类文本优先**；B 类 OCR 文本可查但须核原书；',
        '  C 类影印 PDF 只登记、不进入正文检索；M 类目录/书目仅供导航。',
        '- 用途：`gua_kb` 检索的知识源。古籍原文据中文维基文库/殆知阁等免费公开源整理，机器繁转简、未改字句；',
        '  现代研究类为编者整理，只作提要，不复制受版权保护的原文。引用时请注明书名与篇名。',
        '',
        '## 目录结构',
        '',
    ]
    for name in ORDER:
        if os.path.isdir(os.path.join(root, name)):
            lines.append('- `%s/` —— %s' % (name, SECTION_NAMES[name]))
    lines.append('')
    tier_label = {'text': '文本(A)', 'ocr': 'OCR(B)', 'digest': '摘要(B)', 'pdf': '影印(C)'}
    for section in ORDER:
        section_entries = [item for item in entries if item['section'] == section and item['kind'] != 'meta']
        if not section_entries:
            continue
        lines.append('## %s' % SECTION_NAMES[section])
        lines.append('')
        lines.append('| 文件 | 字数/字节 | 类型 | 来源 / 性质 |')
        lines.append('|---|---:|---|---|')
        for entry in section_entries:
            if entry['kind'] == 'pdf':
                size = '%d B' % entry.get('bytes', 0)
                origin = '影印 PDF，无文本层（不可检索）'
            else:
                size = '%d' % entry.get('chars', 0)
                origin = entry.get('source') or '编者整理'
                origin = origin.replace('|', '｜')
                if len(origin) > 90:
                    origin = origin[:87] + '…'
            lines.append('| %s | %s | %s | %s |' % (entry['name'], size, tier_label.get(entry['kind'], entry['kind']), origin))
        lines.append('')
        catalog = os.path.join(root, section, '_目录.md')
        if os.path.isfile(catalog):
            with open(catalog, encoding='utf-8') as handle:
                text = handle.read()
            if '缺' in text:
                lines.append('缺书与说明见 `%s/_目录.md`。' % section)
                lines.append('')
    lines.extend([
        '## 统计',
        '',
        '- 可直接检索文本（A 类）：%d 份' % stats['text'],
        '- 机器提取文本（B 类 ocr）：%d 份；编者摘要：%d 份' % (stats['ocr'], stats['digest']),
        '- 影印 PDF（C 类，不可检索）：%d 份' % stats['pdf'],
        '- 可检索总字数：约 %d 字' % stats['totalChars'],
        '',
        '## 使用与边界',
        '',
        '- 原文与编者整理均在 `gua_kb` 索引范围内；检索命中会给出文件名、上级标题与行号。',
        '- 古籍底本以维基文库为主；维基文库缺收者补自殆知阁等免费公开源（易冒、易隐、断易天机、',
        '  卜筮全书、卜筮正宗、增删卜易全本），异体字、通假字保留原貌，已知讹字见各文件头校记。',
        '  引经据典前建议用 `gua_kb` 或 `read` 工具核对原文，不要凭记忆背诵。',
        '- 11-现代书籍仅个人研习用，版权归原作者与出版社；Agent 对外引用只可作要点提要，不得整章复述。',
        '  OCR 文本引用须注明「机器提取，须核原书」；只有影印 PDF 的书，不得凭书名/记忆编原文。',
        '- 11–13 科（八字命理、紫微斗数、七政四余）为「半仙·鲸娘」升级准备。其中《八字提要》',
        '  《呱呱集》为韦千里（1908—1988）近人著作，未入公有领域：仅本地个人研习，不传播、不商用。',
        '- 命理类原文多据殆知阁/天机/维基文库电子录文，未与古刻本逐字对勘；引用前核原书。',
        '- 《断易天机》为网络整理节本（含今人按语），已在 `03-六爻卜筮/_目录.md` 注明；',
        '  引用时须说明底本状况。',
        '',
    ])
    return '\n'.join(lines), stats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default=r'D:\DSH_GuaShi\知识库')
    args = parser.parse_args()
    root = args.root
    generated = datetime.datetime.now().strftime('%Y-%m-%d')
    entries = collect(root)
    md, stats = build_index_md(root, entries, generated)

    out_index = os.path.join(root, 'INDEX.md')
    with open(out_index, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(md)

    meta_dir = os.path.join(root, '_META')
    os.makedirs(meta_dir, exist_ok=True)
    manifest = {
        'version': 1,
        'generatedAt': datetime.datetime.now().isoformat(timespec='seconds'),
        'root': root.replace('\\', '/'),
        'policy': '优先 A 类可直接读取文本；B 类 OCR 文本可检索但须核原书；C 类 PDF 只登记不检索；M 类元文件导航用。',
        'tiers': TIERS,
        'stats': stats,
        'entries': entries,
    }
    out_manifest = os.path.join(meta_dir, 'manifest.json')
    with open(out_manifest, 'w', encoding='utf-8', newline='\n') as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=1)

    readable = sum(1 for item in entries if item['readable'] and item['kind'] != 'meta')
    print('写出 %s（%d 份文件，其中可读文本 %d 份，可检索约 %d 字）' % (
        out_index, len(entries), readable, stats['totalChars']))
    print('写出 %s（A/B/C/M：%d/%d/%d/%d）' % (
        out_manifest, stats['text'], stats['ocr'] + stats['digest'], stats['pdf'], stats['meta']))


if __name__ == '__main__':
    main()
