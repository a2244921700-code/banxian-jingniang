/**
 * meihua.js —— 梅花易数起卦（时间卦 / 数字卦 / 物数卦 / 显式上下卦）
 *
 * 起卦法（《梅花易数·卷一》）：
 *  - 时间卦：上卦 =（年支数 + 农历月 + 农历日）÷ 8 取余；下卦 =（年支数 + 农历月 + 农历日 + 时支数）÷ 8 取余；
 *            动爻 = 上数加时支数 ÷ 6 取余（余 0 作 6）。
 *  - 数字卦：第一数为上卦、第二数为下卦，第三数为动爻（未给动爻时以两数和加时支数取动）。
 *  - 物数卦：counts.upper / counts.lower 为物数、字数，动爻未给时以（上数 + 下数）取动。
 *  - 显式：直接给八卦数（1乾2兑3离4震5巽6坎7艮8坤）与动爻。
 *  - 卦以八除（余 0 作 8）、爻以六除（余 0 作 6）。
 * 体用：动爻所在之卦为用，另一卦为体；以体卦五行看用卦生克。
 */

import {
  TRIGRAMS, TRIGRAM_ORDER, BINARY_TRIGRAM, getHexagram, binaryOf, huBinary, wuxingRelation,
} from './hexagrams.js';
import { getAlmanac, BRANCHES, toDate } from './almanac.js';

/** 八卦数（1-8）→ 卦名 */
export function trigramByNumber(n) {
  let num = Number(n) % 8;
  if (num <= 0) num += 8;
  return TRIGRAM_ORDER[num - 1];
}

/** 异体/繁体卦名 → 简体卦名 */
const TRAD_TRIGRAM = { 兌: '兑', 離: '离', 兑: '兑', 离: '离' };

/** 显式起卦参数 → 八卦数（接受 1-8 数字、数字字符串、卦名）；无法解析返回 null */
function resolveTrigramNumber(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return mod8(v);
  const s = String(v).trim();
  if (/^-?\d+$/.test(s)) return mod8(parseInt(s, 10));
  const name = TRAD_TRIGRAM[s] || s;
  if (TRIGRAMS[name]) return TRIGRAMS[name].number;
  return null;
}

/** 数取余：余 0 视为 8 */
function mod8(n) {
  const r = Math.abs(Math.trunc(Number(n))) % 8;
  return r === 0 ? 8 : r;
}

/** 爻取余：余 0 视为 6 */
function mod6(n) {
  const r = Math.abs(Math.trunc(Number(n))) % 6;
  return r === 0 ? 6 : r;
}

/** 地支序号（子=1 … 亥=12） */
function branchNumberOf(branch) {
  return BRANCHES.indexOf(branch) + 1;
}

/** 体用关系（体卦五行对用卦五行） */
export function tiYongRelation(tiElement, yongElement) {
  const rel = wuxingRelation(tiElement, yongElement); // 体 → 用
  const map = {
    生: { relation: '体生用', luck: '泄气', summary: '体生用，泄我之气，事多耗费，求谋费力。' },
    克: { relation: '体克用', luck: '吉', summary: '体克用，我制于物，事可为，然须费力，终得其成。' },
    被生: { relation: '用生体', luck: '大吉', summary: '用生体，得外助，事顺而易成，有进益之喜。' },
    被克: { relation: '用克体', luck: '凶', summary: '用克体，受制于外，事多阻滞，宜守不宜进。' },
    比和: { relation: '体用比和', luck: '吉', summary: '体用比和，内外相合，谋为顺遂。' },
    无: { relation: '体用无涉', luck: '平', summary: '体用五行无生克，事势平淡，须看互变。' },
  };
  const m = map[rel] || map['无'];
  return { ...m, tiElement, yongElement };
}

/** 由八卦名取 {trigram, element} */
function trigramInfo(name) {
  const t = TRIGRAMS[name];
  return { trigram: name, element: t.element, symbol: t.symbol, number: t.number, nature: t.nature };
}

/** 由 binary 构造简要卦信息（ben/hu/bian 共用） */
function hexInfo(binary) {
  const h = getHexagram(binary);
  if (!h) throw new Error('无效的卦二进制：' + binary);
  return {
    number: h.number,
    name: h.name,
    fullName: h.fullName,
    binary: h.binary,
    upper: trigramInfo(h.upper.name),
    lower: trigramInfo(h.lower.name),
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

/** 动爻左右体用：动爻在下卦则下卦为用，动爻在上卦则上卦为用 */
function splitTiYong(binary, moving) {
  const b = String(binary);
  const upper = BINARY_TRIGRAM[b.slice(3, 6)];
  const lower = BINARY_TRIGRAM[b.slice(0, 3)];
  if (moving <= 3) return { ti: upper, yong: lower, lowerIsYong: true };
  return { ti: lower, yong: upper, lowerIsYong: false };
}

/**
 * 梅花易数起卦。
 * @param {object} opts
 * @param {string} [opts.method] 'meihua_time'|'time'|'meihua_number'|'number'|'meihua_count'|'count'|'explicit'
 * @param {Date|string|number} [opts.date] 起卦时间，缺省当前
 * @param {number[]} [opts.numbers] 数字卦：2-3 个数
 * @param {{upper:number, lower:number, moving?:number}} [opts.counts] 物数卦
 * @param {number} [opts.upper] 显式上卦数（1-8 或八卦名）
 * @param {number} [opts.lower] 显式下卦数
 * @param {number} [opts.moving] 显式动爻（1-6）
 * @param {number} [opts.longitude] 经度（定真太阳时时辰）
 * @returns {object} { ok, method, time, cast, ben, hu, bian, tiYong, movingLine, lines, hints }
 */
export function castMeihua(opts = {}) {
  const methodRaw = String(opts.method || 'meihua_time').toLowerCase();
  const method = ({
    meihua_time: 'time', time: 'time', 时间: 'time',
    meihua_number: 'number', number: 'number', 数字: 'number',
    meihua_count: 'count', count: 'count', 物数: 'count', 字数: 'count',
    explicit: 'explicit', 显式: 'explicit',
  })[methodRaw];
  if (!method) throw new Error('未知的起卦方式：' + opts.method);

  const now = toDate(opts.date == null ? new Date() : opts.date);
  if (Number.isNaN(now.getTime())) throw new TypeError('无效的起卦时间：' + String(opts.date));
  const almanac = getAlmanac(now, opts.longitude != null ? { longitude: opts.longitude } : {});
  const hourBranch = almanac.hourBranch.branch;
  const hourNum = branchNumberOf(hourBranch);
  const yearBranchNum = branchNumberOf(almanac.lunar.yearBranch);

  let upperNum = null;
  let lowerNum = null;
  let moving = null;
  let detail = '';
  let source = method;

  const explicitUpper = opts.upper != null && opts.lower != null;

  if (method === 'time') {
    const base = yearBranchNum + almanac.lunar.month + almanac.lunar.day;
    upperNum = mod8(base);
    lowerNum = mod8(base + hourNum);
    moving = mod6(base + hourNum);
    detail = `时间卦：年支${almanac.lunar.yearBranch}（${yearBranchNum}）+ 农历${almanac.lunar.monthName}（${almanac.lunar.month}）+ ${almanac.lunar.dayName}（${almanac.lunar.day}）= ${base}；`
      + `加时支${hourBranch}（${hourNum}）= ${base + hourNum}。上卦 ${base}÷8 余 ${upperNum}，下卦 ${base + hourNum}÷8 余 ${lowerNum}，动爻 ${base + hourNum}÷6 余 ${moving}。`;
  } else if (method === 'number') {
    const nums = Array.isArray(opts.numbers) ? opts.numbers.map(Number) : null;
    if (!nums || nums.length < 2 || nums.some((n) => !Number.isFinite(n))) {
      if (explicitUpper) {
        // 只给上下卦：按显式处理
        source = 'explicit';
      } else {
        throw new Error('数字卦需要 numbers 至少 2 个数');
      }
    } else {
      upperNum = mod8(nums[0]);
      lowerNum = mod8(nums[1]);
      if (nums.length >= 3) {
        moving = mod6(nums[2]);
        detail = `数字卦：上卦 ${nums[0]}÷8 余 ${upperNum}，下卦 ${nums[1]}÷8 余 ${lowerNum}，动爻 ${nums[2]}÷6 余 ${moving}。`;
      } else {
        moving = mod6(nums[0] + nums[1] + hourNum);
        detail = `数字卦：上卦 ${nums[0]}÷8 余 ${upperNum}，下卦 ${nums[1]}÷8 余 ${lowerNum}；`
          + `未给第三数，动爻取两数之和加时支${hourBranch}（${hourNum}）＝${nums[0] + nums[1] + hourNum}÷6 余 ${moving}。`;
      }
    }
  } else if (method === 'count') {
    const c = opts.counts;
    if (c && Number.isFinite(Number(c.upper)) && Number.isFinite(Number(c.lower))) {
      upperNum = mod8(c.upper);
      lowerNum = mod8(c.lower);
      if (c.moving != null && Number.isFinite(Number(c.moving))) {
        moving = mod6(c.moving);
        detail = `物数卦：上数 ${c.upper}÷8 余 ${upperNum}，下数 ${c.lower}÷8 余 ${lowerNum}，动爻 ${c.moving}÷6 余 ${moving}。`;
      } else {
        moving = mod6(Number(c.upper) + Number(c.lower) + hourNum);
        detail = `物数卦：上数 ${c.upper}÷8 余 ${upperNum}，下数 ${c.lower}÷8 余 ${lowerNum}；`
          + `未给动爻，取两数之和加时支${hourBranch}（${hourNum}）＝${Number(c.upper) + Number(c.lower) + hourNum}÷6 余 ${moving}。`;
      }
    } else if (explicitUpper) {
      source = 'explicit';
    } else {
      throw new Error('物数卦需要 counts.upper 与 counts.lower');
    }
  }

  if (source === 'explicit' || (upperNum == null && explicitUpper)) {
    source = 'explicit';
    const un = resolveTrigramNumber(opts.upper);
    const ln = resolveTrigramNumber(opts.lower);
    if (un == null || ln == null) {
      throw new Error('显式起卦需要同时给出有效的 upper 与 lower（八卦数 1-8 或卦名）');
    }
    upperNum = un;
    lowerNum = ln;
    if (opts.moving != null) {
      moving = mod6(opts.moving);
      detail = `显式起卦：上卦 ${opts.upper}→${upperNum}（${trigramByNumber(upperNum)}），下卦 ${opts.lower}→${lowerNum}（${trigramByNumber(lowerNum)}），动爻 ${opts.moving}→${moving}。`;
    } else {
      moving = null;
      detail = `显式起卦：上卦 ${opts.upper}→${upperNum}（${trigramByNumber(upperNum)}），下卦 ${opts.lower}→${lowerNum}（${trigramByNumber(lowerNum)}）；未指定动爻，故无变卦与体用。`;
    }
  }

  if (upperNum == null || lowerNum == null) throw new Error('起卦参数不足，无法定上下卦');

  const upperName = trigramByNumber(upperNum);
  const lowerName = trigramByNumber(lowerNum);
  const binary = binaryOf(upperName, lowerName);
  const ben = hexInfo(binary);
  const hu = hexInfo(huBinary(binary));
  const movingLine = moving || null;
  let bian = null;
  let tiYong = null;
  const hints = [];

  if (movingLine) {
    const arr = binary.split('');
    arr[movingLine - 1] = arr[movingLine - 1] === '1' ? '0' : '1';
    bian = hexInfo(arr.join(''));
    const { ti, yong } = splitTiYong(binary, movingLine);
    const rel = tiYongRelation(TRIGRAMS[ti].element, TRIGRAMS[yong].element);
    tiYong = {
      ti: trigramInfo(ti),
      yong: trigramInfo(yong),
      relation: rel.relation,
      luck: rel.luck,
      summary: rel.summary,
      movingInYong: true,
    };
    hints.push(
      `本卦${ben.fullName}，互卦${hu.fullName}，变卦${bian.fullName}；`
      + `第${movingLine}爻动（动爻在${movingLine > 3 ? '上卦' : '下卦'}，故${movingLine > 3 ? '上' : '下'}卦为用）。`,
    );
    hints.push(`体卦${ti}（${TRIGRAMS[ti].element}），用卦${yong}（${TRIGRAMS[yong].element}）：${rel.relation}，${rel.summary}`);
    if (ben.binary === bian.binary) hints.push('动爻与静爻同阴阳，变卦同本卦，事体不迁。');
  } else {
    hints.push(`本卦${ben.fullName}，互卦${hu.fullName}；未定动爻，故无变卦、无体用。`);
  }
  hints.push(`起卦时间：${almanac.local}（${almanac.lunar.fullName}），月建${almanac.monthBranch}，日辰${almanac.dayGanzhi}，旬空${almanac.xunKong.join('')}。`);
  hints.push(`互卦${hu.fullName}为事之中间过程，变卦为事之归宿；体用看生克旺衰，再参互变。`);

  return {
    ok: true,
    method: `meihua_${source}`,
    time: almanac,
    cast: {
      detail,
      source,
      upperNumber: upperNum,
      lowerNumber: lowerNum,
      moving: movingLine,
      upperTrigram: upperName,
      lowerTrigram: lowerName,
      hourBranch,
      hourNumber: hourNum,
      yearBranchNumber: yearBranchNum,
    },
    ben,
    hu,
    bian,
    tiYong,
    movingLine,
    lines: [],
    hints,
  };
}

export default { castMeihua, trigramByNumber, tiYongRelation };
