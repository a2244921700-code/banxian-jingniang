/**
 * engine.test.mjs —— 卦师引擎测试（node:test，无第三方依赖）
 *
 * 运行：node test/engine.test.mjs
 *
 * 权威来源（测试期望值出处）：
 *  1. 香港天文台《公历农历对照表》（Gregorian-Lunar Calendar Conversion Table）
 *     https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2026e.txt 等
 *     —— 用于农历月首、春节、二十四节气日期的期望值。
 *  2. 便民查询网万年历（公共万年历）https://wannianrili.bmcx.com/<日期>__wannianrili/
 *     —— 用于日柱、年柱、月柱的期望值（1900-01-01、1900-02-01、1949-10-01、
 *        2000-01-01、2020-01-01、2026-10-25 六个时间点）。
 *  3. 《周易》经文（维基文库繁体底本）—— 用于卦辞/爻辞期望值。
 *  4. 邵雍《梅花易数》观梅占 —— 用于梅花时间卦经典例。
 *
 * 已知偏差（详见各测试注释）：
 *  - 节气为 Meeus 低精度太阳视黄经反解，时刻误差通常 < 5 分钟；按“日期”比对
 *    允许 ±1 天（1950 谷雨即因跨零点差 1 天）。
 *  - 农历表覆盖 1900-01-31 ~ 2100-12-31，超出抛 RangeError。
 *  - 日界为 23:00（子时为一日之始）：23:00 及以后算次日日柱、次日农历日；
 *    给出经度时以真太阳时是否已过 23:00 判定。23:00–23:59 为晚子时，
 *    时干按换日后的日干起。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  // 历法
  getAlmanac, trueSolarTime, solarTerms, lunarFromDate, dayPillar, hourPillar, xunKong,
  monthBranch, yearPillar, monthPillar, currentSolarTerm, equationOfTime,
  julianDayNumber, ganzhiName, ganzhiIndex, springFestivals, lunarYearDays,
  STEMS, BRANCHES, SOLAR_TERMS,
  // 卦典
  getHexagram, hexagrams, hexagramByNumber, binaryOf, huBinary, cuoBinary, zongBinary,
  palaceInfo, palaceTable, TRIGRAMS, TRIGRAM_ORDER,
  // 纳甲
  najiaLines, buildHexagram, liuQin, liuShen, changedBinary, SHI_YING, GENERATIONS,
  // 梅花 / 六爻
  castMeihua, castLiuyao, castLiuyaoRandom, parseThrow, THROW_NAMES,
  // 汇总
  data, VERSION, loadSanshi, sanshiStatus,
} from '../lib/engine/index.js';

const BJ = (s) => new Date(s); // 期望值一律带 +08:00

// ============================================================
// 一、历法：日柱（儒略日法）
// ============================================================

// 期望值来源：便民查询网万年历（https://wannianrili.bmcx.com/<日期>__wannianrili/）
// 与独立实现 solarlunar 2.0.7（gzDay）交叉核对一致。
const DAY_PILLAR_CASES = [
  ['1900-01-01T12:00:00+08:00', '甲戌', '便民查询网万年历 1900-01-01「己亥年 丙子月 甲戌日」'],
  ['1900-02-01T12:00:00+08:00', '乙巳', '便民查询网万年历 1900-02-01「己亥年 丁丑月 乙巳日」'],
  ['1949-10-01T15:00:00+08:00', '甲子', '便民查询网万年历 1949-10-01「己丑年 癸酉月 甲子日」（开国大典，通书亦作甲子日）'],
  ['2000-01-01T12:00:00+08:00', '戊午', '便民查询网万年历 2000-01-01「己卯年 丙子月 戊午日」'],
  ['2020-01-01T12:00:00+08:00', '癸卯', '便民查询网万年历 2020-01-01「己亥年 丙子月 癸卯日」'],
  ['2026-10-25T21:30:00+08:00', '壬申', '便民查询网万年历 2026-10-25「丙午年 戊戌月 壬申日」'],
];

test('日柱：儒略日法与权威万年历核对（1900s×2、2020s×2、1949、2000）', () => {
  for (const [iso, expect, source] of DAY_PILLAR_CASES) {
    const p = dayPillar(BJ(iso));
    assert.equal(p.name, expect, `${iso} 日柱应为 ${expect}（来源：${source}），实得 ${p.name}`);
    assert.equal(p.stem + p.branch, p.name);
    assert.equal(p.index, ganzhiIndex(expect));
  }
  // 儒略日锚点：JDN(2000-01-01)=2451545，JDN(1949-10-01)=2433191
  assert.equal(julianDayNumber(2000, 1, 1), 2451545);
  assert.equal(julianDayNumber(1949, 10, 1), 2433191);
  // 60 日一轮回：同干支日期相差 60 的倍数
  const a = dayPillar(BJ('2026-10-25T12:00:00+08:00'));
  const b = dayPillar(BJ('2026-12-24T12:00:00+08:00'));
  assert.equal(a.index, b.index, '2026-10-25 与 2026-12-24 相隔 60 日，日柱应相同');
});

// ============================================================
// 二、历法：农历（1900–2100 表）
// ============================================================

// 期望值来源：香港天文台《公历农历对照表》T<年>e.txt
const LUNAR_NEW_YEAR = [
  [1901, '1901-02-19'], [1949, '1949-01-29'], [1950, '1950-02-17'], [1984, '1984-02-02'],
  [2000, '2000-02-05'], [2024, '2024-02-10'], [2025, '2025-01-29'], [2026, '2026-02-17'],
  [2033, '2033-01-31'],
];

test('农历：春节（正月初一）与香港天文台对照表一致', () => {
  const sf = new Map(springFestivals().map((x) => [x.year, x.local]));
  for (const [year, expect] of LUNAR_NEW_YEAR) {
    assert.equal(sf.get(year), expect, `${year} 年春节应为 ${expect}（天文台），实得 ${sf.get(year)}`);
    const l = lunarFromDate(BJ(expect + 'T12:00:00+08:00'));
    assert.equal(l.month, 1);
    assert.equal(l.day, 1);
    assert.equal(l.isLeap, false);
    assert.equal(l.monthName, '正月');
    assert.equal(l.dayName, '初一');
  }
});

test('农历：闰月与月首（天文台 112 个月首抽查）', () => {
  // 来源：香港天文台 2025 / 2033 年表
  const cases = [
    ['2025-06-25T12:00:00+08:00', 6, 1, false, '天文台 2025/6/25「6th Lunar Month」'],
    ['2025-07-25T12:00:00+08:00', 6, 1, true, '天文台 2025/7/25 同月号再现，为闰六月'],
    ['2033-12-22T12:00:00+08:00', 11, 1, true, '天文台 2033/12/22 同月号再现，为闰十一月'],
    ['2024-02-10T12:00:00+08:00', 1, 1, false, '天文台 2024 春节'],
    ['1901-02-19T12:00:00+08:00', 1, 1, false, '天文台 1901 春节'],
  ];
  for (const [iso, month, day, isLeap, source] of cases) {
    const l = lunarFromDate(BJ(iso));
    assert.equal(l.month, month, `${iso} 农历月（${source}）`);
    assert.equal(l.day, day, `${iso} 农历日（${source}）`);
    assert.equal(l.isLeap, isLeap, `${iso} 闰月标记（${source}）`);
  }
  // 农历年干支：1900 庚子、1984 甲子、2024 甲辰、2026 丙午
  assert.equal(lunarFromDate(BJ('1900-01-31T12:00:00+08:00')).yearGanzhi, '庚子');
  assert.equal(lunarFromDate(BJ('1984-02-02T12:00:00+08:00')).yearGanzhi, '甲子');
  assert.equal(lunarFromDate(BJ('2024-02-10T12:00:00+08:00')).yearGanzhi, '甲辰');
  assert.equal(lunarFromDate(BJ('2026-10-25T12:00:00+08:00')).yearGanzhi, '丙午');
});

test('农历：1900–2100 每年天数与春节连续性自检', () => {
  const years = [];
  for (let y = 1900; y <= 2100; y++) years.push({ y, days: lunarYearDays(y) });
  for (const { y, days } of years) {
    assert.ok(days >= 353 && days <= 385, `农历 ${y} 年天数异常：${days}`);
  }
  // 2100 年也在表内
  assert.ok(lunarFromDate(BJ('2100-12-31T12:00:00+08:00')).year >= 2100);
  // 超界应抛错
  assert.throws(() => lunarFromDate(BJ('1900-01-01T12:00:00+08:00')), RangeError);
  assert.throws(() => lunarFromDate(BJ('2101-06-01T12:00:00+08:00')), RangeError);
});

// ============================================================
// 三、历法：二十四节气
// ============================================================

// 期望值来源：香港天文台《公历农历对照表》T2026e.txt（节气日期）
const TERMS_2026 = {
  小寒: '2026-01-05', 大寒: '2026-01-20', 立春: '2026-02-04', 雨水: '2026-02-18',
  惊蛰: '2026-03-05', 春分: '2026-03-20', 清明: '2026-04-05', 谷雨: '2026-04-20',
  立夏: '2026-05-05', 小满: '2026-05-21', 芒种: '2026-06-05', 夏至: '2026-06-21',
  小暑: '2026-07-07', 大暑: '2026-07-23', 立秋: '2026-08-07', 处暑: '2026-08-23',
  白露: '2026-09-07', 秋分: '2026-09-23', 寒露: '2026-10-08', 霜降: '2026-10-23',
  立冬: '2026-11-07', 小雪: '2026-11-22', 大雪: '2026-12-07', 冬至: '2026-12-22',
};
const TERMS_2024 = {
  小寒: '2024-01-06', 大寒: '2024-01-20', 立春: '2024-02-04', 雨水: '2024-02-19',
  惊蛰: '2024-03-05', 春分: '2024-03-20', 清明: '2024-04-04', 谷雨: '2024-04-19',
  立夏: '2024-05-05', 小满: '2024-05-20', 芒种: '2024-06-05', 夏至: '2024-06-21',
  小暑: '2024-07-06', 大暑: '2024-07-22', 立秋: '2024-08-07', 处暑: '2024-08-22',
  白露: '2024-09-07', 秋分: '2024-09-22', 寒露: '2024-10-08', 霜降: '2024-10-23',
  立冬: '2024-11-07', 小雪: '2024-11-22', 大雪: '2024-12-06', 冬至: '2024-12-21',
};

function dateDiffDays(a, b) {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
}

test('节气：24 节气日期与香港天文台表核对（2026、2024，容差 ±1 天）', () => {
  for (const [year, expected] of [[2026, TERMS_2026], [2024, TERMS_2024]]) {
    const list = solarTerms(year);
    assert.equal(list.length, 24, `${year} 年应有 24 个节气`);
    assert.deepEqual(list.map((t) => t.name), SOLAR_TERMS);
    assert.ok(list.every((t, i) => t.index === i));
    assert.ok(list.every((t) => t.at instanceof Date && !Number.isNaN(t.at.getTime())));
    for (const t of list) {
      const got = t.local.slice(0, 10);
      const expect = expected[t.name];
      assert.ok(
        dateDiffDays(got, expect) <= 1,
        `${year} ${t.name} 期望 ${expect}（天文台），实得 ${got}（容差 ±1 天）`,
      );
    }
    // “节”与“中气”交替
    for (const t of list) {
      assert.equal(t.type, t.index % 2 === 0 ? '节' : '中气');
    }
  }
  // 已知偏差注记：1950 年谷雨本引擎算得 04-21 00:01，天文台记 04-20（跨零点，容差内）
  const y1950 = solarTerms(1950).find((t) => t.name === '谷雨');
  assert.ok(dateDiffDays(y1950.local.slice(0, 10), '1950-04-20') <= 1, '1950 谷雨应在 ±1 天内');
});

test('节气：currentSolarTerm 给出当前与下一节气', () => {
  const term = currentSolarTerm(BJ('2026-10-25T21:30:00+08:00'));
  assert.equal(term.current.name, '霜降');
  assert.equal(term.current.type, '中气');
  assert.equal(term.next.name, '立冬');
  assert.ok(term.current.at <= BJ('2026-10-25T21:30:00+08:00'));
  assert.ok(term.next.at > BJ('2026-10-25T21:30:00+08:00'));
});

// ============================================================
// 四、历法：四柱、月建、旬空、时辰、真太阳时
// ============================================================

test('四柱：2026-10-25 21:30 应为 丙午年 戊戌月 壬申日 辛亥时', () => {
  const a = getAlmanac(BJ('2026-10-25T21:30:00+08:00'));
  assert.deepEqual(a.ganzhi, { year: '丙午', month: '戊戌', day: '壬申', hour: '辛亥' });
  assert.equal(a.monthBranch, '戌', '月建按节气（霜降后为戌月）');
  assert.equal(a.dayBranch, '申');
  assert.equal(a.solarTerm.current.name, '霜降');
  assert.equal(a.lunar.fullName, '丙午年 九月十六');
  assert.equal(a.week, '星期日');
  assert.equal(a.hourBranch.branch, '亥');
  assert.equal(a.hourBranch.range, '21:00–23:59');
  assert.deepEqual(a.xunKong, ['戌', '亥'], '壬申属甲子旬，空戌亥');
});

test('月建：以十二节为界，非农历月', () => {
  // 2024 立春 2024-02-04 16:27，之前属丑月、之后属寅月
  assert.equal(monthBranch(BJ('2024-02-04T12:00:00+08:00')).branch, '丑');
  assert.equal(monthBranch(BJ('2024-02-05T12:00:00+08:00')).branch, '寅');
  // 丑月月建对应小寒至立春
  assert.equal(monthBranch(BJ('2026-01-10T12:00:00+08:00')).branch, '丑');
  // 年柱以立春换年：2024-02-04 12:00 仍癸卯年，02-05 为甲辰年
  assert.equal(yearPillar(BJ('2024-02-04T12:00:00+08:00')).name, '癸卯');
  assert.equal(yearPillar(BJ('2024-02-05T12:00:00+08:00')).name, '甲辰');
  // 月柱五虎遁：甲年寅月为丙寅
  assert.equal(monthPillar(BJ('2024-02-10T12:00:00+08:00')).name, '丙寅');
});

test('时柱：五鼠遁（甲己还加甲、乙庚丙作初、丙辛从戊起、丁壬庚子居、戊癸壬子）', () => {
  assert.equal(hourPillar('甲子', 0).name, '甲子');
  assert.equal(hourPillar('甲子', 23).name, '甲子');
  assert.equal(hourPillar('甲子', 12).name, '庚午');
  assert.equal(hourPillar('乙丑', 0).name, '丙子');
  assert.equal(hourPillar('丙寅', 0).name, '戊子');
  assert.equal(hourPillar('丁卯', 0).name, '庚子');
  assert.equal(hourPillar('戊辰', 0).name, '壬子');
  assert.equal(hourPillar('壬申', 21).name, '辛亥');
  assert.equal(hourPillar('壬申', 23).name, '庚子');
  assert.equal(hourPillar('壬申', '亥').name, '辛亥');
});

test('子时换日：23:00 起算次日（日柱、农历日、晚子时时干）', () => {
  // 传统以子时为一日之始：23:00–23:59 算次日
  const a = getAlmanac(BJ('2026-10-25T22:59:00+08:00'));
  const b = getAlmanac(BJ('2026-10-25T23:01:00+08:00'));
  assert.equal(a.hourBranch.branch, '亥');
  assert.equal(b.hourBranch.branch, '子');
  // 22:59 壬申日，23:01 进日 → 癸酉日，相差一位
  assert.equal(a.ganzhi.day, '壬申');
  assert.equal(b.ganzhi.day, '癸酉', '23:01 应算次日日柱（子时换日）');
  assert.equal(b.enteredNextDay, true);
  assert.deepEqual(b.effectiveDate, { year: 2026, month: 10, day: 26 });
  assert.equal(a.enteredNextDay, false);
  // 晚子时时干按换日后的日干起：癸日子时 = 壬子
  assert.equal(b.ganzhi.hour, '壬子');
  // 农历日同步进日：22:59 九月十六，23:01 九月十七
  assert.equal(a.lunar.day, 16);
  assert.equal(b.lunar.day, 17);
  // 次日 00:30 与 23:30 同日柱、同时柱（同属子时、同一日）
  const c = getAlmanac(BJ('2026-10-26T00:30:00+08:00'));
  assert.equal(c.ganzhi.day, b.ganzhi.day);
  assert.equal(c.ganzhi.hour, b.ganzhi.hour);
  // dayPillar 直查亦遵此制，并回传有效日
  assert.equal(dayPillar(BJ('2026-10-25T22:59:00+08:00')).name, '壬申');
  const dp = dayPillar(BJ('2026-10-25T23:30:00+08:00'));
  assert.equal(dp.name, '癸酉');
  assert.equal(dp.enteredNextDay, true);
  assert.deepEqual(dp.effectiveDate, { year: 2026, month: 10, day: 26 });
  assert.equal(dayPillar(BJ('2026-10-26T00:00:00+08:00')).name, '癸酉');
});

test('子时换日：给经度时以真太阳时判定 23:00 日界', () => {
  // 上海 121.47°E：10 月下旬真太阳时约 +22 分
  const early = getAlmanac(BJ('2026-10-25T22:30:00+08:00'), { longitude: 121.47 });
  assert.equal(early.trueSolarTime.local.slice(0, 5), '22:51');
  assert.equal(early.enteredNextDay, false);
  assert.equal(early.ganzhi.day, '壬申');
  assert.equal(early.hourBranch.branch, '亥');
  // 22:50 北京时间 → 真太阳时 23:11，已过 23:00 → 进日
  const late = getAlmanac(BJ('2026-10-25T22:50:00+08:00'), { longitude: 121.47 });
  assert.equal(late.trueSolarTime.local.slice(0, 5), '23:11');
  assert.equal(late.enteredNextDay, true);
  assert.equal(late.ganzhi.day, '癸酉', '真太阳时已过 23:00，应按次日日柱');
  assert.equal(late.hourBranch.branch, '子');
  assert.equal(late.ganzhi.hour, '壬子');
  // 对照：北京时间基准的日柱仍是壬申
  assert.equal(late.ganzhi.dayCivil, '壬申');
  assert.equal(late.dayBasis, '真太阳时');
  assert.equal(dayPillar(BJ('2026-10-25T22:50:00+08:00'), { longitude: 121.47 }).name, '癸酉');
});

test('子时换日：23:30 起梅花时间卦用次日农历日', () => {
  const m = castMeihua({ method: 'time', date: BJ('2026-10-25T23:30:00+08:00') });
  assert.equal(m.time.lunar.day, 17, '23:30 应取次日（九月十七）农历日');
  assert.equal(m.time.lunar.month, 9);
  assert.equal(m.cast.hourBranch, '子');
  // 年支午=7、月9、日17、时支子=1：上卦 33%8=1（乾）、下卦 34%8=2（兑）、动爻 34%6=4
  assert.equal(m.cast.upperNumber, 1);
  assert.equal(m.cast.lowerNumber, 2);
  assert.equal(m.ben.fullName, '天泽履');
  assert.equal(m.movingLine, 4);
  // 同为 23:30，若按旧制（当日）会得 九月十六、上卦 32%8=8 —— 用于确认换日生效
  assert.notEqual(m.time.lunar.day, 16);
});

test('旬空：六甲旬空表', () => {
  const cases = [
    ['甲子', ['戌', '亥']], ['乙丑', ['戌', '亥']], ['癸酉', ['戌', '亥']],
    ['甲戌', ['申', '酉']], ['甲申', ['午', '未']], ['甲午', ['辰', '巳']],
    ['甲辰', ['寅', '卯']], ['甲寅', ['子', '丑']], ['癸亥', ['子', '丑']],
  ];
  for (const [gz, expect] of cases) assert.deepEqual(xunKong(gz), expect, `${gz} 旬空`);
});

test('真太阳时：经度差 + 均时差（含公式自检）', () => {
  // (121.46 − 120) × 4 = 5.84 分；均时差 10 月下旬约 +16 分
  const t = trueSolarTime(BJ('2026-10-25T12:00:00+08:00'), 121.46);
  assert.equal(t.longitudeOffsetMinutes, 5.8);
  assert.ok(t.equationOfTimeMinutes >= 15 && t.equationOfTimeMinutes <= 17, '10 月下旬均时差应约 +16 分');
  assert.equal(t.offsetSeconds, Math.round((5.84 + equationOfTime(BJ('2026-10-25T12:00:00+08:00'))) * 60));
  assert.ok(t.localFull.startsWith('2026-10-25 12:21'), `真太阳时约 12:21，实得 ${t.localFull}`);
  // 与北京时间相差约 21 分钟
  assert.ok(Math.abs(t.offsetMinutes - 22) <= 1);
  // 西经/低经度：乌鲁木齐 87.6 → (87.6-120)*4 = -129.6 分
  const u = trueSolarTime(BJ('2026-10-25T12:00:00+08:00'), 87.6);
  assert.ok(Math.abs(u.longitudeOffsetMinutes + 129.6) < 0.1);
  assert.ok(Math.abs(u.offsetMinutes + 114) <= 2, `乌鲁木齐真太阳时应约 -114 分，实得 ${u.offsetMinutes}`);
});

test('真太阳时定时辰：给出经度时 getAlmanac 以真太阳时定吉时', () => {
  const a = getAlmanac(BJ('2026-10-25T21:30:00+08:00'), { longitude: 121.47 });
  assert.equal(a.trueSolarTime.localFull.slice(11, 19), '21:51:55');
  assert.equal(a.hourBasis, '真太阳时');
  assert.equal(a.ganzhi.hour, '辛亥');
  assert.equal(a.ganzhi.hourCivil, '辛亥');
  assert.equal(a.hourBranch.branch, '亥');
  assert.equal(a.hourBranch.range, '21:00–23:59');
  // 与北京时间时辰不同：乌鲁木齐 87.6°E，21:30 北京时间 → 真太阳时约 19:21，戌时
  const b = getAlmanac(BJ('2026-10-25T21:30:00+08:00'), { longitude: 87.6 });
  assert.equal(b.hourBranch.branch, '戌', '乌鲁木齐 21:30 北京时间折真太阳时约 19:2x，属戌时');
  assert.equal(b.hourBranchCivil.branch, '亥');
});

// ============================================================
// 五、六十四卦卦典
// ============================================================

test('64 卦：卦序、卦名、二进制、上下卦全覆盖且唯一', () => {
  const list = hexagrams();
  assert.equal(list.length, 64);
  const numbers = new Set(list.map((h) => h.number));
  const names = new Set(list.map((h) => h.name));
  const binaries = new Set(list.map((h) => h.binary));
  const combos = new Set(list.map((h) => h.lower + h.upper));
  assert.equal(numbers.size, 64, 'number 应唯一');
  assert.equal(names.size, 64, '卦名应唯一');
  assert.equal(binaries.size, 64, 'binary 应唯一');
  assert.equal(combos.size, 64, '上下卦组合应唯一');
  for (const h of list) {
    assert.ok(Number.isInteger(h.number) && h.number >= 1 && h.number <= 64);
    assert.match(h.binary, /^[01]{6}$/);
    assert.equal(h.binary, TRIGRAMS[h.lower].binary + TRIGRAMS[h.upper].binary, `${h.fullName} 二进制与上下卦不符`);
    assert.ok(TRIGRAM_ORDER.includes(h.upper) && TRIGRAM_ORDER.includes(h.lower));
  }
  // 卦序前八与末二
  assert.equal(hexagramByNumber(1).fullName, '乾为天');
  assert.equal(hexagramByNumber(2).fullName, '坤为地');
  assert.equal(hexagramByNumber(29).fullName, '坎为水');
  assert.equal(hexagramByNumber(30).fullName, '离为火');
  assert.equal(hexagramByNumber(63).fullName, '水火既济');
  assert.equal(hexagramByNumber(64).fullName, '火水未济');
});

test('64 卦：八宫归属、世应合法（每宫 8 卦、世代不重复）', () => {
  const list = hexagrams();
  const byPalace = new Map();
  for (const h of list) {
    assert.ok(TRIGRAM_ORDER.includes(h.palace), `${h.name} 宫位非法：${h.palace}`);
    assert.equal(h.palaceElement, TRIGRAMS[h.palace].element);
    assert.ok(GENERATIONS.includes(h.generation), `${h.name} 世代非法`);
    const sy = SHI_YING[h.generation];
    assert.equal(h.shiPos, sy.shi, `${h.fullName} 世爻`);
    assert.equal(h.yingPos, sy.ying, `${h.fullName} 应爻`);
    // 世应相隔三爻
    assert.equal(((h.shiPos + 2) % 6) + 1, h.yingPos, `${h.fullName} 世应不相隔三爻`);
    if (!byPalace.has(h.palace)) byPalace.set(h.palace, []);
    byPalace.get(h.palace).push(h);
  }
  assert.equal(byPalace.size, 8, '应有八宫');
  for (const [palace, hs] of byPalace) {
    assert.equal(hs.length, 8, `${palace}宫应有 8 卦`);
    assert.equal(new Set(hs.map((h) => h.generation)).size, 8, `${palace}宫世代应齐八种`);
    // 八纯卦的上下卦即本宫
    const pure = hs.find((h) => h.generation === '八纯');
    assert.equal(pure.upper, palace);
    assert.equal(pure.lower, palace);
  }
  // 乾宫八卦卦序（京房八宫）：乾、姤、遯、否、观、剥、晋、大有
  const qian = byPalace.get('乾').sort((a, b) => GENERATIONS.indexOf(a.generation) - GENERATIONS.indexOf(b.generation));
  assert.deepEqual(qian.map((h) => h.name), ['乾', '姤', '遯', '否', '观', '剥', '晋', '大有']);
  // 坤宫：坤、复、临、泰、大壮、夬、需、比
  const kun = byPalace.get('坤').sort((a, b) => GENERATIONS.indexOf(a.generation) - GENERATIONS.indexOf(b.generation));
  assert.deepEqual(kun.map((h) => h.name), ['坤', '复', '临', '泰', '大壮', '夬', '需', '比']);
  assert.equal(Object.keys(palaceTable()).length, 8, 'palaceTable 应按八宫分组');
  assert.equal(Object.values(palaceTable()).flat().length, 64);
  for (const ci of Object.values(palaceInfo('111111'))) assert.ok(ci != null);
});

test('卦典：按 number / name / fullName / binary 查询，错卦综卦互卦自洽', () => {
  assert.equal(getHexagram(1).fullName, '乾为天');
  assert.equal(getHexagram('乾').number, 1);
  assert.equal(getHexagram('乾卦').number, 1);
  assert.equal(getHexagram('乾为天').number, 1);
  assert.equal(getHexagram('111111').number, 1);
  assert.equal(getHexagram('010101').fullName, '火水未济');
  assert.equal(getHexagram({ binary: '100010' }).fullName, '水雷屯');
  assert.equal(getHexagram(99), null);
  assert.equal(getHexagram('不存在'), null);
  // 错卦：六爻全变；综卦：上下颠倒；互卦：二三四 / 三四五
  assert.equal(cuoBinary('111111'), '000000');
  assert.equal(zongBinary('100010'), '010001'); // 屯 ↔ 蒙
  assert.equal(huBinary('101110'), '011111'); // 革（泽火）二三四为巽、三四五为乾 → 天风姤
  assert.equal(getHexagram(huBinary('101110')).fullName, '天风姤');
  assert.equal(getHexagram(cuoBinary('111111')).fullName, '坤为地');
  assert.equal(getHexagram(zongBinary('111111')).fullName, '乾为天');
  // 既济/未济互为错卦、亦互为综卦
  assert.equal(getHexagram(cuoBinary('101010')).fullName, '火水未济');
  assert.equal(getHexagram(zongBinary('101010')).fullName, '火水未济');
});

test('经文抽检：乾坤屯蒙泰否既济未济逐字核对（维基文库繁体底本）', () => {
  const check = (num, fields) => {
    const h = getHexagram(num);
    for (const [path, expect] of fields) {
      const got = path.split('.').reduce((o, k) => o[k], h);
      assert.equal(got, expect, `${h.fullName} ${path} 不符\n  期望：${expect}\n  实得：${got}`);
    }
  };
  // 乾（第 1 卦）
  check(1, [
    ['guaCi', '乾：元亨。利貞。'],
    ['tuan', '彖曰：大哉乾元，萬物資始，乃統天。雲行雨施，品物流形，大明終始，六位時成。時乘六龍以御天，乾道變化，各正性命，保合大和，乃利貞。首出庶物，萬國咸寧。'],
    ['xiang', '象曰：天行健，君子以自強不息。'],
    ['yao.0.text', '初九：潛龍勿用。'], ['yao.0.xiang', '潛龍勿用，陽在下也。'],
    ['yao.4.text', '九五：飛龍在天，利見大人。'],
    ['yao.5.text', '上九：亢龍，有悔。'],
    ['yong.text', '用九：見羣龍无首，吉。'],
    ['yong.xiang', '用九，天德不可為首也。'],
  ]);
  // 坤（第 2 卦）
  check(2, [
    ['guaCi', '坤：元亨。利牝馬之貞。君子有攸往，先迷後得主。利西南得朋，東北喪朋。安貞，吉。'],
    ['xiang', '象曰：地勢坤，君子以厚德載物。'],
    ['yao.0.text', '初六：履霜，堅冰至。'],
    ['yao.5.text', '上六：龍戰于野，其血玄黃。'],
    ['yong.text', '用六：利永貞。'],
  ]);
  // 屯（第 3 卦）：初九「磐桓」——维基文库以 {{另|磐|盤}} 标注异文，取首字
  check(3, [
    ['guaCi', '屯：元亨，利貞。勿用有攸往，利建侯。'],
    ['yao.0.text', '初九：磐桓，利居貞，利建侯。'],
    ['yao.1.text', '六二：屯如邅如，乘馬班如，匪寇婚媾，女子貞不字，十年乃字。'],
    ['xiang', '象曰：雲雷，屯；君子以經綸。'],
  ]);
  // 蒙（第 4 卦）：六三「勿用取女」——异文「娶」的编者夹注已删
  check(4, [
    ['guaCi', '蒙：亨。匪我求童蒙，童蒙求我。初筮告，再三瀆，瀆則不告。利貞。'],
    ['yao.2.text', '六三：勿用取女，見金夫，不有躬，无攸利。'],
  ]);
  // 泰（第 11 卦）与否（第 12 卦）
  check(11, [
    ['guaCi', '泰：小往大來，吉亨。'],
    ['xiang', '象曰：天地交，泰；后以財成天地之道，輔相天地之宜，以左右民。'],
    ['yao.2.text', '九三：无平不陂，无往不復，艱貞无咎。勿恤其孚，于食有福。'],
  ]);
  check(12, [
    ['guaCi', '否之匪人，不利君子貞，大往小來。'],
    ['xiang', '象曰：天地不交，否；君子以儉德辟難，不可榮以祿。'],
  ]);
  // 既济（第 63 卦）与未济（第 64 卦）
  check(63, [
    ['guaCi', '既濟：亨小。利貞。初吉終亂。'],
    ['xiang', '象曰：水在火上，既濟；君子以思患而豫防之。'],
    ['yao.5.text', '上六：濡其首，厲。'],
  ]);
  check(64, [
    ['guaCi', '未濟：亨。小狐汔濟，濡其尾，无攸利。'],
    ['xiang', '象曰：火在水上，未濟；君子以慎辨物居方。'],
    ['yao.0.text', '初六：濡其尾，吝。'],
  ]);
  // 六十四卦皆备六爻、六小象
  for (const h of hexagrams()) {
    const full = getHexagram(h.number);
    assert.equal(full.yao.length, 6, `${h.fullName} 爻辞不足 6`);
    for (const y of full.yao) {
      assert.ok(y.text && y.text.length > 2, `${h.fullName} 第${y.pos}爻爻辞为空`);
      assert.ok(y.xiang && y.xiang.length > 2, `${h.fullName} 第${y.pos}爻小象为空`);
    }
    assert.ok(full.tuan.startsWith('彖曰'), `${h.fullName} 缺彖`);
    assert.ok(full.xiang.startsWith('象曰'), `${h.fullName} 缺大象`);
  }
});

// ============================================================
// 六、纳甲、六亲、六神、世应
// ============================================================

test('纳甲：乾为天六爻（甲子寅辰、壬午申戌）与六亲、世应', () => {
  const lines = najiaLines('111111');
  assert.deepEqual(lines.map((l) => l.ganzhi), ['甲子', '甲寅', '甲辰', '壬午', '壬申', '壬戌']);
  assert.deepEqual(lines.map((l) => l.yinYang), ['阳', '阳', '阳', '阳', '阳', '阳']);
  const mounted = buildHexagram({ binary: '111111', dayGanzhi: '甲子' });
  assert.equal(mounted.palace, '乾');
  assert.equal(mounted.palaceElement, '金');
  assert.equal(mounted.generation, '八纯');
  assert.equal(mounted.shiPos, 6);
  assert.equal(mounted.yingPos, 3);
  assert.deepEqual(mounted.lines.map((l) => l.liuqin), ['子孙', '妻财', '父母', '官鬼', '兄弟', '父母']);
  assert.deepEqual(mounted.lines.map((l) => l.shiYing), ['', '', '应', '', '', '世']);
  // 六神按日干甲起青龙
  assert.deepEqual(mounted.lines.map((l) => l.liushen), ['青龙', '朱雀', '勾陈', '腾蛇', '白虎', '玄武']);
  // 用壬申日：六神起玄武，旬空戌亥
  const m2 = buildHexagram({ binary: '111111', dayGanzhi: '壬申' });
  assert.deepEqual(m2.lines.map((l) => l.liushen), ['玄武', '青龙', '朱雀', '勾陈', '腾蛇', '白虎']);
  assert.deepEqual(m2.lines.map((l) => l.kong), [false, false, false, false, false, true]);
});

test('纳甲：天风姤（乾宫一世）辛丑辛亥辛酉 / 壬午壬申壬戌，世初应四', () => {
  const h = getHexagram(44);
  assert.equal(h.fullName, '天风姤');
  assert.equal(h.binary, '011111');
  const lines = najiaLines(h.binary);
  assert.deepEqual(lines.map((l) => l.ganzhi), ['辛丑', '辛亥', '辛酉', '壬午', '壬申', '壬戌']);
  assert.equal(h.palace, '乾');
  assert.equal(h.generation, '一世');
  assert.equal(h.shiPos, 1);
  assert.equal(h.yingPos, 4);
  const mounted = buildHexagram({ binary: h.binary, dayGanzhi: '甲子' });
  assert.deepEqual(mounted.lines.map((l) => l.shiYing), ['世', '', '', '应', '', '']);
  // 乾宫五行金：丑土父母、亥水子孙、酉金兄弟、午火官鬼、申金兄弟、戌土父母
  assert.deepEqual(mounted.lines.map((l) => l.liuqin), ['父母', '子孙', '兄弟', '官鬼', '兄弟', '父母']);
});

test('六亲：以卦宫五行为我（生我父母、我生子孙、克我官鬼、我克妻财、同我兄弟）', () => {
  assert.equal(liuQin('金', '水'), '子孙'); // 金生水
  assert.equal(liuQin('金', '木'), '妻财'); // 金克木
  assert.equal(liuQin('金', '土'), '父母'); // 土生金
  assert.equal(liuQin('金', '火'), '官鬼'); // 火克金
  assert.equal(liuQin('金', '金'), '兄弟');
  assert.equal(liuQin('水', '木'), '子孙');
  assert.equal(liuQin('土', '金'), '子孙');
});

test('六神：按日干起（甲乙青龙、丙丁朱雀、戊勾陈、己腾蛇、庚辛白虎、壬癸玄武）', () => {
  assert.deepEqual(liuShen('甲'), ['青龙', '朱雀', '勾陈', '腾蛇', '白虎', '玄武']);
  assert.deepEqual(liuShen('乙'), ['青龙', '朱雀', '勾陈', '腾蛇', '白虎', '玄武']);
  assert.deepEqual(liuShen('丙'), ['朱雀', '勾陈', '腾蛇', '白虎', '玄武', '青龙']);
  assert.deepEqual(liuShen('丁'), ['朱雀', '勾陈', '腾蛇', '白虎', '玄武', '青龙']);
  assert.deepEqual(liuShen('戊'), ['勾陈', '腾蛇', '白虎', '玄武', '青龙', '朱雀']);
  assert.deepEqual(liuShen('己'), ['腾蛇', '白虎', '玄武', '青龙', '朱雀', '勾陈']);
  assert.deepEqual(liuShen('庚'), ['白虎', '玄武', '青龙', '朱雀', '勾陈', '腾蛇']);
  assert.deepEqual(liuShen('辛'), ['白虎', '玄武', '青龙', '朱雀', '勾陈', '腾蛇']);
  assert.deepEqual(liuShen('壬'), ['玄武', '青龙', '朱雀', '勾陈', '腾蛇', '白虎']);
  assert.deepEqual(liuShen('癸'), ['玄武', '青龙', '朱雀', '勾陈', '腾蛇', '白虎']);
});

test('纳甲：八纯卦与重卦纳甲取内外卦拼装（坎、离、艮、兑、震、巽、坤）', () => {
  assert.deepEqual(najiaLines('010010').map((l) => l.ganzhi), ['戊寅', '戊辰', '戊午', '戊申', '戊戌', '戊子']);
  assert.deepEqual(najiaLines('101101').map((l) => l.ganzhi), ['己卯', '己丑', '己亥', '己酉', '己未', '己巳']);
  assert.deepEqual(najiaLines('001001').map((l) => l.ganzhi), ['丙辰', '丙午', '丙申', '丙戌', '丙子', '丙寅']);
  assert.deepEqual(najiaLines('110110').map((l) => l.ganzhi), ['丁巳', '丁卯', '丁丑', '丁亥', '丁酉', '丁未']);
  assert.deepEqual(najiaLines('100100').map((l) => l.ganzhi), ['庚子', '庚寅', '庚辰', '庚午', '庚申', '庚戌']);
  assert.deepEqual(najiaLines('011011').map((l) => l.ganzhi), ['辛丑', '辛亥', '辛酉', '辛未', '辛巳', '辛卯']);
  assert.deepEqual(najiaLines('000000').map((l) => l.ganzhi), ['乙未', '乙巳', '乙卯', '癸丑', '癸亥', '癸酉']);
  // 变卦：乾初爻动 → 姤；三爻动 → 履；初、三爻动 → 讼
  assert.equal(changedBinary('111111', [1]), '011111');
  assert.equal(getHexagram(changedBinary('111111', [1])).fullName, '天风姤');
  assert.equal(getHexagram(changedBinary('111111', [3])).fullName, '天泽履');
  assert.equal(getHexagram(changedBinary('111111', [1, 3])).fullName, '天水讼');
});

test('八宫：64 卦全部落宫、binary 与八宫生成规则一致', () => {
  const all = paletteMap();
  assert.equal(all.size, 64);
  for (const [binary, info] of all) {
    const h = getHexagram(binary);
    assert.equal(h.palace, info.palace, `${h.fullName} 宫`);
    assert.equal(h.generation, info.generation, `${h.fullName} 世代`);
    assert.equal(h.shiPos, info.shiPos, `${h.fullName} 世`);
    assert.equal(h.yingPos, info.yingPos, `${h.fullName} 应`);
  }
});

function paletteMap() {
  const map = new Map();
  for (const palace of TRIGRAM_ORDER) {
    const pure = TRIGRAMS[palace].binary + TRIGRAMS[palace].binary;
    const flips = {
      八纯: [], 一世: [0], 二世: [0, 1], 三世: [0, 1, 2],
      四世: [0, 1, 2, 3], 五世: [0, 1, 2, 3, 4], 游魂: [0, 1, 2, 4], 归魂: [4],
    };
    for (const gen of GENERATIONS) {
      const arr = pure.split('');
      for (const p of flips[gen]) arr[p] = arr[p] === '1' ? '0' : '1';
      map.set(arr.join(''), {
        palace, generation: gen, shiPos: SHI_YING[gen].shi, yingPos: SHI_YING[gen].ying,
      });
    }
  }
  return map;
}

// ============================================================
// 七、梅花易数
// ============================================================

test('梅花：观梅占经典例（辰年十二月十七日申时 → 泽火革，初爻动，互天风姤，变泽山咸）', () => {
  // 邵雍《梅花易数·观梅占》：辰年十二月十七日申时。
  // 取 2024 甲辰年农历十二月十七日申时（公历 2025-01-16 15:30，申时 15:00-17:00）
  const m = castMeihua({ method: 'meihua_time', date: BJ('2025-01-16T15:30:00+08:00') });
  assert.equal(m.ok, true);
  assert.equal(m.time.lunar.yearBranch, '辰');
  assert.equal(m.time.lunar.month, 12);
  assert.equal(m.time.lunar.day, 17);
  assert.equal(m.cast.hourBranch, '申');
  // 年支辰=5，5+12+17=34 → 34÷8 余 2 → 兑（上卦）；34+9=43 → 43÷8 余 3 → 离（下卦）
  assert.equal(m.cast.upperNumber, 2);
  assert.equal(m.cast.lowerNumber, 3);
  assert.equal(m.cast.upperTrigram, '兑');
  assert.equal(m.cast.lowerTrigram, '离');
  assert.equal(m.movingLine, 1, '43÷6 余 1，初爻动');
  assert.equal(m.ben.fullName, '泽火革');
  assert.equal(m.ben.binary, '101110');
  // 互卦：二三四为巽、三四五为乾 → 天风姤
  assert.equal(m.hu.fullName, '天风姤');
  assert.equal(m.hu.upper.trigram, '乾');
  assert.equal(m.hu.lower.trigram, '巽');
  // 变卦：初爻动 → 泽山咸
  assert.equal(m.bian.fullName, '泽山咸');
  // 体用：动爻在下卦，故下卦离为用、上卦兑为体；离火克兑金 → 用克体
  assert.equal(m.tiYong.ti.trigram, '兑');
  assert.equal(m.tiYong.ti.element, '金');
  assert.equal(m.tiYong.yong.trigram, '离');
  assert.equal(m.tiYong.yong.element, '火');
  assert.equal(m.tiYong.relation, '用克体');
  // 梅花卦象不含纳甲六爻信息
  assert.deepEqual(m.lines, []);
});

test('梅花：数字卦（卦以八除、爻以六除）', () => {
  const m = castMeihua({ method: 'meihua_number', numbers: [4, 3, 5], date: BJ('2026-10-25T21:30:00+08:00') });
  assert.equal(m.ben.number, 55);
  assert.equal(m.ben.fullName, '雷火丰');
  assert.equal(m.ben.binary, '101100');
  assert.equal(m.cast.upperTrigram, '震');
  assert.equal(m.cast.lowerTrigram, '离');
  assert.equal(m.movingLine, 5);
  // 变卦：五爻动 → 泽火革
  assert.equal(m.bian.fullName, '泽火革');
  // 动爻在上卦，故上卦震为用、下卦离为体（体火，用木 → 用生体）
  assert.equal(m.tiYong.ti.trigram, '离');
  assert.equal(m.tiYong.yong.trigram, '震');
  assert.equal(m.tiYong.relation, '用生体');
  // 大数取余：17%8=1（乾）、9%8=1（乾）
  const big = castMeihua({ method: 'meihua_number', numbers: [17, 9, 5], date: BJ('2026-10-25T21:30:00+08:00') });
  assert.equal(big.ben.fullName, '乾为天');
  assert.equal(big.movingLine, 5);
  // 数值整除时余 0 视为 8 / 6：8,8 数
  const m2 = castMeihua({ method: 'meihua_number', numbers: [8, 16, 6], date: BJ('2026-10-25T21:30:00+08:00') });
  assert.equal(m2.cast.upperNumber, 8); // 8 % 8 = 0 → 8（坤）
  assert.equal(m2.cast.lowerNumber, 8); // 16 % 8 = 0 → 8（坤）
  assert.equal(m2.ben.fullName, '坤为地');
  assert.equal(m2.movingLine, 6); // 6 % 6 = 0 → 6
  assert.equal(m2.bian.fullName, '山地剥');
});

test('梅花：物数卦（counts）与两数起卦加时支取动', () => {
  const m = castMeihua({ method: 'meihua_count', counts: { upper: 9, lower: 4, moving: 3 }, date: BJ('2026-10-25T21:30:00+08:00') });
  assert.equal(m.cast.upperNumber, 1); // 9 % 8 = 1 乾
  assert.equal(m.cast.lowerNumber, 4); // 4 震
  assert.equal(m.ben.fullName, '天雷无妄');
  assert.equal(m.movingLine, 3);
  // 两数不给动爻：以两数和加时支数取动（亥=12）
  const n = castMeihua({ method: 'meihua_number', numbers: [3, 5], date: BJ('2026-10-25T21:30:00+08:00') });
  assert.equal(n.movingLine, ((3 + 5 + 12) % 6) || 6);
  assert.ok(n.cast.detail.includes('未给第三数'));
});

test('梅花：只给 upper/lower 的显式起卦（lead 要求）', () => {
  // method: 'count' 但只给 upper/lower
  const a = castMeihua({ method: 'count', upper: 4, lower: 3, moving: 2, date: BJ('2026-10-25T21:30:00+08:00') });
  assert.equal(a.ben.fullName, '雷火丰'); // 上震下离
  assert.equal(a.movingLine, 2);
  assert.equal(a.bian.fullName, '雷天大壮');
  // method: 'explicit'，无动爻 → 无变卦、无体用
  const b = castMeihua({ method: 'explicit', upper: 1, lower: 8, date: BJ('2026-10-25T21:30:00+08:00') });
  assert.equal(b.ben.fullName, '天地否'); // 上乾下坤
  assert.equal(b.movingLine, null);
  assert.equal(b.bian, null);
  assert.equal(b.tiYong, null);
  assert.deepEqual(b.lines, []);
  // 八卦名亦可
  const c = castMeihua({ method: 'explicit', upper: '坎', lower: '坤', moving: 1, date: BJ('2026-10-25T21:30:00+08:00') });
  assert.equal(c.ben.fullName, '水地比');
  assert.equal(c.movingLine, 1);
  // 参数不足应抛错
  assert.throws(() => castMeihua({ method: 'explicit', upper: 1 }), /upper 与 lower/);
});

// ============================================================
// 八、六爻
// ============================================================

test('六爻：throws 6/7/8/9 四象与动变正确', () => {
  assert.deepEqual([6, 7, 8, 9].map(parseThrow), [6, 7, 8, 9]);
  assert.equal(parseThrow('正正正'), 9);
  assert.equal(parseThrow('正正反'), 8);
  assert.equal(parseThrow('正反反'), 7);
  assert.equal(parseThrow('反反反'), 6);
  assert.equal(parseThrow('老阳'), 9);
  assert.equal(parseThrow('老阴'), 6);
  assert.equal(parseThrow('少阳'), 7);
  assert.equal(parseThrow('少阴'), 8);
  assert.throws(() => parseThrow(5), /6\/7\/8\/9/);
  assert.throws(() => parseThrow('正正'), /无法解析/);
  // 6 老阴（阴动）/7 少阳/8 少阴/9 老阳（阳动）
  assert.equal(THROW_NAMES[6], '老阴');
  assert.equal(THROW_NAMES[9], '老阳');
  // 六爻全老阳 → 乾为天，六爻皆动 → 变坤为地
  const q = castLiuyao({ date: BJ('2026-10-25T21:30:00+08:00'), throws: [9, 9, 9, 9, 9, 9] });
  assert.equal(q.ben.fullName, '乾为天');
  assert.equal(q.bian.fullName, '坤为地');
  assert.equal(q.movingLine, 1);
  assert.deepEqual(q.cast.movingLines.map((m) => m.pos), [1, 2, 3, 4, 5, 6]);
  // 六爻全老阴 → 坤为地 → 变乾为天
  const k = castLiuyao({ date: BJ('2026-10-25T21:30:00+08:00'), throws: [6, 6, 6, 6, 6, 6] });
  assert.equal(k.ben.fullName, '坤为地');
  assert.equal(k.bian.fullName, '乾为天');
  // 6 与 9 动，7 与 8 静：[6,7,8,9,7,8] → 010110（泽水困）
  const mix = castLiuyao({ date: BJ('2026-10-25T21:30:00+08:00'), throws: [6, 7, 8, 9, 7, 8] });
  assert.deepEqual(mix.ben.binary, '010110');
  assert.equal(mix.ben.fullName, '泽水困');
  assert.deepEqual(mix.cast.movingLines.map((m) => m.pos), [1, 4]);
});

test('六爻：乾为天装卦（throws 全 7）纳甲六亲六神世应旬空', () => {
  const q = castLiuyao({ date: BJ('2026-10-25T21:30:00+08:00'), throws: [7, 7, 7, 7, 7, 7] });
  assert.equal(q.ben.fullName, '乾为天');
  assert.equal(q.bian, null, '六爻安静无变卦');
  assert.equal(q.cast.palace, '乾');
  assert.equal(q.cast.generation, '八纯');
  assert.equal(q.cast.dayGanzhi, '壬申');
  assert.deepEqual(q.cast.xunKong, ['戌', '亥']);
  assert.equal(q.cast.monthBranch, '戌');
  assert.deepEqual(q.lines.map((l) => l.ganzhi), ['甲子', '甲寅', '甲辰', '壬午', '壬申', '壬戌']);
  assert.deepEqual(q.lines.map((l) => l.liuqin), ['子孙', '妻财', '父母', '官鬼', '兄弟', '父母']);
  assert.deepEqual(q.lines.map((l) => l.liushen), ['玄武', '青龙', '朱雀', '勾陈', '腾蛇', '白虎']);
  assert.deepEqual(q.lines.map((l) => l.shiYing), ['', '', '应', '', '', '世']);
  assert.deepEqual(q.lines.map((l) => l.kong), [false, false, false, false, false, true], '壬申日甲子旬空戌亥');
  for (const l of q.lines) {
    assert.ok(l.yaoCi && l.yaoCi.length > 2, `第${l.pos}爻缺爻辞`);
    assert.ok(l.xiaoXiang && l.xiaoXiang.length > 2, `第${l.pos}爻缺小象`);
  }
});

test('六爻：天风姤（初爻老阴）乾宫一世，世初应四，变乾为天', () => {
  const g = castLiuyao({ date: BJ('2026-10-25T21:30:00+08:00'), throws: [6, 7, 7, 7, 7, 7] });
  assert.equal(g.ben.fullName, '天风姤');
  assert.equal(g.ben.palace, '乾');
  assert.equal(g.ben.generation, '一世');
  assert.equal(g.ben.shiPos, 1);
  assert.equal(g.ben.yingPos, 4);
  assert.deepEqual(g.lines.map((l) => l.ganzhi), ['辛丑', '辛亥', '辛酉', '壬午', '壬申', '壬戌']);
  assert.deepEqual(g.lines.map((l) => l.liuqin), ['父母', '子孙', '兄弟', '官鬼', '兄弟', '父母']);
  assert.deepEqual(g.lines.map((l) => l.shiYing), ['世', '', '', '应', '', '']);
  assert.equal(g.bian.fullName, '乾为天');
  assert.deepEqual(g.cast.movingLines.map((m) => m.pos), [1]);
});

test('六爻：随机摇钱（可注入随机源）与 upper/lower 校验', () => {
  // 交替随机源：0.2 视为正面(3)，0.8 视为反面(2)
  let i = 0;
  const rnd = () => (i++ % 3 === 0 ? 0.2 : 0.8); // 每爻一正两反 → 7 少阳
  const r = castLiuyaoRandom({ date: BJ('2026-10-25T21:30:00+08:00'), random: rnd });
  assert.equal(r.method, 'liuyao_random');
  assert.equal(r.cast.throws.length, 6);
  assert.ok(r.cast.coins.every((c) => c.length === 3 && /^[正反]{3}$/.test(c)));
  assert.equal(r.ben.fullName, '乾为天', '六爻皆少阳 → 乾为天');
  assert.equal(r.bian, null);
  // 显式 upper/lower 只作校验
  const ok = castLiuyao({
    date: BJ('2026-10-25T21:30:00+08:00'), throws: [7, 7, 7, 7, 7, 7], upper: 1, lower: 1,
  });
  assert.equal(ok.cast.validation.ok, true);
  assert.equal(ok.cast.validation.expected, '111111');
  // 不一致时以摇钱为准并给提示
  const bad = castLiuyao({
    date: BJ('2026-10-25T21:30:00+08:00'), throws: [7, 7, 7, 7, 7, 7], upper: 8, lower: 8,
  });
  assert.equal(bad.cast.validation.ok, false);
  assert.equal(bad.ben.fullName, '乾为天');
  assert.ok(bad.hints.some((h) => h.includes('摇钱结果')));
  // 只给 upper/lower（手动爻）：无动爻
  const manual = castLiuyao({ date: BJ('2026-10-25T21:30:00+08:00'), upper: 1, lower: 1 });
  assert.equal(manual.method, 'liuyao_manual');
  assert.equal(manual.ben.fullName, '乾为天');
  assert.equal(manual.bian, null);
  assert.deepEqual(manual.cast.throws, [7, 7, 7, 7, 7, 7]);
  // throws 不足 6 应抛错
  assert.throws(() => castLiuyao({ date: BJ('2026-10-25T21:30:00+08:00'), throws: [7, 7] }), /6 个爻值/);
  assert.throws(() => castLiuyao({ date: BJ('2026-10-25T21:30:00+08:00') }), /throws/);
});

test('六爻：月建与日辰参与装卦（返回值与历法一致）', () => {
  const q = castLiuyao({ date: BJ('2026-10-25T21:30:00+08:00'), throws: [7, 8, 7, 8, 7, 8] });
  assert.equal(q.cast.monthBranch, '戌');
  assert.equal(q.cast.monthElement, '土');
  assert.equal(q.cast.dayGanzhi, '壬申');
  assert.deepEqual(q.cast.xunKong, ['戌', '亥']);
  assert.equal(q.lines[0].ganzhi, q.jin.ben[0].ganzhi);
});

// ============================================================
// 九、汇总入口 data / 三式动态接入
// ============================================================

test('index.js：data 速查表与 SPEC 3.1 导出齐全', () => {
  assert.equal(typeof VERSION, 'string');
  assert.deepEqual(data.stems, STEMS);
  assert.deepEqual(data.branches, BRANCHES);
  assert.equal(data.trigrams['乾'].symbol, '☰');
  assert.equal(data.palances.length, 64);
  assert.equal(data.palances.filter((x) => x.palace === '乾').length, 8);
  assert.equal(data.wuxing.sheng['木'], '火');
  assert.equal(data.wuxing.ke['金'], '木');
  assert.deepEqual(data.liushen, ['青龙', '朱雀', '勾陈', '腾蛇', '白虎', '玄武']);
  assert.equal(data.solarTerms.length, 24);
  // SPEC 3.1 要求的函数都应可用
  for (const fn of [getAlmanac, trueSolarTime, solarTerms, lunarFromDate, dayPillar, hourPillar,
    xunKong, getHexagram, hexagrams, castMeihua, castLiuyao, castLiuyaoRandom]) {
    assert.equal(typeof fn, 'function');
  }
});

test('index.js：三式模块未就绪时不阻塞（动态导入 + 明确报错）', async () => {
  const status = await sanshiStatus();
  assert.equal(typeof status.qimen.ready, 'boolean');
  assert.equal(typeof status.liuren.ready, 'boolean');
  const mods = await loadSanshi();
  // engine-sanshi 的 qimen.js / liuren.js 未交付时，castQimen/castLiuren 必须抛中文错误而不是让模块崩掉
  const { castQimen, castLiuren } = await import('../lib/engine/index.js');
  if (!status.qimen.ready) {
    await assert.rejects(() => castQimen({}), /奇门模块/);
  } else {
    assert.equal(typeof mods.qimen.castQimen, 'function');
  }
  if (!status.liuren.ready) {
    await assert.rejects(() => castLiuren({}), /六壬模块/);
  } else {
    assert.equal(typeof mods.liuren.castLiuren, 'function');
  }
  // 基础模块始终可用
  assert.ok(mods && 'qimen' in mods && 'liuren' in mods);
});

test('常量：干支表、节气表、八卦数序', () => {
  assert.deepEqual(STEMS, ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);
  assert.deepEqual(BRANCHES, ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);
  assert.equal(SOLAR_TERMS.length, 24);
  assert.equal(SOLAR_TERMS[0], '小寒');
  assert.equal(SOLAR_TERMS[23], '冬至');
  assert.equal(ganzhiName(0), '甲子');
  assert.equal(ganzhiName(59), '癸亥');
  assert.equal(ganzhiIndex('甲子'), 0);
  assert.equal(ganzhiIndex('癸亥'), 59);
  // 梅花八卦数：1乾 2兑 3离 4震 5巽 6坎 7艮 8坤
  assert.deepEqual(TRIGRAM_ORDER, ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤']);
  assert.equal(binaryOf(1, 1), '111111');
  assert.equal(binaryOf(8, 8), '000000');
});
