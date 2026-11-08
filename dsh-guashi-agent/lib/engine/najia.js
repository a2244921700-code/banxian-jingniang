/**
 * najia.js —— 京房纳甲：纳甲装卦、八宫世应、六亲、六神、旬空标记
 *
 * 依据《京氏易传》纳甲法（火烧林、增删卜易皆用此）：
 *  - 乾纳甲壬（内甲外壬）、坤纳乙癸、震纳庚、巽纳辛、坎纳戊、离纳己、艮纳丙、兑纳丁
 *  - 地支：阳卦顺行、阴卦逆行（见 NAJIA_BRANCHES）
 *  - 六亲以卦宫五行为“我”：生我父母、我生子孙、克我官鬼、我克妻财、同我兄弟
 *  - 六神按日干起：甲乙青龙、丙丁朱雀、戊勾陈、己腾蛇、庚辛白虎、壬癸玄武
 */

import {
  TRIGRAMS, TRIGRAM_ORDER, BINARY_TRIGRAM, palaceInfo, wuxingRelation,
} from './hexagrams.js';
import {
  STEMS, BRANCHES, STEM_ELEMENTS, BRANCH_ELEMENTS, xunKong,
} from './almanac.js';

// ============================================================
// 纳甲数据
// ============================================================

/** 纳甲天干：[内卦天干, 外卦天干] */
export const NAJIA_STEMS = {
  乾: ['甲', '壬'],
  坤: ['乙', '癸'],
  震: ['庚', '庚'],
  巽: ['辛', '辛'],
  坎: ['戊', '戊'],
  离: ['己', '己'],
  艮: ['丙', '丙'],
  兑: ['丁', '丁'],
};

/** 纳甲地支：内卦三爻（初、二、三）与外卦三爻（四、五、上） */
export const NAJIA_BRANCHES = {
  乾: { inner: ['子', '寅', '辰'], outer: ['午', '申', '戌'] },
  坤: { inner: ['未', '巳', '卯'], outer: ['丑', '亥', '酉'] },
  震: { inner: ['子', '寅', '辰'], outer: ['午', '申', '戌'] },
  巽: { inner: ['丑', '亥', '酉'], outer: ['未', '巳', '卯'] },
  坎: { inner: ['寅', '辰', '午'], outer: ['申', '戌', '子'] },
  离: { inner: ['卯', '丑', '亥'], outer: ['酉', '未', '巳'] },
  艮: { inner: ['辰', '午', '申'], outer: ['戌', '子', '寅'] },
  兑: { inner: ['巳', '卯', '丑'], outer: ['亥', '酉', '未'] },
};

/** 六神（六兽）固定顺序 */
export const LIUSHEN = ['青龙', '朱雀', '勾陈', '腾蛇', '白虎', '玄武'];

/** 日干 → 初爻所起六神索引 */
export const LIUSHEN_START = {
  甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5,
};

/** 六亲名称（以卦宫五行为我） */
export const LIUQIN = ['父母', '兄弟', '子孙', '妻财', '官鬼'];

// ============================================================
// 六亲、六神
// ============================================================

/**
 * 六亲：以卦宫五行为“我”，判断某爻地支五行与我的关系。
 * @param {string} palaceElement 卦宫五行（金木水火土）
 * @param {string} lineElement 爻的五行（地支五行）
 * @returns {'父母'|'兄弟'|'子孙'|'妻财'|'官鬼'}
 */
export function liuQin(palaceElement, lineElement) {
  const rel = wuxingRelation(palaceElement, lineElement); // 我 → 彼
  switch (rel) {
    case '生': return '子孙'; // 我生者
    case '克': return '妻财'; // 我克者
    case '被生': return '父母'; // 生我者
    case '被克': return '官鬼'; // 克我者
    case '比和': return '兄弟'; // 同我
    default: return '未知';
  }
}

/**
 * 六神：按日干定初爻起神，自下而上顺排六神。
 * @param {string} dayGan 日干（'甲'…'癸'）
 * @returns {string[]} 长度 6，索引 0 为初爻
 */
export function liuShen(dayGan) {
  const start = LIUSHEN_START[dayGan];
  if (start == null) throw new Error('无效的日干：' + dayGan);
  return Array.from({ length: 6 }, (_, i) => LIUSHEN[(start + i) % 6]);
}

/** 由日柱（'甲子' 或 {stem}）取六神数组 */
export function liuShenOfDay(dayGanzhi) {
  let stem;
  if (typeof dayGanzhi === 'string') stem = dayGanzhi[0];
  else if (dayGanzhi && dayGanzhi.stem) stem = dayGanzhi.stem;
  else throw new Error('无效的日柱：' + String(dayGanzhi));
  return liuShen(stem);
}

// ============================================================
// 装卦
// ============================================================

/**
 * 纳甲：由卦二进制（初爻最左）得六爻干支。
 * @returns {Array<{pos:number, yinYang:'阳'|'阴', stem:string, branch:string, ganzhi:string,
 *                  stemElement:string, element:string}>}
 */
export function najiaLines(binary) {
  const b = String(binary);
  if (!/^[01]{6}$/.test(b)) throw new Error('无效的卦二进制：' + b);
  const lowerName = BINARY_TRIGRAM[b.slice(0, 3)];
  const upperName = BINARY_TRIGRAM[b.slice(3, 6)];
  const lines = [];
  for (let i = 0; i < 6; i++) {
    const isLower = i < 3;
    const triName = isLower ? lowerName : upperName;
    const table = NAJIA_BRANCHES[triName];
    const branch = isLower ? table.inner[i] : table.outer[i - 3];
    const stem = NAJIA_STEMS[triName][isLower ? 0 : 1];
    lines.push({
      pos: i + 1,
      yinYang: b[i] === '1' ? '阳' : '阴',
      stem,
      branch,
      ganzhi: stem + branch,
      stemElement: STEM_ELEMENTS[STEMS.indexOf(stem)],
      element: BRANCH_ELEMENTS[BRANCHES.indexOf(branch)],
    });
  }
  return lines;
}

/** 由上下卦名装卦 */
export function najiaOfTrigrams(upper, lower) {
  if (!TRIGRAMS[upper]) throw new Error('无效的上卦：' + upper);
  if (!TRIGRAMS[lower]) throw new Error('无效的下卦：' + lower);
  const binary = TRIGRAMS[lower].binary + TRIGRAMS[upper].binary;
  return { binary, lines: najiaLines(binary) };
}

/**
 * 完整装卦：纳甲 + 六亲 + 六亲五行 + 世应 + 旬空 + 六神。
 * @param {object} opts
 * @param {string} opts.binary 卦二进制
 * @param {string} [opts.dayGanzhi] 日柱（'甲子'），给出时算六神与旬空
 * @param {number[]} [opts.movingPositions] 动爻位置（1-6）
 * @returns {object} 卦装卦结果
 */
export function buildHexagram({ binary, dayGanzhi, movingPositions = [] }) {
  const b = String(binary);
  const info = palaceInfo(b);
  const raw = najiaLines(b);
  const moving = new Set(movingPositions.map(Number));
  const gods = dayGanzhi ? liuShenOfDay(dayGanzhi) : null;
  const kong = dayGanzhi ? xunKong(dayGanzhi) : null;
  const lines = raw.map((l) => ({
    ...l,
    liuqin: liuQin(info.palaceElement, l.element),
    liushen: gods ? gods[l.pos - 1] : null,
    shiYing: l.pos === info.shiPos ? '世' : (l.pos === info.yingPos ? '应' : ''),
    moving: moving.has(l.pos),
    kong: kong ? kong.includes(l.branch) : false,
  }));
  return {
    binary: b,
    palace: info.palace,
    palaceElement: info.palaceElement,
    generation: info.generation,
    shiPos: info.shiPos,
    yingPos: info.yingPos,
    lines,
  };
}

/**
 * 动爻变卦：翻转动爻阴阳。
 * @param {string} binary
 * @param {number[]} movingPositions 1-6
 */
export function changedBinary(binary, movingPositions) {
  const arr = String(binary).split('');
  for (const p of movingPositions) arr[Number(p) - 1] = arr[Number(p) - 1] === '1' ? '0' : '1';
  return arr.join('');
}

/** 世应：由世爻位置推应爻（世应相隔三爻） */
export function shiYingOf(shiPos) {
  const shi = Number(shiPos);
  if (shi < 1 || shi > 6) throw new Error('无效的世爻位置：' + shiPos);
  return { shiPos: shi, yingPos: ((shi + 2) % 6) + 1 };
}

/** 六亲对应的通常用神事项（供提示，非断语） */
export const LIUQIN_MEANING = {
  父母: '父母、长辈、文书、房产、车、学历、契约、消息',
  兄弟: '兄弟、同辈、竞争者、朋友、口舌、破财',
  子孙: '子女、下属、医药、福神、财源、出行顺利',
  妻财: '妻妾、财物、薪资、交易、器皿、欲望',
  官鬼: '官职、事业、疾病、盗贼、忧患、丈夫（女占）',
};

/** 用神速查：问什么事取哪个六亲（提示用，实际以场景定） */
export const YONGSHEN_HINT = [
  { topic: '求财、买卖、薪资', yong: '妻财' },
  { topic: '功名、官职、事业、诉讼对方', yong: '官鬼' },
  { topic: '文书、房宅、车、父母长辈、考试录取', yong: '父母' },
  { topic: '子女、医药、下属、福气', yong: '子孙' },
  { topic: '兄弟、朋友、竞争、合伙', yong: '兄弟' },
];

export default {
  NAJIA_STEMS, NAJIA_BRANCHES, LIUSHEN, LIUSHEN_START, LIUQIN,
  liuQin, liuShen, liuShenOfDay, najiaLines, najiaOfTrigrams, buildHexagram,
  changedBinary, shiYingOf, LIUQIN_MEANING, YONGSHEN_HINT,
};
