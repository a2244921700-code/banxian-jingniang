/**
 * engine-taiyi.test.mjs —— 太乙神数排盘测试（node:test，无第三方依赖）
 *
 * 运行：node test/engine-taiyi.test.mjs
 *
 * 权威来源与对盘记录：
 *  1. 《太乙金鏡式經》唐·王希明撰（四庫全書本）卷01「推上元積年」「推入六紀三元法」
 *     「積太乙所在法」「推天目所在法」「推計神所在法」；卷02「推太乙運式法」；
 *     卷07「推四神太乙法」。
 *     在线底本：https://zh.wikisource.org/wiki/太乙金鏡式經_(四庫全書本)
 *     本地副本：D:\DSH_GuaShi\知识库\10-太乙神数\太乙金镜式经-四库本.md
 *  2. 对盘一（年计）：卷01 明言「上元混沌甲子之歲至大唐開元十二年甲子歲積得一百九十三萬
 *     七千二百八十一算」→ 724 年积年 1,937,281、第 49 局、太乙一宫、天目太炅（大炅）、
 *     计神寅、合神丑、太岁甲子。本测试逐项断言。
 *  3. 对盘二（年计六纪）：卷01「推入六紀三元法」后的六纪例——积年 mod 360 为
 *     1/61/121/181/241/301 时，太乙在一宫、六宫交替，天目武德/地主/大炅交替，计神寅。
 *     本测试取 2044/2104/2164/2224/2284/2344 六个年份逐项断言。
 *  4. 对盘三（时计例盘，卷01）：太乙九宫、大武为天目、午为计神 →
 *     主算 29、主大将九宫、主参将七宫、始击高叢、客算 4（单四）、客大将四宫、
 *     客参将二宫、合神巳。本测试用纯函数复现同一组数。
 *  5. 对盘四（算例，卷02）：太乙九宫、大义为天目 → 主算 16。
 *
 * 已知待考（meta.pending 亦列）：月计/日计/时计的经典推步常数（四库本有夺文）改用
 * 天文二至与平均回归年近似；时计文昌起神方向、阴遁行序、时计局数为本引擎取舍。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  castTaiyi, taiyiJiNian, juOf, taiyiPalaceOf, tianmuIndex, jishenBranchOf,
  taiSuiOf, suanFromTo, dajiangPalace, canjiangPalace, shijiIndex, heshenOf, sishenOf,
  latestSolstice, shichenFromSolstice,
  SIXTEEN_GODS, TIANMU_SEQ, PALACES, RUN_ORDER, EIGHT_GENERALS, SISHEN_POSITIONS,
  JI_YUAN_BASE, JI_YUAN_OFFSET,
} from '../lib/engine/taiyi.js';

const BJ = (s) => new Date(s);

// ============================================================
// 一、积年与局数
// ============================================================

test('积年：开元十二年甲子（724）为 1,937,281 算，逐年加减一算', () => {
  assert.equal(JI_YUAN_BASE, 1937281);
  assert.equal(JI_YUAN_OFFSET, 1936557);
  assert.equal(taiyiJiNian(724), 1937281, '《太乙金镜式经》卷01 明载此数');
  assert.equal(taiyiJiNian(725), 1937282, '下检将来每年加一算');
  assert.equal(taiyiJiNian(723), 1937280, '上考往古每年减一算');
  assert.equal(taiyiJiNian(2026), 1938583);
  // 局数：积数 mod 72，余 0 作 72，范围 1-72
  assert.equal(juOf(1937281), 49, '724 年积年除元法 72 余 49，即第四十九局');
  for (const y of [1900, 1949, 2000, 2024, 2026, 2100]) {
    const j = juOf(taiyiJiNian(y));
    assert.ok(j >= 1 && j <= 72, `${y} 年局数应在 1-72，实得 ${j}`);
  }
  assert.equal(juOf(72), 72, '整除时余 0 作 72');
  assert.equal(juOf(144), 72);
});

test('年计六纪：积年 mod 360 为 1/61/121/181/241/301 → 太乙一/六宫交替、天目武德/地主/大炅交替、计神寅', () => {
  // 卷01「推入六紀三元法」六纪例（一纪二甲仲辰甲子甲午…太乙在一宫武德为天目计神寅…
  // 二纪…太乙在六宫地主为天目…三纪…太乙在一宫大炅为天目…四纪…六宫武德…五纪…一宫地主…
  // 六纪…六宫大炅）
  const cases = [
    [2044, 1, '武德'],
    [2104, 6, '地主'],
    [2164, 1, '太炅'], // 经作「大炅」
    [2224, 6, '武德'],
    [2284, 1, '地主'],
    [2344, 6, '太炅'],
  ];
  for (const [year, palace, wenchang] of cases) {
    const ji = taiyiJiNian(year);
    assert.equal(ji % 360, cases.findIndex((c) => c[0] === year) * 60 + 1, `${year} 积年 mod 360`);
    const p = taiyiPalaceOf(ji);
    assert.equal(p.palace, palace, `${year} 太乙宫（卷01 六纪例）`);
    assert.equal(p.ruGong, 1);
    assert.equal(SIXTEEN_GODS[tianmuIndex(ji)].god, wenchang, `${year} 天目（卷01 六纪例）`);
    assert.equal(jishenBranchOf(ji, '顺', '寅'), '寅', `${year} 计神（卷01 六纪例）`);
  }
});

test('年计：开元十二年甲子（724）全盘要点', () => {
  const ji = taiyiJiNian(724);
  const p = taiyiPalaceOf(ji);
  assert.equal(juOf(ji), 49);
  assert.equal(p.palace, 1, '太乙在一宫（乾·西北）');
  assert.equal(p.palaceInfo.gua, '乾');
  assert.equal(SIXTEEN_GODS[tianmuIndex(ji)].god, '太炅', '天目在太炅（经作大炅）');
  assert.equal(jishenBranchOf(ji, '顺', '寅'), '寅', '计神寅');
  assert.equal(taiSuiOf(ji).ganzhi, '甲子', '太岁甲子');
  assert.equal(heshenOf(taiSuiOf(ji).ganzhi[1], '寅', '年计'), '丑', '合神丑（子丑六合，卷01 例）');
});

// ============================================================
// 二、十六神、天目十八位、始击
// ============================================================

test('十六神：十二支加四维共十六位，宫位对应太乙式九宫', () => {
  assert.equal(SIXTEEN_GODS.length, 16);
  assert.equal(new Set(SIXTEEN_GODS.map((g) => g.pos)).size, 16, '方位唯一');
  assert.equal(new Set(SIXTEEN_GODS.map((g) => g.god)).size, 16, '神名唯一');
  // 卷02「推十六神所主法」：子地主、丑阳德、艮和德、寅吕申、卯高丛、辰太阳、巽太炅、
  // 巳太神、午大威、未天道、坤大武、申武德、酉太蔟、戌阴主、乾阴德、亥大义
  const byPos = Object.fromEntries(SIXTEEN_GODS.map((g) => [g.pos, g.god]));
  assert.deepEqual(byPos, {
    子: '地主', 丑: '陽德', 艮: '和德', 寅: '吕申', 卯: '高叢', 辰: '太陽',
    巽: '太炅', 巳: '太神', 午: '大威', 未: '天道', 坤: '大武',
    申: '武德', 酉: '太蔟', 戌: '陰主', 乾: '陰德', 亥: '大義',
  });
  // 正宫八神：乾一、午二、艮三、卯四、巽九、酉六、坤七、子八
  const palaceGods = SIXTEEN_GODS.filter((g) => g.palace != null).map((g) => [g.god, g.palace]);
  assert.deepEqual(palaceGods, [
    ['太蔟', 6], ['陰德', 1], ['地主', 8], ['和德', 3],
    ['高叢', 4], ['太炅', 9], ['大威', 2], ['大武', 7],
  ]);
  // 九宫名称与方位（太乙式九宫，与洛书九宫差一位）
  assert.deepEqual(PALACES.map((p) => p.gua), ['乾', '离', '艮', '震', '中', '兑', '坤', '坎', '巽']);
  assert.deepEqual(RUN_ORDER, [1, 2, 3, 4, 6, 7, 8, 9], '太乙行宫不游中五');
});

test('天目：积数 mod 18，起武德顺行十六神，遇陰德大武各重留一算（十八位）', () => {
  assert.equal(TIANMU_SEQ.length, 18);
  assert.equal(TIANMU_SEQ[0], 0, '第一位武德');
  assert.equal(TIANMU_SEQ[3], 3);
  assert.equal(TIANMU_SEQ[4], 3, '陰德重留');
  assert.equal(TIANMU_SEQ[16], 15);
  assert.equal(TIANMU_SEQ[17], 15, '大武重留');
  // 卷01 六纪例已在上一条覆盖；此处验 18 位循环与余 0 作 18
  const ji = taiyiJiNian(724); // 积年 mod 72 = 49, mod 18 = 13
  assert.equal(mod18(ji), 13);
  assert.equal(SIXTEEN_GODS[tianmuIndex(ji)].god, '太炅');
  // 积数 mod 18 = 0 → 第十八位（大武）
  const ji18 = 18 * 7;
  assert.equal(tianmuIndex(ji18), 15);
});

function mod18(n) {
  const r = n % 18;
  return r === 0 ? 18 : r;
}

// ============================================================
// 三、主客算与四将（复现卷01、卷02 例盘）
// ============================================================

test('主算：卷01 时计例盘（太乙九宫、天目大武、计神午）→ 主算29、主大将9、主参将7', () => {
  const wenchangIdx = SIXTEEN_GODS.findIndex((g) => g.god === '大武');
  const zhusuan = suanFromTo(wenchangIdx, 9);
  assert.equal(zhusuan, 29, '卷01 例「主筭得二十九」');
  assert.equal(dajiangPalace(zhusuan), 9, '「主大將在九宫」');
  assert.equal(canjiangPalace(9), 7, '「主參將在七宫」');
});

test('客算与始击：同例（计神午）→ 始击高叢、客算4、客大将4、客参将2', () => {
  const wenchangIdx = SIXTEEN_GODS.findIndex((g) => g.god === '大武');
  const sjIdx = shijiIndex(wenchangIdx, '午');
  assert.equal(SIXTEEN_GODS[sjIdx].god, '高叢', '「天目下臨髙叢卯」（卷01 例）');
  const kesuan = suanFromTo(sjIdx, 9);
  assert.equal(kesuan, 4, '「客筭得單四」');
  assert.equal(dajiangPalace(kesuan), 4, '「客大將在四宫」');
  assert.equal(canjiangPalace(4), 2, '「客參將在二宫」');
  assert.equal(heshenOf('子', '午', '时计'), '巳', '卷01 时计例「巳為合神」');
});

test('主算：卷02 例（太乙九宫、大义为天目）→ 主算16', () => {
  const idx = SIXTEEN_GODS.findIndex((g) => g.god === '大義');
  assert.equal(suanFromTo(idx, 9), 16, '卷02「計得十六」');
});

test('将宫规则：大将取算之个位（0作1），参将九宫序逆退二位', () => {
  assert.equal(dajiangPalace(29), 9);
  assert.equal(dajiangPalace(24), 4, '「得二十四棄二十置四」');
  assert.equal(dajiangPalace(10), 1, '「得十置一」');
  assert.equal(dajiangPalace(20), 1);
  assert.equal(canjiangPalace(9), 7);
  assert.equal(canjiangPalace(4), 2);
  assert.equal(canjiangPalace(1), 8);
});

// ============================================================
// 四、太乙行九宫序列（每宫三年、不入中五）
// ============================================================

test('太乙行九宫：每宫三年，二十四年一週，不游中五', () => {
  // 取积数 1..24，太乙宫应依次为 1,1,1,2,2,2,3,3,3,4,4,4,6,6,6,7,7,7,8,8,8,9,9,9
  const expected = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9];
  const got = [];
  for (let i = 1; i <= 24; i++) got.push(taiyiPalaceOf(i).palace);
  assert.deepEqual(got, expected);
  // 入宫年数 1,2,3 循环
  for (let i = 1; i <= 24; i++) assert.equal(taiyiPalaceOf(i).ruGong, ((i - 1) % 3) + 1);
  // 治化：第一年治天、第二年治地、第三年治民
  assert.equal(taiyiPalaceOf(1).zhi, '治天');
  assert.equal(taiyiPalaceOf(2).zhi, '治地');
  assert.equal(taiyiPalaceOf(3).zhi, '治民');
  // 24 年后回到一宫
  assert.equal(taiyiPalaceOf(25).palace, 1);
  // 不游中五
  for (let i = 1; i <= 72; i++) assert.notEqual(taiyiPalaceOf(i).palace, 5, `积数 ${i} 不应入中五`);
});

// ============================================================
// 五、castTaiyi 全盘（年计）
// ============================================================

test('castTaiyi 年计（2026-10-25 21:30）：盘面字段与自洽性', () => {
  const c = castTaiyi({ date: BJ('2026-10-25T21:30:00+08:00'), mode: '年计', question: '测试' });
  assert.equal(c.ok, true);
  assert.equal(c.mode, '年计');
  assert.equal(c.question, '测试');
  // 历法时间对象透传
  assert.equal(c.time.ganzhi.day, '壬申');
  assert.equal(c.time.ganzhi.year, '丙午');
  // 局与积年
  assert.equal(c.ju.积年, 1938583);
  assert.equal(c.ju.局, 55);
  assert.equal(c.ju.太岁, '丙午');
  assert.equal(c.ju.太岁支, '午');
  // 太乙
  assert.ok(RUN_ORDER.includes(c.taiyi.palace));
  assert.equal(c.taiyi.palace, 3);
  assert.equal(c.taiyi.palaceInfo.gua, '艮');
  assert.equal(c.taiyi.ruGong, 1);
  assert.equal(c.taiyi.zhi, '治天');
  // 文昌 / 始击 / 计神 / 合神
  assert.equal(c.wenchang.god, '武德');
  assert.equal(c.wenchang.palace, null, '武德为间神');
  assert.equal(c.jishen.branch, '申');
  assert.equal(c.heshen.branch, '未', '丙午年太岁午，六合在未');
  assert.ok(SIXTEEN_GODS.some((g) => g.god === c.shiji.god));
  // 主客算与四将自洽
  assert.equal(c.zhusuan, 16);
  assert.equal(c.zhuda.palace, dajiangPalace(c.zhusuan));
  assert.equal(c.zhucan.palace, canjiangPalace(c.zhuda.palace));
  assert.equal(c.keda.palace, dajiangPalace(c.kesuan));
  assert.equal(c.kecan.palace, canjiangPalace(c.keda.palace));
  assert.equal(c.keda.palace, 1); // 客算 0 → 个位 0 作 1
  // 八将俱在
  for (const key of ['taiyi', 'wenchang', 'shiji', 'jishen', 'zhuda', 'zhucan', 'keda', 'kecan']) {
    assert.ok(c[key] != null, `缺八将之一：${key}`);
  }
  assert.equal(EIGHT_GENERALS.length, 8);
  // 九宫盘面
  assert.equal(c.palaces.length, 9);
  assert.equal(c.palaces[2].index, 3);
  assert.ok(c.palaces[2].occupiedBy.includes('太乙'), '第 3 宫应标太乙');
  assert.equal(c.palaces[2].gua, '艮');
  // 十六神落位
  assert.equal(c.sixteenGods.length, 16);
  const wcRow = c.sixteenGods.find((g) => g.god === '武德');
  assert.ok(wcRow.marks.includes('文昌'));
  // 四神太乙
  assert.ok(c.sishen.ji >= 1 && c.sishen.ji <= 5);
  assert.ok(c.sishen.position);
  // hints 只述盘面，meta 有待考
  assert.ok(Array.isArray(c.hints) && c.hints.length >= 5);
  assert.ok(c.hints.some((h) => h.includes('第 55 局')));
  assert.ok(Array.isArray(c.meta.pending) && c.meta.pending.length > 0, 'meta.pending 应列待考项');
  assert.ok(c.meta.source.verifiedAgainst.length >= 3, '应记录对盘来源');
  // 确定性
  const again = castTaiyi({ date: BJ('2026-10-25T21:30:00+08:00'), mode: '年计', question: '测试' });
  assert.deepEqual(again.ju, c.ju);
  assert.deepEqual(again.palaces, c.palaces);
  assert.deepEqual(again.zhusuan, c.zhusuan);
});

// ============================================================
// 六、castTaiyi 全盘（时计 / 月计 / 日计）
// ============================================================

test('castTaiyi 时计（2026-10-25 21:30）：阴遁、三时一移、自洽', () => {
  const c = castTaiyi({ date: BJ('2026-10-25T21:30:00+08:00'), mode: '时计' });
  assert.equal(c.mode, '时计');
  assert.equal(c.ju.遁, '阴遁', '霜降在夏至后、冬至前，属阴遁');
  assert.ok(c.ju.积数 > 0);
  assert.ok(RUN_ORDER.includes(c.taiyi.palace));
  assert.notEqual(c.taiyi.palace, 5);
  assert.ok(c.taiyi.order.includes('逆行'));
  // 自洽：算与将宫
  assert.equal(c.zhuda.palace, dajiangPalace(c.zhusuan));
  assert.equal(c.kecan.palace, canjiangPalace(c.keda.palace));
  // 八将俱全、九宫齐全
  assert.equal(c.palaces.length, 9);
  assert.equal(c.sixteenGods.length, 16);
  // 三时一移：相隔 6 个时辰（12 小时）应移 2 宫
  const c2 = castTaiyi({ date: BJ('2026-10-26T09:30:00+08:00'), mode: '时计' });
  const step1 = c.taiyi.step;
  const step2 = c2.taiyi.step;
  const delta = ((step2 - step1) % 8 + 8) % 8;
  assert.equal(delta, 2, `相隔 6 时辰应移 2 宫（实测 ${delta}）`);
});

test('时计：二至定遁（夏至、冬至前后切换）', () => {
  const a = castTaiyi({ date: BJ('2026-06-20T12:00:00+08:00'), mode: '时计' });
  const b = castTaiyi({ date: BJ('2026-06-25T12:00:00+08:00'), mode: '时计' });
  assert.equal(a.ju.遁, '阳遁', '夏至（2026-06-21）前属阳遁');
  assert.equal(b.ju.遁, '阴遁', '夏至后属阴遁');
  const c = castTaiyi({ date: BJ('2026-12-20T12:00:00+08:00'), mode: '时计' });
  const d = castTaiyi({ date: BJ('2026-12-25T12:00:00+08:00'), mode: '时计' });
  assert.equal(c.ju.遁, '阴遁', '冬至（2026-12-22）前属阴遁');
  assert.equal(d.ju.遁, '阳遁', '冬至后属阳遁');
  // latestSolstice / shichenFromSolstice 边界
  const sol = latestSolstice(BJ('2026-06-25T12:00:00+08:00'));
  assert.equal(sol.name, '夏至');
  const sc = shichenFromSolstice(BJ('2026-06-25T12:00:00+08:00'));
  assert.equal(sc.dun, '阴遁');
  assert.ok(sc.n >= 0 && sc.n < 60, `距夏至约 4 日，应数十个时辰内（实得 ${sc.n}）`);
});

test('castTaiyi 月计 / 日计：字段齐全与自洽', () => {
  for (const mode of ['月计', '日计']) {
    const c = castTaiyi({ date: BJ('2026-10-25T21:30:00+08:00'), mode });
    assert.equal(c.mode, mode);
    assert.ok(c.ju.局 >= 1 && c.ju.局 <= 72);
    assert.ok(c.ju.积数 > 0);
    assert.ok(RUN_ORDER.includes(c.taiyi.palace));
    assert.equal(c.zhuda.palace, dajiangPalace(c.zhusuan));
    assert.equal(c.kecan.palace, canjiangPalace(c.keda.palace));
    assert.equal(c.palaces.length, 9);
    assert.equal(c.sixteenGods.length, 16);
    assert.ok(c.meta.pending.length > 0);
    assert.ok(c.hints.length >= 5);
  }
});

// ============================================================
// 七、四神太乙与边界
// ============================================================

test('四神太乙：积年 mod 180 定纪，五纪、十二宫位', () => {
  assert.equal(SISHEN_POSITIONS.length, 12);
  assert.deepEqual(SISHEN_POSITIONS.slice(9).map((p) => p.name), ['绛宫', '明堂', '玉堂']);
  // 积年 1：第一纪第 1 年 → 一宫
  assert.deepEqual(
    { ji: sishenOf(1).ji, ruJi: sishenOf(1).ruJi, position: sishenOf(1).position },
    { ji: 1, ruJi: 1, position: '一宫' },
  );
  // 积年 36：第一纪第 36 年 → 第十二位（玉堂）
  assert.equal(sishenOf(36).ji, 1);
  assert.equal(sishenOf(36).ruJi, 36);
  assert.equal(sishenOf(36).position, '玉堂');
  // 积年 37：第二纪第 1 年 → 一宫
  assert.equal(sishenOf(37).ji, 2);
  assert.equal(sishenOf(37).position, '一宫');
  // 积年 180 → 第五纪第 36 年（余 0 作 180）
  assert.equal(sishenOf(180).ji, 5);
  assert.equal(sishenOf(180).ruJi, 36);
});

test('边界与错误处理', () => {
  assert.throws(() => castTaiyi({ mode: '年计计' }), /太乙计式/);
  assert.throws(() => castTaiyi({ date: 'not-a-date' }), /无效的时间/);
  // 缺省 mode 为时计、缺省时间为当前
  const c = castTaiyi({ date: BJ('2026-10-25T21:30:00+08:00') });
  assert.equal(c.mode, '时计');
  // 全盘所有结构存在
  for (const key of ['ju', 'taiyi', 'wenchang', 'shiji', 'jishen', 'heshen',
    'zhuda', 'zhucan', 'keda', 'kecan', 'sishen', 'sixteenGods', 'palaces', 'hints', 'meta', 'time']) {
    assert.ok(c[key] !== undefined, `缺字段 ${key}`);
  }
  // 主/客算为整数且非负
  assert.ok(Number.isInteger(c.zhusuan) && c.zhusuan >= 0);
  assert.ok(Number.isInteger(c.kesuan) && c.kesuan >= 0);
});
