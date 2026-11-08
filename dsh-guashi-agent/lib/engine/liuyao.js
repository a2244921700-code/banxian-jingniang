/**
 * liuyao.js —— 六爻起卦（摇钱 / 随机 / 手动爻）与装卦
 *
 * throws 约定（自下而上 6 爻）：
 *  - 数字：6 老阴（动）、7 少阳、8 少阴、9 老阳（动）
 *  - 字符串：'正正反' 形式，正 = 阳 = 3，反 = 阴 = 2，三枚相加得 6/7/8/9
 *  - 也接受 '老阴'/'少阳'/'少阴'/'老阳' 与 '6'~'9' 数字字符串
 *
 * 装卦：京房纳甲 + 八宫世应 + 六亲（以卦宫五行为我）+ 六神（按日干）+ 旬空（按日柱）
 */

import {
  TRIGRAMS, getHexagram, binaryOf,
} from './hexagrams.js';
import { buildHexagram, changedBinary, liuShenOfDay } from './najia.js';
import { getAlmanac } from './almanac.js';

/** 四象名称 */
export const THROW_NAMES = { 6: '老阴', 7: '少阳', 8: '少阴', 9: '老阳' };

/** 四象 → 阴阳与是否动 */
export const THROW_INFO = {
  6: { yinYang: '阴', moving: true, name: '老阴' },
  7: { yinYang: '阳', moving: false, name: '少阳' },
  8: { yinYang: '阴', moving: false, name: '少阴' },
  9: { yinYang: '阳', moving: true, name: '老阳' },
};

/** 四象名称 → 爻值（反向查表） */
const NAME_TO_THROW = { 老阴: 6, 少阳: 7, 少阴: 8, 老阳: 9 };

/**
 * 解析单爻。返回 6/7/8/9。
 * @param {number|string} value
 */
export function parseThrow(value) {
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= 6 && value <= 9) return value;
    throw new Error('爻值应为 6/7/8/9，收到 ' + value);
  }
  const s = String(value).trim();
  if (/^[6789]$/.test(s)) return Number(s);
  if (NAME_TO_THROW[s]) return NAME_TO_THROW[s];
  if (/^[正反]{3}$/.test(s)) {
    let sum = 0;
    for (const ch of s) sum += ch === '正' ? 3 : 2;
    return sum;
  }
  if (/^[3]{1,3}2*$/.test(s) || /^[23]+$/.test(s)) {
    // 例如 '332' 表示正正反
    let sum = 0;
    for (const ch of s) sum += Number(ch);
    if (sum >= 6 && sum <= 9) return sum;
  }
  throw new Error('无法解析的爻：' + String(value) + '（可用 6/7/8/9 或「正正反」形式）');
}

/** 四象值 → 二进制位（阳 1 阴 0） */
export function throwToBit(v) {
  return v === 7 || v === 9 ? '1' : '0';
}

/** 完整卦信息（含经文） */
function hexInfo(binary) {
  const h = getHexagram(binary);
  if (!h) throw new Error('无效的卦二进制：' + binary);
  const tri = (name) => ({
    trigram: name,
    element: TRIGRAMS[name].element,
    symbol: TRIGRAMS[name].symbol,
    number: TRIGRAMS[name].number,
    nature: TRIGRAMS[name].nature,
  });
  return {
    number: h.number,
    name: h.name,
    fullName: h.fullName,
    binary: h.binary,
    upper: tri(h.upper.name),
    lower: tri(h.lower.name),
    palace: h.palace,
    palaceElement: h.palaceElement,
    generation: h.generation,
    shiPos: h.shiPos,
    yingPos: h.yingPos,
    guaCi: h.guaCi,
    tuan: h.tuan,
    xiang: h.xiang,
    yao: h.yao,
  };
}

/** 由上下卦名/八卦数拼 binary（upper/lower 可传 1-8 或卦名，兼容繁体兌/離） */
function binaryFromExplicit(upper, lower) {
  const order = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
  const trad = { 兌: '兑', 離: '离' };
  const toName = (v) => {
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) throw new Error('无效的上/下卦数：' + v);
      const n = ((v % 8) + 8) % 8;
      return order[(n === 0 ? 8 : n) - 1];
    }
    const s = String(v).trim();
    if (/^-?\d+$/.test(s)) return toName(parseInt(s, 10));
    const name = trad[s] || s;
    if (!TRIGRAMS[name]) throw new Error('无效的卦名：' + v);
    return name;
  };
  return binaryOf(toName(upper), toName(lower));
}

/**
 * 六爻起卦（摇钱 / 手动爻）。
 * @param {object} opts
 * @param {Array<number|string>} [opts.throws] 自下而上 6 爻
 * @param {Date|string|number} [opts.date]
 * @param {number|string} [opts.upper] 显式上卦（八卦数 1-8 或卦名），仅作校验或手动指定
 * @param {number|string} [opts.lower] 显式下卦
 * @param {number} [opts.longitude]
 * @returns {object}
 */
export function castLiuyao(opts = {}) {
  const now = opts.date == null ? new Date() : opts.date;
  const almanac = getAlmanac(now, opts.longitude != null ? { longitude: opts.longitude } : {});
  const dayGanzhi = almanac.dayGanzhi;

  const hasThrows = Array.isArray(opts.throws) && opts.throws.length > 0;
  const hasExplicit = opts.upper != null && opts.lower != null;

  if (!hasThrows && !hasExplicit) {
    throw new Error('六爻起卦需要 throws（自下而上 6 爻）或显式 upper/lower');
  }

  let values;
  let binary;
  let validation = null;
  const hints = [];
  let detail = '';
  let method = 'liuyao';

  if (hasThrows) {
    if (opts.throws.length !== 6) {
      throw new Error('throws 应为 6 个爻值（自下而上），收到 ' + opts.throws.length + ' 个');
    }
    values = opts.throws.map(parseThrow);
    binary = values.map(throwToBit).join('');
    detail = '摇钱/手动爻：' + values.map((v, i) => `第${i + 1}爻${v}（${THROW_INFO[v].name}${THROW_INFO[v].moving ? '·动' : ''}）`).join('，') + '。';
    if (hasExplicit) {
      const expect = binaryFromExplicit(opts.upper, opts.lower);
      validation = {
        ok: expect === binary,
        expected: expect,
        actual: binary,
        note: expect === binary
          ? '显式上下卦与摇钱结果一致。'
          : `显式上下卦为 ${expect}，摇钱结果为 ${binary}，已以摇钱结果为准。`,
      };
      if (!validation.ok) hints.push(validation.note);
    }
  } else {
    method = 'liuyao_manual';
    binary = binaryFromExplicit(opts.upper, opts.lower);
    values = binary.split('').map((b) => (b === '1' ? 7 : 8)); // 无动爻
    detail = `手动指定上下卦：上卦${opts.upper}、下卦${opts.lower}，无动爻。`;
  }

  const movingPositions = [];
  values.forEach((v, i) => { if (THROW_INFO[v].moving) movingPositions.push(i + 1); });
  const ben = hexInfo(binary);
  const mounted = buildHexagram({ binary, dayGanzhi, movingPositions });
  const bianBinary = changedBinary(binary, movingPositions);
  const hasBian = movingPositions.length > 0;
  const bian = hasBian ? hexInfo(bianBinary) : null;
  const bianMounted = hasBian ? buildHexagram({ binary: bianBinary, dayGanzhi }) : null;
  const gods = liuShenOfDay(dayGanzhi);
  const kong = almanac.xunKong;

  const lines = mounted.lines.map((l, i) => ({
    pos: l.pos,
    yinYang: l.yinYang,
    moving: l.moving,
    throwValue: values[i],
    throwName: THROW_INFO[values[i]].name,
    gan: l.stem,
    zhi: l.branch,
    ganzhi: l.ganzhi,
    wuxing: l.element,
    liuqin: l.liuqin,
    liushen: gods[i],
    shiYing: l.shiYing,
    kong: l.kong,
    yaoCi: ben.yao[i] ? ben.yao[i].text : '',
    xiaoXiang: ben.yao[i] ? ben.yao[i].xiang : '',
  }));

  // 变爻信息：动爻原值 → 变后阴阳
  const movingLines = movingPositions.map((pos) => ({
    pos,
    from: values[pos - 1],
    fromName: THROW_INFO[values[pos - 1]].name,
    to: values[pos - 1] === 9 ? 8 : 7,
    toName: values[pos - 1] === 9 ? '少阴' : '少阳',
    fromYang: values[pos - 1] === 9 ? '阳' : '阴',
    toYang: values[pos - 1] === 9 ? '阴' : '阳',
  }));

  const monthBranch = almanac.monthBranch;
  const monthElement = almanac.monthBranchElement;
  hints.push(`月建${monthBranch}（${monthElement}），日辰${dayGanzhi}，旬空${kong.join('')}。`);
  if (movingPositions.length === 0) {
    hints.push('六爻安静，以本卦与用神旺衰断，事态较稳。');
  } else if (movingPositions.length === 1) {
    hints.push(`一爻动：第${movingPositions[0]}爻动，以该动爻与变卦之爻断。`);
  } else {
    hints.push(`${movingPositions.length}爻动：以动爻少者为主，多爻动则参变卦大意。`);
  }
  hints.push(`世爻在第${ben.shiPos}爻（${lines[ben.shiPos - 1].liuqin}${lines[ben.shiPos - 1].ganzhi}），应爻在第${ben.yingPos}爻（${lines[ben.yingPos - 1].liuqin}${lines[ben.yingPos - 1].ganzhi}）。`);
  if (kong.length === 2) {
    const kongLines = lines.filter((l) => l.kong).map((l) => `第${l.pos}爻${l.liuqin}${l.ganzhi}`);
    if (kongLines.length) hints.push(`旬空之爻：${kongLines.join('、')}（空则暂虚，待出空填实）。`);
  }
  hints.push('六亲以卦宫五行为我：生我父母、我生子孙、克我官鬼、我克妻财、同我兄弟；用神按所问之事取。');
  if (ben.binary === (bian ? bian.binary : '')) hints.push('六爻皆静，无变卦。');

  return {
    ok: true,
    method,
    time: almanac,
    cast: {
      detail,
      throws: values,
      throwing: values.map((v) => THROW_INFO[v].name),
      movingLines,
      validation,
      palace: mounted.palace,
      palaceElement: mounted.palaceElement,
      generation: mounted.generation,
      monthBranch,
      monthElement,
      dayGanzhi,
      xunKong: kong,
    },
    ben,
    bian,
    movingLine: movingPositions.length ? movingPositions[0] : null,
    movingLines,
    tiYong: null,
    lines,
    jin: { ben: mounted.lines, bian: bianMounted ? bianMounted.lines : null },
    hints,
  };
}

/**
 * 随机摇钱：每爻三枚铜钱，正（阳，3）反（阴，2）各半概率，三枚相加得 6/7/8/9。
 * @param {object} opts
 * @param {Date|string|number} [opts.date]
 * @param {() => number} [opts.random] 随机数发生器（返回 [0,1)），便于测试
 * @param {number} [opts.longitude]
 */
export function castLiuyaoRandom(opts = {}) {
  const rnd = typeof opts.random === 'function' ? opts.random : Math.random;
  const coins = [];
  const throws = [];
  for (let i = 0; i < 6; i++) {
    const row = [];
    let sum = 0;
    for (let c = 0; c < 3; c++) {
      const face = rnd() < 0.5 ? 3 : 2; // 正=3（阳），反=2（阴）
      row.push(face === 3 ? '正' : '反');
      sum += face;
    }
    coins.push(row.join(''));
    throws.push(sum);
  }
  const result = castLiuyao({ ...opts, throws });
  result.method = 'liuyao_random';
  result.cast.coins = coins;
  result.cast.detail = '随机摇钱（每爻三枚）：' + coins.map((c, i) => `第${i + 1}爻${c}`).join('，') + '。' + result.cast.detail;
  return result;
}

export default {
  THROW_NAMES, THROW_INFO, parseThrow, throwToBit, castLiuyao, castLiuyaoRandom,
};
