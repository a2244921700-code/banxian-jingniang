/**
 * qimen.js —— 时家奇门遁甲排盘引擎（转盘法；定局法支持 拆补 / 置闰）
 *
 * 纯 ESM、零第三方依赖；只依赖同目录 ./almanac.js（engine-smith 交付，只读引用）。
 *
 * 实现范围（SPEC §3.2 / §2.6）：
 *   - 节气定阴阳遁（冬至后阳遁、夏至后阴遁）与上中下三元局数；
 *   - 定局法 `juMethod`：
 *       '拆补'（默认，主流常用）：日柱逆推最近“甲/己”日为符头，符头日支
 *         （子午卯酉/寅申巳亥/辰戌丑未）定上中下元，当前节气定局数；
 *       '置闰'（古法，可选）：符头链 + 超神接气置闰（详见下方「置闰法」一节）；
 *   - 地盘三奇六仪：戊己庚辛壬癸丁丙乙，阳遁自局数宫起按九宫序顺布，阴遁逆布；
 *   - 值符（旬首六仪所落宫之本位九星）、值使（同宫本位八门）；
 *   - 天盘干与九星整体随值符转（值符落宫 = 时干地盘宫；时干为甲则隐于旬首六仪）；
 *   - 八门随值使转（值使「加时」：从值使本位宫起，阳顺阴逆，按九宫数序走「旬内序数」步）；
 *   - 八神：值符神起于值符落宫，阳遁顺时针、阴遁逆时针布「值符/螣蛇/太阴/六合/白虎/玄武/九地/九天」；
 *   - 旬空（时柱旬空，标于对应九宫）、驿马（时支三合马）；
 *   - 中五宫：转盘常规“寄坤二宫”，九星天禽与天芮同宫，八门/八神不入中宫，中宫给地盘干/天盘干。
 *
 * 本引擎只出盘面与客观神煞；用神、格局、克应吉凶由 skills 判断（SPEC §3.2/§2.6）。
 *
 * ── 流派结论（用户要求「最主流」）───────────────────────────
 * 时家奇门的主流组合是「转盘 + 拆补法」：
 *   - 现代排盘工具普遍默认拆补：qimen-rs（https://github.com/SpenserCai/qimen-rs，
 *     docs/algorithm-sources.md「本项目的默认计算口径为：时家、拆补、转盘，中五固定寄坤，
 *     天禽随天芮」）；mingpan（https://github.com/ChesterRa/mingpan，QimenService 默认
 *     zhiRunMethod:'chaibu'）；qfdk/qimen（https://github.com/qfdk/qimen，lib/qimen.js 以
 *     「当前节气 + 符头定元」定局）；Taogram/taobi（https://github.com/Taogram/taobi，
 *     置闰法「不支持，也不推荐」）；arc119226/qimen_dunjia（https://github.com/arc119226/
 *     qimen_dunjia，README「定局法提供拆補與符頭兩派並列（預設拆補）」）。
 *   - 古籍上《奇门宝鉴御定》记「李氏奇门真传，止以节气为准」的拆补派与超接置闰派之争，
 *     拆补因规则简明、不依赖跨年置闰累积而为现代通行默认。
 * 故本引擎 juMethod 默认 '拆补'；置闰法作为可选古法实现（默认不用），
 * 古法依据：《遁甲演义·超神接气置闰诀》《奇门遁甲统宗·置闰法》《奇门宝鉴御定》。
 *
 * 校验来源（详见 test/engine-qimen.test.mjs 注释）：
 *   - 节气三元局数表：《烟波钓叟歌》通行歌诀「冬至惊蛰一七四，小寒二八五相随……
 *     夏至白露九三六，小暑八二五之间……」；
 *   - 盘面：开源排盘工具 qfdk/qimen（https://github.com/qfdk/qimen，转盘排盘）与
 *     kentang2017/kinqimen（https://github.com/kentang2017/kinqimen，拆补/置闰时家奇门）交叉核对，
 *     并用两工具自带之权威基准盘（2026 各节气）复核；
 *   - 置闰法：符头链算法与《奇门遁甲统宗·置闰法》康熙五十六—五十八年十个算例逐点核对，
 *     并以《统宗》所记「康熙五十八年六月二十三日立秋甲子符头正授，本日阴遁二局」为外部锚点；
 *     算法参照开源实现 arc119226/qimen_dunjia（MIT）与 perfhelf/bigfishmarquis-qimen（MIT）。
 *
 * ── 扩展能力（task-19；参考 docs/REF-CONGZHEN-QIMEN.md 与知识库 08-奇门遁甲）──
 *   - 盘式 method：'转盘'（默认/已校核）| '飞盘' | '括囊'（后二者实验性）；
 *   - 暗干 anGanMode：五种排法全部实现（默认「八门地盘携带之干」；其余四种实验性）；
 *   - 穿壬（默认附）：每宫附 地盘地支 / 月将加时天盘支 / 十二天将 / 建除十二神；
 *     结构对应从真 CZGongDiZhiEntity（diPanDiZhi/renPanDiZhi/yueJiang/shenJiang/jianChu）；
 *   - 起局 juMethod：'拆补'（默认，主流）| '置闰'（古法）| '茅山' | '阴盘' | '分家阳盘' | '刻家阴盘'（实验性）；
 *   - 局式 juType：'时家'（默认）| '年家' | '月家' | '日家' | '太乙日家' | '山向' | '罗盘' | '套玄空'（实验性）；
 *   - 命运局：castQimenMingYun() 返回原命局 + 10 步大运局（实验性；不套八字）；
 *   - 便捷导出：castNianJia / castYueJia / castRiJia / castTaiYiRiJia / castShanXiang / castLuoPan / castTaoXuanKong。
 *   实验性内容一律在 hints 首条与 meta.experimental / meta.experimentalItems 标注「实验·未校核」，
 *   不静默按转盘冒充；结构自洽测试见 test/engine-qimen.test.mjs「扩展（task-19）」一节。
 */

import {
  getAlmanac,
  xunKong,
  solarTerms,
  dayPillar,
  beijingParts,
  julianDayNumber,
} from './almanac.js';

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

/** 九宫（洛书）：index → 卦、方位、五行 */
export const PALACE_INFO = {
  1: { gua: '坎', direction: '北', element: '水' },
  2: { gua: '坤', direction: '西南', element: '土' },
  3: { gua: '震', direction: '东', element: '木' },
  4: { gua: '巽', direction: '东南', element: '木' },
  5: { gua: '中', direction: '中', element: '土' },
  6: { gua: '乾', direction: '西北', element: '金' },
  7: { gua: '兑', direction: '西', element: '金' },
  8: { gua: '艮', direction: '东北', element: '土' },
  9: { gua: '离', direction: '南', element: '火' },
};

const CN_NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 宫名（八卦 + 汉字数）：如「坤二宫」 */
function palaceName(p) {
  return `${PALACE_INFO[p].gua}${CN_NUMERALS[p]}宫`;
}

/** 转盘八宫环序（顺时针）：坎→艮→震→巽→离→坤→兑→乾 */
const RING = [1, 8, 3, 4, 9, 2, 7, 6];

/** 九星本位（中五天禽，转盘寄坤二与天芮同宫） */
const BASE_STAR = {
  1: '天蓬', 2: '天芮', 3: '天冲', 4: '天辅', 5: '天禽',
  6: '天心', 7: '天柱', 8: '天任', 9: '天英',
};

/** 八门本位（中五无门） */
const BASE_DOOR = {
  1: '休门', 2: '死门', 3: '伤门', 4: '杜门',
  6: '开门', 7: '惊门', 8: '生门', 9: '景门',
};

/** 八门 → 本位宫（暗干「八门地盘携带之干」用） */
const DOOR_BASE_PALACE = Object.fromEntries(
  Object.entries(BASE_DOOR).map(([palace, door]) => [door, Number(palace)]),
);

/** 九星五行 */
const STAR_ELEMENT = {
  天蓬: '水', 天任: '土', 天冲: '木', 天辅: '木', 天英: '火',
  天芮: '土', 天柱: '金', 天心: '金', 天禽: '土',
};

/** 八门五行 */
const DOOR_ELEMENT = {
  休门: '水', 生门: '土', 伤门: '木', 杜门: '木',
  景门: '火', 死门: '土', 惊门: '金', 开门: '金',
};

/** 月支 → 季节五行（用于门/星旺相休囚死） */
const SEASON_ELEMENT = {
  寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土',
  申: '金', 酉: '金', 戌: '土', 亥: '水', 子: '水', 丑: '土',
};

const WANG_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const WANG_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** 以「令」为我：同令旺、令生相、生令休、克令囚、令克死 */
function wangShuaiOf(seasonElement, element) {
  if (!seasonElement || !element) return '';
  if (element === seasonElement) return '旺';
  if (WANG_SHENG[seasonElement] === element) return '相';
  if (WANG_SHENG[element] === seasonElement) return '休';
  if (WANG_KE[element] === seasonElement) return '囚';
  if (WANG_KE[seasonElement] === element) return '死';
  return '';
}

/** 暗干排法（与从真奇门枚举同名；本引擎目前实现第 3 种，其余保留字段） */
export const AN_GAN_MODES = [
  '时干找值使飞布,遇地盘相同入中',
  '时干找值使飞布,遇宫内有时干则入中',
  '八门地盘携带之干',
  '时干加值使转天盘,遇伏吟入中',
  '暗天干地支飞布法',
];
const AN_GAN_MODE_DEFAULT = '八门地盘携带之干';


/** 八宫环上的九星序列（坤位为「天芮/天禽」共宫） */
const RING_STARS = ['天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天柱', '天心'];
/** 八宫环上的八门序列（与九星同向：休生伤杜景死惊开） */
const RING_DOORS = ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'];

/** 八神（SPEC §2.6 指定名称） */
const SHENS = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'];

/** 旬首六仪：甲子→戊、甲戌→己、甲申→庚、甲午→辛、甲辰→壬、甲寅→癸 */
const XUN_YI = ['戊', '己', '庚', '辛', '壬', '癸'];

/** 地盘三奇六仪次序 */
const GAN_SEQ = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];

/**
 * 二十四节气三元局数表。
 * 歌诀：「冬至惊蛰一七四，小寒二八五相随，大寒春分三九六，芒种六三九便回，
 *        谷雨小满五二八，立春八五二相宜，雨水九六三为是；夏至白露九三六，
 *        小暑八二五之间，大暑秋分七一四，立秋二五八相牵，处暑一四七为是，
 *        霜降小雪五八二，寒露立冬六九三，清明立夏四一七，大雪四七一。」
 * 数组顺序 = [上元局, 中元局, 下元局]。
 */
export const JU_TABLE = {
  冬至: { dun: '阳遁', ju: [1, 7, 4] },
  小寒: { dun: '阳遁', ju: [2, 8, 5] },
  大寒: { dun: '阳遁', ju: [3, 9, 6] },
  立春: { dun: '阳遁', ju: [8, 5, 2] },
  雨水: { dun: '阳遁', ju: [9, 6, 3] },
  惊蛰: { dun: '阳遁', ju: [1, 7, 4] },
  春分: { dun: '阳遁', ju: [3, 9, 6] },
  清明: { dun: '阳遁', ju: [4, 1, 7] },
  谷雨: { dun: '阳遁', ju: [5, 2, 8] },
  立夏: { dun: '阳遁', ju: [4, 1, 7] },
  小满: { dun: '阳遁', ju: [5, 2, 8] },
  芒种: { dun: '阳遁', ju: [6, 3, 9] },
  夏至: { dun: '阴遁', ju: [9, 3, 6] },
  小暑: { dun: '阴遁', ju: [8, 2, 5] },
  大暑: { dun: '阴遁', ju: [7, 1, 4] },
  立秋: { dun: '阴遁', ju: [2, 5, 8] },
  处暑: { dun: '阴遁', ju: [1, 4, 7] },
  白露: { dun: '阴遁', ju: [9, 3, 6] },
  秋分: { dun: '阴遁', ju: [7, 1, 4] },
  寒露: { dun: '阴遁', ju: [6, 9, 3] },
  霜降: { dun: '阴遁', ju: [5, 8, 2] },
  立冬: { dun: '阴遁', ju: [6, 9, 3] },
  小雪: { dun: '阴遁', ju: [5, 8, 2] },
  大雪: { dun: '阴遁', ju: [4, 7, 1] },
};

/** 符头日支定三元：子午卯酉上元、寅申巳亥中元、辰戌丑未下元 */
const YUAN_BY_BRANCH = {
  子: '上元', 午: '上元', 卯: '上元', 酉: '上元',
  寅: '中元', 申: '中元', 巳: '中元', 亥: '中元',
  辰: '下元', 戌: '下元', 丑: '下元', 未: '下元',
};
const YUANS = ['上元', '中元', '下元'];

/** 驿马（三合局 → 马星）：申子辰马在寅、寅午戌马在申、巳酉丑马在亥、亥卯未马在巳 */
const MA_BY_BRANCH = {
  申: '寅', 子: '寅', 辰: '寅',
  寅: '申', 午: '申', 戌: '申',
  巳: '亥', 酉: '亥', 丑: '亥',
  亥: '巳', 卯: '巳', 未: '巳',
};

/** 十二支 → 九宫（二十四山归属宫位）：用于标旬空、驿马 */
export const BRANCH_PALACE = {
  子: 1, 丑: 8, 寅: 8, 卯: 3, 辰: 4, 巳: 4,
  午: 9, 未: 2, 申: 2, 酉: 7, 戌: 6, 亥: 6,
};

// ============================================================
// 小工具
// ============================================================

const mod = (n, m) => ((n % m) + m) % m;

/** 干支名 → 六十甲子序（0=甲子），非法返回 -1 */
export function ganzhiIndex(name) {
  if (typeof name !== 'string' || name.length < 2) return -1;
  const s = STEMS.indexOf(name[0]);
  const b = BRANCHES.indexOf(name[1]);
  if (s < 0 || b < 0) return -1;
  for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i;
  return -1;
}

/** 六十甲子序 → 干支名 */
export function ganzhiName(index) {
  const i = mod(Math.round(index), 60);
  return STEMS[i % 10] + BRANCHES[i % 12];
}

/** 宫在八宫环上的序号（0..7，顺时针）；中宫返回 -1 */
export function ringIndex(palace) {
  return RING.indexOf(palace);
}

/** 按二十四山把地支折成九宫 */
export function palaceOfBranch(branch) {
  return BRANCH_PALACE[branch] ?? null;
}

/**
 * 拆补法：由日柱逆推最近符头（甲日或己日，最多 5 日），返回符头与三元。
 * @param {string} dayGanzhi 日柱，如 '丙午'
 * @returns {{futou:string, branch:string, yuan:'上元'|'中元'|'下元'}}
 */
export function futouOfDay(dayGanzhi) {
  const idx = ganzhiIndex(dayGanzhi);
  if (idx < 0) throw new Error('无效的日柱：' + String(dayGanzhi));
  for (let back = 0; back <= 5; back += 1) {
    const i = mod(idx - back, 60);
    const stemIdx = i % 10;
    if (stemIdx === 0 || stemIdx === 5) {
      // 甲（0）或己（5）为符头
      const branch = BRANCHES[i % 12];
      return { futou: ganzhiName(i), branch, yuan: YUAN_BY_BRANCH[branch] };
    }
  }
  /* c8 ignore next */
  throw new Error('符头推算异常：' + dayGanzhi);
}

/**
 * 节气 + 三元 → 阴阳遁与局数。
 * @param {string} termName 节气名（如 '霜降'）
 * @param {'上元'|'中元'|'下元'} yuan
 */
export function juForTerm(termName, yuan) {
  const entry = JU_TABLE[termName];
  if (!entry) throw new Error('未知节气：' + String(termName));
  const yIdx = YUANS.indexOf(yuan);
  if (yIdx < 0) throw new Error('未知三元：' + String(yuan));
  return { dun: entry.dun, number: entry.ju[yIdx] };
}

/**
 * 地盘三奇六仪排布（9 宫，含中五）。
 * 阳遁自局数宫起按宫数 1→2→…→9→1 顺布戊己庚辛壬癸丁丙乙；阴遁逆布。
 * @returns {Record<number,string>} 宫号(1-9) → 地盘干
 */
export function diPanLayout(dun, ju) {
  const start = mod(ju - 1, 9) + 1;
  const out = {};
  for (let i = 0; i < 9; i += 1) {
    const palace = dun === '阳遁'
      ? mod(start - 1 + i, 9) + 1
      : mod(start - 1 - i, 9) + 1;
    out[palace] = GAN_SEQ[i];
  }
  return out;
}

/** 找某天干在地盘上的宫位；找不到返回 0 */
function palaceOfStem(diPan, stem) {
  for (let p = 1; p <= 9; p += 1) if (diPan[p] === stem) return p;
  return 0;
}

/** 五行生克关系：a 对 b（'克' a克b / '生' a生b / '比和'）——引擎仅用于提示，不作吉凶 */
export function wuxingRelationOf(a, b) {
  const order = ['木', '火', '土', '金', '水'];
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia < 0 || ib < 0) return '未知';
  if (ia === ib) return '比和';
  if ((ia + 1) % 5 === ib) return '生';
  if ((ib + 1) % 5 === ia) return '克';
  if ((ia + 2) % 5 === ib) return '克';
  return '生';
}

/** 某宫位的客观标记（旬空 / 驿马） */
function palaceFlags(palace, kongSet, maSet) {
  return { kong: kongSet.has(palace), ma: maSet.has(palace) };
}

// ============================================================
// 置闰法（符头链 / 超神接气置闰）
// ============================================================
//
// 古法依据：
//  - 《遁甲演义·超神接气置闰诀》：「超者，超过也；神者，日辰也；接者，承接也；气者，诸节也。
//    节未至而日辰符头先到，则以符头为主而超用未来之节气……节已至而日辰符头未到，
//    则候符头到方承接之。」「闰诀：甲己二日号符头，子午卯酉为上列……要知置闰在何时？
//    端在芒种与大雪。」「超神不过十日，遇芒种大雪超过九日，即置闰也。」
//  - 《奇门遁甲统宗·置闰法》康熙五十六至五十八年算例：「十六日甲子不作夏至上局，
//    而为芒种闰奇上局……」本引擎测试逐点核对，并以「康熙五十八年六月二十三日立秋
//    甲子符头正授，本日即是阴遁二局」为外部锚点。
//  - 《奇门宝鉴御定》：「遇芒种大雪，重用本气三元。」
// 算法（日粒度；参照 arc119226/qimen_dunjia、perfhelf/bigfishmarquis-qimen 两个 MIT 开源实现）：
//  1. 上元符头仅四日：甲子、己卯、甲午、己酉（皆值子午卯酉），每十五日一见；
//  2. 自上元符头起每十五日一循环，每循环依次统领下一个节气（五日一元：上、中、下）；
//  3. 候补节气若落到符头之后 ≥8 个历日（古籍「超九日」为含头计数），且当前循环节气为
//     芒种或大雪，则本循环不换节气而「重用本气三元」，即置闰（闰奇）；
//  4. 置闰只在芒种、大雪后；小满、小雪虽超九日十日亦不置闰（《遁甲演义》）；
//  5. 某日所属循环以其上元符头（不晚于该日者）确定，元 = ⌊(日 − 符头日) ÷ 5⌋。
// 已知边界：日粒度。交节在当日深夜等「时粒度叠局」情形，古籍有一日之内超/接之分，
// 本引擎按历日统一归元（与 arc119226/qimen_dunjia 的已知从缺一致）。
// ============================================================

/** 上元符头四日（甲子、己卯、甲午、己酉） */
export const ZHIRUN_YUAN_FUTOU = ['甲子', '己卯', '甲午', '己酉'];
/** 置闰节气：芒种、大雪 */
const ZHIRUN_LEAP_TERMS = ['芒种', '大雪'];
/** 置闰触发日差：古籍「超九日」为含头计数，故历日差 8 即触发 */
const ZHIRUN_TRIGGER_GAP = 8;

const JDN_DAY_MS = 86400000;

/** 儒略日数 → 该日北京时间 12:00 的 Date（避开 23:00 子时换日） */
function dateForJdn(jdn) {
  return new Date((jdn - 2440587.5) * JDN_DAY_MS);
}

/** 某时刻所在北京时间历日的儒略日数 */
function jdnOfBeijingDay(date) {
  const p = beijingParts(date);
  return julianDayNumber(p.year, p.month, p.day);
}

/** 儒略日数 → 日柱六十甲子序（0=甲子）；取当日中午，避开 23:00 日界 */
function dayGzIndexForJdn(jdn) {
  return dayPillar(dateForJdn(jdn)).index;
}

/** 是否上元符头（甲/己日 且 支为子午卯酉） */
function isShangYuanFuTou(gzIndex) {
  const stem = gzIndex % 10;
  const branch = gzIndex % 12;
  return (stem === 0 || stem === 5) && [0, 3, 6, 9].includes(branch);
}

/** 二十四节气按历日排序（跨年拼接） */
function jieQiDaySequence(fromYear, toYear) {
  const out = [];
  for (let y = fromYear; y <= toYear; y += 1) {
    for (const t of solarTerms(y)) {
      out.push({ day: jdnOfBeijingDay(t.at), name: t.name });
    }
  }
  out.sort((a, b) => a.day - b.day);
  return out;
}

/** 自某日起最近的（含当日）上元符头；四符头每十五日一见，故至多前推十四日 */
function firstShangYuanOnOrAfter(dayNumber) {
  for (let step = 0; step < 15; step += 1) {
    if (isShangYuanFuTou(dayGzIndexForJdn(dayNumber + step))) return dayNumber + step;
  }
  throw new Error('置闰法符头推算异常：十五日内未见甲子/己卯/甲午/己酉');
}

/** 走符头链：每循环统一节气；遇芒种/大雪超神过限则置闰（重用本气三元） */
function buildFuTouChain(sequence, startDayNumber, startIndex, untilDayNumber, triggerGap = ZHIRUN_TRIGGER_GAP) {
  const chain = [];
  let dayNumber = startDayNumber;
  let index = startIndex;
  let previousIndex = null;
  while (dayNumber <= untilDayNumber) {
    let leap = false;
    if (previousIndex !== null) {
      const candidate = previousIndex + 1;
      const candidateGap = candidate < sequence.length
        ? sequence[candidate].day - dayNumber
        : Infinity;
      if (candidateGap >= triggerGap && ZHIRUN_LEAP_TERMS.includes(sequence[previousIndex].name)) {
        index = previousIndex; // 重用本气三元（闰奇）
        leap = true;
      } else {
        index = candidate;
      }
    }
    if (index < 0 || index >= sequence.length) break;
    chain.push({
      day: dayNumber,
      index,
      term: sequence[index].name,
      gap: sequence[index].day - dayNumber,
      leap,
    });
    previousIndex = index;
    dayNumber += 15;
  }
  return chain;
}

/** 已算出的符头链缓存（惰性建立；按需向后扩年） */
let _fuTouChainCache = null;

/**
 * 按年份区间直接走一条符头链（不写缓存）。
 * 起点取 fromYear−1 年内的第一个上元符头；供置闰查询与测试/诊断使用。
 * @param {number} fromYear
 * @param {number} toYear
 * @returns {Array<{day:number, index:number, term:string, gap:number, leap:boolean}>}
 */
export function zhirunChainForRange(fromYear, toYear, triggerGap = ZHIRUN_TRIGGER_GAP) {
  const sequence = jieQiDaySequence(fromYear - 1, toYear + 1);
  const startDayNumber = firstShangYuanOnOrAfter(
    jdnOfBeijingDay(new Date(Date.UTC(fromYear, 0, 1, 4, 0, 0))),
  );
  let startIndex = -1;
  for (let i = 0; i < sequence.length; i += 1) {
    const gap = sequence[i].day - startDayNumber;
    if (gap >= -6 && gap < triggerGap) { startIndex = i; break; }
  }
  if (startIndex < 0) throw new Error('置闰法符头链起步异常：找不到契合的节气');
  const untilDay = jdnOfBeijingDay(new Date(Date.UTC(toYear, 11, 31, 4, 0, 0)));
  return buildFuTouChain(sequence, startDayNumber, startIndex, untilDay, triggerGap);
}

/**
 * 建立/复用覆盖目标年份的符头链。
 * 起点统一取 min(1700, targetYear−20)，使同一目标年份的结果与查询顺序无关；
 * 链与《统宗》锚点的校验见 test/engine-qimen.test.mjs。
 */
function fuTouChainFor(targetYear, triggerGap = ZHIRUN_TRIGGER_GAP) {
  const fromYear = Math.min(1700, targetYear - 20);
  const toYear = targetYear + 5;
  if (_fuTouChainCache
    && _fuTouChainCache.fromYear <= fromYear
    && _fuTouChainCache.toYear >= toYear
    && _fuTouChainCache.triggerGap === triggerGap) {
    return _fuTouChainCache.chain;
  }
  const chain = zhirunChainForRange(fromYear, toYear, triggerGap);
  _fuTouChainCache = { fromYear, toYear, triggerGap, chain };
  return chain;
}

/** 儒略日数 → 该日干支名（中午取日柱，避开 23:00 日界） */
function dayGanzhiNameForJdn(jdn) {
  return ganzhiName(dayGzIndexForJdn(jdn));
}

/**
 * 置闰法定局：给定起局时刻，返回节气、三元、阴阳遁、局数与超接/闰局信息。
 * 日界按 almanac 的 23:00 子时换日（取 alm.effectiveDate）；节气按北京时间历日。
 * 注意：本函数不依赖农历，故可用于 1900 年前的典籍算例核对。
 *
 * @param {Date|string|number} date 北京时间意义下的起局时刻
 * @param {object|null} [alm] 可选：已取好的 getAlmanac 结果（含 effectiveDate 时按有效日）
 * @returns {{term:string, yuan:string, dun:string, number:number,
 *            chaoJie:'正授'|'超神'|'接气', gap:number, leap:boolean,
 *            shangYuanFuTou:string, futou:string}}
 */
export function zhirunJuFor(date = new Date(), alm = null, options = {}) {
  let eff;
  if (alm && alm.effectiveDate) eff = alm.effectiveDate;
  else {
    const p = beijingParts(date);
    eff = { year: p.year, month: p.month, day: p.day };
  }
  const targetJdn = julianDayNumber(eff.year, eff.month, eff.day);
  const triggerGap = options.triggerGap === 9 ? 9 : ZHIRUN_TRIGGER_GAP;
  const chain = fuTouChainFor(eff.year, triggerGap);
  let lo = 0;
  let hi = chain.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (chain[mid].day <= targetJdn) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (found < 0) throw new Error('置闰法符头链未覆盖所问日期：' + String(date));
  const cycle = chain[found];
  const elapsed = targetJdn - cycle.day;
  const yuanIdx = Math.floor(elapsed / 5);
  if (yuanIdx < 0 || yuanIdx > 2) {
    throw new Error(`置闰法三元越界：距上元符头 ${elapsed} 日`);
  }
  const entry = JU_TABLE[cycle.term];
  if (!entry) throw new Error('置闰法未知节气：' + cycle.term);
  return {
    term: cycle.term,
    yuan: YUANS[yuanIdx],
    dun: entry.dun,
    number: entry.ju[yuanIdx],
    chaoJie: cycle.gap === 0 ? '正授' : cycle.gap > 0 ? '超神' : '接气',
    gap: Math.abs(cycle.gap),
    leap: cycle.leap,
    shangYuanFuTou: dayGanzhiNameForJdn(cycle.day),
    futou: dayGanzhiNameForJdn(cycle.day + yuanIdx * 5),
  };
}

/** 规范定局法参数：'拆补'（默认，主流）/ '置闰'（古法）/ 茅山 / 阴盘 / 分家阳盘 / 刻家阴盘（实验） */
export function normalizeJuMethod(juMethod = '拆补') {
  const s = String(juMethod).trim();
  if (['拆补', '拆補', '拆补法', 'chaibu', 'chaiBu', 'chaibu-fa'].includes(s)) return '拆补';
  if (['置闰', '置閏', '置闰法', '置润', 'zhirun', 'zhiRun', '符头', '符頭', 'futou'].includes(s)) return '置闰';
  if (['茅山', '茅山法', 'maoshan', 'maoShan', 'MAOSHAN'].includes(s)) return '茅山';
  if (['阴盘', '陰盤', '阴盘法', 'yinpan', 'yinPan'].includes(s)) return '阴盘';
  if (['分家阳盘', '分家', 'fenjia', 'fenJia'].includes(s)) return '分家阳盘';
  if (['刻家阴盘', '刻家', 'kejia', 'keJia', '刻家阴盤'].includes(s)) return '刻家阴盘';
  throw new Error(
    `未知定局法「${juMethod}」：支持 '拆补'（默认，主流）、'置闰'（古法），`
    + `以及实验性的 '茅山'、'阴盘'、'分家阳盘'、'刻家阴盘'`,
  );
}

/** 规范盘式参数：'转盘'（默认）/ '飞盘' / '括囊'（后二者实验性） */
export function normalizePanMethod(panMethod = '转盘') {
  const s = String(panMethod).trim();
  if (['转盘', '轉盤', 'zhuanpan', 'zhuanPan', 'ZHUANPAN'].includes(s)) return '转盘';
  if (['飞盘', '飛盤', 'feipan', 'feiPan', 'FEIPAN'].includes(s)) return '飞盘';
  if (['括囊', '括囊盘', 'kuonang', 'kuoNang', 'KUONANG'].includes(s)) return '括囊';
  throw new Error(`未知盘式「${panMethod}」：支持 '转盘'（默认）、'飞盘'、'括囊'（后二者实验性）`);
}

/** 规范局式参数：'时家'（默认）/ 年家 / 月家 / 日家 / 太乙日家 / 山向 / 罗盘 / 套玄空（实验性） */
export function normalizeJuType(juType = '时家') {
  const s = String(juType).trim();
  const table = {
    时家: '时家', 時家: '时家', 时家奇门: '时家', shijia: '时家',
    年家: '年家', 年家奇门: '年家', nianjia: '年家', NIANJIA: '年家',
    月家: '月家', 月家奇门: '月家', yuejia: '月家', YUEJIA: '月家',
    日家: '日家', 日家奇门: '日家', rijia: '日家', RIJIA: '日家',
    太乙日家: '太乙日家', 太乙日家奇门: '太乙日家', taiyirijia: '太乙日家',
    山向: '山向', 山向奇门: '山向', shanxiang: '山向',
    罗盘: '罗盘', 奇门罗盘: '罗盘', luopan: '罗盘',
    套玄空: '套玄空', 奇门套玄空: '套玄空', taoxuankong: '套玄空',
  };
  if (table[s]) return table[s];
  throw new Error(`未知局式「${juType}」：支持 '时家'（默认）与实验性 年家/月家/日家/太乙日家/山向/罗盘/套玄空`);
}

// ============================================================
// 扩展：盘式 / 暗干五法 / 穿壬 / 起局 / 多局 / 命运局
// ============================================================
// 规则来源：docs/REF-CONGZHEN-QIMEN.md（从真奇门 2.9.1 反编译功能清单）与知识库 08-奇门遁甲。
// 反编译源码只用于理解盘式结构与枚举（f2/m 九星八神飞布、f2/f 八门飞布与括囊门、f2/o 天盘干、
// f2/h 五种暗干、f2/b 穿壬、e2/* 起局与多局），算法按公开奇门规则独立重写，不复制其代码。
// 除「时家 + 转盘 + 拆补/置闰」外，以下扩展均为实验性：未与权威排盘逐项校核，
// hints 与 meta.experimental / meta.experimentalItems 会明确标注，不静默按转盘冒充。

export const PAN_METHODS = ['转盘', '飞盘', '括囊'];
export const JU_TYPES = ['时家', '年家', '月家', '日家', '太乙日家', '山向', '罗盘', '套玄空'];
export const JU_METHODS = ['拆补', '置闰', '茅山', '阴盘', '分家阳盘', '刻家阴盘'];

/** 飞盘九星序（按宫序，含中宫天禽） */
const FEIPAN_STARS = ['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'];
/** 飞盘八门序（按宫序，无中门） */
const FEIPAN_DOORS8 = ['休门', '死门', '伤门', '杜门', '开门', '惊门', '生门', '景门'];
/** 飞盘九门序（按宫序，含中门） */
const FEIPAN_DOORS9 = ['休门', '死门', '伤门', '杜门', '中门', '开门', '惊门', '生门', '景门'];
/** 飞盘九神（阳遁 / 阴遁；飞盘有九神，中宫亦得神） */
const FEIPAN_SHENS_YANG = ['值符', '螣蛇', '太阴', '六合', '勾陈', '太常', '朱雀', '九地', '九天'];
const FEIPAN_SHENS_YIN = ['值符', '螣蛇', '太阴', '六合', '白虎', '太常', '玄武', '九地', '九天'];
/** 括囊门 = 值使门之对宫门 */
const KUONANG_DOOR = {
  休门: '景门', 生门: '死门', 伤门: '惊门', 杜门: '开门',
  景门: '休门', 死门: '生门', 惊门: '伤门', 开门: '杜门',
};
/** 九星 → 本位宫（飞盘天盘干按「星携带本位地盘干」） */
const STAR_BASE_PALACE = {
  天蓬: 1, 天芮: 2, 天冲: 3, 天辅: 4, 天禽: 5, 天心: 6, 天柱: 7, 天任: 8, 天英: 9,
};
/** 暗干三奇六仪飞布序 */
const AN_GAN_SEQ = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];
/** 「暗天干地支飞布法」干序（癸起，甲隐不布） */
const AN_GAN_FEIBU_SEQ = ['癸', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬'];
/** 宫辖地支（二十四山归宫，穿壬用）：坎子、坤未申、震卯、巽辰巳、乾戌亥、兑酉、艮丑寅、离午 */
export const PALACE_BRANCHES = {
  1: ['子'], 2: ['未', '申'], 3: ['卯'], 4: ['辰', '巳'],
  5: [], 6: ['戌', '亥'], 7: ['酉'], 8: ['丑', '寅'], 9: ['午'],
};
/** 建除十二神 */
const JIAN_CHU = ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭'];
/** 穿壬十二天将 */
export const CHUAN_REN_JIANG = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'];
/** 十二天将简称（单字） */
const CHUAN_REN_JIANG_SIMPLE = ['贵', '蛇', '雀', '合', '勾', '龙', '空', '虎', '常', '玄', '阴', '后'];
/** 月将名（中气换将） */
export const YUE_JIANG_NAME = {
  子: '神后', 丑: '大吉', 寅: '功曹', 卯: '太冲', 辰: '天罡', 巳: '太乙',
  午: '胜光', 未: '小吉', 申: '传送', 酉: '从魁', 戌: '河魁', 亥: '登明',
};
/** 昼贵 / 夜贵（《六壬元女经》表，与 liuren.js 同源） */
const ZHOU_GUIREN = {
  甲: '丑', 戊: '丑', 庚: '丑', 乙: '子', 己: '子',
  丙: '亥', 丁: '亥', 辛: '午', 壬: '巳', 癸: '巳',
};
const YE_GUIREN = {
  甲: '未', 戊: '未', 庚: '未', 乙: '申', 己: '申',
  丙: '酉', 丁: '酉', 辛: '寅', 壬: '卯', 癸: '卯',
};
/** 当前节气 → 月将（中气换将；almanac 节气名口径，小寒起） */
const YUE_JIANG_BY_TERM = {
  小寒: '丑', 大寒: '子', 立春: '子', 雨水: '亥', 惊蛰: '亥', 春分: '戌',
  清明: '戌', 谷雨: '酉', 立夏: '酉', 小满: '申', 芒种: '申', 夏至: '未',
  小暑: '未', 大暑: '午', 立秋: '午', 处暑: '巳', 白露: '巳', 秋分: '辰',
  寒露: '辰', 霜降: '卯', 立冬: '卯', 小雪: '寅', 大雪: '寅', 冬至: '丑',
};
/** 二十四节气名（almanac 口径，小寒起），用于校验与索引 */
const TERM_NAMES = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
  '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];

/** 宫在九宫数序上的下一步（1→2→…→9→1，阳顺阴逆；含中宫） */
function stepPalace(p, dir) {
  return dir > 0 ? (p % 9) + 1 : ((p + 6) % 9) + 1;
}

/** 宫在九宫数序上的下一步（跳过中五；飞盘八门用） */
function stepPalaceSkip5(p, dir) {
  let n = stepPalace(p, dir);
  if (n === 5) n = stepPalace(n, dir);
  return n;
}

/** 转盘八宫环上的下一宫（逆时针/顺时针由 dir 决定，环序固定） */
function stepRing(p, dir) {
  const i = ringIndex(p);
  return RING[mod(i + dir, 8)];
}

/** 三奇六仪序上的下一干（戊己庚辛壬癸丁丙乙 循环） */
function nextAnGan(gan) {
  const i = AN_GAN_SEQ.indexOf(gan);
  return AN_GAN_SEQ[mod(i + 1, 9)];
}

/** 飞盘/括囊排盘：九星、九神、八门（可含中门）、天盘干；括囊另出括囊门层 */
function buildFlyPan({
  panMethod, diPan, isYang, xunPalace, hourIdx, hourStem, jiGong, jiPalace,
  feiPanUseZhongMen, kuoNangTianPanGanZiFei,
}) {
  const ordinalIdx = Math.floor(hourIdx / 10);
  const doorStep = hourIdx % 10;
  const baseDir = isYang ? 1 : -1;
  // 值符星 / 值使门（与转盘同源：旬首六仪本位）
  const zhiFuStar = xunPalace === 5 ? '天禽' : BASE_STAR[xunPalace];
  const zhiShiDoor = xunPalace === 5
    ? ((isYang && jiGong === '阳艮阴坤') ? '生门' : '死门')
    : BASE_DOOR[xunPalace];
  const originPalace = xunPalace === 5 ? jiPalace : xunPalace;
  // 值符落宫 = 时干地盘宫（甲隐旬首仪）；飞盘不寄宫，落中宫即在中宫
  const landPalace = hourStem === '甲' ? xunPalace : palaceOfStem(diPan, hourStem);
  const isKuo = panMethod === '括囊';
  const starDir = isKuo ? baseDir : 1;          // 飞盘九星恒顺飞；括囊阳顺阴逆
  const shenDir = baseDir;                       // 九神：阳顺阴逆
  const doorDir = isKuo ? baseDir : 1;           // 飞盘八门恒顺飞；括囊阳顺阴逆

  // ---- 九星飞布（含中宫，九星俱全） ----
  const starPan = {};
  let starIdx = FEIPAN_STARS.indexOf(zhiFuStar);
  let p = landPalace;
  for (let k = 0; k < 9; k += 1) {
    starPan[p] = FEIPAN_STARS[mod(starIdx + k, 9)];
    p = stepPalace(p, starDir);
  }

  // ---- 九神飞布（含中宫） ----
  const shens = isYang ? FEIPAN_SHENS_YANG : FEIPAN_SHENS_YIN;
  const shenPan = {};
  p = landPalace;
  for (let k = 0; k < 9; k += 1) {
    shenPan[p] = shens[k];
    p = stepPalace(p, shenDir);
  }

  // ---- 八门/九门飞布 ----
  let landDoor = originPalace;
  for (let k = 0; k < doorStep; k += 1) landDoor = stepPalace(landDoor, baseDir);
  const landDoorRaw = landDoor;
  if (!feiPanUseZhongMen && landDoor === 5) landDoor = jiPalace;
  const doorList = feiPanUseZhongMen ? FEIPAN_DOORS9 : FEIPAN_DOORS8;
  const doorPan = {};
  let doorIdx = doorList.indexOf(zhiShiDoor);
  p = landDoor;
  const doorCount = feiPanUseZhongMen ? 9 : 8;
  for (let k = 0; k < doorCount; k += 1) {
    doorPan[p] = doorList[mod(doorIdx + k, doorList.length)];
    p = feiPanUseZhongMen ? stepPalace(p, doorDir) : stepPalaceSkip5(p, doorDir);
  }

  // ---- 天盘干 ----
  const tianPan = {};
  if (isKuo && kuoNangTianPanGanZiFei) {
    // 括囊：天盘干自飞九宫（值符携旬首六仪，从值符落宫起，阳顺阴逆布三奇六仪）
    let g = diPan[xunPalace] || '';
    let pp = landPalace;
    for (let k = 0; k < 9; k += 1) {
      tianPan[pp] = g;
      pp = stepPalace(pp, baseDir);
      g = nextAnGan(g);
    }
  } else {
    // 飞盘：星携本位地盘干
    for (let k = 1; k <= 9; k += 1) {
      tianPan[k] = diPan[STAR_BASE_PALACE[starPan[k]]] || '';
    }
  }

  // ---- 括囊门层：值使门之对宫门，反向飞布 ----
  let kuoNangDoorPan = null;
  if (isKuo) {
    const oppositeDoor = KUONANG_DOOR[zhiShiDoor];
    const oppositeBase = DOOR_BASE_PALACE[oppositeDoor];
    let kp = oppositeBase;
    for (let k = 0; k < doorStep; k += 1) kp = stepPalace(kp, isYang ? -1 : 1);
    if (!feiPanUseZhongMen && kp === 5) kp = jiPalace;
    kuoNangDoorPan = {};
    let ki = doorList.indexOf(oppositeDoor);
    const kDir = isYang ? -1 : 1;
    const kCount = feiPanUseZhongMen ? 9 : 8;
    for (let k = 0; k < kCount; k += 1) {
      kuoNangDoorPan[kp] = doorList[mod(ki + k, doorList.length)];
      kp = feiPanUseZhongMen ? stepPalace(kp, kDir) : stepPalaceSkip5(kp, kDir);
    }
  }

  return {
    zhiFuStar, zhiShiDoor, originPalace, landPalace, landDoor, landDoorRaw,
    starPan, shenPan, doorPan, tianPan, kuoNangDoorPan,
    starDir, shenDir, doorDir, ordinalIdx,
  };
}

/** 二十四山（罗盘层）：山名 → 九宫（八宫各三山） */
export const ERSHI_SI_SHAN = [
  { shan: '壬', palace: 1 }, { shan: '子', palace: 1 }, { shan: '癸', palace: 1 },
  { shan: '丑', palace: 8 }, { shan: '艮', palace: 8 }, { shan: '寅', palace: 8 },
  { shan: '甲', palace: 3 }, { shan: '卯', palace: 3 }, { shan: '乙', palace: 3 },
  { shan: '辰', palace: 4 }, { shan: '巽', palace: 4 }, { shan: '巳', palace: 4 },
  { shan: '丙', palace: 9 }, { shan: '午', palace: 9 }, { shan: '丁', palace: 9 },
  { shan: '未', palace: 2 }, { shan: '坤', palace: 2 }, { shan: '申', palace: 2 },
  { shan: '庚', palace: 7 }, { shan: '酉', palace: 7 }, { shan: '辛', palace: 7 },
  { shan: '戌', palace: 6 }, { shan: '乾', palace: 6 }, { shan: '亥', palace: 6 },
];
/** 洛书九星（玄空运星）名 */
const JIU_XING_YUN = ['一白', '二黑', '三碧', '四绿', '五黄', '六白', '七赤', '八白', '九紫'];

/** 某山（二十四山）→ 宫 */
export function palaceOfShan(shan) {
  const item = ERSHI_SI_SHAN.find((x) => x.shan === shan);
  return item ? item.palace : null;
}

/** 穿壬：十二天盘支 / 月将 / 十二天将 / 建除十二神（依据 f2/b 结构重写） */
function buildChuanRen({ yueJiangBranch, refHourBranch, refGan }) {
  const hourIdx = BRANCHES.indexOf(refHourBranch);
  const jiangIdx = BRANCHES.indexOf(yueJiangBranch);
  const items = [];
  for (let i = 0; i < 12; i += 1) {
    const tianPan = BRANCHES[mod(jiangIdx + (i - hourIdx), 12)];
    items.push({
      branch: BRANCHES[i],
      tianPan,
      yueJiang: YUE_JIANG_NAME[tianPan],
      shenJiang: '',
      shenJiangSimple: '',
      jianXing: JIAN_CHU[mod(i - hourIdx, 12)],
    });
  }
  // 昼夜：卯至申为昼（与六壬同）；贵人依日干（刻家用时干）
  const dayNight = (hourIdx >= 3 && hourIdx <= 8) ? '昼' : '夜';
  const guirenBranch = (dayNight === '昼' ? ZHOU_GUIREN : YE_GUIREN)[refGan] || '';
  let pos = items.findIndex((it) => it.tianPan === guirenBranch);
  if (pos < 0) pos = 0;
  // 贵人临地盘亥子丑寅卯辰顺布、巳午未申酉戌逆布
  const shun = [11, 0, 1, 2, 3, 4].includes(pos);
  for (let k = 0; k < 12; k += 1) {
    const idx = mod(pos + (shun ? k : -k), 12);
    items[idx].shenJiang = CHUAN_REN_JIANG[k];
    items[idx].shenJiangSimple = CHUAN_REN_JIANG_SIMPLE[k];
  }
  return {
    yueJiang: { branch: yueJiangBranch, name: YUE_JIANG_NAME[yueJiangBranch] || '' },
    dayNight,
    guiren: { branch: guirenBranch, shun },
    items,
  };
}

/** 五种暗干排法（默认「八门地盘携带之干」） */
function computeAnGan(ctx) {
  const {
    mode, diPan, tianPan, starPan, doorPan, landDoor,
    xunYi, xunPalace, isYang, panMethod, refStem,
  } = ctx;
  const out = {};
  for (let p = 1; p <= 9; p += 1) out[p] = '';
  const stem = refStem === '甲' ? xunYi : refStem;
  const dir = isYang ? 1 : -1;
  // 转盘专属两法在飞盘/括囊下退化为「暗天干地支飞布法」（与从真默认回退一致）
  let effective = mode;
  if (panMethod !== '转盘'
    && (mode === '八门地盘携带之干' || mode === '时干加值使转天盘,遇伏吟入中')) {
    effective = '暗天干地支飞布法';
  }
  if (effective === '八门地盘携带之干') {
    for (let p = 1; p <= 9; p += 1) {
      if (p === 5 || !doorPan[p] || doorPan[p] === '中门') continue;
      out[p] = diPan[DOOR_BASE_PALACE[doorPan[p]]] || '';
    }
    return { anGan: out, effective, note: '暗干：按「八门地盘携带之干」排（门落宫携带其本位地盘干）。' };
  }
  if (effective === '时干找值使飞布,遇地盘相同入中') {
    let start = landDoor;
    if (diPan[landDoor] === stem) start = 5;
    let p = start;
    let g = stem;
    for (let k = 0; k < 9; k += 1) {
      out[p] = g;
      g = nextAnGan(g);
      p = stepPalace(p, dir);
    }
    return { anGan: out, effective, note: '暗干：时干找值使飞布（值使宫地盘干与时干相同则入中起布）。' };
  }
  if (effective === '时干找值使飞布,遇宫内有时干则入中') {
    let start = landDoor;
    if (diPan[landDoor] === stem || tianPan[landDoor] === stem) start = 5;
    let p = start;
    let g = stem;
    for (let k = 0; k < 9; k += 1) {
      out[p] = g;
      g = nextAnGan(g);
      p = stepPalace(p, dir);
    }
    return { anGan: out, effective, note: '暗干：时干找值使飞布（值使宫内见时干则入中起布）。' };
  }
  if (effective === '时干加值使转天盘,遇伏吟入中') {
    const fuYin = diPan[1] === tianPan[1] && starPan[1] === '天蓬' && doorPan[1] === '休门';
    if (fuYin) {
      // 伏吟入中：时干（甲隐旬首仪）入中，其余按三奇六仪序阳顺阴逆布九宫
      let p = 5;
      let g = stem;
      for (let k = 0; k < 9; k += 1) {
        out[p] = g;
        g = nextAnGan(g);
        p = stepPalace(p, dir);
      }
      return { anGan: out, effective, note: '暗干：时干加值使转天盘，遇伏吟入中（时干入中宫起布）。' };
    }
    // 非伏吟：自值使宫起，干序三奇六仪，沿转盘八宫环顺行
    let p = landDoor;
    let g = stem;
    for (let k = 0; k < 8; k += 1) {
      out[p] = g;
      g = nextAnGan(g);
      p = stepRing(p, 1);
    }
    out[5] = '';
    return { anGan: out, effective, note: '暗干：时干加值使转天盘（值使宫起，沿八宫环布）。' };
  }
  // 「暗天干地支飞布法」：自旬首宫起，干序癸乙丙丁戊己庚辛壬，阳顺阴逆飞九宫
  let p = xunPalace;
  for (let k = 0; k < 9; k += 1) {
    out[p] = AN_GAN_FEIBU_SEQ[k % 9];
    p = stepPalace(p, dir);
  }
  return { anGan: out, effective, note: '暗干：暗天干地支飞布法（旬首宫起，癸乙丙丁戊己庚辛壬，阳顺阴逆）。' };
}

/** 三元（六十甲子序）→ 三元名；上元符头支为子午卯酉 */
function yuanOfFuTouBranch(branch) {
  const i = BRANCHES.indexOf(branch);
  if ([0, 3, 6, 9].includes(i)) return { yuan: '上元', idx: 0 };
  if ([2, 5, 8, 11].includes(i)) return { yuan: '中元', idx: 1 };
  return { yuan: '下元', idx: 2 };
}

/** 月家三元（从真口径）：寅申巳亥上元、子午卯酉中元、辰戌丑未下元 */
function yuanOfMonthFuTou(branch) {
  const i = BRANCHES.indexOf(branch);
  if ([2, 5, 8, 11].includes(i)) return { yuan: '上元', idx: 0 };
  if ([0, 3, 6, 9].includes(i)) return { yuan: '中元', idx: 1 };
  return { yuan: '下元', idx: 2 };
}

/** 三元九运（年家/套玄空用）：1864 甲子上元起，每运 20 年、三元各 60 年 */
function sanYuanJiuYun(year) {
  const pos = mod(year - 1864, 180);
  const yuanIdx = Math.floor(pos / 60);
  const yun = Math.floor(pos / 20) + 1;
  return { yuanIdx, yuan: YUANS[yuanIdx], yun, cyclePos: pos };
}

/** 刻干支：每时辰十二刻（10 分钟一刻）；刻支自时支位顺推，刻干依五鼠遁自时干起 */
function keGanzhiOf(date, shiGan) {
  const bp = beijingParts(date);
  const keZhiIdx = mod((bp.hour % 2 === 0 ? 6 : 0) + Math.floor(bp.minute / 10), 12);
  const keZhi = BRANCHES[keZhiIdx];
  const ziStem = WU_SHU_DUN[shiGan] || '甲';
  const keGan = STEMS[mod(STEMS.indexOf(ziStem) + keZhiIdx, 10)];
  return { keGan, keZhi, keIdx: keZhiIdx };
}

/** 五鼠遁：日干（或时干）→ 子时干 */
const WU_SHU_DUN = {
  甲: '甲', 己: '甲', 乙: '丙', 庚: '丙', 丙: '戊', 辛: '戊',
  丁: '庚', 壬: '庚', 戊: '壬', 癸: '壬',
};


// ============================================================
// 主函数
// ============================================================

/**
 * 奇门遁甲排盘（默认「时家 + 转盘 + 拆补法」；飞盘/括囊、多局、其余起局法为实验性扩展）。
 *
 * @param {object} [options]
 * @param {Date|string|number} [options.date=new Date()] 北京时间意义下的起局时刻
 * @param {'转盘'|'飞盘'|'括囊'} [options.method='转盘'] 盘式；飞盘/括囊为实验性
 * @param {'拆补'|'置闰'|'茅山'|'阴盘'|'分家阳盘'|'刻家阴盘'} [options.juMethod='拆补'] 定局法
 * @param {'时家'|'年家'|'月家'|'日家'|'太乙日家'|'山向'|'罗盘'|'套玄空'} [options.juType='时家']
 *   局式（除时家外均为实验性，hints 与 meta 会标注未校核）
 * @param {number} [options.longitude] 可选：经度（给出时按真太阳时定时辰，与 getAlmanac 约定一致）
 * @param {'坤二'|'阳艮阴坤'} [options.jiGong='坤二'] 中五寄宫
 * @param {'nextDay'|'sameDay'} [options.lateZi='nextDay'] 晚子时口径
 * @param {number} [options.zhirunDays=8] 置闰触发天数 8 / 9
 * @param {string} [options.anGanMode] 暗干排法（五种，见 AN_GAN_MODES）
 * @param {boolean} [options.chuanRen=true] 是否附穿壬四层（地盘支 / 月将 / 神将 / 建星）
 * @param {boolean} [options.feiPanUseZhongMen=false] 飞盘/括囊是否用中门（九门）
 * @param {boolean} [options.kuoNangTianPanGanZiFei=false] 括囊天盘干是否「自飞九宫」
 * @param {string|null} [options.overrideHourGanzhi=null] 内部参数：覆盖排盘所用「时柱」（命运局用）
 * @param {string|null} [options.shan] 山向局：坐山（二十四山）
 * @param {string|null} [options.xiang] 山向局：朝向
 * @returns {object} 盘面；扩展项以 meta.experimental / meta.experimentalItems 标注
 */
export function castQimen(options = {}) {
  const {
    date = new Date(),
    method = '转盘',
    juMethod: juMethodRaw = '拆补',
    juType: juTypeRaw = '时家',
    longitude,
    jiGong: jiGongRaw = '坤二',
    lateZi: lateZiRaw = 'nextDay',
    zhirunDays = 8,
    anGanMode: anGanModeRaw = AN_GAN_MODE_DEFAULT,
    chuanRen: chuanRenRaw = true,
    feiPanUseZhongMen = false,
    kuoNangTianPanGanZiFei = false,
    overrideHourGanzhi = null,
    shan = null,
    xiang = null,
  } = options;
  const juMethod = normalizeJuMethod(juMethodRaw);
  const panMethod = normalizePanMethod(method);
  const juType = normalizeJuType(juTypeRaw);
  const jiGong = jiGongRaw === '阳艮阴坤' ? '阳艮阴坤' : '坤二';
  const lateZi = lateZiRaw === 'sameDay' ? 'sameDay' : 'nextDay';
  const zhirunTriggerGap = Number(zhirunDays) === 9 ? 9 : 8;
  const anGanMode = AN_GAN_MODES.includes(anGanModeRaw) ? anGanModeRaw : AN_GAN_MODE_DEFAULT;

  const rawAlm = getAlmanac(date, longitude != null ? { longitude } : {});
  let alm = rawAlm;
  let lateZiAdjusted = false;
  if (lateZi === 'sameDay') {
    const bp = beijingParts(date);
    if (bp.hour >= 23) {
      // 夜子时：日柱不换（取当日午时），时柱按次日日干起子时。
      const noon = new Date(Date.UTC(bp.year, bp.month - 1, bp.day, 4, 0, 0));
      const base = getAlmanac(noon);
      const nextStem = STEMS[(STEMS.indexOf(base.dayGanzhi[0]) + 1) % 10];
      const hourStem = STEMS[(STEMS.indexOf(nextStem) * 2) % 10];
      alm = {
        ...base,
        hourGanzhi: `${hourStem}子`,
        enteredNextDay: false,
      };
      lateZiAdjusted = true;
    }
  }
  const almTermName = alm.solarTerm.current.name; // 实际所在节气（拆补/置闰/月将的参照）
  const yearGanzhi = alm.yearGanzhi;
  const monthGanzhi = alm.monthGanzhi;
  const rawDayGanzhi = alm.dayGanzhi;
  const rawHourGanzhi = alm.hourGanzhi;
  const ke = juMethod === '刻家阴盘' ? keGanzhiOf(date, rawHourGanzhi[0]) : null;

  // 排盘所用「时柱」参考：时家=真时柱；刻家=刻柱；多局=年/月/日柱；命运局可覆盖
  let refGanzhi = rawHourGanzhi;
  let refLabel = '时柱';
  if (ke) { refGanzhi = `${ke.keGan}${ke.keZhi}`; refLabel = '刻柱'; }
  if (juType === '日家' || juType === '太乙日家') { refGanzhi = rawDayGanzhi; refLabel = '日柱'; }
  else if (juType === '月家') { refGanzhi = monthGanzhi; refLabel = '月柱'; }
  else if (juType === '年家' || juType === '山向' || juType === '套玄空') { refGanzhi = yearGanzhi; refLabel = '年柱'; }
  if (overrideHourGanzhi) { refGanzhi = overrideHourGanzhi; refLabel = '时柱'; }

  const dayGanzhi = rawDayGanzhi;
  const hourGanzhi = refGanzhi; // 兼容旧字段：盘面「时柱」（多局时为年/月/日柱）
  const hourIdx = ganzhiIndex(refGanzhi);

  // ---- 1. 定局 ----
  let termName = almTermName;
  let futou = '';
  let futouBranch = '';
  let yuan = '上元';
  let dun = JU_TABLE[termName] ? JU_TABLE[termName].dun : '阳遁';
  let ju = 1;
  let zhirunInfo = null;
  const juExtra = {};
  if (juType === '年家' || juType === '山向' || juType === '套玄空') {
    // 年家（实验，未校核）：阴遁；三元九运定三元；局数 1/4/7
    const year = alm.effectiveDate ? alm.effectiveDate.year : beijingParts(date).year;
    const sy = sanYuanJiuYun(year);
    dun = '阴遁';
    yuan = sy.yuan;
    ju = [1, 4, 7][sy.yuanIdx];
    ({ futou, branch: futouBranch } = futouOfDay(yearGanzhi));
    juExtra.jiuYun = sy.yun;
    juExtra.cyclePos = sy.cyclePos;
  } else if (juType === '月家') {
    // 月家（实验，未校核）：阴遁；符头（以年柱求）定三元；局数 1/7/4
    dun = '阴遁';
    ({ futou, branch: futouBranch } = futouOfDay(yearGanzhi));
    const mm = yuanOfMonthFuTou(futouBranch);
    yuan = mm.yuan;
    ju = [1, 7, 4][mm.idx];
  } else if (juType === '日家' || juType === '太乙日家') {
    // 日家（实验，未校核）：阴阳遁看节气；三元由日柱符头定；局数 阳 1/7/4、阴 9/3/6
    ({ futou, branch: futouBranch } = futouOfDay(rawDayGanzhi));
    const yy = yuanOfFuTouBranch(futouBranch);
    yuan = yy.yuan;
    dun = JU_TABLE[almTermName].dun;
    ju = dun === '阳遁' ? [1, 7, 4][yy.idx] : [9, 3, 6][yy.idx];
  } else if (juMethod === '置闰') {
    const zj = zhirunJuFor(date, alm, { triggerGap: zhirunTriggerGap });
    zhirunInfo = {
      chaoJie: zj.chaoJie,
      chaoJieDays: zj.gap,
      leap: zj.leap,
      shangYuanFuTou: zj.shangYuanFuTou,
    };
    termName = zj.term;
    futou = zj.futou;
    futouBranch = futou[1];
    yuan = zj.yuan;
    dun = zj.dun;
    ju = zj.number;
  } else if (juMethod === '拆补') {
    termName = almTermName;
    ({ futou, branch: futouBranch, yuan } = futouOfDay(dayGanzhi));
    ({ dun, number: ju } = juForTerm(termName, yuan));
  } else if (juMethod === '茅山') {
    // 茅山法（实验）：以交节后天数分三元（1–5 上元、6–10 中元、11–15 下元），局数同节气三元表
    const termAt = new Date(alm.solarTerm.current.termAt || alm.solarTerm.current.at);
    const days = Math.max(0, Math.floor((date.getTime() - termAt.getTime()) / 86400000));
    const idx = Math.min(2, Math.floor(days / 5));
    yuan = YUANS[idx];
    ({ dun, number: ju } = juForTerm(almTermName, yuan));
    juExtra.maoShanDays = days;
  } else if (juMethod === '阴盘') {
    // 阴盘（实验）：局数 =（年支序 + 农历月 + 农历日 + 时支序 + 2）% 9，余 0 作 9
    const lunar = alm.lunar;
    const num = mod(
      BRANCHES.indexOf(yearGanzhi[1]) + Math.abs(lunar.month) + lunar.day
      + BRANCHES.indexOf(refGanzhi[1]) + 2,
      9,
    ) || 9;
    dun = JU_TABLE[almTermName].dun;
    ju = num;
    yuan = '—';
    ({ futou, branch: futouBranch } = futouOfDay(dayGanzhi));
    juExtra.lunar = { month: lunar.month, day: lunar.day, isLeap: Boolean(lunar.isLeap) };
  } else if (juMethod === '分家阳盘') {
    // 分家阳盘（实验）：阴阳遁看时支（子至午阳、未至亥阴）；局数按三元固定 1/7/4 或 9/3/6
    dun = BRANCHES.indexOf(refGanzhi[1]) <= 6 ? '阳遁' : '阴遁';
    ({ futou, branch: futouBranch } = futouOfDay(dayGanzhi));
    const yy = yuanOfFuTouBranch(futouBranch);
    yuan = yy.yuan;
    ju = dun === '阳遁' ? [1, 7, 4][yy.idx] : [9, 3, 6][yy.idx];
  } else if (juMethod === '刻家阴盘') {
    // 刻家阴盘（实验）：局数 =（年支 + 农历月 + 农历日 + 时支 + 刻支 + 3）% 9，余 0 作 9
    const lunar = alm.lunar;
    const keZhiIdx = BRANCHES.indexOf(ke.keZhi);
    const num = mod(
      BRANCHES.indexOf(yearGanzhi[1]) + Math.abs(lunar.month) + lunar.day
      + BRANCHES.indexOf(rawHourGanzhi[1]) + keZhiIdx + 3,
      9,
    ) || 9;
    dun = JU_TABLE[almTermName].dun;
    ju = num;
    yuan = '—';
    ({ futou, branch: futouBranch } = futouOfDay(dayGanzhi));
    juExtra.ke = { gan: ke.keGan, zhi: ke.keZhi };
    juExtra.lunar = { month: lunar.month, day: lunar.day, isLeap: Boolean(lunar.isLeap) };
  }
  const isYang = dun === '阳遁';
  // 中五寄宫：默认「统一寄坤二」；可选「阳遁寄艮八、阴遁寄坤二」。
  const jiPalace = jiGong === '阳艮阴坤' ? (isYang ? 8 : 2) : 2;

  // ---- 2. 地盘三奇六仪 ----
  const diPan = diPanLayout(dun, ju);

  // ---- 3. 旬首、值符、值使 ----
  const xunIndex = Math.floor(hourIdx / 10); // 0..5
  const xunShouName = ganzhiName(xunIndex * 10); // 甲子 / 甲戌 / …
  const xunYi = XUN_YI[xunIndex];
  const xunPalace = palaceOfStem(diPan, xunYi); // 旬首六仪落宫（可能为 5）

  // 值符：旬首六仪所在宫之本位九星（中五 → 天禽，按寄宫发用）
  const zhiFuStar = xunPalace === 5 ? '天禽' : BASE_STAR[xunPalace];
  // 值使：同宫本位八门（中五 → 「阳艮阴坤」且阳遁取生门，否则死门，按寄宫发用）
  const zhiShiDoor = xunPalace === 5
    ? ((isYang && jiGong === '阳艮阴坤') ? '生门' : '死门')
    : BASE_DOOR[xunPalace];
  // 值符原宫/值使原宫按寄宫处理
  const originPalace = xunPalace === 5 ? jiPalace : xunPalace;

  const hourStem = hourGanzhi[0];
  let landPalace;
  let landDoor;
  let landDoorRaw;
  let deltaStar = 0;
  let deltaDoor = 0;
  let tianPan = {};
  let starPan = {};
  let doorPan = {};
  let shenPan = {};
  let kuoNangDoorPan = null;
  let zhiFuGan = '';
  if (panMethod === '转盘') {
    // 值符落宫 = 时干地盘宫；时干为甲则隐于旬首六仪，即值符原宫；落中五则寄宫
    landPalace = hourStem === '甲' ? xunPalace : palaceOfStem(diPan, hourStem);
    if (landPalace === 0) landPalace = xunPalace;
    if (landPalace === 5) landPalace = jiPalace; // 中宫不显星门神，按寄宫落宫
    const originRing = ringIndex(originPalace);
    const landRing = ringIndex(landPalace);
    deltaStar = mod(landRing - originRing, 8);

    // ---- 4. 天盘干、九星（随值符整体转） ----
    for (let i = 0; i < 8; i += 1) {
      const p = RING[i];
      const src = RING[mod(i - deltaStar, 8)];
      tianPan[p] = diPan[src];
      starPan[p] = RING_STARS[mod(i - deltaStar, 8)];
    }
    // 中五：地盘干不动；天盘干依转盘例，中宫不参与旋转（盘面同时给出，便于对照）
    tianPan[5] = diPan[5];
    starPan[5] = '天禽';
    zhiFuGan = tianPan[landPalace];

    // ---- 5. 八门（值使「加时」，再整体转） ----
    // 旬内序数：甲子时=0、乙丑=1 … 癸酉=9（与日干进序一致）
    const step = hourIdx % 10;
    landDoor = isYang ? mod(originPalace - 1 + step, 9) + 1 : mod(originPalace - 1 - step, 9) + 1;
    landDoorRaw = landDoor;
    if (landDoor === 5) landDoor = jiPalace; // 落中五按寄宫
    deltaDoor = mod(ringIndex(landDoor) - ringIndex(originPalace), 8);
    for (let i = 0; i < 8; i += 1) {
      doorPan[RING[i]] = RING_DOORS[mod(i - deltaDoor, 8)];
    }

    // ---- 6. 八神（值符神起于值符落宫，阳顺阴逆） ----
    for (let i = 0; i < 8; i += 1) {
      const ringOffset = isYang ? i : -i;
      shenPan[RING[mod(landRing + ringOffset, 8)]] = SHENS[i];
    }
  } else {
    // ---- 飞盘 / 括囊：九星九神飞九宫（含中宫）、八门顺飞（括囊另出括囊门），天盘干随星携干 ----
    const fly = buildFlyPan({
      panMethod, diPan, isYang, xunPalace, hourIdx, hourStem, jiGong, jiPalace,
      feiPanUseZhongMen, kuoNangTianPanGanZiFei,
    });
    landPalace = fly.landPalace;
    landDoor = fly.landDoor;
    landDoorRaw = fly.landDoorRaw;
    tianPan = fly.tianPan;
    starPan = fly.starPan;
    doorPan = fly.doorPan;
    shenPan = fly.shenPan;
    kuoNangDoorPan = fly.kuoNangDoorPan;
    zhiFuGan = tianPan[landPalace] || '';
  }

  // ---- 7. 旬空、驿马（时家以「时柱」为空马主，多局时以所用年/月/日柱为准） ----
  const kongWang = xunKong(hourGanzhi);
  const dayKong = xunKong(dayGanzhi);
  const maXing = MA_BY_BRANCH[hourGanzhi[1]] || MA_BY_BRANCH[dayGanzhi[1]];
  const kongSet = new Set(kongWang.map((b) => palaceOfBranch(b)).filter((p) => p));
  const maSet = new Set([palaceOfBranch(maXing)].filter((p) => p));

  // ---- 8. 暗干、旺衰与九宫汇总 ----
  const monthBranch = alm.monthBranch || (alm.monthGanzhi ? alm.monthGanzhi[1] : '');
  const seasonElement = SEASON_ELEMENT[monthBranch] || '';
  const anGanInfo = computeAnGan({
    mode: anGanMode,
    diPan, tianPan, starPan, doorPan, landDoor, xunYi, xunPalace, isYang, panMethod,
    refStem: hourStem,
  });
  const anGan = anGanInfo.anGan;
  // 穿壬：地盘支 / 月将加时天盘支 / 十二天将 / 建除十二神
  const yueJiangBranch = YUE_JIANG_BY_TERM[almTermName] || '';
  const chuanRen = chuanRenRaw === false ? null : buildChuanRen({
    yueJiangBranch,
    refHourBranch: hourGanzhi[1],
    refGan: juMethod === '刻家阴盘' ? hourGanzhi[0] : dayGanzhi[0],
  });
  const chuanRenByBranch = {};
  if (chuanRen) for (const it of chuanRen.items) chuanRenByBranch[it.branch] = it;

  const palaces = [];
  const isFly = panMethod !== '转盘';
  for (let p = 1; p <= 9; p += 1) {
    const info = PALACE_INFO[p];
    const notes = [];
    const star = starPan[p] || '';
    let door = doorPan[p] || '';
    if (p === 5 && !isFly) door = '';
    const starElement = STAR_ELEMENT[star] || '';
    const doorElement = DOOR_ELEMENT[door] || '';
    if (p === 5) {
      if (isFly) {
        notes.push(`${panMethod}九宫皆布星神：中五亦得${star}/${shenPan[p] || ''}`);
        if (door) notes.push(`中五得${door}（${feiPanUseZhongMen ? '启用中门' : '中门已显示'}）`);
      } else {
        notes.push(`中五宫：按「${jiGong}」寄${palaceName(jiPalace)}；天盘干不转，九星天禽寄宫`);
      }
      if (xunPalace === 5) notes.push(`旬首六仪落中五，值符天禽按寄${palaceName(jiPalace)}发用`);
    } else if (!isFly && star === '天芮') {
      notes.push(`天禽星寄${palaceName(jiPalace)}，与天芮同宫（转盘常例）`);
    }
    if (p === landPalace) notes.push(`值符${zhiFuStar}落${info.gua}${p}宫`);
    if (p === landDoor) notes.push(`值使${zhiShiDoor}落${info.gua}${p}宫`);
    if (landDoorRaw === 5 && !isFly) notes.push(`值使落中五，寄${palaceName(jiPalace)}`);
    const { kong, ma } = palaceFlags(p, kongSet, maSet);
    if (kong) notes.push('旬空');
    if (ma) notes.push('驿马');
    // 穿壬四层：地盘地支 / 月将加时天盘支 / 十二天将 / 建除十二神
    const gongBranches = PALACE_BRANCHES[p] || [];
    const gongItems = chuanRen
      ? gongBranches.map((b) => chuanRenByBranch[b]).filter(Boolean)
      : [];
    const chuanRenGong = chuanRen
      ? {
        diPanDiZhi: gongBranches,
        items: gongItems,
        // 单支宫给便捷直读字段
        ...(gongItems.length === 1 ? {
          tianPan: gongItems[0].tianPan,
          yueJiang: gongItems[0].yueJiang,
          shenJiang: gongItems[0].shenJiang,
          jianXing: gongItems[0].jianXing,
        } : {}),
      }
      : null;
    palaces.push({
      index: p,
      gua: info.gua,
      direction: info.direction,
      element: info.element,
      diPanGan: diPan[p],
      tianPanGan: tianPan[p] || '',
      star,
      door,
      shen: (p === 5 && !isFly) ? '' : (shenPan[p] || ''),
      anGan: anGan[p] || '',
      ...(kuoNangDoorPan ? { kuoNangDoor: kuoNangDoorPan[p] || '' } : {}),
      chuanRen: chuanRenGong,
      starElement,
      doorElement,
      starWangShuai: wangShuaiOf(seasonElement, starElement),
      doorWangShuai: wangShuaiOf(seasonElement, doorElement),
      kong,
      ma,
      notes,
    });
  }

  // ---- 9. hints ----
  const hints = [];
  const experimentalItems = [];
  if (panMethod !== '转盘') experimentalItems.push(panMethod);
  if (juType !== '时家') experimentalItems.push(juType);
  if (!['拆补', '置闰'].includes(juMethod)) experimentalItems.push(juMethod);
  if (anGanMode !== AN_GAN_MODE_DEFAULT || anGanInfo.effective !== AN_GAN_MODE_DEFAULT) {
    experimentalItems.push(`暗干法：${anGanInfo.effective}`);
  }
  if (experimentalItems.length > 0) {
    hints.push(
      `【实验·未校核】本盘含：${experimentalItems.join('、')}。`
      + '规则依据 docs/REF-CONGZHEN-QIMEN.md 反编译结构与公开奇门法理重写，未与权威排盘逐项校核，仅供参考。',
    );
  }
  const panLabel = panMethod === '转盘' ? '转盘' : `${panMethod}（实验）`;
  const refWord = juType === '时家' ? '时柱' : refLabel;
  if (juType !== '时家') {
    hints.push(
      `【实验】${juType}奇门·${panLabel}：${termName}${yuan}，${dun}${ju}局；`
      + `以${refWord}${hourGanzhi}为盘面用神参照（年家/月家取阴遁、日家随节气，属简化口径）。`,
    );
  } else if (juMethod === '置闰' && zhirunInfo) {
    const chaoNote = zhirunInfo.chaoJie === '正授'
      ? '正授（符头与节气同日）'
      : zhirunInfo.chaoJie === '超神'
        ? `超神（符头先于节气 ${zhirunInfo.chaoJieDays} 日）`
        : `接气（节气先于符头 ${zhirunInfo.chaoJieDays} 日）`;
    hints.push(
      `${panLabel}·置闰法（古法可选；主流默认拆补）：` +
      `${termName}${yuan}，${dun}${ju}局；上元符头${zhirunInfo.shangYuanFuTou}，本元符头${futou}（日支${futouBranch}定${yuan}），` +
      `${chaoNote}${zhirunInfo.leap ? '；属芒种/大雪闰奇三元' : ''}。现节气为${almTermName}。`,
    );
  } else if (juMethod === '拆补') {
    hints.push(
      `${panLabel}·拆补法（主流默认定局法；可传 juMethod:'置闰' 用古法超神接气置闰）：` +
      `${termName}${yuan}，${dun}${ju}局；符头${futou}日（日支${futouBranch}定${yuan}）。`,
    );
  } else {
    hints.push(
      `${panLabel}·${juMethod}法（实验·未校核）：${termName}${yuan}，${dun}${ju}局；`
      + `依据反编译所载起局结构重写，局数与三元口径待校核。`,
    );
  }
  hints.push(
    `${refWord}${hourGanzhi}，旬首${xunShouName}（${xunShouName[1]}旬，${xunYi}仪），` +
    `值符${zhiFuStar}落${PALACE_INFO[landPalace].gua}${landPalace}宫，` +
    `值使${zhiShiDoor}落${PALACE_INFO[landDoor].gua}${landDoor}宫。`,
  );
  hints.push(`值符随时干：值符${zhiFuStar}携天盘干「${zhiFuGan}」落${PALACE_INFO[landPalace].gua}${landPalace}宫（时干${hourStem === '甲' ? '甲隐于' + xunYi : hourStem}）。`);
  if (panMethod === '转盘') {
    hints.push(`八神：${dun}${isYang ? '顺时针' : '逆时针'}布值符、螣蛇、太阴、六合、白虎、玄武、九地、九天。`);
    hints.push(`中五宫寄${palaceName(jiPalace)}（当前口径：${jiGong}）：八门、八神不入中宫；天禽随寄宫。`);
  } else if (panMethod === '飞盘') {
    hints.push(
      '飞盘：九星、九神自值符落宫顺飞九宫（中宫亦布星神）；'
      + `八门自值使落宫顺飞（${feiPanUseZhongMen ? '用九门含中门' : '八门跳过中五，中宫标中门'}）；`
      + '天盘干随星携本位地盘干。飞盘属实验性盘式，未与权威飞盘逐项校核。',
    );
  } else {
    hints.push(
      `括囊：九星、九神阳顺阴逆飞九宫；八门阳顺阴逆飞布，另有「括囊门」层（值使门对宫门、反向飞布，见 palaces[].kuoNangDoor）；`
      + `天盘干${kuoNangTianPanGanZiFei ? '自飞九宫' : '随星携干'}。括囊属实验性盘式，未与权威括囊逐项校核。`,
    );
  }
  if (xunPalace === 5) {
    hints.push(
      `旬首六仪${xunYi}落中五宫：值符取天禽（寄${palaceName(jiPalace)}），值使取${zhiShiDoor}，值使加时自该寄宫起数。`,
    );
  }
  if (lateZiAdjusted) {
    hints.push('早晚子时：已按「夜子时」处理（23:00–23:59 日柱不换，时柱按次日日干起子时）。');
  }
  hints.push(anGanInfo.note + (anGanMode === AN_GAN_MODE_DEFAULT ? '' : '（实验性暗干法，未校核）'));
  if (chuanRen) {
    hints.push(
      `穿壬：每宫附四层——地盘地支（二十四山归宫）、月将加时天盘支、十二天将、建除十二神；`
      + `月将取${yueJiangBranch}将，${chuanRen.dayNight}占，贵人临地盘${chuanRen.guiren.shun ? '亥至辰顺布' : '巳至戌逆布'}。`
      + '（穿壬为实验性附加层，未校核）',
    );
  }
  hints.push(`旬空：${refWord}${hourGanzhi}属${xunShouName}旬，空${kongWang.join('、')}（宫位已标 kong）；日柱${dayGanzhi}旬空${dayKong.join('、')}，可参看。`);
  hints.push(`驿马：以${refWord}支${hourGanzhi[1]}查三合马星为${maXing}（落${PALACE_INFO[palaceOfBranch(maXing)].gua}${palaceOfBranch(maXing)}宫）。`);
  if (juType === '山向') {
    hints.push(`山向局：坐山${shan || '未指定'}、朝向${xiang || '未指定'}；山向奇门的起局与星盘规则未确证，本盘仅作占位，待校核。`);
  } else if (juType !== '时家') {
    hints.push(`${juType}奇门起局与九星配属未与权威排盘校核，本盘为实验性占位（可作基础盘参考）。`);
  }
  hints.push('引擎只出盘面与客观神煞；用神、格局、克应、吉凶与应期由 skills 判断。');

  const juOut = {
    yinYang: dun,
    number: ju,
    yuan,
    solarTerm: termName,
    futou,
    method: juMethod === '拆补' ? '拆补法' : juMethod === '置闰' ? '置闰法' : `${juMethod}法（实验）`,
    juMethod,
    juType,
    panMethod,
  };
  if (zhirunInfo) {
    juOut.chaoJie = zhirunInfo.chaoJie;
    juOut.chaoJieDays = zhirunInfo.chaoJieDays;
    juOut.leap = zhirunInfo.leap;
    juOut.shangYuanFuTou = zhirunInfo.shangYuanFuTou;
    juOut.actualSolarTerm = almTermName;
  }
  Object.assign(juOut, juExtra);

  const settings = {
    juType,
    juMethod,
    method: panMethod,
    panMethod,
    jiGong,
    lateZi,
    zhirunDays: zhirunTriggerGap,
    anGanMode: anGanInfo.effective,
    chuanRen: Boolean(chuanRen),
    feiPanUseZhongMen: Boolean(feiPanUseZhongMen),
    kuoNangTianPanGanZiFei: Boolean(kuoNangTianPanGanZiFei),
  };
  const requested = {};
  for (const k of ['method', 'juMethod', 'juType', 'longitude', 'jiGong', 'lateZi',
    'zhirunDays', 'anGanMode', 'chuanRen', 'feiPanUseZhongMen', 'kuoNangTianPanGanZiFei', 'shan', 'xiang']) {
    if (k in options) requested[k] = options[k];
  }
  const chuanRenOut = chuanRen ? { ...chuanRen, monthBranch } : null;

  return {
    ju: juOut,
    zhiFu: {
      star: zhiFuStar,
      palace: landPalace,
      gan: zhiFuGan,
      originPalace,
      note: xunPalace === 5
        ? `旬首六仪落中五宫，值符天禽按寄${palaceName(jiPalace)}发用`
        : `值符${zhiFuStar}随时干落${PALACE_INFO[landPalace].gua}${landPalace}宫`,
    },
    zhiShi: { door: zhiShiDoor, palace: landDoor, originPalace },
    xunShou: { ganzhi: xunShouName, yi: xunYi, palace: xunPalace },
    kongWang,
    maXing,
    palaces,
    chuanRen: chuanRenOut,
    settings,
    requested,
    hints,
    // 以下为引擎内部派生量，便于调试与测试（不影响 SPEC 字段）
    meta: {
      dayGanzhi,
      hourGanzhi,
      displayHourGanzhi: rawHourGanzhi,
      yearGanzhi,
      monthGanzhi,
      year: alm.effectiveDate ? alm.effectiveDate.year : null,
      refLabel,
      refGanzhi,
      hourBasis: alm.hourBasis,
      solarTermAt: alm.solarTerm.current.at,
      juMethod,
      juType,
      panMethod,
      school: `${juType} · ${panMethod} · ${juMethod}${jiGong === '坤二' ? ' · 中五寄坤二' : ''}`,
      isDefaultSchool: juType === '时家' && panMethod === '转盘' && juMethod === '拆补'
        && jiGong === '坤二' && lateZi === 'nextDay'
        && anGanMode === '八门地盘携带之干' && experimentalItems.length === 0,
      actualSolarTerm: almTermName,
      experimental: experimentalItems.length > 0,
      experimentalItems,
      unverified: experimentalItems.length > 0,
      enteredNextDay: Boolean(alm.enteredNextDay),
      lateZi,
      lateZiAdjusted,
      jiGong,
      jiPalace,
      zhirunDays: zhirunTriggerGap,
      anGanMode,
      anGanEffective: anGanInfo.effective,
      yueJiangBranch,
      monthBranch,
      seasonElement,
      shan: shan || null,
      xiang: xiang || null,
      // 多局附加数据（实验）
      ...(juType === '罗盘' ? { luoPan: { shan24: ERSHI_SI_SHAN.map((x) => ({ ...x })) } } : {}),
      ...(juType === '山向' ? {
        shanXiang: {
          shan: shan || null,
          xiang: xiang || null,
          shanPalace: palaceOfShan(shan),
          xiangPalace: palaceOfShan(xiang),
        },
      } : {}),
      ...(juType === '套玄空' ? {
        xuanKong: {
          yun: juExtra.jiuYun,
          yuan,
          yunStar: JIU_XING_YUN[mod((juExtra.jiuYun || 1) - 1, 9)],
        },
      } : {}),
      ...(juType === '太乙日家' ? {
        taiYiRiJia: {
          note: '太乙日家起局与九神配属规则未确证：本盘以日家盘为底并标实验，待校核。',
        },
      } : {}),
      ring: RING.slice(),
      deltaStar,
      deltaDoor,
      landDoorRaw,
    },
  };
}

/**
 * 命运局（实验）：原命局 + 10 步大运局。
 * 简化口径（不做套八字）：每 9 年一步，时柱顺排，阴阳遁与局数不变，只变盘面所用时辰干支；
 * 起运岁数与顺逆未按八字大运排（未做套八字），仅作奇门盘面参考。
 *
 * @param {object} [options] 同 castQimen
 * @returns {{natal:object, daYun:Array<{index:number, ageFrom:number, ageTo:number, year:number, hourGanzhi:string, chart:object}>, meta:object}}
 */
export function castQimenMingYun(options = {}) {
  const natal = castQimen(options);
  const baseIdx = ganzhiIndex(natal.meta.hourGanzhi);
  const birthYear = natal.meta.year;
  const daYun = [];
  for (let k = 1; k <= 10; k += 1) {
    const hourGanzhi = ganzhiName(baseIdx + k);
    const chart = castQimen({ ...options, overrideHourGanzhi: hourGanzhi });
    daYun.push({
      index: k,
      ageFrom: 1 + (k - 1) * 9,
      ageTo: 9 + (k - 1) * 9,
      year: typeof birthYear === 'number' ? birthYear + (k - 1) * 9 : null,
      hourGanzhi,
      chart,
    });
  }
  return {
    natal,
    daYun,
    meta: {
      experimental: true,
      unverified: true,
      experimentalItems: ['命运局'],
      note: '命运局：每 9 年一步、时柱顺排，阴阳遁与局数不变；未套八字（不排起运岁数/顺逆/流年干支）。',
    },
  };
}

/** 年家奇门（实验性便捷包装） */
export function castNianJia(options = {}) {
  return castQimen({ ...options, juType: '年家' });
}
/** 月家奇门（实验性便捷包装） */
export function castYueJia(options = {}) {
  return castQimen({ ...options, juType: '月家' });
}
/** 日家奇门（实验性便捷包装） */
export function castRiJia(options = {}) {
  return castQimen({ ...options, juType: '日家' });
}
/** 太乙日家奇门（实验性占位便捷包装） */
export function castTaiYiRiJia(options = {}) {
  return castQimen({ ...options, juType: '太乙日家' });
}
/** 山向奇门（实验性占位：需传 shan/xiang 二十四山） */
export function castShanXiang(options = {}) {
  return castQimen({ ...options, juType: '山向' });
}
/** 奇门罗盘（实验性：时家基础盘 + 二十四山归宫参考） */
export function castLuoPan(options = {}) {
  return castQimen({ ...options, juType: '罗盘' });
}
/** 奇门套玄空（实验性：年家盘 + 三元九运/运星字段） */
export function castTaoXuanKong(options = {}) {
  return castQimen({ ...options, juType: '套玄空' });
}

/** 引擎能力清单（供工具层/前端渲染「实验/未校核」标签） */
export const QIMEN_CAPABILITIES = {
  panMethods: PAN_METHODS,
  juMethods: JU_METHODS,
  juTypes: JU_TYPES,
  anGanModes: AN_GAN_MODES,
  chuanRenLayers: ['diPanDiZhi', 'tianPan', 'yueJiang', 'shenJiang', 'jianXing'],
  stable: ['时家', '转盘', '拆补', '置闰', '八门地盘携带之干', '穿壬（附加层）'],
  experimental: [
    '飞盘', '括囊', '茅山', '阴盘', '分家阳盘', '刻家阴盘',
    '年家', '月家', '日家', '太乙日家', '山向', '罗盘', '套玄空', '命运局',
    '时干找值使飞布,遇地盘相同入中', '时干找值使飞布,遇宫内有时干则入中',
    '时干加值使转天盘,遇伏吟入中', '暗天干地支飞布法',
  ],
};

export default {
  castQimen,
  JU_TABLE,
  PALACE_INFO,
  futouOfDay,
  juForTerm,
  diPanLayout,
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
};


