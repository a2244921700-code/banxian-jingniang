/**
 * liuren.js —— 大六壬排盘引擎（月将加时 / 四课 / 九宗门三传 / 十二天将）
 *
 * 纯 ESM、零第三方依赖；只依赖同目录 ./almanac.js（engine-smith 交付，只读引用）。
 *
 * 实现范围（SPEC §3.2 / §2.7）：
 *   - 月将按「中气过宫」：雨水后亥将登明、春分后戌将河魁、谷雨后酉将从魁、小满后申将传送、
 *     夏至后未将小吉、大暑后午将胜光、处暑后巳将太乙、秋分后辰将天罡、霜降后卯将太冲、
 *     小雪后寅将功曹、冬至后丑将大吉、大寒后子将神后（节气以 getAlmanac 的当前节气为准，
 *     「节」则沿用上一中气之将，与古法「中气换将」一致）；
 *   - 月将加时：天盘[地盘支] = 月将 + (地盘支 − 时支)（支序顺推）；
 *   - 四课：日干寄宫起干阳、干阴，日支起支阳、支阴；一课下位按「日干本身」论五行（非寄宫）；
 *   - 三传：九宗门「贼克→比用→涉害→遥克」次序，别责/八专/昴星/伏吟/反吟依古法；
 *     中传取初传之上神，末传取中传之上神（伏吟用三刑，反吟无克用井栏射）；
 *     涉害按《六壬大全》卷三：起点/终点不计，计克方向与发用同类（贼计受克、克计我克）；
 *   - 十二天将：昼贵/夜贵按日干（卯至申为昼；表依《六壬元女经》），
 *     贵人临地盘亥子丑寅卯辰顺布、巳午未申酉戌逆布（《六壬大全·括囊赋》注）；
 *   - 旬空：按日柱旬空。
 *
 * 流派结论（用户要求「最主流」）——逐项与古籍及主流工具核对：
 *   1. 月将中气换将：《六壬大全》卷二「十二神释」、《六壬指南》「月将即日宿太阳」→ 现实现一致。
 *   2. 昼夜贵人：《六壬元女经》（《壬学琐记》引）、《六壬粹言》「十二天将旦暮治」、
 *      《武备志·贵人例》皆作「甲戊庚昼丑夜未、乙己昼子夜申、丙丁昼亥夜酉、辛昼午夜寅、
 *      壬癸昼巳夜卯」；《六壬大全》卷三空亡例亦可旁证 → 现实现一致（不用「阳贵人=昼」异说）。
 *   3. 贵人顺逆：《六壬大全·括囊赋》注「亥至辰顺，巳至戌逆」→ 一致。
 *   4. 涉害深浅：《六壬大全》卷三算例「亥加丑历五重」「庚子日午加庚历二重」
 *      → 起点/终点不计、计同类克（贼计受克、克计我克）、寄干单独计，现实现一致。
 *      （《六壬指南》初学者读本简化为「先孟后仲」，不给深浅；本引擎从《大全》《粹言》。）
 *   5. 别责：《六壬指南》「阳日干合上乘神，阴日支三合前一位而不用乘神，中末俱干上神」
 *      → 一致。八专：《六壬指南》「干支同处一位，四课只得二课；阳日干上阳神顺三、
 *      阴日支上阴神逆三，中末干上」→ 一致（八专日取寄宫=日支者五日）。
 *   6. 反吟无克（井栏射）：《六壬指南》「以支神之井栏冲射上所得之神为初用（日支之马为用），
 *      日支所乘为中传，日干所乘为末传」→ 一致（初传取日支驿马）。
 *   7. 伏吟三刑、中传自刑冲末：《六壬指南》《六壬大全》→ 一致。
 *   8. 三传相因（中传=初传地盘所乘、末传=中传地盘所乘）：《六壬指南》→ 一致。
 *
 * 本引擎只出盘面与客观神煞；用神、课体吉凶、应期由 skills 判断（SPEC §3.2/§2.7）。
 *
 * 校验来源（详见 test/engine-liuren.test.mjs 注释）：
 *   - 《六壬大全（四库全书本）》卷一「入手法」十干寄宫、九宗门歌诀，卷二「十二神释」，
 *     卷三涉害/缀瑕算例；
 *   - 《六壬指南》九宗门、伏吟、八专、别责、反吟诸条；
 *   - 《六壬粹言》（清·刘赤江）涉害、别责、八专、反吟无克诸条；
 *   - 《壬学琐记》引《六壬元女经》昼夜贵人；《武备志·贵人例》旁证；
 *   - 开源排盘工具 kentang2017/kinliuren 与 goliajp/mingli（mingli-liuren crate）交叉核对
 *     （分歧项已在测试注释注明，如 kinliuren 涉害计起点、反吟驿马取时支）。
 */

import { getAlmanac, xunKong } from './almanac.js';

// ============================================================
// 常量
// ============================================================

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const STEM_ELEMENT = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
const BRANCH_ELEMENT = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};
const STEM_YANG = { 甲: true, 丙: true, 戊: true, 庚: true, 壬: true };

/** 十干寄宫（《六壬大全·入手法》）：甲课寅、乙课辰、丙戊课巳、丁己课未、庚课申、辛课戌、壬课亥、癸课丑 */
export const JI_GONG = {
  甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳',
  己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑',
};

/** 月将（中气过宫）：节气索引（0=小寒，见 almanac SOLAR_TERMS）→ 月将 */
export const YUE_JIANG_BY_ZHONGQI = {
  1: { branch: '子', name: '神后' }, // 大寒
  3: { branch: '亥', name: '登明' }, // 雨水
  5: { branch: '戌', name: '河魁' }, // 春分
  7: { branch: '酉', name: '从魁' }, // 谷雨
  9: { branch: '申', name: '传送' }, // 小满
  11: { branch: '未', name: '小吉' }, // 夏至
  13: { branch: '午', name: '胜光' }, // 大暑
  15: { branch: '巳', name: '太乙' }, // 处暑
  17: { branch: '辰', name: '天罡' }, // 秋分
  19: { branch: '卯', name: '太冲' }, // 霜降
  21: { branch: '寅', name: '功曹' }, // 小雪
  23: { branch: '丑', name: '大吉' }, // 冬至
};

/** 二十四节气名（与 almanac SOLAR_TERMS 同序：0=小寒，偶数=节、奇数=中气） */
const SOLAR_TERM_NAMES = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];

/** 十二天将（次序固定） */
const JIANGS = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'];

/**
 * 昼贵 / 夜贵表：依《六壬元女经》昼夜贵人（《壬学琐记》引，《六壬粹言》「十二天将旦暮治」同）。
 * 贵人歌「甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸蛇兔藏，六辛逢虎马」给的是地支对，
 * 昼夜分配古法为：甲戊庚昼丑夜未、乙己昼子夜申、丙丁昼亥夜酉、辛昼午夜寅、壬癸昼巳夜卯。
 * 旁证：《六壬大全》卷三「甲申旬午未空亡……辛日旦贵空……甲戊庚三日夜贵空」，
 * 甲申旬空午未，恰合辛日旦贵午、甲戊庚夜贵未，与上表一致。
 */
export const GUI_REN = {
  甲: { 昼: '丑', 夜: '未' },
  乙: { 昼: '子', 夜: '申' },
  丙: { 昼: '亥', 夜: '酉' },
  丁: { 昼: '亥', 夜: '酉' },
  戊: { 昼: '丑', 夜: '未' },
  己: { 昼: '子', 夜: '申' },
  庚: { 昼: '丑', 夜: '未' },
  辛: { 昼: '午', 夜: '寅' },
  壬: { 昼: '巳', 夜: '卯' },
  癸: { 昼: '巳', 夜: '卯' },
};

/** 三合局 → 驿马（申子辰马在寅、寅午戌马在申、巳酉丑马在亥、亥卯未马在巳） */
export const YI_MA = {
  申: '寅', 子: '寅', 辰: '寅',
  寅: '申', 午: '申', 戌: '申',
  巳: '亥', 酉: '亥', 丑: '亥',
  亥: '巳', 卯: '巳', 未: '巳',
};

/** 三刑 chain（自刑记自身）：寅→巳→申、丑→戌→未、子↔卯、辰午酉亥自刑 */
const XING = {
  寅: '巳', 巳: '申', 申: '寅',
  丑: '戌', 戌: '未', 未: '丑',
  子: '卯', 卯: '子',
  辰: '辰', 午: '午', 酉: '酉', 亥: '亥',
};

/** 六冲 */
const CHONG = {
  子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅',
  卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳',
};


// ============================================================
// 小工具
// ============================================================

const mod = (n, m) => ((n % m) + m) % m;
const bIdx = (branch) => BRANCHES.indexOf(branch);
const sIdx = (stem) => STEMS.indexOf(stem);

/** 五行相克：a 克 b？ */
export function controls(a, b) {
  const order = ['木', '火', '土', '金', '水'];
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia < 0 || ib < 0) return false;
  return (ia + 2) % 5 === ib; // 木克土、土克水、水克火、火克金、金克木
}
/** 五行相生：a 生 b？ */
export function generates(a, b) {
  const order = ['木', '火', '土', '金', '水'];
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia < 0 || ib < 0) return false;
  return (ia + 1) % 5 === ib;
}

/**
 * 六亲：以日干（我）论某支之六亲。
 * 生我者父母、我生者子孙、克我者官鬼、我克者妻财、比和者兄弟。
 */
export function liuQinOfBranch(dayStem, branch) {
  const me = STEM_ELEMENT[dayStem];
  const other = BRANCH_ELEMENT[branch];
  if (!me || !other) return '';
  if (me === other) return '兄弟';
  if (generates(other, me)) return '父母';
  if (generates(me, other)) return '子孙';
  if (controls(other, me)) return '官鬼';
  if (controls(me, other)) return '妻财';
  return '';
}

/** 天盘：tianPan[地盘支] = 月将 + (地盘支 − 时支) */
function buildTianPan(yueJiangBranch, hourBranch) {
  const yj = bIdx(yueJiangBranch);
  const hb = bIdx(hourBranch);
  const tianPan = {};
  for (let p = 0; p < 12; p += 1) {
    tianPan[BRANCHES[p]] = BRANCHES[mod(yj + p - hb, 12)];
  }
  return tianPan;
}

/** 地盘支 → 天盘支 的逆查：天盘为某支时，地盘在何支 */
function earthOfHeaven(tianPan, heavenBranch) {
  for (let p = 0; p < 12; p += 1) {
    if (tianPan[BRANCHES[p]] === heavenBranch) return BRANCHES[p];
  }
  return '';
}

/** 昼夜：auto 依「卯至申为昼」；否则按入参 */
function resolveDayNight(daynight, hourBranch) {
  if (daynight === '昼' || daynight === '夜') return daynight;
  const h = bIdx(hourBranch);
  return h >= 3 && h <= 8 ? '昼' : '夜';
}

// ============================================================
// 三传（九宗门）
// ============================================================

/** 一课下位五行：一课下位是「日干」本身，其余课下位是地支 */
function downElementOf(keIdx, dayStem, down) {
  if (keIdx === 0) return STEM_ELEMENT[dayStem];
  return BRANCH_ELEMENT[down];
}

/**
 * 课的下位是否克上神（下贼上）；上神是否克下位（上克下）。
 * 一课下位论日干本身五行；其地盘位（寄宫）只用于涉害历数。
 */
function relationOf(ke, keIdx, dayStem) {
  const down = downElementOf(keIdx, dayStem, ke.downBranch);
  const up = BRANCH_ELEMENT[ke.up];
  if (controls(down, up)) return 'zei'; // 下贼上
  if (controls(up, down)) return 'ke'; // 上克下
  return 'other';
}

/** 由日柱（或日干+日支）与天盘构造四课；一课下位记日干本身，另记寄宫支 */
export function buildSiKe(dayGanzhi, tianPan) {
  const dayStem = dayGanzhi[0];
  const dayBranch = dayGanzhi[1];
  const lodging = JI_GONG[dayStem];
  const ke1 = { up: tianPan[lodging], down: dayStem, downBranch: lodging };
  const ke2 = { up: tianPan[ke1.up], down: ke1.up, downBranch: ke1.up };
  const ke3 = { up: tianPan[dayBranch], down: dayBranch, downBranch: dayBranch };
  const ke4 = { up: tianPan[ke3.up], down: ke3.up, downBranch: ke3.up };
  return [ke1, ke2, ke3, ke4];
}

/** 干支寄藏于某地盘宫的天干（用于涉害计「寄干」之克） */
function stemsLodgedAt(branch) {
  const out = [];
  for (const s of STEMS) if (JI_GONG[s] === branch) out.push(s);
  return out;
}
const LODGED_STEMS = (() => {
  const m = {};
  for (const b of BRANCHES) m[b] = stemsLodgedAt(b);
  return m;
})();

/**
 * 涉害深浅：天盘神 up 临地盘 down，自 down 的下一支顺行至 up 本家之前，
 * **起点与终点均不计**，沿途「地支 + 寄于该宫之天干」各计一重。
 * 计克方向与发用同类（《六壬大全》卷三涉害算例）：
 *   - 下贼上（orientation='zei'）：计地盘（含寄干）克 up —— 受克数；
 *   - 上克下（orientation='ke'）：计 up 克地盘（含寄干）—— 我克数。
 * 验例（《六壬大全》卷三）：
 *   「亥加丑，前行历辰、戊、未、己、戌土位五重，归本家亥位」→ shehaiDepth('亥','丑','zei') = 5；
 *   「庚子日午加庚，前行历酉辛金二重，归本家地盘午位」→ shehaiDepth('午','申','ke') = 2
 *     （本引擎按寄宫计：酉金 + 戌寄辛金）；
 *   「辰加寅，历卯木一重，归本家辰位」→ shehaiDepth('辰','寅','zei') = 1（本家寄干乙木不计）。
 * 依《六壬粹言》「取克贼之神，从地盘历数归于本家，以受克深者为用」。
 */
export function shehaiDepth(up, down, orientation = 'zei') {
  const target = BRANCH_ELEMENT[up];
  const asZei = orientation !== 'ke';
  let depth = 0;
  for (let step = 1; step < 12; step += 1) {
    const g = BRANCHES[mod(bIdx(down) + step, 12)];
    if (g === up) break;
    const branchEl = BRANCH_ELEMENT[g];
    if (asZei ? controls(branchEl, target) : controls(target, branchEl)) depth += 1;
    for (const s of LODGED_STEMS[g]) {
      const se = STEM_ELEMENT[s];
      if (asZei ? controls(se, target) : controls(target, se)) depth += 1;
    }
  }
  return depth;
}

/** 孟仲季：孟（寅申巳亥）=0 深，仲（子午卯酉）=1，季（辰戌丑未）=2；看天盘神所临地盘位 */
export function mengZhongJi(branch) {
  const i = bIdx(branch);
  if ([2, 5, 8, 11].includes(i)) return 0; // 寅巳申亥
  if ([0, 3, 6, 9].includes(i)) return 1; // 子卯午酉
  return 2; // 丑辰未戌
}


/** 从初传支层层取天盘上神，得三传（非伏吟/反吟之常法） */
function chuanFrom(first, tianPan) {
  const mid = tianPan[first];
  const last = tianPan[mid];
  return [first, mid, last];
}

/**
 * 贼克 / 比用 / 涉害。
 * @param {Array} kes 四课
 * @param {boolean} zei 取下贼上（true）或上克下（false）
 * @param {string} dayStem
 * @param {boolean} isYangDay
 * @returns {{first:string, fa:string, keTi:string}}
 */
function resolveKeDe(kes, zei, dayStem, isYangDay) {
  const hits = kes.filter((k, i) => relationOf(k, i, dayStem) === (zei ? 'zei' : 'ke'));
  if (hits.length === 1) {
    return {
      first: hits[0].up,
      fa: '贼克法',
      keTi: zei ? '重审' : '元首',
    };
  }
  // 比用：取与日干同阴阳之上神
  const bi = hits.filter((k) => (bIdx(k.up) % 2 === 0) === isYangDay);
  if (bi.length === 1) {
    return { first: bi[0].up, fa: '比用法', keTi: '知一' };
  }
  // 俱比取比者，俱不比取全部克课，进涉害
  const pool = bi.length > 0 ? bi : hits;
  const orientation = zei ? 'zei' : 'ke';
  const depthOf = (k) => shehaiDepth(k.up, k.downBranch, orientation);
  const depths = pool.map(depthOf);
  const maxDepth = Math.max(...depths);
  let candidates = pool.filter((_, i) => depths[i] === maxDepth);
  // 孟 > 仲 > 季（看所临地盘位）
  const bestRank = Math.min(...candidates.map((k) => mengZhongJi(k.downBranch)));
  candidates = candidates.filter((k) => mengZhongJi(k.downBranch) === bestRank);
  if (candidates.length > 1) {
    const prefer = isYangDay ? kes[0].up : kes[2].up;
    const found = candidates.find((k) => k.up === prefer);
    if (found) candidates = [found];
  }
  return {
    first: candidates[0].up,
    fa: '涉害法',
    keTi: candidates.length === 1 ? '见机' : '涉害',
    shehai: pool.map((k) => ({ up: k.up, down: k.downBranch, depth: depthOf(k) })),
  };
}

/**
 * 判课体并取三传。
 * @param {object} ctx {kes, dayStem, dayBranch, tianPan, isYangDay, offset}
 */
export function deriveSanChuan(ctx) {
  const { kes, dayStem, dayBranch, tianPan, isYangDay, offset } = ctx;
  const chuan = (first, fa, keTi) => ({ fa, keTi, first, chuan: chuanFrom(first, tianPan) });

  // 1. 伏吟：月将与时支同位（offset=0）
  if (offset === 0) {
    const relations = kes.map((k, i) => relationOf(k, i, dayStem));
    const hasZei = relations.includes('zei');
    const hasKe = relations.includes('ke');
    let first;
    let source; // 发用来自「干上神」还是「支上神」，供自刑时颠倒日辰
    if (hasZei || hasKe) {
      // 有克：依贼克法。伏吟只可能第一课（日干与寄宫）有克，故发用来自干侧。
      const idx = hasZei ? relations.indexOf('zei') : relations.indexOf('ke');
      first = kes[idx].up;
      source = idx === 0 ? 'gan' : 'zhi';
    } else {
      // 无克：刚日取干上神，柔日取支上神（《六壬大全》「无克刚干柔取辰」）
      first = isYangDay ? kes[0].up : kes[2].up;
      source = isYangDay ? 'gan' : 'zhi';
    }
    // 中末以三刑递取；若发用自刑，次传「颠倒日辰」改取另一侧上神
    const selfXing = (b) => XING[b] === b;
    let mid;
    if (selfXing(first)) {
      mid = source === 'gan' ? tianPan[dayBranch] : tianPan[JI_GONG[dayStem]];
    } else {
      mid = XING[first];
    }
    let last;
    if (selfXing(mid)) last = CHONG[mid];
    else {
      const x = XING[mid];
      // 子卯互刑，不复再传，以冲为末
      last = x === first ? CHONG[mid] : x;
    }
    return {
      fa: '伏吟法',
      keTi: isYangDay ? '自任' : '自信',
      first,
      chuan: [first, mid, last],
      note: '伏吟：天地盘同位，中末以三刑递取；发用自刑者中传颠倒日辰，中传复自刑者以冲为末。',
    };
  }

  // 2. 反吟：月将与时支相冲（offset=6）
  if (offset === 6) {
    const relations = kes.map((k, i) => relationOf(k, i, dayStem));
    const hasZei = relations.includes('zei');
    const hasKe = relations.includes('ke');
    if (hasZei || hasKe) {
      const r = hasZei
        ? resolveKeDe(kes, true, dayStem, isYangDay)
        : resolveKeDe(kes, false, dayStem, isYangDay);
      return { ...chuan(r.first, '反吟法', r.keTi), note: '反吟有克，依贼克法发用，中末取冲。' };
    }
    // 无克：井栏射（又名无亲）——初传取日支驿马，中传支上神，末传干上神
    const first = YI_MA[dayBranch];
    return {
      fa: '反吟法',
      keTi: '井栏射',
      first,
      chuan: [first, kes[2].up, kes[0].up],
      note: '反吟无克，井栏射：初传取日支驿马，中传支上神，末传干上神。',
    };
  }

  // 3. 贼克：先下贼上，无则上克下
  const relations = kes.map((k, i) => relationOf(k, i, dayStem));
  const hasZei = relations.includes('zei');
  const hasKe = relations.includes('ke');
  if (hasZei) {
    const r = resolveKeDe(kes, true, dayStem, isYangDay);
    return { ...chuan(r.first, r.fa, r.keTi), shehai: r.shehai, note: '下贼上发用（贼克法）。' };
  }
  if (hasKe) {
    const r = resolveKeDe(kes, false, dayStem, isYangDay);
    return { ...chuan(r.first, r.fa, r.keTi), shehai: r.shehai, note: '上克下发用（贼克法）。' };
  }

  // 4. 八专：日干寄宫与日支同位（四课只得两课），无克则先从八专法（《六壬粹言》：八专不论遥克）
  if (JI_GONG[dayStem] === dayBranch) {
    // 刚日：自干上神连本位顺数三位；柔日：自四课上神连本位逆数三位；中末皆取干上神
    const first = isYangDay
      ? BRANCHES[mod(bIdx(kes[0].up) + 2, 12)]
      : BRANCHES[mod(bIdx(kes[3].up) - 2, 12)];
    return {
      fa: '八专法',
      keTi: '八专',
      first,
      chuan: [first, kes[0].up, kes[0].up],
      note: isYangDay
        ? '八专：刚日自干上神连本位顺数三位发用，中末取干上神。'
        : '八专：柔日自四课上神连本位逆数三位发用，中末取干上神。',
    };
  }

  // 5. 遥克：神遥克日（蒿矢）优先，其次日遥克神（弹射）
  const dayElem = STEM_ELEMENT[dayStem];
  const pickYaoKe = (list, keTi) => {
    if (list.length === 0) return null;
    if (list.length === 1) return { first: list[0].up, fa: '遥克法', keTi };
    const bi = list.filter((k) => (bIdx(k.up) % 2 === 0) === isYangDay);
    const pool = bi.length > 0 ? bi : list;
    if (pool.length === 1) return { first: pool[0].up, fa: '遥克法', keTi };
    // 多个：以涉害浅深裁之（古籍未详，取「比用→涉害」通例）
    const depths = pool.map((k) => shehaiDepth(k.up, k.downBranch));
    const maxIdx = depths.indexOf(Math.max(...depths));
    return {
      first: pool[maxIdx].up,
      fa: '遥克法',
      keTi,
      note: '遥克有数神，先取与日干比者，仍不决则以涉害浅深裁之。',
    };
  };
  const hao = pickYaoKe(
    kes.filter((k) => controls(BRANCH_ELEMENT[k.up], dayElem)),
    '蒿矢',
  );
  if (hao) return { ...chuan(hao.first, hao.fa, hao.keTi), note: hao.note || '神遥克日发用（蒿矢）。' };
  const tan = pickYaoKe(
    kes.filter((k) => controls(dayElem, BRANCH_ELEMENT[k.up])),
    '弹射',
  );
  if (tan) return { ...chuan(tan.first, tan.fa, tan.keTi), note: tan.note || '日遥克神发用（弹射）。' };

  // 6. 别责：四课不全（上神去重后只余三神，即「四课不全三课备」），无上下克、无遥克
  const distinctUps = new Set(kes.map((k) => k.up));
  if (distinctUps.size < 4) {
    let first;
    if (isYangDay) {
      // 刚日：日干之合干的寄宫之上神
      const partner = STEMS[mod(sIdx(dayStem) + 5, 10)];
      first = tianPan[JI_GONG[partner]];
    } else {
      // 柔日：日支三合局前一位（支 + 4）本身发用
      first = BRANCHES[mod(bIdx(dayBranch) + 4, 12)];
    }
    return {
      fa: '别责法',
      keTi: '别责',
      first,
      chuan: [first, kes[0].up, kes[0].up],
      note: isYangDay
        ? '别责：四课不全，刚日取干合寄宫之上神发用，中末取干上神。'
        : '别责：四课不全，柔日取支前三合位发用，中末取干上神。',
    };
  }

  // 7. 昴星：无遥无克、四课全备
  let first;
  let mid;
  let last;
  if (isYangDay) {
    first = tianPan['酉']; // 阳仰：地盘酉位之上神
    mid = kes[2].up; // 刚日先辰（支上神）
    last = kes[0].up; // 而后日（干上神）
  } else {
    first = earthOfHeaven(tianPan, '酉'); // 阴俯：天盘酉所临之地盘支
    mid = kes[0].up; // 柔日先日（干上神）
    last = kes[2].up; // 而后辰（支上神）
  }
  return {
    fa: '昴星法',
    keTi: isYangDay ? '虎视' : '冬蛇掩目',
    first,
    chuan: [first, mid, last],
    note: isYangDay
      ? '昴星：阳日仰取地盘酉上神，中传支上神，末传干上神。'
      : '昴星：阴日俯取天盘酉下神，中传干上神，末传支上神。',
  };
}

// ============================================================
// 主函数
// ============================================================

/**
 * 大六壬排盘。
 *
 * @param {object} [options]
 * @param {Date|string|number} [options.date=new Date()] 北京时间意义下的起课时刻
 * @param {'auto'|'昼'|'夜'} [options.daynight='auto'] 昼夜（auto 依卯至申为昼）
 * @param {number} [options.longitude] 可选：经度（给出时按真太阳时定时辰）
 * @returns {object} 见 SPEC §2.7：yueJiang / tianDiPan / siKe / sanChuan / tianJiang / xunKong / hints
 */
export function castLiuren(options = {}) {
  const { date = new Date(), daynight = 'auto', longitude } = options;
  const alm = getAlmanac(date, longitude != null ? { longitude } : {});

  const dayGanzhi = alm.dayGanzhi;
  const hourGanzhi = alm.hourGanzhi;
  const dayStem = dayGanzhi[0];
  const dayBranch = dayGanzhi[1];
  const hourBranch = hourGanzhi[1];
  const isYangDay = !!STEM_YANG[dayStem];

  // ---- 1. 月将（中气过宫） ----
  const termIndex = alm.solarTerm.current.index;
  const zhongQiIndex = termIndex % 2 === 1 ? termIndex : mod(termIndex - 1, 24);
  const zhongQiName = SOLAR_TERM_NAMES[zhongQiIndex];
  const yueJiang = YUE_JIANG_BY_ZHONGQI[zhongQiIndex];
  if (!yueJiang) throw new Error('月将推算失败：' + alm.solarTerm.current.name);
  const yueJiangBranch = yueJiang.branch;

  // ---- 2. 昼夜与贵人 ----
  const dn = resolveDayNight(daynight, hourBranch);
  const guirenBranch = GUI_REN[dayStem][dn];

  // ---- 3. 天地盘 ----
  const tianPan = buildTianPan(yueJiangBranch, hourBranch);
  // 天盘相对地盘之位移：天盘[时支] = 月将 ⇒ offset = 月将 − 时支（伏吟 0，反吟 6）
  const offsetSigned = mod(bIdx(yueJiangBranch) - bIdx(hourBranch), 12);

  const tianDiPan = BRANCHES.map((p) => ({
    position: p,
    diPan: p,
    tianPan: tianPan[p],
  }));

  // ---- 4. 四课 ----
  const lodging = JI_GONG[dayStem];
  const kes = buildSiKe(dayGanzhi, tianPan);

  // ---- 5. 三传 ----
  const sc = deriveSanChuan({
    kes,
    dayStem,
    dayBranch,
    tianPan,
    isYangDay,
    offset: offsetSigned,
  });

  // ---- 6. 十二天将 ----
  const guirenEarth = earthOfHeaven(tianPan, guirenBranch);
  const guirenEarthIdx = bIdx(guirenEarth);
  const shun = [11, 0, 1, 2, 3, 4].includes(guirenEarthIdx); // 贵人临亥子丑寅卯辰顺行
  const jiangByHeaven = {};
  const jiangByPosition = {};
  for (let i = 0; i < 12; i += 1) {
    // 顺：天盘支 = 贵神 + i；逆：天盘支 = 贵神 − i
    const heaven = BRANCHES[mod(bIdx(guirenBranch) + (shun ? i : -i), 12)];
    jiangByHeaven[heaven] = JIANGS[i];
  }
  for (const p of BRANCHES) jiangByPosition[p] = jiangByHeaven[tianPan[p]];
  const tianJiang = BRANCHES.map((p) => ({
    branch: tianPan[p], // 天将所乘之天盘神
    position: p, // 所临地盘宫支
    jiang: jiangByHeaven[tianPan[p]],
  }));

  // ---- 7. 旬空 ----
  const kong = xunKong(dayGanzhi);

  // ---- 8. 汇总 ----
  const sanChuanChuan = sc.chuan.map((branch, i) => ({
    index: i + 1,
    branch,
    liuqin: liuQinOfBranch(dayStem, branch),
    tianJiang: jiangByHeaven[branch] || '',
    kong: kong.includes(branch),
    note: i === 0 ? '初传（发用）' : i === 1 ? '中传：初传之上神' : '末传：中传之上神',
  }));

  const siKe = kes.map((k, i) => ({
    ke: i + 1,
    upper: k.up,
    lower: k.down,
    liuqin: liuQinOfBranch(dayStem, k.up),
    note:
      i === 0
        ? `下位日干${dayStem}（寄宫${lodging}）；上神为干阳`
        : i === 1
          ? '下位为一课上神；上神为干阴'
          : i === 2
            ? `下位日支${dayBranch}；上神为支阳`
            : '下位为三课上神；上神为支阴',
  }));

  const hints = [];
  hints.push(
    `月将${yueJiangBranch}将${yueJiang.name}（${zhongQiName}后中气换将；现值${alm.solarTerm.current.name}），月将加时${hourBranch}。`,
  );
  hints.push(
    `日柱${dayGanzhi}（${dayStem}寄${lodging}），时柱${hourGanzhi}；${dn}占，贵人取${dn}贵「${guirenBranch}」，` +
    `临地盘${guirenEarth}，${shun ? '顺布' : '逆布'}十二天将。`,
  );
  hints.push(
    `三传：${sc.chuan.join('、')}（${sc.fa}·${sc.keTi}）。${sc.note || ''}`,
  );
  hints.push(`旬空：${dayGanzhi}属旬，空${kong.join('、')}；三传逢空已标 kong。`);
  if (sc.shehai) {
    hints.push('涉害浅深：' + sc.shehai.map((x) => `${x.up}临${x.down}（${x.depth}重）`).join('；'));
  }
  if (alm.enteredNextDay) {
    hints.push(`日界按子时换日（23:00 起算次日）：此课已进次日日柱${dayGanzhi}（${alm.dayBasis || '北京时间'}），晚子时以次日日干起时。`);
  }
  hints.push('四课以日干寄宫起干阳，日支起支阳；一课下位按日干本身论五行。');
  hints.push('引擎只出盘面与客观神煞；用神、课体吉凶、神煞断应与应期由 skills 判断。');

  // 校验用：offset 供测试断言（伏吟=0，反吟=6）
  const offsetForTest = mod(bIdx(hourBranch) - bIdx(yueJiangBranch), 12);

  return {
    yueJiang: {
      name: yueJiang.name,
      branch: yueJiangBranch,
      note: `${zhongQiName}后中气过宫，月将${yueJiang.name}${yueJiangBranch}，月将加时${hourBranch}（现值节气：${alm.solarTerm.current.name}）。`,
    },
    tianDiPan,
    siKe,
    sanChuan: {
      method: sc.fa,
      keTi: sc.keTi,
      chuan: sanChuanChuan,
      note: sc.note || '',
    },
    tianJiang,
    guiren: {
      daynight: dn,
      branch: guirenBranch,
      earth: guirenEarth,
      shun,
      note: `${dn}贵${guirenBranch}临地盘${guirenEarth}，${shun ? '顺布' : '逆布'}。`,
    },
    xunKong: kong,
    hints,
    // 以下为引擎内部派生量，便于调试与测试
    meta: {
      dayGanzhi,
      hourGanzhi,
      dayStem,
      dayBranch,
      hourBranch,
      lodging,
      yueJiangBranch,
      offset: offsetSigned,
      offsetForTest,
      termName: alm.solarTerm.current.name,
      hourBasis: alm.hourBasis,
      enteredNextDay: Boolean(alm.enteredNextDay),
      dayBasis: alm.dayBasis || null,
      jiangByPosition,
    },
  };
}

export default { castLiuren, JI_GONG, GUI_REN, YI_MA, shehaiDepth, deriveSanChuan };
