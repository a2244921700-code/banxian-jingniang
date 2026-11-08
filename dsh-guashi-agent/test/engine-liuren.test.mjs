/**
 * engine-liuren.test.mjs —— 大六壬排盘（月将加时 / 四课 / 九宗门三传 / 十二天将）测试
 *
 * 运行：在 dsh-guashi-agent 目录下 `node test/engine-liuren.test.mjs`（node:test，零依赖）
 *
 * ── 对盘来源 ────────────────────────────────────────────────
 * 1) 昼课金样本 2026-10-25 09:30（壬申日 乙巳时，霜降后卯将·昼占）与
 *    夜课金样本 2026-10-25 21:30（壬申日 辛亥时，霜降后卯将·夜占）：
 *    来源：开源排盘工具 kentang2017/kinliuren（https://github.com/kentang2017/kinliuren，
 *          PyPI kinliuren）实跑输出；本引擎对其完整盘面（月将/天地盘/四课/三传/十二天将/
 *          昼夜贵人/顺逆/旬空）逐项核对一致。
 * 2) 比用课样本 2026-01-11 12:00（乙酉日 壬午时，冬至后丑将）：
 *    同 kinliuren 输出一致；并按《六壬大全》卷一九宗门歌诀手工复推（四课 亥/乙、午/亥、辰/酉、亥/辰；
 *    两下贼上 上午、上亥，乙为柔日取阴神亥 → 三传 亥午丑），推导过程写在用例注释里。
 * 3) 九宗门古法例盘（伏吟、八专、涉害、遥克、昴星、别责、返吟）共 28 例：
 *    来源：《六壬大全（四库全书本）》卷一「入手法」九宗门歌诀；《六壬粹言》（清·刘赤江）
 *          「涉害」「别责」「八专」「返吟无克（无亲课）」「昴星仰视/俯视」「遥克蒿矢/弹射」诸条
 *          所载算例；《古今图书集成·艺术典》八专课算例。逐例断言三传，见下方 CLASSIC_CASES。
 *    另：涉害浅深验例据《六壬大全》卷三与《六壬粹言》引《观月经》《课经》：
 *          甲辰日子加辰四重、甲午日辰加寅一重、亥加丑五重、庚子日午加庚二重、戌加子一重。
 * 4) 月将中气过宫、日干寄宫、驿马：据《六壬大全》卷一「入手法」「十干寄宫」及卷二「十二神释」；
 *    昼夜贵人：据《壬学琐记》引《六壬元女经》昼夜贵人表（甲戊庚昼丑夜未、乙己昼子夜申、
 *    丙丁昼亥夜酉、辛昼午夜寅、壬癸昼巳夜卯），《六壬粹言》「十二天将旦暮治」条同，
 *    明·茅元仪《武备志·贵人例》亦同（「甲、戊、庚昼贵在丑……夜贵在未」）；
 *    旁证《六壬大全》卷三「甲申旬午未空亡……辛日旦贵空……甲戊庚三日夜贵空」；
 *    昼夜分界：卯至申为昼（SPEC §2.7 通行说），贵人所临地盘亥子丑寅卯辰顺布、巳午未申酉戌逆布
 *    （《六壬大全·括囊赋》注「亥至辰顺，巳至戌逆」）。
 * 5) 九宗门口径逐项核对（用户要求「最主流」）：
 *    - 贼克/比用/涉害/遥克次序、中末相因：《六壬大全》卷一歌诀、《六壬指南》；
 *    - 涉害深浅：取「从地盘历数归本家，计克深者」，起点/终点不计，计克方向与发用同类
 *      （下贼上计受克、上克下计我克），寄宫天干单独计（《六壬大全》卷三三则算例逐条验算）；
 *      《六壬指南》初学者读本简化为「先孟后仲」，不给深浅，本引擎从《大全》《粹言》；
 *    - 别责：刚日干合上乘神、柔日支三合前一位「不用乘神」、中末俱干上神（《六壬指南》）；
 *    - 八专：干支同处一位（四课只得二课），刚日干上阳神顺数三、柔日支上阴神逆数三，
 *      中末俱干上神（《六壬指南》《古今图书集成》）；八专日取寄宫＝日支者五日
 *      （甲寅、庚申、丁未、己未、癸丑）；
 *    - 反吟无克（井栏射/无亲）：初传取**日支**驿马，中传支上神、末传干上神（《六壬指南》
 *      「日支之马为用」、《六壬粹言》六课全列）；反吟有克依贼克法，中末初末相同而冲中传；
 *    - 伏吟：无克刚日干上、柔日支上，迤逦三刑，自刑颠倒日辰、中传复自刑以冲为末（《六壬指南》）；
 *    - 月将中气换将、贵人顺逆：如 4)。
 *
 * ── 已知口径差异（非错误）─────────────────────────────────
 * - 涉害深浅的计数边界：本引擎按《六壬大全》卷三算例与《六壬粹言》，
 *   起点（所临地盘位）与终点（本家）均不计、途经寄宫天干单独计一重；
 *   kinliuren 计起点且只按受克计，故个别涉害课的取用可能不同
 *   （本测试的涉害例盘均采古籍算例，不采 kinliuren 口径）。
 * - 反吟无克驿马：本引擎取日支马（古籍），kinliuren 取时支马。
 * - 昼夜贵人：用《六壬元女经》表；部分简化工具用「阳贵人＝昼」异说（甲昼未、乙昼申…），
 *   会差一个贵人。
 * - 别责：四课不全指「上神去重后只余三神」；柔日初传取支前三合位本身（《六壬粹言》定论，
 *   goliajp/mingli、kinliuren 同）；八专日取「日干寄宫＝日支」五日（甲寅、庚申、丁未、己未、癸丑，
 *   《古今图书集成》「干支同位，专聚一处，故名八专」），kinliuren 另采干支同气八日之说。
 * - 返吟无克（井栏射/无亲）初传取「日支」驿马（《六壬粹言》《六壬大全》），kinliuren 取时支驿马。
 * - 伏吟中末以三刑递取、发用自刑者颠倒日辰、次传复自刑者以冲为末（《六壬大全》卷一），
 *   与 kinliuren 部分分支实现不同。
 * - 十二天将排列顺序：《六壬大全》贵人、螣蛇、朱雀、六合、勾陈、青龙、天空、白虎、太常、
 *   玄武、太阴、天后；本引擎从之（kinliuren 白天将简称顺序略异，但十二将相对次序一致）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  castLiuren,
  deriveSanChuan,
  buildSiKe,
  shehaiDepth,
  liuQinOfBranch,
  controls,
  generates,
  JI_GONG,
  GUI_REN,
  YUE_JIANG_BY_ZHONGQI,
  YI_MA,
} from '../lib/engine/liuren.js';

const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const bj = (s) => new Date(s + '+08:00');
const bIdx = (b) => BRANCHES.indexOf(b);
const YANG_STEMS = new Set(['甲', '丙', '戊', '庚', '壬']);

// ============================================================
// 一、静态表：十干寄宫 / 月将 / 贵人 / 驿马 / 五行六亲
// ============================================================

test('十干寄宫（《六壬大全·入手法》）：甲寅 乙辰 丙戊巳 丁己未 庚申 辛戌 壬亥 癸丑', () => {
  assert.deepEqual(JI_GONG, {
    甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳', 己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑',
  });
  // 「分眀不用四正神」：四正（子午卯酉）不作寄宫
  for (const v of Object.values(JI_GONG)) assert.equal('子午卯酉'.includes(v), false);
});

test('月将中气过宫：雨水亥登明、春分戌河魁、夏至未小吉、冬至丑大吉……', () => {
  const names = Object.fromEntries(Object.entries(YUE_JIANG_BY_ZHONGQI).map(([k, v]) => [v.branch, v.name]));
  assert.deepEqual(Object.keys(YUE_JIANG_BY_ZHONGQI).map(Number).sort((a, b) => a - b), [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]);
  assert.deepEqual(names, {
    子: '神后', 亥: '登明', 戌: '河魁', 酉: '从魁', 申: '传送', 未: '小吉',
    午: '胜光', 巳: '太乙', 辰: '天罡', 卯: '太冲', 寅: '功曹', 丑: '大吉',
  });
  // 通过真实时间验证「中气换将」：节气落点见 almanac（已由 engine-smith 对天文台核对）
  assert.equal(castLiuren({ date: bj('2026-06-25T12:00') }).yueJiang.branch, '未'); // 夏至后
  assert.equal(castLiuren({ date: bj('2026-04-01T12:00') }).yueJiang.branch, '戌'); // 春分后
  assert.equal(castLiuren({ date: bj('2026-01-10T12:00') }).yueJiang.branch, '丑'); // 冬至后
  assert.equal(castLiuren({ date: bj('2026-02-25T12:00') }).yueJiang.branch, '亥'); // 雨水后
});

test('昼夜贵人表（《六壬元女经》，见《壬学琐记》引、《六壬粹言》「十二天将旦暮治」同）：甲戊庚昼丑夜未、辛昼午夜寅……', () => {
  assert.deepEqual(GUI_REN, {
    甲: { 昼: '丑', 夜: '未' }, 戊: { 昼: '丑', 夜: '未' }, 庚: { 昼: '丑', 夜: '未' },
    乙: { 昼: '子', 夜: '申' }, 己: { 昼: '子', 夜: '申' },
    丙: { 昼: '亥', 夜: '酉' }, 丁: { 昼: '亥', 夜: '酉' },
    辛: { 昼: '午', 夜: '寅' },
    壬: { 昼: '巳', 夜: '卯' }, 癸: { 昼: '巳', 夜: '卯' },
  });
  // 《六壬大全》卷三旁证：甲申旬午未空亡，「辛日旦贵空……甲戊庚三日夜贵空」
  assert.equal('午未'.includes(GUI_REN.辛.昼), true);
  assert.equal('午未'.includes(GUI_REN.甲.夜), true);
  assert.equal('午未'.includes(GUI_REN.戊.夜), true);
  assert.equal('午未'.includes(GUI_REN.庚.夜), true);
});

test('驿马（三合冲位）与五行六亲', () => {
  assert.deepEqual(YI_MA, {
    申: '寅', 子: '寅', 辰: '寅',
    寅: '申', 午: '申', 戌: '申',
    巳: '亥', 酉: '亥', 丑: '亥',
    亥: '巳', 卯: '巳', 未: '巳',
  });
  assert.equal(controls('木', '土'), true);
  assert.equal(controls('金', '木'), true);
  assert.equal(controls('木', '金'), false);
  assert.equal(generates('木', '火'), true);
  assert.equal(generates('火', '木'), false);
  // 以日干为我：生我父母、我生子孙、克我官鬼、我克妻财、比和兄弟
  assert.equal(liuQinOfBranch('壬', '亥'), '兄弟');
  assert.equal(liuQinOfBranch('乙', '亥'), '父母');
  assert.equal(liuQinOfBranch('乙', '午'), '子孙');
  assert.equal(liuQinOfBranch('乙', '丑'), '妻财');
  assert.equal(liuQinOfBranch('壬', '未'), '官鬼');
});

test('涉害浅深（《六壬大全》卷三、《六壬粹言》引《观月经》《课经》）：起点/终点不计、计同类之克、寄干单独计', () => {
  // 《观月经》甲辰日「子加辰……巳上戊土、未土、未上己土、前又戌土，共四重」——
  // 起点辰不计、本家子不计、寄宫天干（巳寄戊、未寄己）单独计
  assert.equal(shehaiDepth('子', '辰'), 4);
  // 《课经》甲午日「辰加寅，历卯木一重」——终点辰之寄干乙木若计则两重，作一重
  assert.equal(shehaiDepth('辰', '寅'), 1);
  // 《六壬大全》卷三「亥加丑土，前行历辰、戊、未、己、戌土位五重，归本家亥位」
  assert.equal(shehaiDepth('亥', '丑'), 5);
  // 上克下发用计「我克」：《大全》「庚子日午加庚，前行历酉辛金二重，归本家地盘午位」
  // 本引擎按寄宫计：酉（金）+ 戌寄辛（金）= 2
  assert.equal(shehaiDepth('午', '申', 'ke'), 2);
  // 上克下：《大全》同例「戌加子水，前行历癸水一重」——丑寄癸（水）
  assert.equal(shehaiDepth('戌', '子', 'ke'), 1);
  // 同一组参数若误按「受克」计会得到不同数（保证方向参数确实生效）
  assert.notEqual(shehaiDepth('午', '申', 'ke'), shehaiDepth('午', '申', 'zei'));
  // 缺省方向为「下贼上」
  assert.equal(shehaiDepth('子', '辰'), shehaiDepth('子', '辰', 'zei'));
});

test('涉害（上克下）2026-09-23 12:00（庚子日壬午时）：两上克下俱比，午临申克深二重 → 三传午辰寅·见机', () => {
  // 庚子日 壬午时，秋分后辰将：四课 午/庚、辰/午、戌/子、申/戌
  // 一课 午火克庚金、三课 戌土克子水，两上克下且皆阳神，与庚（阳日）俱比 → 涉害
  // 午临申（寄宫），计「我克」：酉金 + 戌寄辛金 = 二重；戌临子：丑寄癸水 = 一重 → 取午
  // 三传：初午，中=天盘[午]=辰，末=天盘[辰]=寅；与 kinliuren 输出一致
  const l = castLiuren({ date: bj('2026-09-23T12:00') });
  assert.equal(l.meta.dayGanzhi, '庚子');
  assert.equal(l.meta.hourGanzhi, '壬午');
  assert.deepEqual(l.siKe.map((k) => `${k.upper}/${k.lower}`), ['午/庚', '辰/午', '戌/子', '申/戌']);
  assert.equal(l.sanChuan.method, '涉害法');
  assert.equal(l.sanChuan.keTi, '见机');
  assert.deepEqual(l.sanChuan.chuan.map((c) => c.branch), ['午', '辰', '寅']);
  assert.ok(l.hints.some((h) => h.includes('涉害浅深') && h.includes('午临申（2重）')), 'hints 列出涉害浅深');
});

// ============================================================
// 二、金样本：昼课 2026-10-25 09:30（壬申日 乙巳时）
// ============================================================

/** 昼课期望盘面（来源 kinliuren 实跑核对，见文件头 1) ） */
const DAY_CHART = {
  dayGanzhi: '壬申',
  hourGanzhi: '乙巳',
  yueJiang: { name: '太冲', branch: '卯' },
  guiren: { daynight: '昼', branch: '巳', earth: '未', shun: false },
  tianPan: { 子: '戌', 丑: '亥', 寅: '子', 卯: '丑', 辰: '寅', 巳: '卯', 午: '辰', 未: '巳', 申: '午', 酉: '未', 戌: '申', 亥: '酉' },
  siKe: [
    { upper: '酉', lower: '壬' },
    { upper: '未', lower: '酉' },
    { upper: '午', lower: '申' },
    { upper: '辰', lower: '午' },
  ],
  sanChuan: { method: '贼克法', keTi: '元首', chuan: ['午', '辰', '寅'] },
  chuanJiang: { 午: '天后', 辰: '螣蛇', 寅: '六合' },
  tianJiang: {
    子: ['戌', '白虎'], 丑: ['亥', '天空'], 寅: ['子', '青龙'], 卯: ['丑', '勾陈'],
    辰: ['寅', '六合'], 巳: ['卯', '朱雀'], 午: ['辰', '螣蛇'], 未: ['巳', '贵人'],
    申: ['午', '天后'], 酉: ['未', '太阴'], 戌: ['申', '玄武'], 亥: ['酉', '太常'],
  },
  xunKong: ['戌', '亥'],
};

test('昼课 2026-10-25 09:30（壬申日乙巳时·霜降后卯将）：月将/天地盘/四课/三传/天将全盘核对', () => {
  const l = castLiuren({ date: bj('2026-10-25T09:30') });
  assert.equal(l.meta.dayGanzhi, DAY_CHART.dayGanzhi);
  assert.equal(l.meta.hourGanzhi, DAY_CHART.hourGanzhi);
  assert.equal(l.meta.termName, '霜降');
  // 月将：霜降（中气）后卯将太冲
  assert.equal(l.yueJiang.branch, DAY_CHART.yueJiang.branch);
  assert.equal(l.yueJiang.name, DAY_CHART.yueJiang.name);
  assert.ok(l.yueJiang.note.includes('霜降'));
  // 昼夜与贵人：巳时属昼（卯至申为昼），壬日昼贵巳，临地盘未，未在巳午未申酉戌 → 逆布
  assert.equal(l.guiren.daynight, '昼');
  assert.equal(l.guiren.shun, false);
  assert.equal(l.guiren.branch, DAY_CHART.guiren.branch);
  assert.equal(l.guiren.earth, DAY_CHART.guiren.earth);
  // 天地盘：月将加时
  assert.equal(l.tianDiPan.length, 12);
  for (const item of l.tianDiPan) {
    assert.equal(item.position, item.diPan);
    assert.equal(item.tianPan, DAY_CHART.tianPan[item.position], `天盘[${item.position}]`);
  }
  // 四课
  assert.equal(l.siKe.length, 4);
  l.siKe.forEach((k, i) => {
    assert.equal(k.ke, i + 1);
    assert.equal(k.upper, DAY_CHART.siKe[i].upper, `${i + 1}课上神`);
    assert.equal(k.lower, DAY_CHART.siKe[i].lower, `${i + 1}课下神`);
    assert.equal(typeof k.liuqin, 'string');
    assert.ok(k.liuqin.length > 0);
  });
  assert.ok(l.siKe[0].note.includes('寄宫亥'), '一课注明日干寄宫');
  // 三传：上克下（午火克申金）一重发用 → 元首；中末层层取上神
  assert.equal(l.sanChuan.method, DAY_CHART.sanChuan.method);
  assert.equal(l.sanChuan.keTi, DAY_CHART.sanChuan.keTi);
  assert.deepEqual(l.sanChuan.chuan.map((c) => c.branch), DAY_CHART.sanChuan.chuan);
  assert.deepEqual(l.sanChuan.chuan.map((c) => c.index), [1, 2, 3]);
  for (const c of l.sanChuan.chuan) {
    assert.equal(c.tianJiang, DAY_CHART.chuanJiang[c.branch], `${c.branch} 天将`);
    assert.equal(typeof c.liuqin, 'string');
  }
  // 十二天将：将序顺逆 + 所乘天盘神
  assert.equal(l.tianJiang.length, 12);
  for (const entry of l.tianJiang) {
    const [expectedTian, expectedJiang] = DAY_CHART.tianJiang[entry.position];
    assert.equal(entry.branch, expectedTian, `天将[${entry.position}] 乘神`);
    assert.equal(entry.jiang, expectedJiang, `天将[${entry.position}]`);
  }
  // 旬空：壬申属甲子旬，空戌亥
  assert.deepEqual(l.xunKong, DAY_CHART.xunKong);
});

// ============================================================
// 三、金样本：夜课 2026-10-25 21:30（壬申日 辛亥时）
// ============================================================

/** 夜课期望盘面（来源 kinliuren 实跑核对，见文件头 1) ） */
const NIGHT_CHART = {
  dayGanzhi: '壬申',
  hourGanzhi: '辛亥',
  yueJiang: { name: '太冲', branch: '卯' },
  guiren: { daynight: '夜', branch: '卯', earth: '亥', shun: true },
  tianPan: { 子: '辰', 丑: '巳', 寅: '午', 卯: '未', 辰: '申', 巳: '酉', 午: '戌', 未: '亥', 申: '子', 酉: '丑', 戌: '寅', 亥: '卯' },
  siKe: [
    { upper: '卯', lower: '壬' },
    { upper: '未', lower: '卯' },
    { upper: '子', lower: '申' },
    { upper: '辰', lower: '子' },
  ],
  sanChuan: { method: '贼克法', keTi: '重审', chuan: ['未', '亥', '卯'] },
  chuanJiang: { 未: '勾陈', 亥: '太常', 卯: '贵人' },
  tianJiang: {
    子: ['辰', '螣蛇'], 丑: ['巳', '朱雀'], 寅: ['午', '六合'], 卯: ['未', '勾陈'],
    辰: ['申', '青龙'], 巳: ['酉', '天空'], 午: ['戌', '白虎'], 未: ['亥', '太常'],
    申: ['子', '玄武'], 酉: ['丑', '太阴'], 戌: ['寅', '天后'], 亥: ['卯', '贵人'],
  },
  xunKong: ['戌', '亥'],
};

test('夜课 2026-10-25 21:30（壬申日辛亥时·霜降后卯将）：月将/天地盘/四课/三传/天将全盘核对', () => {
  const l = castLiuren({ date: bj('2026-10-25T21:30') });
  assert.equal(l.meta.dayGanzhi, NIGHT_CHART.dayGanzhi);
  assert.equal(l.meta.hourGanzhi, NIGHT_CHART.hourGanzhi);
  assert.equal(l.meta.termName, '霜降');
  assert.equal(l.yueJiang.branch, '卯');
  // 亥时属夜，壬日夜贵卯，临地盘亥，亥在亥子丑寅卯辰 → 顺布
  assert.equal(l.guiren.daynight, '夜');
  assert.equal(l.guiren.branch, NIGHT_CHART.guiren.branch);
  assert.equal(l.guiren.earth, NIGHT_CHART.guiren.earth);
  assert.equal(l.guiren.shun, true);
  for (const item of l.tianDiPan) {
    assert.equal(item.tianPan, NIGHT_CHART.tianPan[item.position], `天盘[${item.position}]`);
  }
  l.siKe.forEach((k, i) => {
    assert.equal(k.upper, NIGHT_CHART.siKe[i].upper, `${i + 1}课上神`);
    assert.equal(k.lower, NIGHT_CHART.siKe[i].lower, `${i + 1}课下神`);
  });
  // 三传：下贼上（卯木克未土）一重发用 → 重审
  assert.equal(l.sanChuan.method, NIGHT_CHART.sanChuan.method);
  assert.equal(l.sanChuan.keTi, NIGHT_CHART.sanChuan.keTi);
  assert.deepEqual(l.sanChuan.chuan.map((c) => c.branch), NIGHT_CHART.sanChuan.chuan);
  for (const c of l.sanChuan.chuan) {
    assert.equal(c.tianJiang, NIGHT_CHART.chuanJiang[c.branch], `${c.branch} 天将`);
  }
  for (const entry of l.tianJiang) {
    const [expectedTian, expectedJiang] = NIGHT_CHART.tianJiang[entry.position];
    assert.equal(entry.branch, expectedTian, `天将[${entry.position}] 乘神`);
    assert.equal(entry.jiang, expectedJiang, `天将[${entry.position}]`);
  }
  assert.deepEqual(l.xunKong, NIGHT_CHART.xunKong);
});

test('昼夜判定：auto 依卯至申为昼，显式 daynight 可覆盖（贵人随之改取）', () => {
  assert.equal(castLiuren({ date: bj('2026-10-25T09:30') }).guiren.daynight, '昼'); // 巳时
  assert.equal(castLiuren({ date: bj('2026-10-25T21:30') }).guiren.daynight, '夜'); // 亥时
  const forced = castLiuren({ date: bj('2026-10-25T21:30'), daynight: '昼' });
  assert.equal(forced.guiren.daynight, '昼');
  assert.equal(forced.guiren.branch, '巳'); // 壬日昼贵巳（auto 为夜贵卯）
  const forced2 = castLiuren({ date: bj('2026-10-25T09:30'), daynight: '夜' });
  assert.equal(forced2.guiren.branch, '卯');
});

test('23:00 子时换日边界：日柱进次日、晚子时以次日日干起时（六壬通例）', () => {
  const before = castLiuren({ date: bj('2026-10-25T22:59') });
  assert.equal(before.meta.dayGanzhi, '壬申');
  assert.equal(before.meta.hourGanzhi, '辛亥');
  assert.equal(before.meta.enteredNextDay, false);

  const after = castLiuren({ date: bj('2026-10-25T23:30') });
  assert.equal(after.meta.dayGanzhi, '癸酉'); // 子时（23:00）即进次日
  assert.equal(after.meta.hourGanzhi, '壬子'); // 晚子时以次日癸日干起壬子
  assert.equal(after.meta.enteredNextDay, true);
  assert.ok(after.hints.some((h) => h.includes('子时换日')), 'hints 说明已进次日');
  // 日柱不同 → 四课/三传随日重新起课
  assert.notDeepEqual(before.siKe.map((k) => k.upper + k.lower), after.siKe.map((k) => k.upper + k.lower));
});

// ============================================================
// 四、比用课样本：2026-01-11 12:00（乙酉日 壬午时）
// ============================================================

test('比用课 2026-01-11 12:00（乙酉日壬午时）：两下贼上，柔日取阴神亥 → 亥午丑', () => {
  // 手推（《六壬大全》「下贼或三二四侵……常将天日比神用，阳日用阳阴用阴」）：
  // 丑将加午时，天盘自子起 未申酉戌亥子丑寅卯辰巳午
  // 四课：一 亥/乙（亥生乙，不克）、二 午/亥（亥水克午火，下贼上）、
  //       三 辰/酉（不克）、四 亥/辰（辰土克亥水，下贼上）
  // 两下贼上：上午为阳神、上亥为阴神；乙为柔日（阴），唯亥与之比 → 比用取亥
  // 中传=天盘[亥]=午，末传=天盘[午]=丑 → 亥午丑（与 kinliuren 输出一致）
  const l = castLiuren({ date: bj('2026-01-11T12:00') });
  assert.equal(l.meta.dayGanzhi, '乙酉');
  assert.equal(l.meta.hourGanzhi, '壬午');
  assert.deepEqual(l.siKe.map((k) => `${k.upper}/${k.lower}`), ['亥/乙', '午/亥', '辰/酉', '亥/辰']);
  assert.equal(l.sanChuan.method, '比用法');
  assert.equal(l.sanChuan.keTi, '知一');
  assert.deepEqual(l.sanChuan.chuan.map((c) => c.branch), ['亥', '午', '丑']);
  assert.equal(l.guiren.branch, '子'); // 乙日昼贵子
  assert.equal(l.guiren.earth, '巳'); // 子临地盘巳
  assert.equal(l.guiren.shun, false); // 巳在巳午未申酉戌 → 逆布
});

// ============================================================
// 五、九宗门古法例盘（28 例，来源见文件头 3) ）
// ============================================================

/**
 * [日柱, 天盘位移 d（= 月将 − 时支）, 期望三传, 来源与说明]
 * 构造方式：天盘[地支] = 地支 + d；四课由 buildSiKe 依日干寄宫推得。
 */
const CLASSIC_CASES = [
  // ── 伏吟（d=0）：《六壬大全》卷一伏吟歌「无克刚干柔取辰，迤逦刑之作中末；
  //    若也自刑为发用，次传颠倒日辰并（阳日用辰阴日用日），次传更复自刑者，冲取末传不论刑」
  ['丙辰', 0, '巳申寅', '《六壬大全》例：丙辰日申将申时伏吟无克（刚日自任，巳→申→寅三刑）'],
  ['丁丑', 0, '丑戌未', '《六壬大全》例：丁丑日未将未时伏吟无克（柔日自信，丑→戌→未）'],
  ['壬辰', 0, '亥辰戌', '《六壬大全》例：壬辰日伏吟，初传亥自刑→中取日支辰，辰自刑→末取冲戌'],
  ['壬午', 0, '亥午子', '《六壬大全》例：壬午日伏吟，亥自刑→中取日支午，末取冲子'],
  ['乙亥', 0, '辰亥巳', '《六壬大全》例：乙亥日伏吟有克（乙木克辰土，重审），初辰自刑→中取支亥，亥自刑→末冲巳'],
  ['乙酉', 0, '辰酉卯', '《六壬大全》例：乙酉日伏吟有克，初辰自刑→中取支酉，酉自刑→末冲卯'],
  ['丁卯', 0, '卯子午', '《六壬大全》例：丁卯日伏吟，卯刑子，子卯互刑不复再传，以子冲午为末'],
  ['丁酉', 0, '酉未丑', '《六壬大全》例：丁酉日伏吟，初酉自刑→中取干上未，未刑丑为末'],
  // ── 八专：《古今图书集成·艺术典》八专课算例；《六壬粹言》「柔日支之阴神逆数三位」
  ['甲寅', 9, '丑亥亥', '《古今图书集成》例：甲寅日辰时丑将八专，刚日干上亥顺数三位至丑，中末归干上'],
  ['己未', 2, '酉酉酉', '《古今图书集成》例：己未日未时酉将八专（独足格），三传皆日上神酉'],
  ['丁未', 10, '丑巳巳', '《六壬粹言》例：丁未日八专，柔日支之阴神卯逆数三位至丑，中末归干上巳'],
  // ── 涉害：《六壬粹言》「取克贼之神，从地盘历数归于本家，以受克深者为用」及见机/察微/复等条
  ['癸未', 4, '酉丑巳', '《六壬粹言》涉害·见机：癸未日一课巳癸、二课酉巳、三课亥未，俱与日比，取孟位酉'],
  ['庚辰', 2, '申戌子', '《六壬粹言》涉害·察微：庚辰日二课子戌、四课申午，孟位无取，取仲位申'],
  ['戊辰', 7, '子未寅', '《六壬粹言》涉害·复等：戊辰日一课子戊、四课午亥，俱在孟位，取先见之子'],
  // ── 遥克：《六壬粹言》「蒿矢（神遥克日）无取弹射（日遥克神）宜」
  ['丙戌', 9, '亥申巳', '《六壬粹言》遥克·蒿矢：丙戌日干上寅、二课亥，亥水遥克丙火，取亥'],
  ['癸未', 11, '巳辰卯', '《六壬粹言》遥克·弹射：癸未日干上子、三课午、四课巳，取与日比之巳'],
  // ── 昴星：《六壬粹言》「阳日取地盘酉上神为仰视，阴日取天盘酉下神为俯视」
  ['戊寅', 4, '丑午酉', '《六壬粹言》昴星·仰视：戊寅日，中取辰上神，末取日上神'],
  ['己巳', 1, '申申午', '《六壬粹言》昴星·俯视：己巳日，中用日上神，末用辰上神'],
  ['癸未', 1, '申寅申', '《六壬粹言》昴星·俯视：癸未日，中取日上神寅，末取辰上神申'],
  // ── 别责：《六壬粹言》「柔日不备，无克无遥，取支三合前位神为用，中末俱取干上神」
  ['丁酉', 10, '丑巳巳', '《六壬粹言》别责·柔日：丁酉日干上巳，支酉三合前位丑'],
  ['辛酉', 11, '丑酉酉', '《六壬粹言》别责·柔日：辛酉日干上酉，支酉三合前位丑'],
  ['辛丑', 3, '巳丑丑', '《六壬粹言》别责·柔日：辛丑日干上丑，支丑三合前位巳'],
  ['辛未', 9, '亥未未', '《六壬粹言》别责·柔日：辛未日干上未，支未三合前位亥'],
  // ── 返吟（d=6）：《六壬粹言》「返吟无克，取支之驿马为用，中用支上神，末用干上神，曰无亲」
  ['丁丑', 6, '亥未丑', '《六壬粹言》返吟无克·无亲：丁丑日，驿马亥、支上未、干上丑'],
  ['辛丑', 6, '亥未辰', '《六壬粹言》返吟无克：辛丑日，驿马亥、支上未、干上辰'],
  ['丁未', 6, '巳丑丑', '《六壬粹言》返吟无克：丁未日，驿马巳、支上丑、干上丑'],
  ['辛未', 6, '巳丑辰', '《六壬粹言》返吟无克：辛未日，驿马巳、支上丑、干上辰'],
  ['丁亥', 6, '巳亥巳', '《六壬粹言》返吟有克：丁亥日取克为用，三传巳亥巳，巳为日比肩又为驿马'],
];

/** 构造古法例盘的对盘上下文：天盘[支] = 支 + d（d = 月将 − 时支） */
function syntheticContext(dayGanzhi, d) {
  const tianPan = {};
  for (let i = 0; i < 12; i += 1) tianPan[BRANCHES[i]] = BRANCHES[((i + d) % 12 + 12) % 12];
  return {
    kes: buildSiKe(dayGanzhi, tianPan),
    dayStem: dayGanzhi[0],
    dayBranch: dayGanzhi[1],
    tianPan,
    isYangDay: YANG_STEMS.has(dayGanzhi[0]),
    offset: ((d % 12) + 12) % 12,
  };
}

for (const [dayGanzhi, d, expected, source] of CLASSIC_CASES) {
  test(`九宗门古法例盘 ${dayGanzhi}日 d=${d} → ${expected}`, () => {
    const r = deriveSanChuan(syntheticContext(dayGanzhi, d));
    assert.equal(r.chuan.length, 3);
    assert.equal(r.chuan.join(''), expected, source);
    assert.ok(r.fa.endsWith('法'), r.fa);
    assert.equal(typeof r.keTi, 'string');
  });
}

test('九宗门覆盖：28 例古盘 + 金样本覆盖九宗门全部取传法', () => {
  const methods = new Set(['贼克法']); // 贼克法由昼课/夜课金样本覆盖（元首/重审）
  for (const [dayGanzhi, d] of CLASSIC_CASES) methods.add(deriveSanChuan(syntheticContext(dayGanzhi, d)).fa);
  // 比用法由 2026-01-11 12:00 乙酉日壬午时样本覆盖（两下贼上、唯亥比日，见上文用例）
  assert.equal(castLiuren({ date: bj('2026-01-11T12:00') }).sanChuan.method, '比用法');
  methods.add('比用法');
  assert.deepEqual([...methods].sort(), [
    '八专法', '别责法', '反吟法', '伏吟法', '比用法', '涉害法', '贼克法', '遥克法', '昴星法',
  ].sort());
});

// ============================================================
// 六、盘面自洽性（多时间点）
// ============================================================

const SELF_CHECK_TIMES = [];
for (let m = 0; m < 12; m += 1) {
  for (const d of [3, 11, 19, 27]) {
    for (const hh of ['03:30', '09:30', '15:30', '21:30']) {
      SELF_CHECK_TIMES.push(`2026-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T${hh}`);
    }
  }
}

test('盘面自洽性：192 个时间点（月将加时、四课、三传、天将、旬空互洽）', () => {
  for (const t of SELF_CHECK_TIMES) {
    const l = castLiuren({ date: bj(t) });
    // 月将加时：天盘[时支] === 月将
    assert.equal(l.tianDiPan[bIdx(l.meta.hourBranch)].tianPan, l.meta.yueJiangBranch, t);
    assert.equal(l.yueJiang.branch, l.meta.yueJiangBranch);
    // 天地盘：十二支各现一次
    assert.deepEqual(l.tianDiPan.map((x) => x.tianPan).sort(), [...BRANCHES].sort(), t);
    assert.deepEqual(l.tianDiPan.map((x) => x.diPan).join(''), BRANCHES, t);
    // 四课：一课上 = 天盘[日干寄宫]，三课上 = 天盘[日支]，二/四课层层取上神
    const tianPan = Object.fromEntries(l.tianDiPan.map((x) => [x.diPan, x.tianPan]));
    assert.equal(l.siKe[0].upper, tianPan[JI_GONG[l.meta.dayStem]], t);
    assert.equal(l.siKe[0].lower, l.meta.dayStem, t);
    assert.equal(l.siKe[1].upper, tianPan[l.siKe[0].upper], t);
    assert.equal(l.siKe[2].upper, tianPan[l.meta.dayBranch], t);
    assert.equal(l.siKe[3].upper, tianPan[l.siKe[2].upper], t);
    // 三传：初传为天盘中之支；常法（非伏吟/反吟/昴星/别责/八专）中末层层取上神
    const chuan = l.sanChuan.chuan.map((c) => c.branch);
    assert.equal(chuan.length, 3);
    for (const b of chuan) assert.ok(BRANCHES.includes(b), t);
    if (['贼克法', '比用法', '涉害法', '遥克法'].includes(l.sanChuan.method)) {
      assert.equal(chuan[1], tianPan[chuan[0]], `${t} 中传`);
      assert.equal(chuan[2], tianPan[chuan[1]], `${t} 末传`);
    }
    // 十二天将：十二将各一，贵人所乘神 = 贵人支
    const jiangs = l.tianJiang.map((x) => x.jiang);
    assert.equal(jiangs.length, 12);
    assert.equal(new Set(jiangs).size, 12, t);
    assert.equal(new Set(l.tianJiang.map((x) => x.position)).size, 12);
    const guirenEntry = l.tianJiang.find((x) => x.branch === l.guiren.branch);
    assert.ok(guirenEntry, `${t} 贵人乘神`);
    assert.equal(guirenEntry.jiang, '贵人', t);
    assert.equal(guirenEntry.position, l.guiren.earth, t);
    // 顺逆：贵人临亥子丑寅卯辰为顺、巳午未申酉戌为逆
    assert.equal(l.guiren.shun, '亥子丑寅卯辰'.includes(l.guiren.earth), t);
    // 旬空
    assert.equal(l.xunKong.length, 2);
    assert.notEqual(l.xunKong[0], l.xunKong[1]);
    // hints
    assert.ok(l.hints.length >= 5, t);
    assert.ok(l.hints.some((h) => h.includes('月将')), t);
    assert.ok(l.hints.some((h) => h.includes('三传')), t);
  }
});

test('字段契约与「只出盘面、不做吉凶判断」', () => {
  const l = castLiuren({ date: bj('2026-10-25T21:30') });
  // SPEC §2.7 字段
  assert.deepEqual(Object.keys(l.yueJiang).sort(), ['branch', 'name', 'note']);
  for (const item of l.tianDiPan) assert.deepEqual(Object.keys(item).sort(), ['diPan', 'position', 'tianPan']);
  for (const k of l.siKe) {
    assert.deepEqual(Object.keys(k).sort(), ['ke', 'liuqin', 'lower', 'note', 'upper']);
  }
  assert.ok(['贼克法', '比用法', '涉害法', '遥克法', '昴星法', '别责法', '八专法', '伏吟法', '反吟法'].includes(l.sanChuan.method));
  for (const c of l.sanChuan.chuan) {
    assert.deepEqual(Object.keys(c).sort(), ['branch', 'index', 'kong', 'liuqin', 'note', 'tianJiang']);
  }
  for (const x of l.tianJiang) assert.deepEqual(Object.keys(x).sort(), ['branch', 'jiang', 'position']);
  assert.equal(l.xunKong.length, 2);
  // hints 只作摆盘提示，不出吉凶断语
  const text = l.hints.join('\n');
  assert.ok(text.includes('skills'));
  for (const bad of ['大吉', '必成', '凶兆', '主凶']) assert.equal(text.includes(bad), false, bad);
});

test('hints 与四课/三传/贵人信息彼此一致', () => {
  const l = castLiuren({ date: bj('2026-10-25T21:30') });
  const text = l.hints.join('\n');
  assert.ok(text.includes(l.yueJiang.name), '月将名');
  assert.ok(text.includes(l.sanChuan.chuan.map((c) => c.branch).join('、')), '三传地支');
  assert.ok(text.includes(l.guiren.branch), '贵人支');
  assert.ok(text.includes(l.meta.dayGanzhi), '日柱');
  assert.ok(text.includes(l.xunKong.join('、')), '旬空');
});
