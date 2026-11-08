/**
 * ziwei.js —— 紫微斗数排盘引擎（纯 ESM、零第三方依赖）
 *
 * 输入：公历日期（本地时间，默认北京时间）、性别、可选经度（真太阳时判界）。
 * 输出：与前端 `client/ziwei-chart/chart.js` 数据契约同构的盘面 JSON。
 *
 * 口径（详见 docs/PLAN-ZIWEI-CLIENT.md）：
 *  - 子时换日：23:00 起算次日（沿用 almanac 的 effectiveDay）；
 *  - 闰月：默认「前半月（1–15）按下月、后半月（16–月底）按下月」之外的通行派别，
 *    本项目采用 py-iztro 通行口径：闰月前半月算上个月、后半月算下个月（fixLeap=true）；
 *  - 四化用农历年干（正月初一为界），非立春；
 *  - 紫微定位用《紫微斗数全书》表，经 py-iztro 对照校准。
 *
 * 数据表在 ziwei-data.js；本文件只做逻辑。
 */
import {
  STEMS, BRANCHES, getAlmanac, hourBranchIndex, lunarFromDate, xunKong, beijingParts,
} from './almanac.js';
import {
  ZIWEI_TABLE, BRIGHTNESS, KUIYUE, LUCUN, HUOXING_START, LINGXING_START,
  TIANMA, HONGLUAN_START, SOUL_STARS, BODY_STARS, SIHUA_TABLE,
  NAYIN_60, NAYIN_TO_JU,
} from './ziwei-data.js';

const MOD = 12;
const mod = (n) => ((n % MOD) + MOD) % MOD;

const PALACE_NAMES = [
  '命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄',
  '迁移', '交友', '官禄', '田宅', '福德', '父母',
];

/** 盘面环序（沿四边逆时针一圈） */
const RING = ['寅', '丑', '子', '亥', '戌', '酉', '申', '未', '午', '巳', '辰', '卯'];

const MAIN_STARS = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];

const ZIWEI_SERIES = [['紫微', 0], ['天机', -1], ['太阳', -3], ['武曲', -4], ['天同', -5], ['廉贞', -8]];
const TIANFU_SERIES = [['天府', 0], ['太阴', 1], ['贪狼', 2], ['巨门', 3], ['天相', 4], ['天梁', 5], ['七杀', 6], ['破军', 10]];

const SIX_SHA = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];
const AUX_STARS = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '天马'];
const SHEN_SHA = ['天刑', '天姚', '红鸾', '天喜', '华盖', '咸池', '孤辰', '寡宿', '天哭', '天虚', '破碎', '大耗'];

const HUA_NAMES = ['禄', '权', '科', '忌'];

/** 三合局 → 墓/桃花 等 */
const SANHE_GROUP = {
  申: '水', 子: '水', 辰: '水',
  寅: '火', 午: '火', 戌: '火',
  巳: '金', 酉: '金', 丑: '金',
  亥: '木', 卯: '木', 未: '木',
};
const MU = { 水: '辰', 火: '戌', 金: '丑', 木: '未' };
const TAOHUA = { 水: '酉', 火: '卯', 金: '午', 木: '子' };
const GUCHEN = { 水: '寅', 火: '巳', 金: '申', 木: '亥' }; // 孤辰：三合局前一位
const GUASU = { 水: '戌', 火: '丑', 金: '辰', 木: '未' };  // 寡宿：三合局后一位

const BROKEN = { 子: '巳', 午: '巳', 卯: '巳', 酉: '巳', 寅: '酉', 申: '酉', 巳: '酉', 亥: '酉', 辰: '丑', 戌: '丑', 丑: '丑', 未: '丑' };
const DAHAO = { 子: '未', 丑: '午', 寅: '酉', 卯: '申', 辰: '亥', 巳: '戌', 午: '丑', 未: '子', 申: '卯', 酉: '寅', 戌: '巳', 亥: '辰' };

const branchIndex = (zhi) => BRANCHES.indexOf(zhi);
const stemIndex = (gan) => STEMS.indexOf(gan);

function nayinOf(gan, zhi) {
  const si = stemIndex(gan);
  const bi = branchIndex(zhi);
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === si && i % 12 === bi) return NAYIN_60[Math.floor(i / 2)];
  }
  throw new Error(`不是合法干支：${gan}${zhi}`);
}

function juFromGanzhi(gan, zhi) {
  const nayin = nayinOf(gan, zhi);
  const element = nayin[nayin.length - 1];
  const ju = NAYIN_TO_JU[element];
  if (!ju) throw new Error(`纳音五行无法定局：${nayin}`);
  return { ...ju, element, nayin };
}

/** 五虎遁：由年干得寅宫天干 */
function yinStemOf(yearStem) {
  const si = stemIndex(yearStem);
  return STEMS[(2 * (si % 5) + 2) % 10];
}

/** 闰月处理：前半月算上个月，后半月算下个月（通行口径，可关） */
function effectiveMonth(month, day, isLeap, fixLeap = true) {
  if (!isLeap || !fixLeap) return month;
  if (day <= 15) return month === 1 ? 12 : month - 1;
  return month === 12 ? 1 : month + 1;
}

function hourIndexOfDate(date) {
  return hourBranchIndex(date.getHours());
}

function starBrightness(star, zhiIndex) {
  const s = BRIGHTNESS[star];
  if (!s) return '';
  return s[zhiIndex] || '';
}

function buildStar(star, positions, zhiIndex, sihuaMap) {
  const zhi = BRANCHES[zhiIndex];
  if (positions[star] !== zhi) return null;
  const item = { name: star, bright: starBrightness(star, zhiIndex) };
  const hua = sihuaMap.get(star);
  if (hua) item.sihua = hua;
  return item;
}

/**
 * 排紫微斗数盘
 * @param {object} opts
 * @param {Date} [opts.date] 出生时间（本地时间）
 * @param {'男'|'女'} [opts.gender]
 * @param {number} [opts.longitude] 经度（用于子时换日判界；不传按北京时间）
 * @param {boolean} [opts.fixLeap] 闰月通行调整，默认 true
 * @param {Date} [opts.now] 计算「当前大限/流年」的参照时间，默认当下
 * @returns {object} 盘面
 */
export function castZiwei(opts = {}) {
  const date = opts.date instanceof Date ? opts.date : new Date(opts.date || Date.now());
  const gender = opts.gender === '女' ? '女' : '男';
  if (Number.isNaN(date.getTime())) throw new TypeError('出生时间不合法');
  const fixLeap = opts.fixLeap !== false;
  const now = opts.now instanceof Date ? opts.now : new Date();

  // 一律用北京时间（固定 UTC+8）取年月日时，避免本机历史时区/夏令时影响命盘。
  // 农历以「北京时间当日 12:00」取，避免 23:00 换日把生月/生日整体推到次日。
  // 晚子时（23:00–23:59）只把「日」推一日用于紫微定位；命宫/身宫/月系星仍按当日。
  const bp = beijingParts(date);
  const noon = new Date(Date.UTC(bp.year, bp.month - 1, bp.day, 4, 0, 0)); // 北京 12:00
  const lunar = lunarFromDate(noon, { longitude: opts.longitude });
  const nextDay = new Date(Date.UTC(bp.year, bp.month - 1, bp.day + 1, 4, 0, 0));
  const lunarNext = lunarFromDate(nextDay, { longitude: opts.longitude });
  const almanac = getAlmanac(date, { longitude: opts.longitude });
  const hourIndex = hourBranchIndex(bp.hour);
  const isLateZi = bp.hour >= 23;
  const ziweiDay = isLateZi ? lunarNext.day : lunar.day;
  const month = effectiveMonth(lunar.month, lunar.day, lunar.isLeap, fixLeap);

  /* ── 命宫、身宫 ── */
  const mingZhiIndex = mod(2 + (month - 1) - hourIndex);
  const shenZhiIndex = mod(2 + (month - 1) + hourIndex);
  const mingZhi = BRANCHES[mingZhiIndex];
  const shenZhi = BRANCHES[shenZhiIndex];

  /* ── 年干/年支（农历年） ── */
  const yearGanzhi = lunar.yearGanzhi;
  const yearStem = yearGanzhi[0];
  const yearBranch = yearGanzhi[1];

  /* ── 命宫干支与五行局 ── */
  const yinStem = yinStemOf(yearStem);
  const palaceGan = (zhiIndex) => STEMS[(stemIndex(yinStem) + mod(zhiIndex - 2)) % 10];
  const mingGan = palaceGan(mingZhiIndex);
  const ju = juFromGanzhi(mingGan, mingZhi);

  /* ── 紫微、天府 ── */
  const ziweiZhi = ZIWEI_TABLE[ju.name][ziweiDay - 1];
  if (!ziweiZhi) throw new RangeError(`农历日 ${ziweiDay} 超出紫微定位表`);
  const ziweiIdx = branchIndex(ziweiZhi);
  const tianfuIdx = mod(2 - (ziweiIdx - 2));
  const tianfuZhi = BRANCHES[tianfuIdx];

  /* ── 十四主星位置 ── */
  const positions = {};
  ZIWEI_SERIES.forEach(([star, off]) => { positions[star] = BRANCHES[mod(ziweiIdx + off)]; });
  TIANFU_SERIES.forEach(([star, off]) => { positions[star] = BRANCHES[mod(tianfuIdx + off)]; });

  /* ── 四化（年干） ── */
  const sihuaList = SIHUA_TABLE[yearStem] || [];
  const sihuaMap = new Map();
  sihuaList.forEach((star, i) => sihuaMap.set(star, HUA_NAMES[i]));

  /* ── 辅星/煞星位置 ── */
  const auxPos = {};
  auxPos['左辅'] = BRANCHES[mod(4 + (month - 1))];
  auxPos['右弼'] = BRANCHES[mod(10 - (month - 1))];
  auxPos['文昌'] = BRANCHES[mod(10 - hourIndex)];
  auxPos['文曲'] = BRANCHES[mod(4 + hourIndex)];
  const kuiyue = KUIYUE[yearStem] || KUIYUE.甲;
  auxPos['天魁'] = kuiyue[0];
  auxPos['天钺'] = kuiyue[1];
  const lucun = LUCUN[yearStem] || LUCUN.甲;
  auxPos['禄存'] = lucun;
  auxPos['擎羊'] = BRANCHES[mod(branchIndex(lucun) + 1)];
  auxPos['陀罗'] = BRANCHES[mod(branchIndex(lucun) - 1)];
  auxPos['火星'] = BRANCHES[mod(branchIndex(HUOXING_START[yearBranch]) + hourIndex)];
  auxPos['铃星'] = BRANCHES[mod(branchIndex(LINGXING_START[yearBranch]) + hourIndex)];
  auxPos['地空'] = BRANCHES[mod(11 - hourIndex)];
  auxPos['地劫'] = BRANCHES[mod(11 + hourIndex)];
  auxPos['天马'] = TIANMA[yearBranch];

  /* ── 神煞 ── */
  const shaPos = {};
  shaPos['天刑'] = BRANCHES[mod(9 + (month - 1))];
  shaPos['天姚'] = BRANCHES[mod(1 + (month - 1))];
  shaPos['红鸾'] = BRANCHES[mod(branchIndex(HONGLUAN_START) - branchIndex(yearBranch))];
  shaPos['天喜'] = BRANCHES[mod(branchIndex(shaPos['红鸾']) + 6)];
  const group = SANHE_GROUP[yearBranch];
  shaPos['华盖'] = MU[group];
  shaPos['咸池'] = TAOHUA[group];
  shaPos['孤辰'] = GUCHEN[group];
  shaPos['寡宿'] = GUASU[group];
  shaPos['天哭'] = BRANCHES[mod(6 - branchIndex(yearBranch))]; // 午起子年逆
  shaPos['天虚'] = BRANCHES[mod(6 + branchIndex(yearBranch))]; // 午起子年顺
  shaPos['破碎'] = BROKEN[yearBranch];
  shaPos['大耗'] = DAHAO[yearBranch];

  /* ── 大限 ── */
  const yearYang = stemIndex(yearStem) % 2 === 0;
  const forward = (yearYang && gender === '男') || (!yearYang && gender === '女');
  const daxianByZhi = {};
  for (let k = 0; k < 12; k += 1) {
    const zhi = forward ? BRANCHES[mod(mingZhiIndex + k)] : BRANCHES[mod(mingZhiIndex - k)];
    const start = ju.num + 10 * k;
    daxianByZhi[zhi] = `${start}-${start + 9}`;
  }

  /* ── 当前虚岁与大限、流年 ── */
  const nowLunar = lunarFromDate(now, { longitude: opts.longitude });
  const nominalAge = nowLunar.year - lunar.year + 1;
  let currentDaxian = '';
  let daxianZhi = '';
  Object.keys(daxianByZhi).forEach((zhi) => {
    const [s, e] = daxianByZhi[zhi].split('-').map(Number);
    if (nominalAge >= s && nominalAge <= e) { currentDaxian = daxianByZhi[zhi]; daxianZhi = zhi; }
  });
  const nowAlmanac = getAlmanac(now, { longitude: opts.longitude });
  const liunianZhi = nowAlmanac.ganzhi.year[1];
  const liunianLabel = `${nowAlmanac.ganzhi.year}（${now.getFullYear()}）`;

  /* ── 组盘 ── */
  const palaces = RING.map((zhi) => {
    const zi = branchIndex(zhi);
    const nameOffset = mod(mingZhiIndex - zi);
    const name = PALACE_NAMES[nameOffset];
    const stars = MAIN_STARS.map((star) => buildStar(star, positions, zi, sihuaMap)).filter(Boolean);
    const aux = [];
    AUX_STARS.concat(SIX_SHA).forEach((star) => {
      if (auxPos[star] !== zhi) return;
      const item = { name: star };
      const bright = starBrightness(star, zi);
      if (bright) item.bright = bright;
      const hua = sihuaMap.get(star);
      if (hua) item.sihua = hua;
      aux.push(item);
    });
    const sha = SHEN_SHA.filter((star) => shaPos[star] === zhi);
    return {
      zhi,
      name,
      isMing: zhi === mingZhi,
      isShen: zhi === shenZhi,
      daxian: daxianByZhi[zhi],
      liunian: zhi === liunianZhi ? '流年命宫' : '',
      stars,
      aux,
      sha,
    };
  });

  const hints = [];
  if (lunar.isLeap) {
    hints.push(`生月为闰${lunar.month}月，已按通行口径${fixLeap ? '前半月算上月、后半月算下月' : '按本月'}处理安命。`);
  }
  if (isLateZi) hints.push('晚子时（23:00 后）：命宫/月系星按当日，紫微按次日农历日定位（与通行排盘一致）。');
  hints.push('四化取农历年干（正月初一为界）；若师承以立春换年，需另校。');
  hints.push('流年斗君、小限、自化飞星、三方四正连线尚未实现（阶段 C/D）。');

  const pad = (n) => String(n).padStart(2, '0');
  return {
    meta: {
      name: opts.name || `${gender}命`,
      gender,
      birthSolar: `${bp.year}-${pad(bp.month)}-${pad(bp.day)} ${pad(bp.hour)}:${pad(bp.minute)}`,
      birthLunar: lunar.fullName,
      fourPillars: `${almanac.ganzhi.year} ${almanac.ganzhi.month} ${almanac.ganzhi.day} ${almanac.ganzhi.hour}`,
      wuxingJu: ju.name,
      mingZhu: SOUL_STARS[mingZhi],
      shenZhu: BODY_STARS[yearBranch],
      shenGongZhi: shenZhi,
      daxian: currentDaxian,
      liunian: liunianLabel,
      note: '本盘由本地引擎计算，未含流年斗君/小限/飞星',
    },
    palaces,
    details: {
      mingZhi,
      shenZhi,
      mingGan,
      mingGanzhi: `${mingGan}${mingZhi}`,
      ju,
      ziweiZhi,
      tianfuZhi,
      yearGanzhi,
      month,
      hourIndex,
      lunar,
      xunKong: xunKong(almanac.ganzhi.day),
      daxianDirection: forward ? '顺行' : '逆行',
      currentDaxian: daxianZhi ? `${daxianZhi}宫 ${currentDaxian}` : '',
      nominalAge,
      liunianZhi,
      palaceGanzhi: Object.fromEntries(BRANCHES.map((zhi, i) => [zhi, `${palaceGan(i)}${zhi}`])),
    },
    hints,
  };
}

export default castZiwei;
