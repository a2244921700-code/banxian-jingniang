/**
 * taiyi.js —— 太乙神数排盘（纯 ESM、零第三方依赖，只依赖 ./almanac.js）
 *
 * 主要依据：《太乙金鏡式經》（唐 王希明撰，四庫全書本）卷01、卷02，
 * 参校卷07「五福/四神」诸法。经文来源：中文维基文库
 * https://zh.wikisource.org/wiki/太乙金鏡式經_(四庫全書本)
 * 知识库副本：D:\DSH_GuaShi\知识库\10-太乙神数\太乙金镜式经-四库本.md
 *
 * 本引擎只出「盘面」：积年局数、太乙九宫行度、十六神、八将落位、
 * 主客算与主客大将参将、四神太乙、九宫盘面。吉凶断法（掩迫囚击关格、
 * 主客胜负、三基五福、大游小游等）不在此处，留给 skills。
 *
 * ── 已确证并写死在测试里的算法（卷01/02 原文 + 例盘） ──
 * 1. 积年：上元混沌甲子至唐開元十二年甲子（724）積 1,937,281 算；
 *    「上考往古每年减一算，下检将来每年加一算」→ 积年 = 公元年 + 1,936,557。
 * 2. 年计太乙：积年 mod 360（周纪）→ mod 72（元法）→ mod 24（小周）→ ÷3 得宫数，
 *    命起一宫顺行八宫、不游中五（宫序 1,2,3,4,6,7,8,9），余数为入宫年数。
 * 3. 天目（文昌）：积数 mod 72 → mod 18，命起武德顺行十六神，遇陰德、大武各重留一算
 *    （故一周 18 位）。年计用积年；月计、日计类推。
 * 4. 计神：积数 mod 60，年计起寅顺行十二辰；月计、日计起寅逆行十二辰。
 * 5. 合神：年计取太岁六合（甲子年合神丑，与经文例合）。
 * 6. 始击：以计神加和德宫，顺行十六神，文昌临处即始击（经文「法曰：始擊起元因艮為和德，
 *    加計神，文昌臨處為始擊」）。可复现卷01 例盘：计神午、文昌大武 → 始击高叢。
 * 7. 主算：自文昌顺行十六神，数至太乙宫止（不含太乙宫），正宫计其宫数、间神不计；
 *    若天目本身落间神则加一数。客算同法，自始击起。
 *    可复现卷01 例盘（太乙九宫、文昌大武 → 主算 29）、卷02 例（太乙九宫、天目大义 → 主算 16）。
 * 8. 主客大将宫 = 算之个位（个位 0 作 1；经文「得十置一」「得二十四弃二十置四」）；
 *    参将宫 = 大将宫在九宫序中逆退二位。例盘：29→9/7，4→4/2。
 * 9. 四神太乙：积年 mod 180 → mod 36 得纪数（五纪）与入纪年，入纪年 ÷3 得宫位，
 *    命起一宫顺行九宫，再以绛宫、明堂、玉堂接之（卷07）。
 *
 * ── 待考（meta.pending 中会列出） ──
 *  · 月计积月、日计积日、时计时实的经典常数（四库本卷01「推时计差法」数字有夺文，
 *    章岁/章月与通行历法不合），本引擎改用天文二至与平均回归年推步，属近似；
 *  · 时计/日计/月计的文昌起神方向（经文时计直使条有「左行十六神」之说，年计明言顺行）；
 *  · 阴遁时计八将行序（「阴遁命起九宫行八宫」未言顺逆，本引擎按逆行处理）；
 *  · 天乙/地乙/直符太乙、五福/大游/小游、定目定算、三基五福十精等未实现。
 */

import { getAlmanac, solarTerms } from './almanac.js';

// ============================================================
// 常量
// ============================================================

/** 太乙积年基准：唐开元十二年甲子岁（公元 724）积 1,937,281 算 */
export const JI_YUAN_BASE_YEAR = 724;
export const JI_YUAN_BASE = 1937281;
/** 积年 = 公元年 + JI_YUAN_OFFSET */
export const JI_YUAN_OFFSET = JI_YUAN_BASE - JI_YUAN_BASE_YEAR; // 1936557

/** 周纪法 / 元法 / 太乙小周法 / 天目周法 / 纪法 */
export const ZHOU_JI_FA = 360;
export const YUAN_FA = 72;
export const XIAO_ZHOU_FA = 24;
export const TIANMU_ZHOU_FA = 18;
export const JI_FA = 60;

/** 太乙九宫（太乙式九宫，与洛书九宫差一位） */
export const PALACES = [
  { index: 1, gua: '乾', direction: '西北', element: '金', zhou: '冀州并州' },
  { index: 2, gua: '离', direction: '南', element: '火', zhou: '荆州' },
  { index: 3, gua: '艮', direction: '东北', element: '土', zhou: '青州' },
  { index: 4, gua: '震', direction: '东', element: '木', zhou: '徐州' },
  { index: 5, gua: '中', direction: '中', element: '土', zhou: '中宫（太乙不入）' },
  { index: 6, gua: '兑', direction: '西', element: '金', zhou: '雍州' },
  { index: 7, gua: '坤', direction: '西南', element: '土', zhou: '梁益州' },
  { index: 8, gua: '坎', direction: '北', element: '水', zhou: '兖州' },
  { index: 9, gua: '巽', direction: '东南', element: '木', zhou: '扬州（经作「州」）' },
];

/** 太乙顺行八宫之序（不游中五） */
export const RUN_ORDER = [1, 2, 3, 4, 6, 7, 8, 9];
/** 阴遁行宫之序（起九宫，逆行；待考） */
export const YIN_RUN_ORDER = [9, 8, 7, 6, 4, 3, 2, 1];
/** 九宫全序（参将逆退用） */
export const NINE_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * 十六神（顺行、按十二支加四维之序，起武德于申）。
 * palace 为 null 者为「间神」（不在八宫正位）。
 */
export const SIXTEEN_GODS = [
  { god: '武德', pos: '申', palace: null },
  { god: '太蔟', pos: '酉', palace: 6 },
  { god: '陰主', pos: '戌', palace: null },
  { god: '陰德', pos: '乾', palace: 1 },
  { god: '大義', pos: '亥', palace: null },
  { god: '地主', pos: '子', palace: 8 },
  { god: '陽德', pos: '丑', palace: null },
  { god: '和德', pos: '艮', palace: 3 },
  { god: '吕申', pos: '寅', palace: null },
  { god: '高叢', pos: '卯', palace: 4 },
  { god: '太陽', pos: '辰', palace: null },
  { god: '太炅', pos: '巽', palace: 9 },
  { god: '太神', pos: '巳', palace: null },
  { god: '大威', pos: '午', palace: 2 },
  { god: '天道', pos: '未', palace: null },
  { god: '大武', pos: '坤', palace: 7 },
];

/**
 * 天目十八位：命起武德顺行十六神，遇陰德、大武各重留一算。
 * 值为 SIXTEEN_GODS 下标；数组下标 = (余数 - 1)。
 */
export const TIANMU_SEQ = [0, 1, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15];

/** 十二支 → 十六神下标 */
export const BRANCH_TO_GOD_INDEX = {
  子: 5, 丑: 6, 寅: 8, 卯: 9, 辰: 10, 巳: 12,
  午: 13, 未: 14, 申: 0, 酉: 1, 戌: 2, 亥: 4,
};

/** 十二支 */
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 太岁六合 */
const LIUHE = {
  子: '丑', 丑: '子', 寅: '亥', 卯: '戌', 辰: '酉', 巳: '申',
  午: '未', 未: '午', 申: '巳', 酉: '辰', 戌: '卯', 亥: '寅',
};

/** 四神太乙十二宫位（九宫 + 绛宫、明堂、玉堂） */
export const SISHEN_POSITIONS = [
  { name: '一宫', palace: 1 }, { name: '二宫', palace: 2 }, { name: '三宫', palace: 3 },
  { name: '四宫', palace: 4 }, { name: '五宫', palace: 5 }, { name: '六宫', palace: 6 },
  { name: '七宫', palace: 7 }, { name: '八宫', palace: 8 }, { name: '九宫', palace: 9 },
  { name: '绛宫', palace: null }, { name: '明堂', palace: null }, { name: '玉堂', palace: null },
];

/** 八将名称（五将 + 计神 + 两参将；《提要》：「計神與太乙合之為八將」） */
export const EIGHT_GENERALS = ['太乙', '文昌', '始击', '计神', '主大将', '主参将', '客大将', '客参将'];

/** 治化（三年一宫：第一年治天、第二年治地、第三年治民） */
const ZHI_HUA = { 1: '治天', 2: '治地', 3: '治民' };

// ============================================================
// 基础工具
// ============================================================

/** 1-based 取余：n mod m，余 0 作 m */
export function mod1(n, m) {
  const r = ((Math.trunc(n) % m) + m) % m;
  return r === 0 ? m : r;
}

function palaceOf(index) {
  const p = PALACES.find((x) => x.index === index);
  return p ? { ...p } : null;
}

function godAt(index) {
  const g = SIXTEEN_GODS[index];
  return {
    god: g.god,
    pos: g.pos,
    palace: g.palace,
    palaceName: g.palace ? PALACES[g.palace - 1].gua : null,
    isJian: g.palace == null,
  };
}

/** 十二支索引（0=子） */
function branchIndex(branch) {
  return BRANCHES.indexOf(branch);
}

/** 太乙年计积年（公元年 → 积年） */
export function taiyiJiNian(year) {
  return Number(year) + JI_YUAN_OFFSET;
}

/** 积数 → 局数（1-72） */
export function juOf(jiShu) {
  return mod1(jiShu, YUAN_FA);
}

/** 积数 → 太乙宫与入宫年数 */
export function taiyiPalaceOf(jiShu) {
  const r24 = mod1(jiShu, XIAO_ZHOU_FA);
  const step = Math.floor((r24 - 1) / 3);
  const ruGong = ((r24 - 1) % 3) + 1;
  const palace = RUN_ORDER[step];
  return {
    palace,
    palaceInfo: palaceOf(palace),
    ruGong,
    zhi: ZHI_HUA[ruGong],
    r24,
    step,
  };
}

/** 积数 → 天目（文昌）十六神下标 */
export function tianmuIndex(jiShu) {
  const r18 = mod1(jiShu, TIANMU_ZHOU_FA);
  return TIANMU_SEQ[r18 - 1];
}

/** 积数 → 计神地支（direction: '顺'|'逆'；start: 起神地支） */
export function jishenBranchOf(jiShu, direction = '顺', start = '寅') {
  const r60 = mod1(jiShu, JI_FA); // 1-based
  const offset = r60 - 1;
  const startIdx = branchIndex(start);
  const idx = direction === '逆'
    ? ((startIdx - offset) % 12 + 12) % 12
    : (startIdx + offset) % 12;
  return BRANCHES[idx];
}

/** 太岁（积数 mod 60 → 干支；因积年 mod 60 = 年干支序，故 1=甲子） */
export function taiSuiOf(jiShu) {
  const r60 = mod1(jiShu, JI_FA); // 1-based，1=甲子
  const stem = '甲乙丙丁戊己庚辛壬癸'[(r60 - 1) % 10];
  const branch = BRANCHES[(r60 - 1) % 12];
  return { index: r60, ganzhi: stem + branch };
}

/**
 * 主客算：自某目（十六神下标）顺行数至太乙宫止。
 * 正宫计其宫数，间神不计；若目本身落间神，加一数。
 */
export function suanFromTo(startGodIndex, taiyiPalace) {
  let total = 0;
  let i = startGodIndex;
  let steps = 0;
  const startGod = SIXTEEN_GODS[startGodIndex];
  if (startGod.palace == null) total += 1; // 间神加一数
  for (;;) {
    const g = SIXTEEN_GODS[i];
    if (g.palace === taiyiPalace) break; // 至太乙宫止（不含）
    // 起始目若为正宫，先计入本数
    if (steps === 0 && g.palace != null) total += g.palace;
    else if (steps > 0 && g.palace != null) total += g.palace;
    i = (i + 1) % 16;
    steps += 1;
    if (steps > 32) break; // 防御：理论不会发生（太乙必在八宫正位之一，16 步内必达）
  }
  return total;
}

/** 算数 → 大将宫（个位，0 作 1；经文「得十置一」「得二十四弃二十置四」） */
export function dajiangPalace(suan) {
  const d = suan % 10;
  return d === 0 ? 1 : d;
}

/** 大将宫 → 参将宫（九宫序中逆退二位） */
export function canjiangPalace(dajiang) {
  const idx = NINE_ORDER.indexOf(dajiang);
  const target = ((idx - 2) % 9 + 9) % 9;
  return NINE_ORDER[target];
}

/** 始击：以计神加和德宫，顺行十六神，文昌临处即始击 */
export function shijiIndex(wenchangIdx, jishenBranch) {
  const jishenGodIdx = BRANCH_TO_GOD_INDEX[jishenBranch];
  const hedeIdx = 7; // 和德
  const offset = ((hedeIdx - jishenGodIdx) % 16 + 16) % 16;
  return (wenchangIdx + offset) % 16;
}

/** 合神：年计取太岁六合；其它计式取计神逆一位（卷01 时计例：计神午、合神巳） */
export function heshenOf(taiSuiBranch, jishenBranch, mode = '年计') {
  if (mode === '年计') return LIUHE[taiSuiBranch];
  const idx = ((branchIndex(jishenBranch) - 1) % 12 + 12) % 12;
  return BRANCHES[idx];
}

/** 四神太乙（卷07）：积年 mod 180 → mod 36 纪；入纪年 ÷3 宫位（九宫 + 绛宫明堂玉堂） */
export function sishenOf(jiNian) {
  const r180 = mod1(jiNian, 180);
  const ji = Math.ceil(r180 / 36); // 第几纪（1-5）
  const ruJi = ((r180 - 1) % 36) + 1; // 入纪第几年
  const step = Math.floor((ruJi - 1) / 3);
  const pos = SISHEN_POSITIONS[step];
  return { ji, ruJi, positionIndex: step + 1, position: pos.name, palace: pos.palace };
}

// ============================================================
// 二至（时计 / 日计 / 月计用）
// ============================================================

/** 取某时刻之前最近的冬至或夏至（返回 {name, at}） */
export function latestSolstice(date) {
  const t = date instanceof Date ? date : new Date(date);
  const beijingYear = new Date(t.getTime() + 8 * 3600e3).getUTCFullYear();
  const cands = [];
  for (const y of [beijingYear - 1, beijingYear, beijingYear + 1]) {
    const terms = solarTerms(y);
    cands.push({ name: '夏至', at: terms[11].at, local: terms[11].local });
    cands.push({ name: '冬至', at: terms[23].at, local: terms[23].local });
  }
  cands.sort((a, b) => a.at - b.at);
  let cur = cands[0];
  for (const c of cands) {
    if (c.at <= t) cur = c; else break;
  }
  return cur;
}

/** 某时刻距最近二至的时辰数（半辰法取整：加 1 小时再除 2 小时） */
export function shichenFromSolstice(date) {
  const t = date instanceof Date ? date : new Date(date);
  const sol = latestSolstice(t);
  const n = Math.floor((t.getTime() - sol.at.getTime() + 3600e3) / 7200e3);
  return { n: Math.max(0, n), solstice: sol, dun: sol.name === '冬至' ? '阳遁' : '阴遁' };
}

// ============================================================
// 排盘主函数
// ============================================================

const MODES = ['时计', '日计', '月计', '年计'];

/**
 * 太乙神数排盘（只出盘面，不写吉凶断语）。
 *
 * @param {object} opts
 * @param {Date|string|number} [opts.date] 起盘时刻（北京时间意义），缺省当前
 * @param {'时计'|'日计'|'月计'|'年计'} [opts.mode] 计式，默认时计
 * @param {number} [opts.longitude] 经度（传给历法，定时辰/真太阳时）
 * @param {string} [opts.question] 所问何事（原样回显）
 * @returns {object} { ok, mode, question, time, ju, taiyi, wenchang, shiji, jishen, heshen,
 *                     zhuda, zhucan, keda, kecan, zhusuan, kesuan, sishen, sixteenGods,
 *                     palaces, hints, meta }
 */
export function castTaiyi(opts = {}) {
  const mode = opts.mode ?? '时计';
  if (!MODES.includes(mode)) throw new Error('太乙计式应为 时计/日计/月计/年计，收到 ' + mode);
  const rawDate = opts.date == null ? new Date() : opts.date;
  const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
  if (Number.isNaN(date.getTime())) throw new TypeError('无效的时间：' + String(opts.date));
  const almanac = getAlmanac(date, opts.longitude != null ? { longitude: opts.longitude } : {});

  // ---- 积数：按计式取 积年/积月/积日/时辰数 ----
  const gzYearNum = ganzhiYearNumber(almanac);
  const jiNian = taiyiJiNian(gzYearNum);
  const lunarMonth = almanac.lunar.month;
  const dayOfYear = dayNumberSinceJan1(date);
  const taiSuiGanzhi = almanac.ganzhi.year; // 立春换年
  const taiSuiBranch = taiSuiGanzhi[1];
  let jiShu;
  let jiShuLabel;
  let dun = '—';
  let extra = {};
  if (mode === '年计') {
    jiShu = jiNian;
    jiShuLabel = `积年 ${jiNian}`;
  } else if (mode === '月计') {
    jiShu = Math.floor((jiNian - 1) * 12.3683) + (lunarMonth - 1);
    jiShuLabel = `积月（近似）${jiShu}`;
  } else if (mode === '日计') {
    jiShu = Math.floor((jiNian - 1) * 365.2425) + dayOfYear;
    jiShuLabel = `积日（近似）${jiShu}`;
  } else {
    const sc = shichenFromSolstice(date);
    dun = sc.dun;
    jiShu = sc.n;
    jiShuLabel = `${dun}：距${sc.solstice.name}（${sc.solstice.local}）${sc.n} 个时辰`;
    extra = { solstice: sc.solstice };
  }

  // ---- 局数与太乙 ----
  const ju = juOf(jiShu);
  let taiyi;
  if (mode === '时计') {
    const order = dun === '阳遁' ? RUN_ORDER : YIN_RUN_ORDER;
    const step = Math.floor(jiShu / 3) % 8;
    const palace = order[step];
    taiyi = {
      palace,
      palaceInfo: palaceOf(palace),
      ruGong: (jiShu % 3) + 1,
      zhi: ZHI_HUA[(jiShu % 3) + 1],
      step,
      order: dun === '阳遁' ? '顺行八宫（起一宫）' : '逆行八宫（起九宫）',
      note: '时计三时一移，不游中五',
    };
  } else {
    taiyi = taiyiPalaceOf(jiShu);
  }

  // ---- 文昌（天目）、计神、合神 ----
  const wcIdx = tianmuIndex(jiShu);
  const wenchang = godAt(wcIdx);
  let jishen;
  if (mode === '时计') {
    jishen = jishenBranchOf(jiShu, '顺', dun === '阳遁' ? '寅' : '申');
  } else if (mode === '年计') {
    jishen = jishenBranchOf(jiShu, '顺', '寅');
  } else {
    jishen = jishenBranchOf(jiShu, '逆', '寅');
  }
  const heshen = heshenOf(taiSuiBranch, jishen, mode);
  const jishenInfo = {
    branch: jishen,
    palace: godAt(BRANCH_TO_GOD_INDEX[jishen]).palace,
    god: godAt(BRANCH_TO_GOD_INDEX[jishen]).god,
  };

  // ---- 始击、主客算、主客四将 ----
  const sjIdx = shijiIndex(wcIdx, jishen);
  const shiji = godAt(sjIdx);
  const zhusuan = suanFromTo(wcIdx, taiyi.palace);
  const kesuan = suanFromTo(sjIdx, taiyi.palace);
  const zhuDaPalace = dajiangPalace(zhusuan);
  const zhuCanPalace = canjiangPalace(zhuDaPalace);
  const keDaPalace = dajiangPalace(kesuan);
  const keCanPalace = canjiangPalace(keDaPalace);
  const zhuda = { palace: zhuDaPalace, palaceInfo: palaceOf(zhuDaPalace) };
  const zhucan = { palace: zhuCanPalace, palaceInfo: palaceOf(zhuCanPalace) };
  const keda = { palace: keDaPalace, palaceInfo: palaceOf(keDaPalace) };
  const kecan = { palace: keCanPalace, palaceInfo: palaceOf(keCanPalace) };

  // ---- 四神太乙 ----
  const sishen = { ...sishenOf(jiNian), note: '积年 mod 180 定纪，入纪年 ÷3 移宫（卷07）' };

  // ---- 九宫盘面 ----
  const features = [
    { key: 'taiyi', label: '太乙', palace: taiyi.palace },
    { key: 'wenchang', label: '文昌', god: wenchang.god, palace: wenchang.palace },
    { key: 'shiji', label: '始击', god: shiji.god, palace: shiji.palace },
    { key: 'jishen', label: '计神', palace: jishenInfo.palace },
    { key: 'zhuda', label: '主大将', palace: zhuDaPalace },
    { key: 'zhucan', label: '主参将', palace: zhuCanPalace },
    { key: 'keda', label: '客大将', palace: keDaPalace },
    { key: 'kecan', label: '客参将', palace: keCanPalace },
  ];
  const palaces = PALACES.map((p) => {
    const here = features.filter((f) => f.palace === p.index);
    return {
      index: p.index,
      gua: p.gua,
      direction: p.direction,
      element: p.element,
      zhou: p.zhou,
      occupiedBy: here.map((f) => f.label),
      detail: here.map((f) => ({ label: f.label, god: f.god ?? null })),
    };
  });

  // ---- 十六神落位 ----
  const sixteenGods = SIXTEEN_GODS.map((g, i) => {
    const marks = [];
    if (i === wcIdx) marks.push('文昌');
    if (i === sjIdx) marks.push('始击');
    if (BRANCH_TO_GOD_INDEX[jishen] === i) marks.push('计神');
    if (BRANCH_TO_GOD_INDEX[heshen] === i) marks.push('合神');
    return {
      god: g.god,
      pos: g.pos,
      palace: g.palace,
      palaceName: g.palace ? PALACES[g.palace - 1].gua : null,
      isJian: g.palace == null,
      marks,
    };
  });

  // ---- hints（只述盘面，不断吉凶） ----
  const hints = [];
  const unitName = { 年计: '年', 月计: '月', 日计: '日', 时计: '时' }[mode];
  hints.push(
    `${mode}：${jiShuLabel}，元法72取局，得第 ${ju} 局；太乙落第 ${taiyi.palace} 宫（${taiyi.palaceInfo.gua}·${taiyi.palaceInfo.direction}），入宫第 ${taiyi.ruGong} ${unitName}。`,
  );
  if (mode === '年计') hints.push(`太岁 ${taiSuiGanzhi}，合神 ${heshen}，计神 ${jishen}（年计起寅顺行十二辰）。`);
  else if (mode === '时计') hints.push(`遁：${dun}；计神 ${jishen}（${dun === '阳遁' ? '起寅顺行' : '起申顺行'}）。`);
  else hints.push(`计神 ${jishen}（起寅逆行十二辰），合神 ${heshen}（待考）。`);
  hints.push(`文昌（下目·主）临 ${wenchang.god}（${wenchang.pos}${wenchang.palace ? '，第' + wenchang.palace + '宫' : '，间神'}）；始击（上目·客）临 ${shiji.god}（${shiji.pos}${shiji.palace ? '，第' + shiji.palace + '宫' : '，间神'}）。`);
  hints.push(`主算 ${zhusuan}，主大将第 ${zhuDaPalace} 宫、主参将第 ${zhuCanPalace} 宫；客算 ${kesuan}，客大将第 ${keDaPalace} 宫、客参将第 ${keCanPalace} 宫。（算子至太乙宫止，正宫计宫数、间神不计；大将取算之个位，参将逆退二位）`);
  if (zhusuan === 0 || kesuan === 0) {
    hints.push('主算或客算为零：目与太乙同处一宫，算无所行，盘面如此（经典「空算」处理待考）。');
  }
  hints.push(`四神太乙：第 ${sishen.ji} 纪第 ${sishen.ruJi} 年，临 ${sishen.position}。`);
  hints.push('八将：太乙、文昌、始击、计神、主大将、主参将、客大将、客参将；吉凶断法（掩迫囚击关格、主客胜负、三基五福）不在本盘，见 guashi-taiyi。');
  hints.push('太乙不游中五；九宫为太乙式九宫（一乾、二离、三艮、四震、六兑、七坤、八坎、九巽），与洛书九宫差一位。');

  return {
    ok: true,
    mode,
    question: opts.question ?? null,
    time: almanac,
    ju: {
      局: ju,
      元法: YUAN_FA,
      周纪法: ZHOU_JI_FA,
      积年: jiNian,
      积数: jiShu,
      积数说明: jiShuLabel,
      太岁: taiSuiGanzhi,
      太岁支: taiSuiBranch,
      遁: dun,
      二至: extra.solstice ? extra.solstice.name : null,
      二至时刻: extra.solstice ? extra.solstice.local : null,
    },
    taiyi,
    wenchang,
    shiji,
    jishen: jishenInfo,
    heshen: { branch: heshen, god: godAt(BRANCH_TO_GOD_INDEX[heshen]).god },
    zhuda,
    zhucan,
    keda,
    kecan,
    zhusuan,
    kesuan,
    sishen,
    sixteenGods,
    palaces,
    hints,
    meta: {
      source: {
        book: '《太乙金鏡式經》唐·王希明撰（四庫全書本）卷01、卷02、卷07',
        url: 'https://zh.wikisource.org/wiki/太乙金鏡式經_(四庫全書本)',
        localCopy: 'D:\\DSH_GuaShi\\知识库\\10-太乙神数\\太乙金镜式经-四库本.md',
        verifiedAgainst: [
          '卷01 推入六紀三元法 六纪例：积年 mod 360 为 1/61/121/181/241/301 时，太乙在一/六宫交替，天目武德/地主/大炅交替，计神寅',
          '卷01 推上元積年：开元十二年甲子（724）积 1,937,281 算',
          '卷01 时计例盘：太乙九宫、大武为天目、午为计神 → 主算 29、主大将九宫、主参将七宫、始击高叢、客算 4、客大将四宫、客参将二宫',
          '卷02 推太乙運式法 例：太乙九宫、大义为天目 → 主算 16',
        ],
        算法: {
          积年基准: '上元混沌甲子→唐开元十二年甲子（724）= 1,937,281 算；积年 = 公元年 + 1,936,557',
          局数: '积数 mod 72（余 0 作 72）',
          太乙行宫: '积数 mod 24，÷3 得宫数，命起一宫顺行八宫、不游中五（宫序 1,2,3,4,6,7,8,9）',
          天目: '积数 mod 18，命起武德顺行十六神，遇陰德、大武各重留一算',
          计神: '积数 mod 60，年计起寅顺行；月计/日计起寅逆行；时计阳遁起寅、阴遁起申',
          始击: '以计神加和德宫，顺行十六神，文昌临处为始击',
          主客算: '自目顺行至太乙宫止，正宫计宫数、间神不计，目落间神则加一',
          将宫: '大将取算之个位（0 作 1），参将九宫序逆退二位',
        },
      },
      pending: [
        '月计积月、日计积日、时计时实的经典常数（四库本卷01「推时计差法」有夺文），本引擎改用平均回归年与天文二至推步，属近似',
        '时计文昌起神方向：经文时计直使条有「左行十六神」之说，本引擎按年计惯例顺行处理',
        '阴遁时计八将行序：经文仅言「阴遁命起九宫行八宫」，未言顺逆，本引擎按逆行处理',
        '时计局数取距二至时辰数 mod 72，与经典「时计七十二局」的完整推步或有出入',
        '天乙/地乙/直符太乙、五福/大游/小游太乙、定目定算、三基五福十精、掩迫囚击关格等未实现',
      ],
    },
  };
}

// ============================================================
// 内部小工具
// ============================================================

/** 由 almanac 取「干支年」之公元年（以立春为界） */
function ganzhiYearNumber(almanac) {
  const STEMS_LOCAL = '甲乙丙丁戊己庚辛壬癸';
  const yearGanzhi = almanac.ganzhi.year; // 立春换年后的年柱
  const yearBeijing = new Date(almanac.epochMs + 8 * 3600e3).getUTCFullYear();
  for (const y of [yearBeijing, yearBeijing - 1, yearBeijing + 1]) {
    const gz = `${STEMS_LOCAL[((y - 4) % 10 + 10) % 10]}${BRANCHES[((y - 4) % 12 + 12) % 12]}`;
    if (gz === yearGanzhi) return y;
  }
  return yearBeijing;
}

function dayNumberSinceJan1(date) {
  const bj = new Date(new Date(date).getTime() + 8 * 3600e3);
  const y = bj.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  return Math.floor((Date.UTC(y, bj.getUTCMonth(), bj.getUTCDate()) - start) / 86400000) + 1;
}

export default {
  castTaiyi, taiyiJiNian, juOf, taiyiPalaceOf, tianmuIndex, jishenBranchOf,
  taiSuiOf, suanFromTo, dajiangPalace, canjiangPalace, shijiIndex, heshenOf,
  sishenOf, latestSolstice, shichenFromSolstice, mod1,
  PALACES, RUN_ORDER, YIN_RUN_ORDER, SIXTEEN_GODS, TIANMU_SEQ, SISHEN_POSITIONS,
  EIGHT_GENERALS, JI_YUAN_BASE, JI_YUAN_OFFSET,
};
