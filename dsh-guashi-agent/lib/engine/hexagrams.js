/**
 * hexagrams.js —— 六十四卦卦典（纯 ESM、零第三方依赖）
 *
 * 数据源：lib/engine/data/hexagrams.json（生成自中文维基文库《周易》64 卦子页，繁体原文）。
 * 本模块负责：八卦数据、64 卦索引（卦序/卦名/二进制/上下卦）、八宫归属与世应、
 * 按 number|name|binary 查询卦对象（含卦辞/彖/象/六爻爻辞+小象）。
 *
 * binary 约定：自下而上 6 位字符串，初爻在最左（如乾 '111111'、屯 '100010'）。
 */

import { readFileSync } from 'node:fs';

// ============================================================
// 八卦
// ============================================================

/**
 * 八卦：名称、符号、二进制（自下而上）、先天数（梅花：乾一兑二离三震四巽五坎六艮七坤八）、
 * 五行、卦象、方位、家庭角色、物象。
 */
export const TRIGRAMS = {
  乾: {
    name: '乾', symbol: '☰', binary: '111', number: 1, element: '金', nature: '天',
    direction: '西北', family: '父', image: '天', animal: '马', body: '首', attribute: '健',
  },
  兑: {
    name: '兑', symbol: '☱', binary: '110', number: 2, element: '金', nature: '泽',
    direction: '西', family: '少女', image: '泽', animal: '羊', body: '口', attribute: '悦',
  },
  离: {
    name: '离', symbol: '☲', binary: '101', number: 3, element: '火', nature: '火',
    direction: '南', family: '中女', image: '火', animal: '雉', body: '目', attribute: '丽',
  },
  震: {
    name: '震', symbol: '☳', binary: '100', number: 4, element: '木', nature: '雷',
    direction: '东', family: '长男', image: '雷', animal: '龙', body: '足', attribute: '动',
  },
  巽: {
    name: '巽', symbol: '☴', binary: '011', number: 5, element: '木', nature: '风',
    direction: '东南', family: '长女', image: '风', animal: '鸡', body: '股', attribute: '入',
  },
  坎: {
    name: '坎', symbol: '☵', binary: '010', number: 6, element: '水', nature: '水',
    direction: '北', family: '中男', image: '水', animal: '豕', body: '耳', attribute: '陷',
  },
  艮: {
    name: '艮', symbol: '☶', binary: '001', number: 7, element: '土', nature: '山',
    direction: '东北', family: '少男', image: '山', animal: '狗', body: '手', attribute: '止',
  },
  坤: {
    name: '坤', symbol: '☷', binary: '000', number: 8, element: '土', nature: '地',
    direction: '西南', family: '母', image: '地', animal: '牛', body: '腹', attribute: '顺',
  },
};

/** 梅花先天八卦数序：1乾 2兑 3离 4震 5巽 6坎 7艮 8坤 */
export const TRIGRAM_ORDER = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

/** 二进制 → 八卦名 */
export const BINARY_TRIGRAM = {
  '111': '乾', '110': '兑', '101': '离', '100': '震',
  '011': '巽', '010': '坎', '001': '艮', '000': '坤',
};

/** 五行生克 */
export const WUXING_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 我生
export const WUXING_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }; // 我克

/** 五行关系：返回 '生'|'克'|'被生'|'被克'|'比和'（从 a 的角度看 b） */
export function wuxingRelation(a, b) {
  if (a === b) return '比和';
  if (WUXING_SHENG[a] === b) return '生';
  if (WUXING_KE[a] === b) return '克';
  if (WUXING_SHENG[b] === a) return '被生';
  if (WUXING_KE[b] === a) return '被克';
  return '无';
}

/** 五行生克的中文描述（a 对 b） */
export function wuxingText(a, b) {
  const r = wuxingRelation(a, b);
  return { 生: `${a}生${b}`, 克: `${a}克${b}`, 被生: `${b}生${a}`, 被克: `${b}克${a}`, 比和: `${a}${b}比和`, 无: `${a}${b}无关` }[r];
}

// ============================================================
// 八宫、世应
// ============================================================

/**
 * 京房八宫卦的生成规则：以本宫八纯卦为基，按“爻变”得一世～归魂。
 * 数组为需要翻转的爻位（0-based，0=初爻）。
 */
export const PALACE_FLIPS = {
  八纯: [],
  一世: [0],
  二世: [0, 1],
  三世: [0, 1, 2],
  四世: [0, 1, 2, 3],
  五世: [0, 1, 2, 3, 4],
  游魂: [0, 1, 2, 4],
  归魂: [4],
};

/** 八宫卦序（生成顺序） */
export const GENERATIONS = ['八纯', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂'];

/** 世应位置 */
export const SHI_YING = {
  八纯: { shi: 6, ying: 3 },
  一世: { shi: 1, ying: 4 },
  二世: { shi: 2, ying: 5 },
  三世: { shi: 3, ying: 6 },
  四世: { shi: 4, ying: 1 },
  五世: { shi: 5, ying: 2 },
  游魂: { shi: 4, ying: 1 },
  归魂: { shi: 3, ying: 6 },
};

/** 把 binary 的第 i 位（0 起）翻转 */
function flipBinary(binary, positions) {
  const arr = binary.split('');
  for (const p of positions) arr[p] = arr[p] === '1' ? '0' : '1';
  return arr.join('');
}

/** 构建 binary → {palace, palaceElement, generation, shiPos, yingPos} 映射表 */
function buildPalaceMap() {
  const map = new Map();
  for (const palace of TRIGRAM_ORDER) {
    const pure = TRIGRAMS[palace].binary;
    const pureBinary = pure + pure;
    for (const gen of GENERATIONS) {
      const binary = flipBinary(pureBinary, PALACE_FLIPS[gen]);
      const sy = SHI_YING[gen];
      map.set(binary, {
        palace,
        palaceElement: TRIGRAMS[palace].element,
        generation: gen,
        shiPos: sy.shi,
        yingPos: sy.ying,
      });
    }
  }
  if (map.size !== 64) throw new Error('八宫卦映射异常：' + map.size + '（应为 64）');
  return map;
}

/** binary → 八宫信息 */
const PALACE_MAP = buildPalaceMap();

export function palaceInfo(binary) {
  const info = PALACE_MAP.get(String(binary));
  if (!info) throw new Error('无效的卦二进制：' + String(binary));
  return info;
}

/** 全部八宫卦表（按宫、按世代），供速查 */
export function palaceTable() {
  const out = {};
  for (const palace of TRIGRAM_ORDER) {
    out[palace] = GENERATIONS.map((gen) => ({
      generation: gen,
      binary: flipBinary(TRIGRAMS[palace].binary + TRIGRAMS[palace].binary, PALACE_FLIPS[gen]),
      ...SHI_YING[gen],
    }));
  }
  return out;
}

// ============================================================
// 64 卦数据
// ============================================================

let _payload = null;

/** 懒加载 data/hexagrams.json */
function payload() {
  if (_payload) return _payload;
  const url = new URL('./data/hexagrams.json', import.meta.url);
  try {
    _payload = JSON.parse(readFileSync(url, 'utf8'));
  } catch (err) {
    throw new Error(
      '无法读取 data/hexagrams.json（' + url.href + '）：' + err.message +
      '。请先运行 lib/engine/scripts/fetch_hexagrams.py 与 build_hexagrams.py 生成数据。',
    );
  }
  return _payload;
}

/** 内部索引，按 number / name / tradName / binary 查 */
let _byNumber = null;
let _byName = null;
let _byBinary = null;

function indexes() {
  if (_byNumber) return;
  _byNumber = new Map();
  _byName = new Map();
  _byBinary = new Map();
  for (const h of payload().hexagrams) {
    _byNumber.set(h.number, h);
    _byBinary.set(h.binary, h);
    for (const n of nameAliases(h)) _byName.set(n, h);
  }
}

/** 一个卦的全部可用名称/别名 */
function nameAliases(h) {
  const names = new Set();
  if (h.name) names.add(h.name);
  if (h.fullName) names.add(h.fullName);
  if (h.nameTrad) names.add(h.nameTrad);
  // '乾卦' / '乾为天卦' 这类后缀写法
  const out = new Set();
  for (const n of names) {
    out.add(n);
    out.add(n + '卦');
  }
  return [...out];
}

/** 全部别名（供 gua_hexagram 返回 aliases） */
export function aliasesOf(h) {
  const list = nameAliases(h).filter((n) => !n.endsWith('卦'));
  return list;
}

/** 六十四卦 metadata 表（load 后缓存），不含经文 */
function metaOf(h) {
  const info = palaceInfo(h.binary);
  return {
    number: h.number,
    name: h.name,
    nameTrad: h.nameTrad,
    fullName: h.fullName,
    binary: h.binary,
    upper: { ...TRIGRAMS[h.upper], trigram: h.upper, name: h.upper },
    lower: { ...TRIGRAMS[h.lower], trigram: h.lower, name: h.lower },
    palance: info.palace,
    palace: info.palace,
    palaceElement: info.palaceElement,
    generation: info.generation,
    shiPos: info.shiPos,
    yingPos: info.yingPos,
  };
}

/** 完整卦对象（SPEC §2.1 <卦对象>） */
function fullObject(h) {
  const meta = metaOf(h);
  return {
    ...meta,
    guaCi: h.guaCi,
    tuan: h.tuan,
    xiang: h.xiang,
    yao: h.yao.map((y) => ({ pos: y.pos, text: y.text, xiang: y.xiang })),
    yong: h.yong || null,
  };
}

/**
 * 查卦。接受：
 *  - number: 1-64
 *  - { number } / { name } / { binary }
 *  - string: '乾' '乾为天' '乾卦' '111111' '010101'
 * @returns {object|null} 完整卦对象；查不到返回 null
 */
export function getHexagram(query) {
  indexes();
  let h = null;
  if (query && typeof query === 'object') {
    if (typeof query.number === 'number') h = _byNumber.get(query.number);
    else if (typeof query.binary === 'string') h = _byBinary.get(query.binary.trim());
    else if (typeof query.name === 'string') h = _byName.get(query.name.trim());
  } else if (typeof query === 'number') {
    h = _byNumber.get(query);
  } else if (typeof query === 'string') {
    const s = query.trim();
    if (/^[01]{6}$/.test(s)) h = _byBinary.get(s);
    else if (/^\d+$/.test(s)) h = _byNumber.get(Number(s));
    else h = _byName.get(s);
  }
  return h ? fullObject(h) : null;
}

/** 按 number 取完整卦对象（必存在，不存在抛错） */
export function hexagramByNumber(number) {
  const h = getHexagram(Number(number));
  if (!h) throw new Error('无效的卦序：' + number + '（应为 1-64）');
  return h;
}

/** 按 binary 取完整卦对象 */
export function hexagramByBinary(binary) {
  const h = getHexagram(String(binary));
  if (!h) throw new Error('无效的卦二进制：' + binary);
  return h;
}

/** binary → 卦名（不加载经文以外的多余内容） */
export function hexagramName(binary) {
  indexes();
  const h = _byBinary.get(String(binary));
  return h ? h.name : null;
}

/** 64 条简明数组：{number,name,fullName,binary,upper,lower, palace, palaceElement, generation, shiPos, yingPos} */
export function hexagrams() {
  indexes();
  const list = [];
  for (let n = 1; n <= 64; n++) {
    const h = _byNumber.get(n);
    const meta = metaOf(h);
    list.push({
      number: meta.number,
      name: meta.name,
      fullName: meta.fullName,
      binary: meta.binary,
      upper: meta.upper.name,
      lower: meta.lower.name,
      palace: meta.palace,
      palaceElement: meta.palaceElement,
      generation: meta.generation,
      shiPos: meta.shiPos,
      yingPos: meta.yingPos,
    });
  }
  return list;
}

/** 上卦/下卦名（由 binary 推：初爻最左） */
export function trigramsOf(binary) {
  const b = String(binary);
  if (!/^[01]{6}$/.test(b)) throw new Error('无效的卦二进制：' + b);
  const lower = BINARY_TRIGRAM[b.slice(0, 3)];
  const upper = BINARY_TRIGRAM[b.slice(3, 6)];
  return { upper, lower };
}

/** 由上下卦名（或数）拼 binary */
export function binaryOf(upper, lower) {
  const lo = typeof lower === 'number' ? TRIGRAM_ORDER[lower - 1] : lower;
  const up = typeof upper === 'number' ? TRIGRAM_ORDER[upper - 1] : upper;
  if (!TRIGRAMS[lo]) throw new Error('无效的下卦：' + lower);
  if (!TRIGRAMS[up]) throw new Error('无效的上卦：' + upper);
  return TRIGRAMS[lo].binary + TRIGRAMS[up].binary;
}

/** 互卦 binary：二三四爻为下卦、三四五爻为上卦 */
export function huBinary(binary) {
  const b = String(binary);
  return b.slice(1, 4) + b.slice(2, 5);
}

/** 错卦（六爻全变） */
export function cuoBinary(binary) {
  return String(binary).split('').map((c) => (c === '1' ? '0' : '1')).join('');
}

/** 综卦（上下颠倒） */
export function zongBinary(binary) {
  return String(binary).split('').reverse().join('');
}

/** 数据来源信息 */
export function dataSource() {
  const p = payload();
  return { source: p.source, fetchedAt: p.fetchedAt, license: p.license, count: p.hexagrams.length };
}

/** 按行号取六爻爻辞（pos 1-6） */
export function yaoCi(number, pos) {
  const h = getHexagram(number);
  if (!h) return null;
  const y = h.yao.find((x) => x.pos === Number(pos));
  return y || null;
}

export default {
  TRIGRAMS, TRIGRAM_ORDER, GENERATIONS, SHI_YING, PALACE_FLIPS,
  getHexagram, hexagramByNumber, hexagramByBinary, hexagrams, hexagramName,
  palaceInfo, palaceTable, trigramsOf, binaryOf, huBinary, cuoBinary, zongBinary,
  wuxingRelation, wuxingText, dataSource, yaoCi, aliasesOf,
};
