# -*- coding: utf-8 -*-
"""临时工具：按文档顺序导出 docx 的段落与表格文本，供阅读。"""
import sys
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph


def iter_blocks(doc):
    for child in doc.element.body.iterchildren():
        if child.tag == qn("w:p"):
            yield Paragraph(child, doc)
        elif child.tag == qn("w:tbl"):
            yield Table(child, doc)


def dump(path, budget=40000):
    doc = Document(path)
    print("=" * 30)
    print(path)
    print("=" * 30)
    used = 0
    for block in iter_blocks(doc):
        if isinstance(block, Paragraph):
            text = block.text.strip()
            if not text:
                continue
            style = block.style.name if block.style is not None else ""
            line = f"[{style}] {text}"
        else:
            line = "[表格]"
            for row in block.rows:
                cells = [c.text.strip().replace("\n", " / ") for c in row.cells]
                line += "\n  " + " | ".join(cells)
        print(line)
        used += len(line)
        if used > budget:
            print("...TRUNCATED at %d chars..." % used)
            break
    print()


if __name__ == "__main__":
    for p in sys.argv[1:]:
        dump(p)
