/**
 * engine-qimen.test.mjs —— 时家奇门遁甲排盘测试（转盘；定局法默认拆补、可传置闰）
 *
 * 运行：在 dsh-guashi-agent 目录下 `node test/engine-qimen.test.mjs`（node:test，零依赖）
 *
 * ── 流派结论 ────────────────────────────────────────────────
 * 时家奇门主流组合 = 「转盘 + 拆补法」。依据：
 *  - 现代排盘工具默认拆补：qimen-rs（https://github.com/SpenserCai/qimen-rs，
 *    docs/algorithm-sources.md「默认计算口径为：时家、拆补、转盘」）；mingpan
 *    （https://github.com/ChesterRa/mingpan，QimenService 默认 zhiRunMethod:'chaibu'）；
 *    qfdk/qimen（https://github.com/qfdk/qimen，以「当前节气 + 符头定元」定局）；
 *    Taogram/taobi（https://github.com/Taogram/taobi，置闰法「不支持，也不推荐」）；
 *    arc119226/qimen_dunjia（https://github.com/arc119226/qimen_dunjia，「預設拆補」）。
 *  - 古籍《奇门宝鉴御定》记李氏拆补派与超接置闰派之争；拆补规则简明、不依赖跨年置闰累积，
 *    为现代通行默认。故本引擎 `juMethod` 默认 '拆补'，置闰法作可选古法实现。
 *
 * ── 对盘来源 ────────────────────────────────────────────────
 * 1) 金样本 2024-06-21 10:00（夏至当日·阴遁三局中元）：
 *    来源：开源排盘工具 mingpan（MCP 排盘服务，https://github.com/ChesterRa/mingpan）
 *          测试 test/qimen.test.ts「金樣本：2024-06-21 10:00 夏至當日 陰遁三局中元（手工逐項推演）」，
 *          该盘依张志春《神奇之门》转盘式规则逐项手工推演，并与 kentang2017/kinqimen 交叉核对。
 *    本引擎在该时间点上与上述金样本完全一致（九宫地盘/天盘/九星/八门/八神/值符/值使/局数）。
 * 2) 2026-06-05 16:52（拆补法：小满上元·阳遁五局·伏吟盘）：
 *    来源：开源排盘工具 kentang2017/kinqimen（https://github.com/kentang2017/kinqimen，
 *          拆补法排盘，PyPI kinqimen）实跑输出；本引擎逐宫核对一致（拆补法局数 5）。
 *    同一时刻置闰法为芒种上元·阳遁六局（超神 1 日），值符天任落艮八、值使生门落艮八、星门伏吟，
 *    与 qfdk/qimen test/paipan.test.js 对 2026-06-05 的权威基准描述（置闰法）逐项一致。
 * 3) 五张 2026 年权威基准盘（局数/值符星/值符落宫/值使门/值使落宫）：
 *    来源：qfdk/qimen test/paipan.test.js 注释「五张权威 App 基准盘（2026 各节气，午时 12:00，置闰法）
 *          校验：局数/阴阳遁 + 值符星 + 值符落宫 + 值使门 + 值使落宫(中5寄坤2)」。
 *          该五盘按置闰法生成：本引擎**置闰法**五项逐项一致；拆补法在这五日恰与置闰同局，亦一致。
 * 4) 三元局数表：《烟波钓叟歌》通行歌诀（冬至惊蛰一七四、小暑八二五……），见 JU_TABLE 注释。
 * 5) 拆补法定元：符头甲己日、四仲（子午卯酉）上元/四孟（寅申巳亥）中元/四季（辰戌丑未）下元，
 *    与《奇门遁甲》教材通说及 kinqimen config.findyuen_dict 一致。
 * 6) 置闰法（超神接气置闰）：
 *    古籍：《遁甲演义·超神接气置闰诀》（「超神不过十日，遇芒种大雪超过九日，即置闰也」
 *          「要知置闰在何时？端在芒种与大雪」）；《奇门遁甲统宗·置闰法》康熙五十六—五十八年
 *          十个算例（本测试逐点核对）；《奇门宝鉴御定》「遇芒种大雪，重用本气三元」。
 *    算法参照（MIT）：arc119226/qimen_dunjia（calculations.js 符头链）、
 *          perfhelf/bigfishmarquis-qimen（src/engines/zhirun.ts）。
 *    外部锚点：《统宗》「直至康熙五十八年六月二十三日立秋，而甲子符头恰当日，是为正授，
 *          本日即是阴遁二局」→ 1719-08-08 断言立秋上元、正授、日差 0、阴遁二局、上元符头甲子。
 *    不变量：1800–2100 置闰 105 次（每 2.86 年一闰，理论值 2.86），只落在芒种/大雪，
 *          不跳节气，接气极值不低于 −9 日。
 *
 * ── 已知口径差异（非错误，已在 hints 说明）──────────────────
 * - 中五宫：本引擎按「中宫不参与转盘」给天盘干 = 地盘中宫干；部分工具（如 mingpan）把中宫天盘干
 *   显示为坤二宫天盘干。九星天禽按转盘常例寄坤二、与天芮同宫，中宫星位给「天禽」。
 * - 八神：SPEC §2.6 指定固定用「值符/螣蛇/太阴/六合/白虎/玄武/九地/九天」；部分流派阳遁以勾陈、
 *   朱雀代白虎、玄武，本引擎不采用。
 * - 旬首六仪落中五宫时（值符天禽寄坤二），值使门「加时」自坤二宫起算（与 qfdk/qimen、
 *   mingpan 一致）；kinqimen 自中五宫起算，属流派差异。
 * - 马星本测试按「时支三合马」标注（时家奇门通例；日支马见 hints 说明）。
 * - 置闰法为日粒度：交节在当日深夜的「时粒度叠局」情形，古籍有一日之内超/接之分，
 *   本引擎按历日统一归元（与 arc119226/qimen_dunjia 的已知从缺一致）。
 *
 * ── 扩展（task-19）────────────────────────────────────────
 * 在「时家 + 转盘 + 拆补/置闰」之外新增：飞盘、括囊（盘式）；暗干其余四法；穿壬四层；
 * 茅山/阴盘/分家阳盘/刻家阴盘（起局）；年家/月家/日家/太乙日家/山向/罗盘/套玄空（多局）；
 * 命运局（原命局+10 步大运局）。扩展项均为实验性，规则依据 docs/REF-CONGZHEN-QIMEN.md 的
 * 反编译结构说明与知识库 08-奇门遁甲，按公开法理独立重写；未与权威排盘逐项校核，
 * 因此扩展示例只断言「结构自洽 + 实验标记 + 不静默冒充」，不断言与某工具逐项一致。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  castQimen,
  diPanLayout,
  futouOfDay,
  juForTerm,
  JU_TABLE,
  PALACE_INFO,
  zhirunJuFor,
  zhirunChainForRange,
  normalizeJuMethod,
  normalizePanMethod,
  normalizeJuType,
  castQimenMingYun,
  castNianJia,
  castYueJia,
  castRiJia,
  castTaiYiRiJia,
  castShanXiang,
  castLuoPan,
  castTaoXuanKong,
  QIMEN_CAPABILITIES,
  AN_GAN_MODES,
  PALACE_BRANCHES,
  ZHIRUN_YUAN_FUTOU,
} from '../lib/engine/qimen.js';
import { getAlmanac } from '../lib/engine/almanac.js';

/** 北京时间字面量 → Date */
const bj = (s) => new Date(s + '+08:00');

/** 从盘面取指定字段的「宫号 → 值」映射 */
function field(chart, key) {
  const out = {};
  for (const p of chart.palaces) out[p.index] = p[key];
  return out;
}
const RING = [1, 8, 3, 4, 9, 2, 7, 6];

const GAN_SEQ = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];
const STAR_SET = new Set(['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英']);
const DOOR_SET = new Set(['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门']);
const SHEN_SET = new Set(['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天']);

// ============================================================
// 一、三元局数表与地盘（静态规则）
// ============================================================

test('三元局数表：二十四节气俱全，古歌诀数值正确', () => {
  assert.equal(Object.keys(JU_TABLE).length, 24);
  // 《烟波钓叟歌》：「冬至惊蛰一七四，小寒二八五相随，大寒春分三九六，芒种六三九便回，
  //  谷雨小满五二八，立春八五二相宜，雨水九六三为是；夏至白露九三六，小暑八二五之间，
  //  大暑秋分七一四，立秋二五八相牵，处暑一四七为是，霜降小雪五八二，寒露立冬六九三，
  //  清明立夏四一七，大雪四七一。」
  const expect = {
    冬至: ['阳遁', 1, 7, 4], 惊蛰: ['阳遁', 1, 7, 4],
    小寒: ['阳遁', 2, 8, 5], 大寒: ['阳遁', 3, 9, 6], 春分: ['阳遁', 3, 9, 6],
    立春: ['阳遁', 8, 5, 2], 雨水: ['阳遁', 9, 6, 3],
    清明: ['阳遁', 4, 1, 7], 立夏: ['阳遁', 4, 1, 7],
    谷雨: ['阳遁', 5, 2, 8], 小满: ['阳遁', 5, 2, 8], 芒种: ['阳遁', 6, 3, 9],
    夏至: ['阴遁', 9, 3, 6], 白露: ['阴遁', 9, 3, 6],
    小暑: ['阴遁', 8, 2, 5], 大暑: ['阴遁', 7, 1, 4], 秋分: ['阴遁', 7, 1, 4],
    立秋: ['阴遁', 2, 5, 8], 处暑: ['阴遁', 1, 4, 7],
    寒露: ['阴遁', 6, 9, 3], 立冬: ['阴遁', 6, 9, 3],
    霜降: ['阴遁', 5, 8, 2], 小雪: ['阴遁', 5, 8, 2], 大雪: ['阴遁', 4, 7, 1],
  };
  for (const [term, [dun, ...ju]] of Object.entries(expect)) {
    assert.equal(JU_TABLE[term].dun, dun, term);
    assert.deepEqual(JU_TABLE[term].ju, ju, term);
  }
  assert.deepEqual(juForTerm('霜降', '中元'), { dun: '阴遁', number: 8 });
  assert.throws(() => juForTerm('不存在', '上元'), /未知节气/);
});

test('地盘三奇六仪：阳遁一局/三局/六局、阴遁九局/三局（与教材及对盘工具一致）', () => {
  // 阳遁一局：戊坎1己坤2庚震3辛巽4壬中5癸乾6丁兑7丙艮8乙离9
  assert.deepEqual(diPanLayout('阳遁', 1), {
    1: '戊', 2: '己', 3: '庚', 4: '辛', 5: '壬', 6: '癸', 7: '丁', 8: '丙', 9: '乙',
  });
  // 阳遁三局（自震3顺布）
  assert.deepEqual(diPanLayout('阳遁', 3), {
    3: '戊', 4: '己', 5: '庚', 6: '辛', 7: '壬', 8: '癸', 9: '丁', 1: '丙', 2: '乙',
  });
  // 阳遁六局（qfdk/qimen test：6戊 7己 8庚 9辛 1壬 2癸 3丁 4丙 5乙）
  assert.deepEqual(diPanLayout('阳遁', 6), {
    6: '戊', 7: '己', 8: '庚', 9: '辛', 1: '壬', 2: '癸', 3: '丁', 4: '丙', 5: '乙',
  });
  // 阴遁九局：戊离9己艮8庚兑7辛乾6壬中5癸巽4丁震3丙坤2乙坎1
  assert.deepEqual(diPanLayout('阴遁', 9), {
    9: '戊', 8: '己', 7: '庚', 6: '辛', 5: '壬', 4: '癸', 3: '丁', 2: '丙', 1: '乙',
  });
  // 阴遁三局（2024-06-21 金样本地盘）
  assert.deepEqual(diPanLayout('阴遁', 3), {
    3: '戊', 2: '己', 1: '庚', 9: '辛', 8: '壬', 7: '癸', 6: '丁', 5: '丙', 4: '乙',
  });
  // 任意局：九宫九干各居其一
  for (const dun of ['阳遁', '阴遁']) {
    for (let ju = 1; ju <= 9; ju += 1) {
      const map = diPanLayout(dun, ju);
      assert.deepEqual(Object.values(map).sort(), [...GAN_SEQ].sort(), `${dun}${ju}局`);
    }
  }
});

test('拆补法符头定元：甲己日为符头，四仲上元/四孟中元/四季下元', () => {
  // 与 mingpan test「六十甲子逐日三元应按五日符头循环」及 kinqimen 定元表一致
  const futouYuan = {
    甲子: '上元', 己巳: '中元', 甲戌: '下元', 己卯: '上元', 甲申: '中元', 己丑: '下元',
    甲午: '上元', 己亥: '中元', 甲辰: '下元', 己酉: '上元', 甲寅: '中元', 己未: '下元',
  };
  for (const [futou, yuan] of Object.entries(futouYuan)) {
    assert.equal(futouOfDay(futou).futou, futou, `${futou} 当日即符头`);
    assert.equal(futouOfDay(futou).yuan, yuan, futou);
  }
  // 非符头日：逆推最近甲/己日
  assert.deepEqual(futouOfDay('丙辰'), { futou: '甲寅', branch: '寅', yuan: '中元' });
  assert.deepEqual(futouOfDay('庚戌'), { futou: '己酉', branch: '酉', yuan: '上元' });
  assert.deepEqual(futouOfDay('癸巳'), { futou: '己丑', branch: '丑', yuan: '下元' });
  // 五日一循环：同组内三元相同
  assert.equal(futouOfDay('甲子').yuan, futouOfDay('戊辰').yuan);
  assert.notEqual(futouOfDay('戊辰').yuan, futouOfDay('己巳').yuan);
});

// ============================================================
// 二、金样本：2024-06-21 10:00（夏至·阴遁三局中元）
// ============================================================

/** 金样本期望盘面（来源见文件头 1) mingpan test/qimen.test.ts + 张志春《神奇之门》） */
const GOLD_2024 = {
  dayGanzhi: '丙辰',
  hourGanzhi: '癸巳',
  solarTerm: '夏至',
  ju: { yinYang: '阴遁', number: 3, yuan: '中元', futou: '甲寅' },
  zhiFu: { star: '天蓬', palace: 7, gan: '庚' },
  zhiShi: { door: '休门', palace: 1 },
  xunShou: { ganzhi: '甲申', yi: '庚', palace: 1 },
  kongWang: ['午', '未'],
  maXing: '亥',
  diPan: { 1: '庚', 2: '己', 3: '戊', 4: '乙', 5: '丙', 6: '丁', 7: '癸', 8: '壬', 9: '辛' },
  // 中五宫：本引擎按「中宫不参与转盘」取地盘干（mingpan 金样本作坤二天盘干「丁」，口径差异见文件头）
  tianPan: { 1: '戊', 2: '丁', 3: '辛', 4: '己', 5: '丙', 6: '壬', 7: '庚', 8: '乙', 9: '癸' },
  star: { 1: '天冲', 2: '天心', 3: '天英', 4: '天芮', 5: '天禽', 6: '天任', 7: '天蓬', 8: '天辅', 9: '天柱' },
  door: { 1: '休门', 2: '死门', 3: '伤门', 4: '杜门', 5: '', 6: '开门', 7: '惊门', 8: '生门', 9: '景门' },
  shen: { 1: '九地', 2: '螣蛇', 3: '白虎', 4: '六合', 5: '', 6: '九天', 7: '值符', 8: '玄武', 9: '太阴' },
};

test('金样本 2024-06-21 10:00：夏至阴遁三局中元，全盘逐宫核对', () => {
  const q = castQimen({ date: bj('2024-06-21T10:00') });
  assert.equal(q.meta.dayGanzhi, GOLD_2024.dayGanzhi);
  assert.equal(q.meta.hourGanzhi, GOLD_2024.hourGanzhi);
  assert.equal(q.ju.solarTerm, GOLD_2024.solarTerm);
  assert.equal(q.ju.yinYang, GOLD_2024.ju.yinYang);
  assert.equal(q.ju.number, GOLD_2024.ju.number);
  assert.equal(q.ju.yuan, GOLD_2024.ju.yuan);
  assert.equal(q.ju.futou, GOLD_2024.ju.futou);
  assert.equal(q.ju.method, '拆补法');
  // 值符：甲申旬首庚临地盘坎一 → 天蓬；时干癸临兑七 → 值符落兑七
  assert.equal(q.zhiFu.star, GOLD_2024.zhiFu.star);
  assert.equal(q.zhiFu.palace, GOLD_2024.zhiFu.palace);
  assert.equal(q.zhiFu.gan, GOLD_2024.zhiFu.gan); // 值符所携天盘干 = 旬首六仪庚
  // 值使：癸巳旬内序 9，阴遁自坎一逆数九宫 → 落坎一
  assert.equal(q.zhiShi.door, GOLD_2024.zhiShi.door);
  assert.equal(q.zhiShi.palace, GOLD_2024.zhiShi.palace);
  assert.deepEqual(q.xunShou, { ganzhi: '甲申', yi: '庚', palace: 1 });
  // 旬空（时柱癸巳属甲申旬，空午未）、驿马（巳酉丑马在亥）
  assert.deepEqual(q.kongWang, GOLD_2024.kongWang);
  assert.equal(q.maXing, GOLD_2024.maXing);
  // 九宫盘面
  assert.deepEqual(field(q, 'diPanGan'), GOLD_2024.diPan, '地盘');
  assert.deepEqual(field(q, 'tianPanGan'), GOLD_2024.tianPan, '天盘');
  assert.deepEqual(field(q, 'star'), GOLD_2024.star, '九星');
  assert.deepEqual(field(q, 'door'), GOLD_2024.door, '八门');
  assert.deepEqual(field(q, 'shen'), GOLD_2024.shen, '八神');
});

// ============================================================
// 三、拆补法伏吟盘：2026-06-05 16:52（小满上元·阳遁五局）
// ============================================================

test('2026-06-05 16:52：小满上元阳遁五局，甲申时伏吟盘（对盘 kinqimen 拆补法）', () => {
  const q = castQimen({ date: bj('2026-06-05T16:52') });
  assert.equal(q.meta.dayGanzhi, '庚戌');
  assert.equal(q.meta.hourGanzhi, '甲申');
  assert.equal(q.ju.solarTerm, '小满');
  assert.equal(q.ju.yuan, '上元');
  assert.equal(q.ju.futou, '己酉');
  assert.equal(q.ju.yinYang, '阳遁');
  assert.equal(q.ju.number, 5);
  assert.deepEqual(q.xunShou, { ganzhi: '甲申', yi: '庚', palace: 7 });
  assert.equal(q.zhiFu.star, '天柱');
  assert.equal(q.zhiFu.palace, 7);
  assert.equal(q.zhiShi.door, '惊门');
  assert.equal(q.zhiShi.palace, 7);
  // 甲申时：时干甲隐于旬首庚，值符值使皆归本宫 → 天地盘重合、星门伏吟
  assert.deepEqual(field(q, 'diPanGan'), {
    1: '癸', 2: '丁', 3: '丙', 4: '乙', 5: '戊', 6: '己', 7: '庚', 8: '辛', 9: '壬',
  });
  assert.deepEqual(field(q, 'tianPanGan'), field(q, 'diPanGan'));
  assert.deepEqual(field(q, 'star'), {
    1: '天蓬', 2: '天芮', 3: '天冲', 4: '天辅', 5: '天禽', 6: '天心', 7: '天柱', 8: '天任', 9: '天英',
  });
  assert.deepEqual(field(q, 'door'), {
    1: '休门', 2: '死门', 3: '伤门', 4: '杜门', 5: '', 6: '开门', 7: '惊门', 8: '生门', 9: '景门',
  });
  // 八神：值符起艮八，阳遁顺时针：8符 3蛇 4阴 9合 2虎 7玄 6地 1天
  assert.deepEqual(field(q, 'shen'), {
    1: '太阴', 2: '九天', 3: '白虎', 4: '玄武', 5: '', 6: '螣蛇', 7: '值符', 8: '六合', 9: '九地',
  });
  assert.deepEqual(q.kongWang, ['午', '未']);
  assert.equal(q.maXing, '寅');
});

// ============================================================
// 四、五张 2026 年权威基准盘（来源 qfdk/qimen test/paipan.test.js BENCH）
// ============================================================

const QFDK_BENCH = [
  { date: '2026-03-21T12:00', dun: '阳遁', ju: 3, star: '天冲', starPalace: 2, door: '伤门', doorPalace: 9 },
  { date: '2026-06-09T12:00', dun: '阳遁', ju: 3, star: '天冲', starPalace: 2, door: '伤门', doorPalace: 9 },
  { date: '2026-07-15T12:00', dun: '阴遁', ju: 5, star: '天辅', starPalace: 1, door: '杜门', doorPalace: 2 },
  { date: '2026-09-23T12:00', dun: '阴遁', ju: 1, star: '天英', starPalace: 6, door: '景门', doorPalace: 1 },
  { date: '2026-12-08T12:00', dun: '阴遁', ju: 7, star: '天辅', starPalace: 4, door: '杜门', doorPalace: 4 },
];

for (const b of QFDK_BENCH) {
  test(`权威基准盘 ${b.date.slice(0, 10)}：局数/值符值使（qfdk/qimen BENCH，置闰法；拆补同局）`, () => {
    // qfdk 该五盘按置闰法生成；本引擎置闰法五项逐项一致，拆补法在这五日恰与置闰同局
    for (const juMethod of ['置闰', '拆补']) {
      const q = castQimen({ date: bj(b.date), juMethod });
      const label = `${b.date.slice(0, 10)} ${juMethod}`;
      assert.equal(q.ju.yinYang, b.dun, label);
      assert.equal(q.ju.number, b.ju, label);
      assert.equal(q.zhiFu.star, b.star, label);
      assert.equal(q.zhiFu.palace, b.starPalace, label);
      assert.equal(q.zhiShi.door, b.door, label);
      assert.equal(q.zhiShi.palace, b.doorPalace, label);
      // 落宫即中五宫时，本引擎已按转盘常例寄坤二
      assert.notEqual(q.zhiFu.palace, 5);
      assert.notEqual(q.zhiShi.palace, 5);
    }
  });
}

// ============================================================
// 五、定局法：拆补（默认，主流）/ 置闰（古法可选）
// ============================================================

test('定局法参数：默认拆补（主流），可传 juMethod:\'置闰\'；别名与非法值处理', () => {
  const d = bj('2026-06-05T16:52');
  const def = castQimen({ date: d });
  assert.equal(def.ju.method, '拆补法');
  assert.equal(def.ju.juMethod, '拆补');
  assert.equal(def.meta.juMethod, '拆补');
  assert.equal(def.ju.number, 5);
  assert.ok(def.hints[0].includes("juMethod:'置闰'"), '拆补 hints 说明可传置闰');

  const zr = castQimen({ date: d, juMethod: '置闰' });
  assert.equal(zr.ju.method, '置闰法');
  assert.equal(zr.ju.juMethod, '置闰');
  assert.equal(zr.ju.number, 6);
  assert.equal(zr.meta.juMethod, '置闰');
  assert.ok(zr.hints[0].includes('置闰法'), '置闰 hints 标明定局法');

  // 别名兼容（工具层透传）
  for (const alias of ['拆补', '拆補', '拆补法', 'chaibu', 'chaiBu']) {
    assert.equal(castQimen({ date: d, juMethod: alias }).ju.juMethod, '拆补', alias);
  }
  for (const alias of ['置闰', '置閏', '置闰法', '置润', 'zhirun', 'zhiRun', '符头']) {
    assert.equal(castQimen({ date: d, juMethod: alias }).ju.juMethod, '置闰', alias);
  }
  assert.equal(normalizeJuMethod(), '拆补');
  assert.equal(normalizeJuMethod('zhirun'), '置闰');
  assert.throws(() => normalizeJuMethod('飞盘'), /未知定局法/);
  assert.throws(() => castQimen({ date: d, juMethod: '飞盘' }), /未知定局法/);
});

test('拆补与置闰的差异窗口：2026-06-05 小满/阳五局 vs 芒种/阳六局；2026-12-05 小雪/阴五局 vs 大雪/阴四局', () => {
  // 超神时段：符头已到、节气未到。拆补仍按当前节气，置闰按符头链所统节气。
  const a = bj('2026-06-05T16:52');
  const aChai = castQimen({ date: a });
  const aZhi = castQimen({ date: a, juMethod: '置闰' });
  assert.deepEqual([aChai.ju.solarTerm, aChai.ju.yinYang, aChai.ju.number, aChai.ju.yuan], ['小满', '阳遁', 5, '上元']);
  assert.deepEqual([aZhi.ju.solarTerm, aZhi.ju.yinYang, aZhi.ju.number, aZhi.ju.yuan], ['芒种', '阳遁', 6, '上元']);
  assert.equal(aZhi.ju.chaoJie, '超神');
  assert.equal(aZhi.ju.chaoJieDays, 1);
  assert.equal(aZhi.ju.leap, false);
  assert.equal(aZhi.ju.shangYuanFuTou, '己酉');
  assert.equal(aZhi.ju.actualSolarTerm, '小满');

  // 年底大雪超神 6 日：拆补作小雪阴五局，置闰作大雪阴四局
  const b = bj('2026-12-05T12:00');
  const bChai = castQimen({ date: b });
  const bZhi = castQimen({ date: b, juMethod: '置闰' });
  assert.equal(bChai.ju.solarTerm, '小雪');
  assert.equal(bZhi.ju.solarTerm, '大雪');
  assert.equal(bZhi.ju.chaoJie, '超神');
  assert.equal(bZhi.ju.chaoJieDays, 6);
  assert.deepEqual([bZhi.ju.yinYang, bZhi.ju.number], ['阴遁', 4]);
});

test('置闰法金样本 2026-06-05 16:52：芒种上元阳遁六局、值符天任艮八、值使生门艮八、伏吟（qfdk BENCH 置闰法）', () => {
  const q = castQimen({ date: bj('2026-06-05T16:52'), juMethod: '置闰' });
  assert.equal(q.meta.dayGanzhi, '庚戌');
  assert.equal(q.meta.hourGanzhi, '甲申');
  assert.equal(q.ju.solarTerm, '芒种');
  assert.equal(q.ju.yuan, '上元');
  assert.equal(q.ju.yinYang, '阳遁');
  assert.equal(q.ju.number, 6);
  assert.equal(q.ju.chaoJie, '超神');
  assert.equal(q.ju.chaoJieDays, 1);
  assert.equal(q.ju.leap, false);
  // qfdk/qimen 对同一时刻的置闰法权威基准：值符甲申庚、天任落艮八；值使生门落艮八；九星八门伏吟
  assert.equal(q.zhiFu.star, '天任');
  assert.equal(q.zhiFu.palace, 8);
  assert.equal(q.zhiFu.gan, '庚');
  assert.equal(q.zhiShi.door, '生门');
  assert.equal(q.zhiShi.palace, 8);
  assert.deepEqual(field(q, 'diPanGan'), {
    1: '壬', 2: '癸', 3: '丁', 4: '丙', 5: '乙', 6: '戊', 7: '己', 8: '庚', 9: '辛',
  });
  assert.deepEqual(field(q, 'tianPanGan'), field(q, 'diPanGan'), '甲申时伏吟：天盘=地盘');
  assert.deepEqual(field(q, 'star'), {
    1: '天蓬', 2: '天芮', 3: '天冲', 4: '天辅', 5: '天禽', 6: '天心', 7: '天柱', 8: '天任', 9: '天英',
  });
  assert.deepEqual(field(q, 'door'), {
    1: '休门', 2: '死门', 3: '伤门', 4: '杜门', 5: '', 6: '开门', 7: '惊门', 8: '生门', 9: '景门',
  });
  assert.deepEqual(field(q, 'shen'), {
    1: '九天', 2: '白虎', 3: '螣蛇', 4: '太阴', 5: '', 6: '九地', 7: '玄武', 8: '值符', 9: '六合',
  });
  assert.deepEqual(q.kongWang, ['午', '未']);
  assert.equal(q.maXing, '寅');
});

/** 《奇门遁甲统宗·置闰法》康熙五十六—五十八年十检核点（原文见 test 头注释 6)） */
const TONGZONG_LEAP_CASES = [
  { ymd: [1718, 5, 30], term: '芒种', yuan: '上元', note: '五月初一己酉，芒种上局' },
  { ymd: [1718, 6, 4], term: '芒种', yuan: '中元' },
  { ymd: [1718, 6, 9], term: '芒种', yuan: '下元' },
  { ymd: [1718, 6, 14], term: '芒种', yuan: '上元', leap: true, note: '十六日甲子，芒种闰奇上局' },
  { ymd: [1718, 6, 19], term: '芒种', yuan: '中元', leap: true },
  { ymd: [1718, 6, 24], term: '芒种', yuan: '下元', leap: true },
  { ymd: [1718, 6, 29], term: '夏至', yuan: '上元', note: '六月初二己卯，夏至上局（接气）' },
  { ymd: [1718, 7, 4], term: '夏至', yuan: '中元' },
  { ymd: [1719, 8, 8], term: '立秋', yuan: '上元', chaoJie: '正授', dun: '阴遁', ju: 2, note: '甲子符头正授，本日阴遁二局' },
  { ymd: [1719, 8, 24], term: '处暑', yuan: '上元', note: '七月初九庚辰处暑，超一日' },
];

test('置闰法《统宗》康熙五十六—五十八年十检核点：节气/三元/闰局/超接/阴阳局数逐点核对', () => {
  for (const c of TONGZONG_LEAP_CASES) {
    const date = new Date(Date.UTC(c.ymd[0], c.ymd[1] - 1, c.ymd[2], 4, 0, 0)); // 北京时间 12:00
    const r = zhirunJuFor(date);
    const label = c.ymd.join('-') + (c.note ? `（${c.note}）` : '');
    assert.equal(r.term, c.term, label + ' 节气');
    assert.equal(r.yuan, c.yuan, label + ' 三元');
    if (c.leap !== undefined) assert.equal(r.leap, c.leap, label + ' 闰局');
    if (c.chaoJie !== undefined) assert.equal(r.chaoJie, c.chaoJie, label + ' 超接');
    if (c.dun !== undefined) assert.equal(r.dun, c.dun, label + ' 阴阳遁');
    if (c.ju !== undefined) assert.equal(r.number, c.ju, label + ' 局数');
  }
});

test('置闰法外部锚点：《统宗》康熙五十八年立秋甲子符头正授（1719-08-08）', () => {
  const r = zhirunJuFor(new Date(Date.UTC(1719, 7, 8, 4, 0, 0)));
  assert.equal(r.term, '立秋');
  assert.equal(r.chaoJie, '正授');
  assert.equal(r.gap, 0);
  assert.equal(r.shangYuanFuTou, '甲子');
  assert.equal(r.yuan, '上元');
  assert.equal(r.dun, '阴遁');
  assert.equal(r.number, 2); // 《统宗》：「本日即是阴遁二局」
});

test('置闰法符头链不变量（1800–2100）：只置闰于芒种/大雪、不跳节气、频率约 2.86 年、接气不低 −9 日', () => {
  const chain = zhirunChainForRange(1800, 2100);
  assert.ok(chain.length > 7000, `链长应 > 7000，实得 ${chain.length}`);
  let leaps = 0;
  let skipped = 0;
  const leapTerms = new Set();
  const gaps = [];
  for (let i = 0; i < chain.length; i += 1) {
    const c = chain[i];
    gaps.push(c.gap);
    if (i > 0) {
      // 符头日严格每 15 日一见
      assert.equal(c.day - chain[i - 1].day, 15, `第 ${i} 个循环与前一循环应相隔 15 日`);
      const prev = chain[i - 1];
      if (c.index === prev.index) {
        // 同一节气连续两循环 = 置闰（重用本气三元），必为芒种/大雪
        assert.equal(c.leap, true);
        assert.ok(['芒种', '大雪'].includes(c.term), `置闰只应在芒种/大雪，实得 ${c.term}`);
      } else {
        assert.equal(c.leap, false);
        if (c.index !== prev.index + 1) skipped += 1;
      }
    }
    if (c.leap) {
      leaps += 1;
      leapTerms.add(c.term);
    }
  }
  assert.equal(skipped, 0, '不得跳过节气');
  assert.deepEqual([...leapTerms].sort(), ['大雪', '芒种'].sort(), '置闰节气集合');
  const yearsPerLeap = (2100 - 1800) / leaps;
  assert.ok(yearsPerLeap > 2.75 && yearsPerLeap < 3.0, `置闰频率应近 2.86 年，实得每 ${yearsPerLeap.toFixed(2)} 年`);
  assert.ok(Math.min(...gaps) >= -9, `接气极值不应低于 −9 日，实得 ${Math.min(...gaps)}`);
  // 上元符头只四日
  assert.deepEqual(ZHIRUN_YUAN_FUTOU, ['甲子', '己卯', '甲午', '己酉']);
});

test('置闰法盘面自洽：24 个时间点（值符值使落宫、排列、旬空驿马一致）', () => {
  const times = [];
  for (let m = 0; m < 12; m += 1) {
    for (const hh of ['02:30', '11:30', '20:30']) {
      times.push(`2026-${String(m + 1).padStart(2, '0')}-14T${hh}`);
    }
  }
  for (const t of times) {
    const q = castQimen({ date: bj(t), juMethod: '置闰' });
    assert.equal(q.ju.juMethod, '置闰', t);
    assert.equal(Object.values(field(q, 'diPanGan')).sort().join(''), [...GAN_SEQ].sort().join(''), t);
    assert.equal(Object.values(field(q, 'tianPanGan')).sort().join(''), [...GAN_SEQ].sort().join(''), t);
    assert.equal(new Set(RING.map((i) => q.palaces[i - 1].door)).size, 8, t);
    assert.equal(new Set(RING.map((i) => q.palaces[i - 1].star)).size, 8, t);
    assert.equal(new Set(RING.map((i) => q.palaces[i - 1].shen)).size, 8, t);
    assert.equal(q.palaces[q.zhiFu.palace - 1].shen, '值符', t);
    assert.equal(q.palaces[q.zhiShi.palace - 1].door, q.zhiShi.door, t);
    assert.ok(['正授', '超神', '接气'].includes(q.ju.chaoJie), t);
    assert.equal(typeof q.ju.chaoJieDays, 'number', t);
    assert.equal(typeof q.ju.leap, 'boolean', t);
  }
});

test('23:00 子时换日边界：奇门起局按有效日（日柱/元）计算，22:59 与 23:01 分属两日', () => {
  const before = castQimen({ date: bj('2026-06-05T22:59') });
  assert.equal(before.meta.dayGanzhi, '庚戌');
  assert.equal(before.meta.hourGanzhi, '丁亥');
  assert.equal(before.meta.enteredNextDay, false);

  const after = castQimen({ date: bj('2026-06-05T23:30') });
  assert.equal(after.meta.dayGanzhi, '辛亥'); // 子时换日（almanac 23:00 日界）
  assert.equal(after.meta.hourGanzhi, '戊子'); // 晚子时用换日后日干起时
  assert.equal(after.meta.enteredNextDay, true);

  const afterZhi = castQimen({ date: bj('2026-06-05T23:30'), juMethod: '置闰' });
  assert.equal(afterZhi.meta.dayGanzhi, '辛亥');
  assert.equal(afterZhi.ju.juMethod, '置闰');
});

// ============================================================
// 六、盘面自洽性（多时间点）
// ============================================================

const SELF_CHECK_TIMES = [];
for (let m = 0; m < 12; m += 1) {
  for (const d of [5, 15, 25]) {
    for (const hh of ['01:30', '07:30', '13:30', '19:30']) {
      SELF_CHECK_TIMES.push(`2026-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T${hh}`);
    }
  }
}

test('九宫盘面自洽性：144 个时间点（字段完整、排列自洽、值符值使落宫一致）', () => {
  for (const t of SELF_CHECK_TIMES) {
    const q = castQimen({ date: bj(t) });
    // 字段完整
    assert.equal(q.palaces.length, 9, t);
    assert.deepEqual(q.palaces.map((p) => p.index), [1, 2, 3, 4, 5, 6, 7, 8, 9], t);
    for (const p of q.palaces) {
      assert.deepEqual(PALACE_INFO[p.index], { gua: p.gua, direction: p.direction, element: p.element }, `${t} ${p.index}宫`);
      assert.equal(typeof p.diPanGan, 'string');
      assert.equal(typeof p.tianPanGan, 'string');
      assert.equal(typeof p.kong, 'boolean');
      assert.equal(typeof p.ma, 'boolean');
      assert.ok(Array.isArray(p.notes));
    }
    // 地盘/天盘各为九干 permutation
    assert.deepEqual(Object.values(field(q, 'diPanGan')).sort(), [...GAN_SEQ].sort(), t);
    assert.deepEqual(Object.values(field(q, 'tianPanGan')).sort(), [...GAN_SEQ].sort(), t);
    // 八门、九星、八神：八宫各一且合法（中五宫无门无神；天禽在五宫，天芮在环上）
    const ringPalaces = RING.map((i) => q.palaces[i - 1]);
    const doors = ringPalaces.map((p) => p.door);
    const stars = ringPalaces.map((p) => p.star);
    const shens = ringPalaces.map((p) => p.shen);
    assert.equal(new Set(doors).size, 8, t);
    assert.equal(new Set(stars).size, 8, t);
    assert.equal(new Set(shens).size, 8, t);
    for (const d of doors) assert.ok(DOOR_SET.has(d), `${t} 门 ${d}`);
    for (const s of stars) assert.ok(STAR_SET.has(s), `${t} 星 ${s}`);
    for (const s of shens) assert.ok(SHEN_SET.has(s), `${t} 神 ${s}`);
    assert.equal(stars.includes('天禽'), false, `${t} 天禽不入环`);
    assert.equal(q.palaces[4].star, '天禽', `${t} 中宫天禽`);
    assert.equal(q.palaces[4].door, '', `${t} 中宫无门`);
    assert.equal(q.palaces[4].shen, '', `${t} 中宫无神`);
    // 值符星在值符落宫、值使门在值使落宫、八神值符同宫
    // 旬首六仪落中五宫时值符为天禽（寄坤二），盘中该宫星位标「天芮」，二星同宫，属转盘常例
    const zhiFuPalace = q.palaces[q.zhiFu.palace - 1];
    assert.ok(
      zhiFuPalace.star === q.zhiFu.star || (q.zhiFu.star === '天禽' && zhiFuPalace.star === '天芮'),
      `${t} 值符星落宫 ${q.zhiFu.star} / ${zhiFuPalace.star}`,
    );
    if (q.zhiFu.star === '天禽') {
      assert.ok(zhiFuPalace.notes.some((s) => s.includes('天禽')), `${t} 天禽同宫说明`);
    }
    assert.equal(q.palaces[q.zhiFu.palace - 1].shen, '值符', t);
    assert.equal(q.palaces[q.zhiShi.palace - 1].door, q.zhiShi.door, t);
    // 值符所携天盘干 = 值符落宫天盘干
    assert.equal(q.palaces[q.zhiFu.palace - 1].tianPanGan, q.zhiFu.gan, t);
    // 旬空、驿马标宫正确（按二十四山折宫）
    const branchPalace = { 子: 1, 丑: 8, 寅: 8, 卯: 3, 辰: 4, 巳: 4, 午: 9, 未: 2, 申: 2, 酉: 7, 戌: 6, 亥: 6 };
    const kongSet = new Set(q.kongWang.map((b) => branchPalace[b]));
    for (const p of q.palaces) {
      assert.equal(p.kong, kongSet.has(p.index), `${t} ${p.index}宫旬空`);
      assert.equal(p.ma, branchPalace[q.maXing] === p.index, `${t} ${p.index}宫驿马`);
    }
    // 局数/值符值使合法
    assert.ok(['阳遁', '阴遁'].includes(q.ju.yinYang));
    assert.ok(q.ju.number >= 1 && q.ju.number <= 9);
    assert.ok(['上元', '中元', '下元'].includes(q.ju.yuan));
    assert.ok(q.zhiFu.palace >= 1 && q.zhiFu.palace <= 9);
    assert.ok(q.zhiShi.palace >= 1 && q.zhiShi.palace <= 9);
    assert.ok(q.xunShou.ganzhi.startsWith('甲'), '旬首必为六甲');
    assert.equal(q.xunShou.yi.length, 1);
    // hints 非空且提到拆补法
    assert.ok(q.hints.length >= 5, t);
    assert.ok(q.hints[0].includes('拆补法'), t);
  }
});

test('值符值使与原宫：时干为甲则值符归旬首本宫；值使落宫按旬内序数九宫顺逆', () => {
  // 2026-06-05 16:52 甲申时（旬内序 0）→ 值符、值使皆归旬首本宫（伏吟）
  const a = castQimen({ date: bj('2026-06-05T16:52') });
  assert.equal(a.meta.hourGanzhi, '甲申');
  assert.equal(a.zhiShi.palace, a.xunShou.palace);
  assert.equal(a.zhiFu.palace, a.xunShou.palace);
  // 2026-06-10 17:30 乙酉时（旬内序 1）：旬首庚落中五（寄坤二），阳遁自坤二顺数一宫 → 震三
  const b = castQimen({ date: bj('2026-06-10T17:30') });
  assert.equal(b.meta.hourGanzhi, '乙酉');
  assert.equal(b.ju.yinYang, '阳遁');
  assert.equal(b.xunShou.palace, 5);
  assert.equal(b.zhiFu.star, '天禽');
  assert.equal(b.zhiFu.palace, 2); // 中五寄坤二
  assert.equal(b.zhiShi.palace, 3); // 2 + 1（壬盘数序顺数）
  const origin = b.xunShou.palace === 5 ? 2 : b.xunShou.palace;
  const step = 1;
  const expected = ((origin - 1 + step) % 9) + 1;
  assert.equal(b.zhiShi.palace, expected === 5 ? 2 : expected);
  assert.ok(b.hints.some((h) => h.includes('旬首六仪') && h.includes('中五宫')), '中五旬首 hints 说明');
});

test('八神方向：阳遁顺时针、阴遁逆时针，值符起于值符落宫', () => {
  const yang = castQimen({ date: bj('2026-06-05T16:52') }); // 阳遁五局
  assert.equal(yang.ju.yinYang, '阳遁');
  const k = RING.indexOf(yang.zhiFu.palace);
  const order = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'];
  order.forEach((shen, i) => {
    assert.equal(yang.palaces[RING[(k + i) % 8] - 1].shen, shen, `阳遁 ${shen}`);
  });
  const yin = castQimen({ date: bj('2024-06-21T10:00') }); // 阴遁三局
  assert.equal(yin.ju.yinYang, '阴遁');
  const k2 = RING.indexOf(yin.zhiFu.palace);
  order.forEach((shen, i) => {
    assert.equal(yin.palaces[RING[((k2 - i) % 8 + 8) % 8] - 1].shen, shen, `阴遁 ${shen}`);
  });
});

test('中五宫口径：中宫天盘干不转、天禽入中宫并寄坤二，hints 有说明', () => {
  const q = castQimen({ date: bj('2024-06-21T10:00') });
  assert.equal(q.palaces[4].diPanGan, '丙');
  assert.equal(q.palaces[4].tianPanGan, '丙'); // 中宫不参与转盘
  assert.equal(q.palaces[4].star, '天禽');
  assert.ok(q.palaces[4].notes.some((s) => s.includes('坤二')));
  assert.ok(q.hints.some((h) => h.includes('中五宫寄坤二')));
});

test('hints 只出盘面与神煞提示，不含吉凶断语（用神/格局留给 skills）', () => {
  const q = castQimen({ date: bj('2026-10-25T21:30') });
  const text = q.hints.join('\n');
  assert.ok(text.includes('拆补法'));
  assert.ok(text.includes('旬空'));
  assert.ok(text.includes('驿马'));
  assert.ok(text.includes('skills'));
  for (const bad of ['大吉', '必成', '凶兆', '主吉']) {
    assert.equal(text.includes(bad), false, bad);
  }
});

test('中五寄宫选项：默认坤二；阳遁寄艮八、阴遁寄坤二', () => {
  const q1 = castQimen({ date: bj('2024-06-21T10:00'), jiGong: '坤二' });
  assert.equal(q1.meta.jiGong, '坤二');
  assert.equal(q1.meta.jiPalace, 2);
  const q2 = castQimen({ date: bj('2024-06-21T10:00'), jiGong: '阳艮阴坤' });
  assert.equal(q2.meta.jiGong, '阳艮阴坤');
  assert.ok([2, 8].includes(q2.meta.jiPalace));
  assert.ok(q2.hints.some((h) => h.includes('中五宫寄')));
});

test('早晚子时选项：sameDay 为夜子时（日柱不换，时柱按次日日干起子时）', () => {
  const normal = castQimen({ date: bj('2024-07-22T23:30') });
  const night = castQimen({ date: bj('2024-07-22T23:30'), lateZi: 'sameDay' });
  assert.notEqual(normal.meta.dayGanzhi, night.meta.dayGanzhi);
  assert.equal(normal.meta.hourGanzhi, night.meta.hourGanzhi); // 均为子时
  assert.equal(night.meta.hourGanzhi[1], '子');
  assert.ok(night.hints.some((h) => h.includes('夜子时')));
});

test('暗干与门/星旺衰字段：五种暗干排法均可出盘，默认「八门地盘携带之干」', () => {
  const q = castQimen({ date: bj('2024-07-22T09:09') });
  assert.equal(q.meta.anGanMode, '八门地盘携带之干');
  assert.equal(q.meta.anGanEffective, '八门地盘携带之干');
  assert.equal(q.meta.experimental, false);
  assert.ok(q.palaces.some((p) => p.anGan && p.anGan.length === 1));
  for (const p of q.palaces) {
    assert.ok(['旺', '相', '休', '囚', '死', ''].includes(p.starWangShuai));
    assert.ok(['旺', '相', '休', '囚', '死', ''].includes(p.doorWangShuai));
  }
  // 其余四种暗干排法：均可出干（实验性），不得静默留空
  for (const mode of AN_GAN_MODES) {
    const chart = castQimen({ date: bj('2024-07-22T09:09'), anGanMode: mode });
    assert.equal(chart.meta.anGanEffective, mode, mode);
    const gans = chart.palaces.map((p) => p.anGan).filter(Boolean);
    assert.ok(gans.length >= 8, `${mode} 应能布出暗干，实得 ${gans.length}`);
    for (const g of gans) assert.ok(GAN_SEQ.includes(g), `${mode} 暗干应为三奇六仪：${g}`);
    if (mode !== '八门地盘携带之干') {
      assert.equal(chart.meta.experimental, true, `${mode} 应标实验`);
    }
  }
  // 飞盘下，转盘专属两法退化为「暗天干地支飞布法」
  const fly = castQimen({ date: bj('2024-07-22T09:09'), method: '飞盘' });
  assert.equal(fly.meta.anGanEffective, '暗天干地支飞布法');
  assert.ok(fly.hints.some((h) => h.includes('暗干')));
});

test('置闰天数选项：默认 8；传 9 时 meta 记录且可用', () => {
  const q = castQimen({ date: bj('2026-06-05T16:52'), juMethod: '置闰', zhirunDays: 9 });
  assert.equal(q.meta.zhirunDays, 9);
  assert.equal(q.ju.juMethod, '置闰');
  assert.ok(Array.isArray(q.hints));
});
// ============================================================
// 扩展（task-19）：盘式 / 暗干 / 穿壬 / 起局 / 多局 / 命运局
// 说明：以下除「时家+转盘+拆补/置闰」外均为实验性扩展（任务允许实验性），
// 规则参考 docs/REF-CONGZHEN-QIMEN.md 与知识库 08-奇门遁甲，未与权威排盘逐项校核，
// 因此测试只断言「结构自洽 + 实验标记 + 不静默冒充」，不断言与某工具逐项一致。
// ============================================================

const BRANCHES12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const YUE_JIANG_NAMES = ['神后', '大吉', '功曹', '太冲', '天罡', '太乙', '胜光', '小吉', '传送', '从魁', '河魁', '登明'];
const JIAN_CHU_NAMES = ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭'];
const STAR_BASE_PALACE = {
  天蓬: 1, 天芮: 2, 天冲: 3, 天辅: 4, 天禽: 5, 天心: 6, 天柱: 7, 天任: 8, 天英: 9,
};

test('盘式参数：默认转盘；飞盘/括囊出盘且标实验，不静默按转盘冒充', () => {
  assert.equal(normalizePanMethod(), '转盘');
  assert.equal(normalizePanMethod('转盘'), '转盘');
  assert.equal(normalizePanMethod('zhuanpan'), '转盘');
  assert.equal(normalizePanMethod('飞盘'), '飞盘');
  assert.equal(normalizePanMethod('括囊'), '括囊');
  assert.throws(() => normalizePanMethod('圆盘'), /未知盘式/);

  const d = bj('2024-07-22T09:09');
  const base = castQimen({ date: d });
  assert.equal(base.meta.panMethod, '转盘');
  assert.equal(base.meta.experimental, false);
  assert.deepEqual(base.meta.experimentalItems, []);

  // 飞盘：九宫皆得星神（含中宫），八门八宫；与转盘盘面不同
  const fly = castQimen({ date: d, method: '飞盘' });
  assert.equal(fly.meta.panMethod, '飞盘');
  assert.equal(fly.meta.experimental, true);
  assert.ok(fly.meta.experimentalItems.includes('飞盘'));
  assert.ok(fly.hints[0].includes('实验'));
  assert.equal(new Set(fly.palaces.map((p) => p.star)).size, 9);
  assert.equal(new Set(fly.palaces.map((p) => p.shen)).size, 9);
  assert.equal(new Set(fly.palaces.map((p) => p.door).filter(Boolean)).size, 8);
  assert.equal(fly.palaces[fly.zhiFu.palace - 1].star, fly.zhiFu.star);
  assert.equal(fly.palaces[fly.zhiShi.palace - 1].door, fly.zhiShi.door);
  assert.notEqual(fly.palaces[4].star, '');
  assert.notEqual(fly.palaces[4].shen, '');
  // 飞盘天盘干 = 所在星所携本位地盘干
  const diPanFly = Object.fromEntries(fly.palaces.map((p) => [p.index, p.diPanGan]));
  for (const p of fly.palaces) {
    assert.equal(p.tianPanGan, diPanFly[STAR_BASE_PALACE[p.star]], `飞盘第 ${p.index} 宫天盘干`);
  }
  assert.notDeepEqual(fly.palaces.map((p) => p.star), base.palaces.map((p) => p.star));

  // 括囊：另有括囊门层（八门对宫门，独立飞布）
  const kuo = castQimen({ date: d, method: '括囊' });
  assert.equal(kuo.meta.panMethod, '括囊');
  assert.equal(kuo.meta.experimental, true);
  assert.ok(kuo.meta.experimentalItems.includes('括囊'));
  assert.equal(new Set(kuo.palaces.map((p) => p.star)).size, 9);
  const kuoDoors = kuo.palaces.map((p) => p.kuoNangDoor).filter(Boolean);
  assert.equal(kuoDoors.length, 8);
  assert.equal(new Set(kuoDoors).size, 8);
  assert.deepEqual(
    [...new Set(kuoDoors)].sort(),
    [...new Set(kuo.palaces.map((p) => p.door).filter(Boolean))].sort(),
  );

  // 中门选项：飞盘用九门时，中宫得中门
  const zhong = castQimen({ date: d, method: '飞盘', feiPanUseZhongMen: true });
  assert.equal(new Set(zhong.palaces.map((p) => p.door)).size, 9);
  assert.ok(zhong.palaces.some((p) => p.door === '中门'));
  assert.ok(base.palaces[4].shen === '' && base.palaces[4].door === '');
});

test('穿壬四层：十二地支的月将加时 / 十二天将 / 建除，及八宫归属', () => {
  const q = castQimen({ date: bj('2024-07-22T09:09') });
  assert.ok(q.chuanRen, '默认附穿壬');
  assert.equal(q.chuanRen.items.length, 12);
  assert.ok(YUE_JIANG_NAMES.includes(q.chuanRen.yueJiang.name));
  assert.ok(['昼', '夜'].includes(q.chuanRen.dayNight));
  assert.equal(new Set(q.chuanRen.items.map((i) => i.branch)).size, 12);
  assert.equal(new Set(q.chuanRen.items.map((i) => i.shenJiang)).size, 12);
  const yueJiangIdx = BRANCHES12.indexOf(q.chuanRen.yueJiang.branch);
  const hourIdx = BRANCHES12.indexOf(q.meta.hourGanzhi[1]);
  for (const it of q.chuanRen.items) {
    assert.ok(YUE_JIANG_NAMES.includes(it.yueJiang), it.yueJiang);
    assert.ok(JIAN_CHU_NAMES.includes(it.jianXing), it.jianXing);
    // 月将加时：天盘支 = 月将 + (地盘支 − 时支)
    const branchIdx = BRANCHES12.indexOf(it.branch);
    const expected = BRANCHES12[((yueJiangIdx + (branchIdx - hourIdx)) % 12 + 12) % 12];
    assert.equal(it.tianPan, expected, `${it.branch} 的天盘支`);
  }
  // 建除：时支位置起「建」
  const jianAtHour = q.chuanRen.items.find((i) => i.branch === q.meta.hourGanzhi[1]);
  assert.equal(jianAtHour.jianXing, '建');
  // 八宫归属：坎子、坤未申、震卯、巽辰巳、乾戌亥、兑酉、艮丑寅、离午，中宫空
  assert.deepEqual(PALACE_BRANCHES[1], ['子']);
  assert.deepEqual(PALACE_BRANCHES[2], ['未', '申']);
  assert.deepEqual(PALACE_BRANCHES[9], ['午']);
  assert.deepEqual(PALACE_BRANCHES[5], []);
  let total = 0;
  for (const p of q.palaces) {
    assert.ok(p.chuanRen, `第 ${p.index} 宫应有穿壬`);
    const expectedBranches = PALACE_BRANCHES[p.index];
    assert.deepEqual(p.chuanRen.diPanDiZhi, expectedBranches);
    assert.equal(p.chuanRen.items.length, expectedBranches.length);
    total += p.chuanRen.items.length;
    for (const it of p.chuanRen.items) {
      const top = q.chuanRen.items.find((x) => x.branch === it.branch);
      assert.equal(it.shenJiang, top.shenJiang);
      assert.equal(it.jianXing, top.jianXing);
    }
    if (expectedBranches.length === 1) {
      assert.equal(p.chuanRen.shenJiang, p.chuanRen.items[0].shenJiang);
    }
  }
  assert.equal(total, 12, '十二地支应恰好分配入八宫');
  // 可关闭
  const off = castQimen({ date: bj('2024-07-22T09:09'), chuanRen: false });
  assert.equal(off.chuanRen, null);
  assert.ok(off.palaces.every((p) => p.chuanRen === null));
});

test('起局方式（实验）：茅山按交节天数、阴盘按农历月日、分家阳盘按时支、刻家阴盘用刻柱', () => {
  // 茅山：夏至当日 10:00（交节 04:51）→ 上元；夏至后第 11 日 → 下元
  const mao1 = castQimen({ date: bj('2024-06-21T10:00'), juMethod: '茅山' });
  assert.equal(mao1.ju.yuan, '上元');
  assert.equal(mao1.ju.yinYang, '阴遁');
  assert.equal(mao1.ju.number, 9); // 夏至上元阴遁九局
  assert.ok(mao1.meta.experimentalItems.includes('茅山'));
  const mao2 = castQimen({ date: bj('2024-07-02T10:00'), juMethod: '茅山' });
  assert.equal(mao2.ju.yuan, '下元');
  assert.equal(mao2.ju.number, 6); // 夏至下元阴遁六局
  // 阴盘：局数 =（年支序 + 农历月 + 农历日 + 时支序 + 2）% 9
  const d = bj('2024-07-22T09:09');
  const alm = getAlmanac(new Date(d));
  const expectedYinPan = ((BRANCHES12.indexOf(alm.yearGanzhi[1]) + Math.abs(alm.lunar.month)
    + alm.lunar.day + BRANCHES12.indexOf(alm.hourGanzhi[1]) + 2) % 9) || 9;
  const yin = castQimen({ date: d, juMethod: '阴盘' });
  assert.equal(yin.ju.number, expectedYinPan);
  assert.ok(yin.meta.experimentalItems.includes('阴盘'));
  // 分家阳盘：时支子至午为阳遁、未至亥为阴遁；局数取三元固定 1/7/4 或 9/3/6
  const fenYang = castQimen({ date: bj('2024-07-22T09:09'), juMethod: '分家阳盘' }); // 巳时
  assert.equal(fenYang.meta.jiGong, '坤二');
  assert.equal(fenYang.ju.yinYang, '阳遁');
  assert.ok([1, 7, 4].includes(fenYang.ju.number));
  const fenYin = castQimen({ date: bj('2024-07-22T21:30'), juMethod: '分家阳盘' }); // 亥时
  assert.equal(fenYin.ju.yinYang, '阴遁');
  assert.ok([9, 3, 6].includes(fenYin.ju.number));
  // 刻家阴盘：排盘参考「刻柱」，刻支由「时辰内第几刻（10 分钟一刻）」顺推
  const ke = castQimen({ date: bj('2024-07-22T09:09'), juMethod: '刻家阴盘' });
  assert.equal(ke.meta.refLabel, '刻柱');
  assert.equal(ke.meta.hourGanzhi, ke.ju.juMethod === '刻家阴盘' ? ke.meta.refGanzhi : '');
  assert.equal(ke.meta.hourGanzhi[1], '子', '09:00–09:09 为子刻');
  assert.ok(ke.meta.experimentalItems.includes('刻家阴盘'));
  assert.ok(ke.hints.some((h) => h.includes('刻家阴盘')));
});

test('多局（实验）：年家/月家/日家/太乙日家/山向/罗盘/套玄空均出盘并如实标注', () => {
  assert.equal(normalizeJuType(), '时家');
  assert.equal(normalizeJuType('时家'), '时家');
  assert.equal(normalizeJuType('nianjia'), '年家');
  assert.equal(normalizeJuType('日家'), '日家');
  assert.throws(() => normalizeJuType('季家'), /未知局式/);
  const d = bj('2024-07-22T09:09');
  const base = castQimen({ date: d });
  for (const juType of ['年家', '月家', '日家', '太乙日家', '山向', '罗盘', '套玄空']) {
    const q = castQimen({ date: d, juType, shan: '子', xiang: '午' });
    assert.equal(q.meta.juType, juType);
    assert.equal(q.settings.juType, juType);
    assert.equal(q.ju.juType, juType);
    assert.equal(q.meta.experimental, true, juType);
    assert.ok(q.meta.experimentalItems.includes(juType), juType);
    assert.equal(q.palaces.length, 9);
    assert.ok(q.ju.number >= 1 && q.ju.number <= 9);
    assert.ok(['阴遁', '阳遁'].includes(q.ju.yinYang));
  }
  // 年家：阴遁、以年柱为参照、三元九运
  const nian = castQimen({ date: d, juType: '年家' });
  assert.equal(nian.ju.yinYang, '阴遁');
  assert.equal(nian.meta.refLabel, '年柱');
  assert.equal(nian.meta.refGanzhi, nian.meta.yearGanzhi);
  assert.ok(nian.ju.jiuYun >= 1 && nian.ju.jiuYun <= 9);
  // 月家：阴遁、以月柱为参照
  const yue = castQimen({ date: d, juType: '月家' });
  assert.equal(yue.ju.yinYang, '阴遁');
  assert.equal(yue.meta.refLabel, '月柱');
  // 日家：阴阳遁随节气（同月内），以日柱为参照
  const ri = castQimen({ date: d, juType: '日家' });
  assert.equal(ri.meta.refLabel, '日柱');
  assert.equal(ri.ju.yinYang, JU_TABLE[ri.ju.solarTerm].dun);
  // 罗盘：以时家基础盘为底
  const luo = castQimen({ date: d, juType: '罗盘' });
  assert.equal(luo.ju.yinYang, base.ju.yinYang);
  assert.equal(luo.ju.number, base.ju.number);
  assert.equal(luo.meta.refLabel, '时柱');
  // 山向：占位并说明未确证
  const shan = castQimen({ date: d, juType: '山向', shan: '子', xiang: '午' });
  assert.ok(shan.hints.some((h) => h.includes('山向') && h.includes('待校核')));
  assert.equal(shan.meta.shan, '子');
  // 按局式的便捷包装
  assert.equal(castNianJia({ date: d }).meta.juType, '年家');
  assert.equal(castYueJia({ date: d }).meta.juType, '月家');
  assert.equal(castRiJia({ date: d }).meta.juType, '日家');
  assert.equal(castTaiYiRiJia({ date: d }).meta.juType, '太乙日家');
  assert.equal(castShanXiang({ date: d }).meta.juType, '山向');
  assert.equal(castLuoPan({ date: d }).meta.juType, '罗盘');
  assert.equal(castTaoXuanKong({ date: d }).meta.juType, '套玄空');
  // 能力清单
  assert.ok(QIMEN_CAPABILITIES.stable.includes('转盘'));
  assert.ok(QIMEN_CAPABILITIES.experimental.includes('飞盘'));
  assert.ok(QIMEN_CAPABILITIES.experimental.includes('命运局'));
});

test('命运局（实验）：原命局 + 10 步大运局，只变时辰干支、阴阳遁与局数不变', () => {
  const d = bj('2024-07-22T09:09');
  const my = castQimenMingYun({ date: d });
  assert.ok(my.natal && my.natal.ju);
  assert.equal(my.daYun.length, 10);
  assert.equal(my.meta.experimental, true);
  assert.deepEqual(my.meta.experimentalItems, ['命运局']);
  const natalJu = `${my.natal.ju.yinYang}${my.natal.ju.number}`;
  const baseHourIdx = (() => {
    const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const name = my.natal.meta.hourGanzhi;
    for (let i = 0; i < 60; i += 1) if (stems[i % 10] === name[0] && BRANCHES12[i % 12] === name[1]) return i;
    return -1;
  })();
  for (let k = 0; k < 10; k += 1) {
    const step = my.daYun[k];
    assert.equal(step.index, k + 1);
    assert.equal(step.ageFrom, 1 + k * 9);
    assert.equal(step.ageTo, 9 + k * 9);
    assert.equal(`${step.chart.ju.yinYang}${step.chart.ju.number}`, natalJu, '局数阴阳不变');
    assert.equal(step.chart.ju.yuan, my.natal.ju.yuan);
    // 时柱顺排：比原时柱前进 k+1 位
    assert.equal(step.chart.meta.hourGanzhi, step.hourGanzhi);
    assert.equal(step.chart.meta.hourGanzhi[1], BRANCHES12[(baseHourIdx + k + 1) % 12]);
    if (typeof step.year === 'number') assert.equal(step.year, my.natal.meta.year + k * 9);
  }
  // 大运盘自身仍是完整盘面
  const first = my.daYun[0].chart;
  assert.equal(first.palaces.length, 9);
  assert.ok(first.hints.some((h) => h.includes('时柱')));
});
