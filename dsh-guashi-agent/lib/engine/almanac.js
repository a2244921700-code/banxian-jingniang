/**
 * almanac.js —— 历法引擎（纯 ESM、零第三方依赖）
 *
 * 提供：真太阳时、二十四节气、农历换算、四柱干支（年/月/日/时）、旬空。
 * 精度与边界（详见 docs/SPEC.md §3.1）：
 *  - 日柱：儒略日整数公式，连续无跳变，覆盖 1900–2100 及更早日期（公式本身无年份上限）。
 *  - 农历：内置 1900–2100 年“月份大小 + 闰月”编码表（业界通行的天文年历转录），
 *          与香港天文台《公历农历对照表》核对，支持区间 1900-01-31 ~ 2100-12-31。
 *  - 节气：用 Meeus《Astronomical Algorithms》低精度太阳视黄经公式（误差约 0.01°≈15 分钟）
 *          反解黄经 = 15°×k 的时刻，换算为北京时间（UTC+8）；忽略 ΔT（2026 年约 69 秒），
 *          对“日期/月建”判断无影响。
 *  - 时辰：子时 23:00–00:59。**日界为 23:00**（传统以子时为新一日之始）：
 *          23:00 及以后即算次日日柱；给出经度时，以真太阳时是否已过 23:00 为准。
 *          故 23:00–23:59 为“晚子时”，其时柱按**换日后的日干**起子时干。
 *  - 真太阳时 = 北京时间 + (经度 − 120) × 4 分钟 + 均时差。
 *
 * 时间表示约定：所有输入 Date/ISO 字符串先换算为“北京时间”的民用时间再参与计算，
 * 与运行机器时区无关（内部用 UTC 视图承载 +08:00 墙上时间）。
 */

// ============================================================
// 常量
// ============================================================

/** 十天干 */
export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
/** 十二地支 */
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
/** 天干五行（按索引） */
export const STEM_ELEMENTS = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
/** 地支五行（按索引） */
export const BRANCH_ELEMENTS = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];
/** 地支生肖（按索引） */
export const BRANCH_ANIMALS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

/** 二十四节气，自小寒起；偶数下标为“节”，奇数下标为中气 */
export const SOLAR_TERMS = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];

/** 十二“节”对应的月建地支（小寒→丑，立春→寅，……，大雪→子） */
export const JIE_MONTH_BRANCH = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0];

/** 北京时间相对 UTC 的毫秒偏移 */
const BJ_OFFSET_MS = 8 * 3600 * 1000;
const DAY_MS = 86400 * 1000;

// ============================================================
// 时间工具
// ============================================================

/**
 * 把 Date / ISO 字符串 / 毫秒数转成 Date。
 * 无时区信息的字符串按本机时区解析（建议总是传带 +08:00 的 ISO 串）。
 */
export function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
    // 兜底：'2026-10-25 21:30' 这类空格分隔串
    const m = value.trim().match(
      /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    );
    if (m) {
      return new Date(
        Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] || 0, +m[5] || 0, +m[6] || 0) - BJ_OFFSET_MS,
      );
    }
  }
  return new Date(NaN);
}

/**
 * 北京时间的民用时间分量。
 * 与运行环境时区无关：先 +8h，再用 UTC 视图读取。
 */
export function beijingParts(date = new Date()) {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) throw new TypeError('无效的时间：' + String(date));
  const t = new Date(d.getTime() + BJ_OFFSET_MS);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    second: t.getUTCSeconds(),
    weekday: t.getUTCDay(), // 0=周日
    epochMs: d.getTime(),
  };
}

const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/** 北京时间 'YYYY-MM-DD HH:mm' / 'YYYY-MM-DD HH:mm:ss' */
export function fmtBeijing(date = new Date(), withSeconds = false) {
  const p = beijingParts(date);
  const pad = (n) => String(n).padStart(2, '0');
  const base = `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
  return withSeconds ? `${base}:${pad(p.second)}` : base;
}

/** 北京时间的“日序号”，用于日差计算 */
function beijingDayNumber(date) {
  const p = beijingParts(date);
  return Math.floor((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(1900, 0, 31)) / DAY_MS);
}

/** 某年某月某日的日序号（相对 1900-01-31，可负） */
function dayNumberOf(y, m, d) {
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(1900, 0, 31)) / DAY_MS);
}

/** 一年中的第几天（1 起） */
function dayOfYear(y, m, d) {
  return dayNumberOf(y, m, d) - dayNumberOf(y, 1, 1) + 1;
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

// ============================================================
// 干支基础
// ============================================================

/** 干支索引 0..59 → '甲子' 形式；0=甲子 */
export function ganzhiName(index) {
  const i = mod(Math.round(index), 60);
  return STEMS[i % 10] + BRANCHES[i % 12];
}

/** '甲子' 形式 → 干支索引 0..59；非法返回 -1 */
export function ganzhiIndex(name) {
  if (name && typeof name === 'object') name = name.name;
  if (typeof name !== 'string' || name.length < 2) return -1;
  const s = STEMS.indexOf(name[0]);
  const b = BRANCHES.indexOf(name[1]);
  if (s < 0 || b < 0) return -1;
  for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i;
  return -1;
}

/** 干支的名字、序号、五行等分解 */
export function ganzhiInfo(indexOrName) {
  const i = typeof indexOrName === 'number' ? mod(indexOrName, 60) : ganzhiIndex(indexOrName);
  if (i < 0) throw new Error('无效的干支：' + String(indexOrName));
  return {
    index: i,
    name: ganzhiName(i),
    stem: STEMS[i % 10],
    branch: BRANCHES[i % 12],
    stemIndex: i % 10,
    branchIndex: i % 12,
    stemElement: STEM_ELEMENTS[i % 10],
    branchElement: BRANCH_ELEMENTS[i % 12],
  };
}

// ============================================================
// 儒略日与日柱
// ============================================================

/**
 * 公历日期 → 儒略日数 JDN（整数，对应该日 00:00 UT 的“日序”）。
 * Fliegel–Van Flandern 公式，格里历（1582-10-15 之后；更早按格里历外推）。
 */
export function julianDayNumber(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d + Math.floor((153 * mm + 2) / 5) + 365 * yy +
    Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
  );
}

/** 公历日期 → 儒略日 JD（浮点，含当日时刻；按北京时间墙上时间算 UT 分量） */
export function julianDay(date) {
  const p = beijingParts(date);
  return julianDayNumber(p.year, p.month, p.day) - 0.5 +
    (p.hour * 3600 + p.minute * 60 + p.second) / 86400;
}

/** 日界小时：子时自 23:00 起，即入次日（传统“子时为一日之始”） */
export const DAY_BOUNDARY_HOUR = 23;

/**
 * 有效干支日（23:00 换日制）。
 *
 * 规则：
 *  - 未给经度：以**北京时间**的钟点判定；23:00 及以后算次日。
 *  - 给了经度：以**真太阳时**的日期与钟点判定；真太阳时 23:00 及以后算其次日。
 *    （真太阳时本身可能跨回公历前一日或后一日，故先取真太阳时日期，再过 23:00 进日。）
 *
 * @param {Date|string|number} date
 * @param {{longitude?:number}} [opts]
 * @returns {{year:number, month:number, day:number, hour:number,
 *            basis:'北京时间'|'真太阳时', enteredNextDay:boolean,
 *            clockLocal:string, baseDate:Date}}
 */
export function effectiveDay(date = new Date(), opts = {}) {
  const t = toDate(date);
  if (Number.isNaN(t.getTime())) throw new TypeError('无效的时间：' + String(date));
  const lon = opts && opts.longitude;
  const hasLon = lon != null && Number.isFinite(Number(lon));
  let baseDate = t;
  let basis = '北京时间';
  if (hasLon) {
    baseDate = trueSolarTime(t, lon).date;
    basis = '真太阳时';
  }
  const p = beijingParts(baseDate);
  let { year, month, day } = p;
  const enteredNextDay = p.hour >= DAY_BOUNDARY_HOUR;
  if (enteredNextDay) {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
  }
  const pad = (n) => String(n).padStart(2, '0');
  return {
    year,
    month,
    day,
    hour: p.hour,
    basis,
    enteredNextDay,
    // 进日前的原始钟点（便于对照）
    clockLocal: `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`,
    baseDate,
  };
}

/**
 * 日柱（儒略日法 + 23:00 换日）。
 * 锚点核对（详见测试）：JDN(1949-10-01)=2433191 → 甲子日；JDN(2000-01-01)=2451545 → 戊午日。
 * 反推常数：(JDN + 49) mod 60 == 日干支序数。
 *
 * ⚠ 23:00 及以后算次日（晚子时）：2026-10-25 23:30 的日柱 = 2026-10-26 的日柱。
 * 给出 opts.longitude 时以真太阳时判定 23:00 界。
 * @param {Date|string|number} date
 * @param {{longitude?:number}} [opts]
 * @returns {{stem:string, branch:string, name:string, index:number, element:string,
 *            branchElement:string, jdn:number, effectiveDate:{year:number,month:number,day:number},
 *            enteredNextDay:boolean, dayBasis:string}}
 */
export function dayPillar(date = new Date(), opts = {}) {
  const eff = effectiveDay(date, opts);
  const jdn = julianDayNumber(eff.year, eff.month, eff.day);
  const idx = mod(jdn + 49, 60);
  const info = ganzhiInfo(idx);
  return {
    stem: info.stem,
    branch: info.branch,
    name: info.name,
    index: idx,
    element: info.stemElement,
    branchElement: info.branchElement,
    jdn,
    effectiveDate: { year: eff.year, month: eff.month, day: eff.day },
    enteredNextDay: eff.enteredNextDay,
    dayBasis: eff.basis,
  };
}

/** 时支索引：23 点起为子时 */
export function hourBranchIndex(hour) {
  return mod(Math.floor((Number(hour) + 1) / 2), 12);
}

/** 时支对应的钟点区间文本，如 亥 → '21:00–23:59'、子 → '23:00–01:59' */
export function hourRange(branchIndex) {
  const b = mod(Number(branchIndex), 12);
  const start = (b * 2 + 23) % 24;
  const end = (b * 2 + 1) % 24;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(start)}:00–${pad(end)}:59`;
}

/**
 * 时柱：五鼠遁（甲己还加甲、乙庚丙作初、丙辛从戊起、丁壬庚子居、戊癸壬子是真途）。
 * @param {string|object|number} dayGanzhi 日柱 '甲子' / {stem,branch} / 干支索引
 * @param {number|string} hour 0–23 时；也接受 '亥' 这样的地支名
 * @returns {{stem:string, branch:string, name:string, branchIndex:number, element:string, branchElement:string}}
 */
export function hourPillar(dayGanzhi, hour) {
  const info = typeof dayGanzhi === 'number'
    ? ganzhiInfo(dayGanzhi)
    : (typeof dayGanzhi === 'string'
      ? ganzhiInfo(ganzhiIndex(dayGanzhi))
      : ganzhiInfo(ganzhiIndex(dayGanzhi.name)));
  let bIdx;
  if (typeof hour === 'string') {
    bIdx = BRANCHES.indexOf(hour);
    if (bIdx < 0) throw new Error('无效的地支：' + hour);
  } else {
    bIdx = hourBranchIndex(hour);
  }
  const sIdx = ((info.stemIndex % 5) * 2 + bIdx) % 10;
  return {
    stem: STEMS[sIdx],
    branch: BRANCHES[bIdx],
    name: STEMS[sIdx] + BRANCHES[bIdx],
    stemIndex: sIdx,
    branchIndex: bIdx,
    element: STEM_ELEMENTS[sIdx],
    branchElement: BRANCH_ELEMENTS[bIdx],
  };
}

/**
 * 旬空（六甲旬空）：按日柱所在之旬，取该旬缺的两个地支。
 * 甲子旬空戌亥、甲戌旬空申酉、甲申旬空午未、甲午旬空辰巳、甲辰旬空寅卯、甲寅旬空子丑。
 * @returns {[string, string]}
 */
export function xunKong(dayGanzhi) {
  const info = typeof dayGanzhi === 'number'
    ? ganzhiInfo(dayGanzhi)
    : ganzhiInfo(typeof dayGanzhi === 'string' ? ganzhiIndex(dayGanzhi) : ganzhiIndex(dayGanzhi.name));
  const xun = Math.floor(info.index / 10); // 0..5（甲子旬..甲寅旬）
  const headBranch = mod(-2 * xun, 12); // 旬首之地支：甲子0、甲戌10、甲申8、甲午6、甲辰4、甲寅2
  return [BRANCHES[mod(headBranch + 10, 12)], BRANCHES[mod(headBranch + 11, 12)]];
}

/** 干支所在旬的旬首，如 '甲子' */
export function xunHead(dayGanzhi) {
  const info = typeof dayGanzhi === 'number' ? ganzhiInfo(dayGanzhi) : ganzhiInfo(
    typeof dayGanzhi === 'string' ? ganzhiIndex(dayGanzhi) : ganzhiIndex(dayGanzhi.name),
  );
  return ganzhiName(Math.floor(info.index / 10) * 10);
}

// ============================================================
// 太阳视黄经与二十四节气
// ============================================================

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/**
 * 太阳视黄经（度，0–360）。Meeus, Astronomical Algorithms, ch.25 低精度公式。
 * 适用于 -2000 ~ +3000 年，误差 < 0.01°。
 */
export function solarApparentLongitude(jd) {
  const T = (jd - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const Mr = M * D2R;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
    0.000289 * Math.sin(3 * Mr);
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * D2R);
  return mod(lambda, 360);
}

/** 节气索引 → 目标太阳视黄经（小寒 285°，大寒 300°，……，冬至 270°） */
function termLongitude(index) {
  return mod(285 + 15 * index, 360);
}

/**
 * 反解某年第 index 个节气的儒略日（UT，北京时间墙上时间等价）。
 * 牛顿迭代：太阳每日约行 0.98565°。
 */
function termJulianDay(year, index) {
  // 初值：1 月 1 日 + (index×15.2184 + 5) 天
  let jd = julianDayNumber(year, 1, 1) - 0.5 + (index * 15.2184 + 5);
  const target = termLongitude(index);
  for (let i = 0; i < 8; i++) {
    const lam = solarApparentLongitude(jd);
    let diff = mod(target - lam + 180, 360) - 180; // -180..180
    jd += diff / 0.9856473;
    if (Math.abs(diff) < 1e-7) break;
  }
  return jd;
}

/** 儒略日 → Date */
function jdToDate(jd) {
  return new Date((jd - 2440587.5) * DAY_MS);
}

/**
 * 某年二十四节气（北京时间）。
 * @returns {Array<{name:string,index:number,at:Date,type:'节'|'中气',local:string}>}
 */
export function solarTerms(year) {
  const y = Number(year);
  const out = [];
  for (let i = 0; i < 24; i++) {
    const at = jdToDate(termJulianDay(y, i));
    out.push({
      name: SOLAR_TERMS[i],
      index: i,
      at,
      type: i % 2 === 0 ? '节' : '中气',
      local: fmtBeijing(at),
    });
  }
  return out;
}

/** 若 date 恰在节气当日，返回该节气；否则 null */
export function solarTermOnDate(date) {
  const p = beijingParts(date);
  const list = solarTerms(p.year);
  const key = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  for (const t of list) {
    if (t.local.slice(0, 10) === key) return t;
  }
  return null;
}

/**
 * 某时刻所处的节气区间：current = 已过（含当日）的最近一个节气，next = 下一个节气。
 * @returns {{current:{name,index,type,at,local}, next:{name,index,type,at,local}}}
 */
export function currentSolarTerm(date = new Date()) {
  const t = toDate(date);
  const p = beijingParts(t);
  const all = [];
  for (const y of [p.year - 1, p.year, p.year + 1]) all.push(...solarTerms(y));
  all.sort((a, b) => a.at - b.at);
  let cur = all[0];
  let next = all[all.length - 1];
  for (let i = 0; i < all.length; i++) {
    if (all[i].at <= t) cur = all[i];
    else { next = all[i]; break; }
  }
  return { current: cur, next };
}

// ============================================================
// 农历（1900–2100 表）
// ============================================================

/**
 * 农历 1900–2100 年“闰月与月大小”编码表。
 * 每项：低 4 位 = 闰月月份（0 表示无闰月），bit16 = 闰月是否 30 天，
 * bit15..bit4 依次表示正月..十二月是否 30 天。
 * 与香港天文台《公历农历对照表》(1901–2100) 及通行万年历核对。
 */
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
  0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252, // 2090-2099
  0x0d520, // 2100
];

const LUNAR_BASE_YEAR = 1900;
const LUNAR_BASE_DAY = Date.UTC(1900, 0, 31); // 1900-01-31 = 农历 1900 年 正月初一
const LUNAR_MAX_YEAR = 2100;

const MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
const DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

/** 某农历年闰月月份，0 表示无闰月 */
export function leapMonth(year) {
  return LUNAR_INFO[year - LUNAR_BASE_YEAR] & 0xf;
}

/** 某农历年闰月天数（0 表示无闰月） */
export function leapMonthDays(year) {
  if (!leapMonth(year)) return 0;
  return (LUNAR_INFO[year - LUNAR_BASE_YEAR] & 0x10000) ? 30 : 29;
}

/** 某农历年第 month 个月（1..12，非闰）的天数 */
export function lunarMonthDays(year, month) {
  if (month < 1 || month > 12) throw new RangeError('农历月份应为 1–12：' + month);
  return (LUNAR_INFO[year - LUNAR_BASE_YEAR] & (0x10000 >> month)) ? 30 : 29;
}

/** 某农历年的总天数 */
export function lunarYearDays(year) {
  let sum = 348; // 12 × 29
  const info = LUNAR_INFO[year - LUNAR_BASE_YEAR];
  for (let i = 0x8000; i > 0x8; i >>= 1) if (info & i) sum += 1;
  return sum + leapMonthDays(year);
}

/** 农历年 → 干支（如 2026 → 丙午） */
export function lunarYearGanzhi(year) {
  return ganzhiName(mod(year - 4, 60));
}

/**
 * 公历时间 → 农历（**23:00 换日**：23:00 及以后算次日农历日）。
 * 给出 opts.longitude 时以真太阳时判定 23:00 界。
 * @param {Date|string|number} date
 * @param {{longitude?:number}} [opts]
 * @returns {{year:number, month:number, day:number, isLeap:boolean, yearGanzhi:string,
 *            yearBranch:string, monthName:string, dayName:string, fullName:string,
 *            effectiveDate:{year:number,month:number,day:number}, enteredNextDay:boolean}}
 */
export function lunarFromDate(date = new Date(), opts = {}) {
  const eff = effectiveDay(date, opts);
  const p = { year: eff.year, month: eff.month, day: eff.day };
  let offset = Math.floor((Date.UTC(p.year, p.month - 1, p.day) - LUNAR_BASE_DAY) / DAY_MS);
  if (offset < 0) throw new RangeError('农历表下限为 1900-01-31，收到 ' + fmtBeijing(date));
  let year = LUNAR_BASE_YEAR;
  while (year <= LUNAR_MAX_YEAR) {
    const yDays = lunarYearDays(year);
    if (offset < yDays) break;
    offset -= yDays;
    year += 1;
  }
  if (year > LUNAR_MAX_YEAR) throw new RangeError('农历表上限为 2100-12-31，收到 ' + fmtBeijing(date));

  const leap = leapMonth(year);
  let month = 1;
  let isLeap = false;
  let dayInMonth = offset;
  for (;;) {
    const mDays = lunarMonthDays(year, month);
    if (dayInMonth < mDays) break;
    dayInMonth -= mDays;
    if (leap === month) {
      // 闰月紧跟在同号月之后
      const lDays = leapMonthDays(year);
      if (dayInMonth < lDays) { isLeap = true; break; }
      dayInMonth -= lDays;
    }
    if (month === 12) throw new Error('农历换算越界：' + fmtBeijing(date));
    month += 1;
  }
  const day = dayInMonth + 1;
  const gz = lunarYearGanzhi(year);
  return {
    year,
    month,
    day,
    isLeap,
    yearGanzhi: gz,
    yearBranch: gz[1],
    monthName: (isLeap ? '闰' : '') + MONTH_NAMES[month - 1],
    dayName: DAY_NAMES[day - 1],
    fullName: `${gz}年 ${isLeap ? '闰' : ''}${MONTH_NAMES[month - 1]}${DAY_NAMES[day - 1]}`,
    effectiveDate: { year: eff.year, month: eff.month, day: eff.day },
    enteredNextDay: eff.enteredNextDay,
  };
}

/** 农历 1900-2100 所有春节（正月初一）的北京时间 Date */
export function springFestivals() {
  const out = [];
  let cursor = LUNAR_BASE_DAY;
  for (let year = LUNAR_BASE_YEAR; year <= LUNAR_MAX_YEAR; year++) {
    out.push({ year, date: new Date(cursor), local: fmtBeijing(new Date(cursor)).slice(0, 10) });
    cursor += lunarYearDays(year) * DAY_MS;
  }
  return out;
}

// ============================================================
// 月建、年柱
// ============================================================

/**
 * 月建（节气月）：以十二“节”为界。
 * 小寒→丑、立春→寅、惊蛰→卯、清明→辰、立夏→巳、芒种→午、
 * 小暑→未、立秋→申、白露→酉、寒露→戌、立冬→亥、大雪→子。
 * @returns {{branch:string, branchIndex:number, element:string, term:string, termAt:Date}}
 */
export function monthBranch(date = new Date()) {
  const t = toDate(date);
  const p = beijingParts(t);
  const terms = [];
  for (const y of [p.year - 1, p.year, p.year + 1]) {
    for (const term of solarTerms(y)) {
      if (term.index % 2 === 0) terms.push(term); // 只取“节”
    }
  }
  terms.sort((a, b) => a.at - b.at);
  let cur = terms[0];
  for (const term of terms) {
    if (term.at <= t) cur = term; else break;
  }
  const bIdx = JIE_MONTH_BRANCH[cur.index / 2];
  return {
    branch: BRANCHES[bIdx],
    branchIndex: bIdx,
    element: BRANCH_ELEMENTS[bIdx],
    term: cur.name,
    termAt: cur.at,
  };
}

/** 干支年（以立春为界） */
export function yearPillar(date = new Date()) {
  const t = toDate(date);
  const p = beijingParts(t);
  const lichun = solarTerms(p.year)[2]; // 立春 index 2
  const gzYear = t < lichun.at ? p.year - 1 : p.year;
  const idx = mod(gzYear - 4, 60);
  const info = ganzhiInfo(idx);
  return { ...info, gzYear, lichun: lichun.at, lichunLocal: lichun.local };
}

/** 月柱：五虎遁（甲己之年丙作首、乙庚之岁戊为头、丙辛必定寻庚起、丁壬壬位顺行流、戊癸甲寅好追求） */
export function monthPillar(date = new Date()) {
  const yp = yearPillar(date);
  const mb = monthBranch(date);
  const monthOrder = mod(mb.branchIndex - 2, 12); // 寅月为 0
  const sIdx = ((yp.stemIndex % 5) * 2 + 2 + monthOrder) % 10;
  return {
    stem: STEMS[sIdx],
    branch: BRANCHES[mb.branchIndex],
    name: STEMS[sIdx] + BRANCHES[mb.branchIndex],
    stemIndex: sIdx,
    branchIndex: mb.branchIndex,
    monthOrder,
    term: mb.term,
    termAt: mb.termAt,
    element: STEM_ELEMENTS[sIdx],
    branchElement: BRANCH_ELEMENTS[mb.branchIndex],
  };
}

// ============================================================
// 真太阳时
// ============================================================

/**
 * 均时差（equation of time，分钟）：真太阳时 − 平太阳时。
 * NOAA 近似公式，全年误差 < ±0.5 分钟。
 */
export function equationOfTime(date = new Date()) {
  const p = beijingParts(date);
  const n = dayOfYear(p.year, p.month, p.day);
  const gamma = (2 * Math.PI / 365) * (n - 1 + (p.hour - 12) / 24);
  return 229.18 * (
    0.000075 +
    0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)
  );
}

function fmtClock(date) {
  const p = beijingParts(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/**
 * 真太阳时。
 * 公式：真太阳时 = 北京时间 + (经度 − 120) × 4 分钟 + 均时差。
 * @param {Date|string|number} date 北京时间意义下的时刻
 * @param {number} longitude 东经为正（如上海 121.46）
 * @returns {{local:string, localFull:string, offsetMinutes:number, offsetSeconds:number,
 *            longitudeOffsetMinutes:number, equationOfTimeMinutes:number,
 *            date:Date, note:string}}
 */
export function trueSolarTime(date = new Date(), longitude) {
  const t = toDate(date);
  if (Number.isNaN(t.getTime())) throw new TypeError('无效的时间：' + String(date));
  const lon = Number(longitude);
  if (!Number.isFinite(lon)) throw new TypeError('无效的经度：' + String(longitude));
  const lonMinutes = (lon - 120) * 4;
  const eot = equationOfTime(t);
  const offsetSeconds = Math.round((lonMinutes + eot) * 60);
  const solar = new Date(t.getTime() + offsetSeconds * 1000);
  const p = beijingParts(solar);
  const pad = (n) => String(n).padStart(2, '0');
  const full = `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
  return {
    local: fmtClock(solar),
    localFull: full,
    date: solar,
    offsetMinutes: Math.round(offsetSeconds / 60),
    offsetSeconds,
    longitudeOffsetMinutes: Math.round(lonMinutes * 10) / 10,
    equationOfTimeMinutes: Math.round(eot * 10) / 10,
    note:
      `真太阳时 = 北京时间 + (经度 ${lon.toFixed(2)} − 120) × 4 分钟` +
      `（${lonMinutes >= 0 ? '+' : ''}${lonMinutes.toFixed(1)} 分）` +
      ` + 均时差（${eot >= 0 ? '+' : ''}${eot.toFixed(1)} 分）` +
      ` = ${offsetSeconds >= 0 ? '+' : ''}${(offsetSeconds / 60).toFixed(1)} 分。`,
  };
}

// ============================================================
// 汇总：getAlmanac
// ============================================================

/**
 * 历法汇总（对应 SPEC §2.1 的 time 对象 / §2.8 的 almanac）。
 *
 * 日界 23:00：日柱、日支、旬空、农历日按「有效日」计算；23:00 及以后算次日，
 * 30 分（晚子时）即属次日日柱、次日农历日。给出 opts.longitude 时，
 * 日界与时辰都以真太阳时判定（真太阳时 23:00 后进日）。
 *
 * @param {Date|string|number} date 北京时间意义下的时刻，缺省当前
 * @param {{longitude?:number}} opts 给出 longitude 时附真太阳时，并按真太阳时定时辰
 * @returns {object}
 */
export function getAlmanac(date = new Date(), opts = {}) {
  const t = toDate(date);
  if (Number.isNaN(t.getTime())) throw new TypeError('无效的时间：' + String(date));
  const p = beijingParts(t);
  const lon = opts && opts.longitude;
  const hasLon = lon != null && Number.isFinite(Number(lon));
  const dayOpts = hasLon ? { longitude: lon } : {};

  const lunar = lunarFromDate(t, dayOpts);
  const yp = yearPillar(t);
  const mp = monthPillar(t);
  const dp = dayPillar(t, dayOpts); // 23:00 换日（给经度时按真太阳时）
  const term = currentSolarTerm(t);
  const kong = xunKong(dp);

  // 时辰基准：给经度按真太阳时，否则北京时间
  const tst = hasLon ? trueSolarTime(t, lon) : null;
  const basisHour = tst ? beijingParts(tst.date).hour : p.hour;
  const hourBranchIdx = hourBranchIndex(basisHour);
  const hour = hourPillar(dp, BRANCHES[hourBranchIdx]); // 晚子时：按换日后的日干起子时干

  const result = {
    iso: new Date(t.getTime()).toISOString(),
    local: fmtBeijing(t, true),
    week: WEEKDAY_NAMES[p.weekday],
    timezone: 'Asia/Shanghai',
    epochMs: t.getTime(),
    lunar,
    ganzhi: {
      year: yp.name,
      month: mp.name,
      day: dp.name,
      hour: hour.name,
    },
    yearGanzhi: yp.name,
    monthGanzhi: mp.name,
    dayGanzhi: dp.name,
    hourGanzhi: hour.name,
    monthBranch: mp.branch,
    monthBranchElement: BRANCH_ELEMENTS[mp.branchIndex],
    monthTerm: mp.term,
    dayBranch: dp.branch,
    xunKong: kong,
    xunHead: xunHead(dp),
    solarTerm: {
      current: {
        name: term.current.name,
        index: term.current.index,
        type: term.current.type,
        at: term.current.local,
        termAt: term.current.at,
      },
      next: {
        name: term.next.name,
        index: term.next.index,
        type: term.next.type,
        at: term.next.local,
        termAt: term.next.at,
      },
    },
    hourBranch: {
      branch: BRANCHES[hourBranchIdx],
      branchIndex: hourBranchIdx,
      element: BRANCH_ELEMENTS[hourBranchIdx],
      range: hourRange(hourBranchIdx),
    },
    // 23:00 换日：日柱所用“有效日”与是否进日（便于工具层展示与排查）
    effectiveDate: dp.effectiveDate,
    enteredNextDay: dp.enteredNextDay,
    dayBasis: dp.dayBasis,
    dayBoundary: DAY_BOUNDARY_HOUR,
  };

  if (hasLon) {
    const civilDp = dayPillar(t); // 北京时间基准的日柱，仅作对照
    const civilHourBranchIdx = hourBranchIndex(p.hour);
    const civilHour = hourPillar(civilDp, p.hour);
    result.trueSolarTime = {
      local: tst.local,
      localFull: tst.localFull,
      offsetMinutes: tst.offsetMinutes,
      offsetSeconds: tst.offsetSeconds,
      equationOfTimeMinutes: tst.equationOfTimeMinutes,
      longitudeOffsetMinutes: tst.longitudeOffsetMinutes,
      note: tst.note,
    };
    result.hourBranchCivil = {
      branch: BRANCHES[civilHourBranchIdx],
      branchIndex: civilHourBranchIdx,
      element: BRANCH_ELEMENTS[civilHourBranchIdx],
      range: hourRange(civilHourBranchIdx),
    };
    result.ganzhi.hourCivil = civilHour.name;
    result.ganzhi.dayCivil = civilDp.name;
    result.hourBasis = '真太阳时';
  } else {
    result.hourBasis = '北京时间';
  }

  return result;
}

export default {
  getAlmanac,
  trueSolarTime,
  solarTerms,
  lunarFromDate,
  dayPillar,
  hourPillar,
  xunKong,
  effectiveDay,
  DAY_BOUNDARY_HOUR,
  monthBranch,
  monthPillar,
  yearPillar,
  currentSolarTerm,
  equationOfTime,
  julianDayNumber,
  julianDay,
  solarApparentLongitude,
  ganzhiName,
  ganzhiIndex,
  ganzhiInfo,
  toDate,
  beijingParts,
  fmtBeijing,
  springFestivals,
  leapMonth,
  leapMonthDays,
  lunarMonthDays,
  lunarYearDays,
  lunarYearGanzhi,
  hourBranchIndex,
  hourRange,
  STEMS,
  BRANCHES,
  SOLAR_TERMS,
};
