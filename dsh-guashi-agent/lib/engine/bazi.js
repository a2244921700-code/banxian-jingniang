// 八字（子平）排盘引擎。
//
// 输入出生时间（公历）、性别，可选出生地经度与是否用真太阳时；输出四柱、十神、藏干、
// 十二长生（星运/自坐）、旬空、纳音、常用神煞子集、大运（顺逆/起运/交运）、流年、流月，
// 以及与前端 `client/bazi-chart` 对齐的数据结构。断法（旺衰/格局/用神/应期）不写在引擎里。
//
// 依赖 almanac.js：四柱、节气、农历、真太阳时、子时换日规则（23:00 进次日）。

import {
  STEMS, BRANCHES, getAlmanac, solarTerms, trueSolarTime, beijingParts,
} from './almanac.js';

const STEM_EL = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
const BRANCH_EL = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];
const SHENGXIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

const HIDDEN = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '戊', '庚'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};

const CS_ORDER = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
const CS_START = {
  甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅', 己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯',
};

const NAYIN = [
  '海中金', '炉中火', '大林木', '路旁土', '剑锋金', '山头火', '涧下水', '城头土', '白蜡金', '杨柳木',
  '泉中水', '屋上土', '霹雳火', '松柏木', '长流水', '沙中金', '山下火', '平地木', '壁上土', '金箔金',
  '覆灯火', '天河水', '大驿土', '钗钏金', '桑柘木', '大溪水', '沙中土', '天上火', '石榴木', '大海水',
];

const JIEQI = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];

const EL_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const EL_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

const GROUP = {};
[['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']].forEach((g) => {
  g.forEach((z) => { GROUP[z] = g.join(''); });
});
const TAOHUA = { 申子辰: '酉', 寅午戌: '卯', 巳酉丑: '午', 亥卯未: '子' };
const YIMA = { 申子辰: '寅', 寅午戌: '申', 巳酉丑: '亥', 亥卯未: '巳' };
const HUAGAI = { 申子辰: '辰', 寅午戌: '戌', 巳酉丑: '丑', 亥卯未: '未' };
const JIANGXING = { 申子辰: '子', 寅午戌: '午', 巳酉丑: '酉', 亥卯未: '卯' };
const JIESHA = { 申子辰: '巳', 寅午戌: '亥', 巳酉丑: '寅', 亥卯未: '申' };
const WANGSHEN = { 申子辰: '亥', 寅午戌: '巳', 巳酉丑: '申', 亥卯未: '寅' };
const GUCHEN = { 亥子丑: '寅', 寅卯辰: '巳', 巳午未: '申', 申酉戌: '亥' };
const GUASU = { 亥子丑: '戌', 寅卯辰: '丑', 巳午未: '辰', 申酉戌: '未' };
const TIANYI = { 甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉', 辛: '午寅', 壬: '卯巳', 癸: '卯巳' };
const WENCHANG = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
const LUSHEN = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };

const JIE_TERM_TYPE = '节';

function mod12(n) { return ((n % 12) + 12) % 12; }
function ganIdx(g) { return STEMS.indexOf(g); }
function zhiIdx(z) { return BRANCHES.indexOf(z); }
function pad(n) { return String(n).padStart(2, '0'); }

function sexagenaryIndex(gan, zhi) {
  const gi = ganIdx(gan);
  const zi = zhiIdx(zhi);
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === gi && i % 12 === zi) return i;
  }
  return -1;
}

export function shishen(dayGan, targetGan) {
  const di = ganIdx(dayGan);
  const ti = ganIdx(targetGan);
  if (di < 0 || ti < 0) return '';
  const de = STEM_EL[di];
  const te = STEM_EL[ti];
  const sameYY = di % 2 === ti % 2;
  if (de === te) return sameYY ? '比肩' : '劫财';
  if (EL_SHENG[de] === te) return sameYY ? '食神' : '伤官';
  if (EL_KE[de] === te) return sameYY ? '偏财' : '正财';
  if (EL_KE[te] === de) return sameYY ? '七杀' : '正官';
  if (EL_SHENG[te] === de) return sameYY ? '偏印' : '正印';
  return '';
}

export function changSheng(gan, zhi) {
  const start = CS_START[gan];
  if (!start) return '';
  const si = zhiIdx(start);
  const zi = zhiIdx(zhi);
  const odd = ganIdx(gan) % 2 === 1;
  const step = odd ? mod12(si - zi) : mod12(zi - si);
  return CS_ORDER[step];
}

export function xunKong(gan, zhi) {
  const i = sexagenaryIndex(gan, zhi);
  if (i < 0) return '';
  const xun = Math.floor(i / 10);
  const a = mod12(xun * 10 + 10);
  return BRANCHES[a] + BRANCHES[mod12(a + 1)];
}

export function nayinOf(gan, zhi) {
  const i = sexagenaryIndex(gan, zhi);
  return i < 0 ? '' : NAYIN[Math.floor(i / 2)];
}

export function shenshaOf(gan, zhi, dayGan, yearBranch) {
  const out = [];
  const add = (name, ok) => { if (ok && !out.includes(name)) out.push(name); };
  add('天乙贵人', (TIANYI[dayGan] || '').includes(zhi));
  add('文昌贵人', WENCHANG[dayGan] === zhi);
  add('禄神', LUSHEN[dayGan] === zhi);
  add('羊刃', changSheng(dayGan, zhi) === '帝旺');
  const g = GROUP[yearBranch] || '';
  add('桃花', TAOHUA[g] === zhi);
  add('驿马', YIMA[g] === zhi);
  add('华盖', HUAGAI[g] === zhi);
  add('将星', JIANGXING[g] === zhi);
  add('劫煞', JIESHA[g] === zhi);
  add('亡神', WANGSHEN[g] === zhi);
  const yb = zhiIdx(yearBranch);
  add('红鸾', BRANCHES[mod12(3 - yb)] === zhi);
  add('天喜', BRANCHES[mod12(3 - yb + 6)] === zhi);
  let gu = null;
  let gua = null;
  Object.keys(GUCHEN).forEach((k) => {
    if (k.includes(yearBranch)) { gu = GUCHEN[k]; gua = GUASU[k]; }
  });
  add('孤辰', gu === zhi);
  add('寡宿', gua === zhi);
  return out;
}

function pillarDetail(gan, zhi, label, dayGan, yearBranch, gender) {
  const canggan = (HIDDEN[zhi] || []).map((g) => ({ gan: g, shishen: shishen(dayGan, g) }));
  return {
    label,
    gan,
    zhi,
    ganEl: STEM_EL[ganIdx(gan)],
    zhiEl: BRANCH_EL[zhiIdx(zhi)],
    shishen: label === '日柱' ? (gender === '女' ? '元女' : '元男') : shishen(dayGan, gan),
    canggan,
    xingyun: changSheng(dayGan, zhi),
    zizuo: changSheng(gan, zhi),
    kongwang: xunKong(gan, zhi),
    nayin: nayinOf(gan, zhi),
    shensha: shenshaOf(gan, zhi, dayGan, yearBranch),
  };
}

function yearGanzhi(year) {
  const n = year - 4;
  return { gan: STEMS[((n % 10) + 10) % 10], zhi: BRANCHES[((n % 12) + 12) % 12] };
}

function monthStemBase(yearGan) {
  return ((ganIdx(yearGan) % 5) * 2 + 2) % 10;
}

function liuyueList(yearGan) {
  const base = monthStemBase(yearGan);
  return JIEQI.map((jieqi, i) => ({
    idx: i,
    jieqi,
    gan: STEMS[(base + i) % 10],
    zhi: BRANCHES[(2 + i) % 12],
  }));
}

function termTime(term) {
  const t = term && (term.at || term.termAt);
  return t instanceof Date ? t.getTime() : new Date(t).getTime();
}

function isYangStem(gan) { return ganIdx(gan) % 2 === 0; }

/** 起运：按出生到最近「节」的日数，三日折一年、一日折四月、一时折十日（取常用法）。 */
function computeQiyun(birthDate, birthParts, yearGan, gender) {
  const forward = (isYangStem(yearGan) && gender === '男') || (!isYangStem(yearGan) && gender === '女');
  const epoch = birthDate.getTime();
  const terms = [];
  for (let y = birthParts.year - 1; y <= birthParts.year + 1; y += 1) {
    solarTerms(y).forEach((t) => {
      if (t.type === JIE_TERM_TYPE) terms.push(t);
    });
  }
  terms.sort((a, b) => termTime(a) - termTime(b));
  let term = null;
  if (forward) {
    term = terms.find((t) => termTime(t) > epoch) || null;
  } else {
    const before = terms.filter((t) => termTime(t) <= epoch);
    term = before.length ? before[before.length - 1] : null;
  }
  if (!term) throw new Error('起运计算失败：找不到出生附近的节气');
  const days = Math.abs(termTime(term) - epoch) / 86400000;
  let years = Math.floor(days / 3);
  let rem = days - years * 3;
  let months = Math.floor(rem * 4);
  let rem2 = rem * 4 - months;
  let d = Math.round(rem2 * 30);
  if (d >= 30) { d -= 30; months += 1; }
  if (months >= 12) { months -= 12; years += 1; }
  return { forward, direction: forward ? '顺行' : '逆行', term, years, months, days: d };
}

function buildDayun(birthDate, birthParts, monthGanZhi, yearGan, gender, now) {
  const q = computeQiyun(birthDate, birthParts, yearGan, gender);
  const monthIdx = sexagenaryIndex(monthGanZhi[0], monthGanZhi[1]);
  const dirStep = q.forward ? 1 : -1;
  // 交运年份：出生年 + 年数 + 月数（按公历近似）
  const start = new Date(Date.UTC(birthParts.year + q.years, birthParts.month - 1 + q.months, birthParts.day + q.days));
  const startYear = start.getUTCFullYear();
  const startAge = startYear - birthParts.year + 1; // 虚岁
  const dayun = [];
  for (let i = 0; i < 10; i += 1) {
    const idx = ((monthIdx + dirStep * (i + 1)) % 60 + 60) % 60;
    const gan = STEMS[idx % 10];
    const zhi = BRANCHES[idx % 12];
    const from = startYear + i * 10;
    const to = from + 9;
    const ageStart = startAge + i * 10;
    const liunian = [];
    for (let y = from; y <= to; y += 1) {
      const gz = yearGanzhi(y);
      const ly = liuyueList(gz.gan);
      liunian.push({
        year: y,
        age: y - birthParts.year + 1,
        gan: gz.gan,
        zhi: gz.zhi,
        shishen: shishen(monthGanZhi[0] && '', gz.gan) || '',
        liuyue: ly.map((m) => ({ ...m, shishen: shishen('', m.gan) })),
      });
    }
    dayun.push({
      index: i,
      from,
      to,
      label: String(from),
      age: `${ageStart}岁`,
      ageStart,
      ageEnd: ageStart + 9,
      gan,
      zhi,
      shishen: '',
      liunian,
    });
  }
  return { q, monthIdx, dirStep, startYear, startAge, dayun };
}

export function castBazi(opts = {}) {
  const date = opts.date instanceof Date ? opts.date : new Date(opts.date);
  if (Number.isNaN(date.getTime())) throw new TypeError('八字排盘需要有效的出生时间');
  const gender = opts.gender === '女' ? '女' : '男';
  const now = opts.now instanceof Date ? opts.now : new Date();
  const longitude = Number.isFinite(opts.longitude) ? Number(opts.longitude) : null;
  const useTrueSolarTime = opts.trueSolarTime !== false;

  let baseDate = date;
  if (longitude != null && useTrueSolarTime) {
    baseDate = trueSolarTime(date, longitude).date;
  }
  const almanac = getAlmanac(baseDate);
  const [yearGz, monthGz, dayGz, hourGz] = ['year', 'month', 'day', 'hour'].map((k) => almanac.ganzhi[k]);
  const dayGan = dayGz[0];
  const yearBranch = yearGz[1];
  const bp = beijingParts(date);

  const pillars = [
    pillarDetail(yearGz[0], yearGz[1], '年柱', dayGan, yearBranch, gender),
    pillarDetail(monthGz[0], monthGz[1], '月柱', dayGan, yearBranch, gender),
    pillarDetail(dayGz[0], dayGz[1], '日柱', dayGan, yearBranch, gender),
    pillarDetail(hourGz[0], hourGz[1], '时柱', dayGan, yearBranch, gender),
  ];

  const yun = buildDayun(baseDate, bp, [monthGz[0], monthGz[1]], yearGz[0], gender, now);
  const dayun = yun.dayun;
  // 填 大运/流年 十神（以日干为我）
  dayun.forEach((d) => {
    d.shishen = shishen(dayGan, d.gan);
    d.liunian.forEach((ln) => {
      ln.shishen = shishen(dayGan, ln.gan);
      ln.liuyue.forEach((ly) => { ly.shishen = shishen(dayGan, ly.gan); });
    });
  });

  const nowYear = now.getUTCFullYear();
  let currentDayunIndex = dayun.findIndex((d) => d.from <= nowYear && nowYear <= d.to);
  if (currentDayunIndex < 0) currentDayunIndex = nowYear < dayun[0].from ? 0 : dayun.length - 1;
  const currentLiunianYear = Math.min(Math.max(nowYear, dayun[currentDayunIndex].from), dayun[currentDayunIndex].to);
  const curDayun = dayun[currentDayunIndex];
  const curLiunian = curDayun.liunian.find((x) => x.year === currentLiunianYear) || curDayun.liunian[0];
  const nowAlmanac = getAlmanac(now);
  const monthBranch = nowAlmanac.monthBranch || '寅';
  const currentLiuyueIndex = mod12(zhiIdx(monthBranch) - 2);

  const hints = [
    '四柱按节气换月、立春换年；日柱按子时换日（23:00 进次日），23:00–23:59 为晚子时。',
    useTrueSolarTime && longitude != null
      ? `已按出生地经度 ${longitude}° 换算真太阳时排盘；如需钟表时，传入 trueSolarTime:false。`
      : '未提供出生地经度，按北京时间排盘（未做真太阳时校正）。',
    '本盘已含四柱、十神、藏干、十二长生、自坐、旬空、纳音、常用神煞子集、大运/流年/流月。',
    '旺衰、格局、用神、人元司令、流日流时、分柱（五柱）未在引擎内计算，断法见技能与知识库。',
  ];
  if (bp.hour >= 23) hints.push('出生时间在 23:00 后，已按晚子时（子时换日）处理，日柱取次日。');

  return {
    meta: {
      name: opts.name || `${gender}命`,
      gender,
      birthSolar: `${bp.year}-${pad(bp.month)}-${pad(bp.day)} ${pad(bp.hour)}:${pad(bp.minute)}`,
      lunar: almanac.lunar ? almanac.lunar.fullName : '',
      fourPillars: `${yearGz} ${monthGz} ${dayGz} ${hourGz}`,
      rizhu: `${dayGan}${STEM_EL[ganIdx(dayGan)]}`,
      rizhuElement: STEM_EL[ganIdx(dayGan)],
      shengxiao: SHENGXIAO[zhiIdx(yearBranch)],
      direction: yun.q.direction,
      qiyun: `出生后${yun.q.years}年${yun.q.months}个月${yun.q.days}天起运，${yun.startAge}岁交运（${yun.startYear}年）`,
      qiyunYears: yun.q.years,
      qiyunMonths: yun.q.months,
      qiyunDays: yun.q.days,
      startAge: yun.startAge,
      startYear: yun.startYear,
      jiaoyun: `${yun.startYear}年起交入第一步大运（${yun.q.direction}）`,
      currentDayunIndex,
      currentLiunianYear,
      currentLiuyueIndex,
      now: now.toISOString(),
      useTrueSolarTime: useTrueSolarTime && longitude != null,
      longitude,
    },
    pillars,
    dayun,
    hints,
  };
}

export default { castBazi };

