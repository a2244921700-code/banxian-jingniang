#!/usr/bin/env node
/**
 * gen-sample.mjs —— 用奇门引擎（lib/engine/qimen.js，只读调用）生成前端示例数据。
 *
 * 用法（在 D:\DSH_GuaShi 下）：
 *   node client/qimen-chart/tools/gen-sample.mjs
 *
 * 原则：
 *  1. 只调用引擎，不写引擎/工具/测试；引擎没给的字段一律置 null/缺省，前端显示「—」，不伪造。
 *  2. 对「起局方式 / 盘式 / 暗干排法」逐项探测：引擎抛错、hints 说「未实现/按转盘出盘」、
 *     或盘面与基准相同，则记 supported:false；引擎 meta.experimental/experimentalItems 或
 *     hints「【实验·未校核】」则记 experimental:true，前端显示「实验/待校核」标签。
 *  3. 场景矩阵：局式1 全量（起局方式 × 寄宫 × 早晚子时 + 置闰天数/盘式/暗干变体），
 *     局式2/3 只带基础变体；控制 sample-data.js 体积。
 *  4. 多局（年/月/日家/太乙日家/山向/罗盘/套玄空）与命运局：按 engine-sanshi task-19 契约
 *     走 castQimen({juType}) 与 castQimenMingYun()；引擎未提供就留 null，前端显示「引擎未提供」。
 *
 * engine-sanshi 交付后重跑本脚本即可刷新示例数据；契约若改，只改 ADAPTER 段。
 */
import { writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.resolve(HERE, '..');
const ROOT = path.resolve(CLIENT_DIR, '..', '..');
// 允许用 QIMEN_ENGINE / QIMEN_SAMPLE_OUT 指向临时引擎与临时输出（仅用于开发期 mock 验证）。
const ENGINE_PATH = process.env.QIMEN_ENGINE
  ? path.resolve(process.env.QIMEN_ENGINE)
  : path.join(ROOT, 'dsh-guashi-agent', 'lib', 'engine', 'qimen.js');
const ALMANAC_PATH = path.join(ROOT, 'dsh-guashi-agent', 'lib', 'engine', 'almanac.js');
const OUT_PATH = process.env.QIMEN_SAMPLE_OUT
  ? path.resolve(process.env.QIMEN_SAMPLE_OUT)
  : path.join(CLIENT_DIR, 'sample-data.js');

const DEFAULT_SETTINGS = {
  juMode: '时家拆补',
  panMode: '转盘',
  jiGong: '坤二',
  lateZi: 'nextDay',
  zhirunDays: 8,
  anGanMode: '八门地盘携带之干',
};

const TIMED_JU_MODES = new Set(['时家拆补', '时家置闰', '时家茅山', '时家阴盘', '分家阳盘', '刻家阴盘']);

const JI_GONG_OPTIONS = [
  { id: '坤二', label: '统一寄坤二' },
  { id: '阳艮阴坤', label: '阳遁寄艮八 / 阴遁寄坤二' },
];
const LATE_ZI_OPTIONS = [
  { id: 'nextDay', label: '子时换日（23:00 换日）' },
  { id: 'sameDay', label: '夜子时（日柱不换）' },
];
const ZHIRUN_DAY_OPTIONS = [
  { id: 8, label: '8 天' },
  { id: 9, label: '9 天' },
];
/* 起局方式 = 时家六法 + 多局七法（对应 docs/REF-CONGZHEN-QIMEN.md 枚举与 task-19 契约）。 */
const JU_MODE_OPTIONS = [
  { id: '时家拆补', label: '时家拆补', family: '时家', juType: '时家', juMethod: '拆补', experimentalByRef: false },
  { id: '时家置闰', label: '时家置闰', family: '时家', juType: '时家', juMethod: '置闰', experimentalByRef: false },
  { id: '时家茅山', label: '时家茅山', family: '时家', juType: '时家', juMethod: '茅山', experimentalByRef: true },
  { id: '时家阴盘', label: '时家阴盘', family: '时家', juType: '时家', juMethod: '阴盘', experimentalByRef: true },
  { id: '分家阳盘', label: '分家阳盘', family: '分家', juType: '时家', juMethod: '分家阳盘', experimentalByRef: true },
  { id: '刻家阴盘', label: '刻家阴盘', family: '刻家', juType: '时家', juMethod: '刻家阴盘', experimentalByRef: true },
  { id: '年家奇门', label: '年家奇门', family: '多局', juType: '年家', experimentalByRef: true },
  { id: '月家奇门', label: '月家奇门', family: '多局', juType: '月家', experimentalByRef: true },
  { id: '日家奇门', label: '日家奇门', family: '多局', juType: '日家', experimentalByRef: true },
  { id: '太乙日家', label: '太乙日家奇门', family: '多局', juType: '太乙日家', experimentalByRef: true },
  { id: '山向奇门', label: '山向奇门', family: '多局', juType: '山向', experimentalByRef: true },
  { id: '奇门罗盘', label: '奇门罗盘', family: '多局', juType: '罗盘', experimentalByRef: true },
  { id: '奇门套玄空', label: '奇门套玄空', family: '多局', juType: '套玄空', experimentalByRef: true },
];
const JU_MODE_BY_ID = Object.fromEntries(JU_MODE_OPTIONS.map((o) => [o.id, o]));
const PAN_MODE_OPTIONS = [
  { id: '转盘', label: '转盘', experimentalByRef: false },
  { id: '飞盘', label: '飞盘', experimentalByRef: true },
  { id: '括囊', label: '括囊', experimentalByRef: true },
];
const AN_GAN_OPTIONS = [
  { id: '八门地盘携带之干', label: '八门地盘携带之干', experimentalByRef: false },
  { id: '时干找值使飞布,遇地盘相同入中', label: '时干找值使飞布（遇地盘相同入中）', experimentalByRef: true },
  { id: '时干找值使飞布,遇宫内有时干则入中', label: '时干找值使飞布（遇宫内有时干入中）', experimentalByRef: true },
  { id: '时干加值使转天盘,遇伏吟入中', label: '时干加值使转天盘（遇伏吟入中）', experimentalByRef: true },
  { id: '暗天干地支飞布法', label: '暗天干地支飞布法', experimentalByRef: true },
];

const SCENES = [
  { id: 'scene-1', label: '局式1', datetime: '2024-07-22T09:09:00+08:00', question: '示例局式一（演示数据）', depth: 'full' },
  { id: 'scene-2', label: '局式2', datetime: '2026-11-07T20:45:00+08:00', question: '示例局式二（演示数据）', depth: 'basic' },
  { id: 'scene-3', label: '局式3', datetime: '2026-11-08T10:30:00+08:00', question: '示例局式三（演示数据）', depth: 'basic' },
];
const MINGYUN_BIRTH = '1990-06-15T10:30:00+08:00';

const engineModule = await import(pathToFileURL(ENGINE_PATH).href);
const almanacModule = await import(pathToFileURL(ALMANAC_PATH).href);
const castQimen = engineModule.castQimen;
const castQimenMingYun = engineModule.castQimenMingYun;
if (typeof castQimen !== 'function') {
  console.error('引擎未导出 castQimen，无法生成示例数据：' + ENGINE_PATH);
  process.exit(1);
}
const engineStat = statSync(ENGINE_PATH);
const almanacStat = statSync(ALMANAC_PATH);

/* ============================================================
 * ADAPTER：请求设置 → castQimen 参数（按 task-19 契约）
 * ============================================================ */
function engineArgsFor(settings, scene) {
  const meta = JU_MODE_BY_ID[settings.juMode] || JU_MODE_BY_ID['时家拆补'];
  const args = { date: new Date(scene.datetime), chuanRen: true };
  args.juType = meta.juType;
  if (meta.juMethod) args.juMethod = meta.juMethod;
  if (meta.juType === '山向') {
    // 山向奇门需要二十四山；示例固定「子山午向」，仅作结构演示（实验项）。
    args.shan = '子';
    args.xiang = '午';
  }
  args.method = settings.panMode || '转盘';
  args.jiGong = settings.jiGong;
  args.lateZi = settings.lateZi;
  args.zhirunDays = settings.zhirunDays;
  args.anGanMode = settings.anGanMode;
  return args;
}

function settingsKey(settings) {
  return [
    settings.juMode,
    settings.panMode,
    settings.jiGong,
    settings.lateZi,
    settings.zhirunDays,
    settings.anGanMode,
  ].join('|');
}

/* ============================================================
 * 穿壬归一（task-19 契约）
 * 顶层 chuanRen: { yueJiang:{branch,name}, dayNight, guiren:{...}, monthBranch, items:[{branch,tianPan,yueJiang,shenJiang,jianXing}] }
 * 每宫 chuanRen: { diPanDiZhi:[...], items:[...] }
 * ============================================================ */
function asText(value, keys) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'object') return '';
  for (const key of keys) {
    const hit = asText(value[key], []);
    if (hit) return hit;
  }
  return '';
}

function normalizeCrItem(item) {
  if (!item || typeof item !== 'object') return null;
  const branch = asText(item.branch, ['diPanDiZhi', 'diZhi', 'earth']);
  const tianPan = asText(item.tianPan, ['tianPanDiZhi', 'tian']);
  const yueJiang = asText(item.yueJiang, ['yueJiangDiZhi', 'jiangBranch']);
  const shenJiang = asText(item.shenJiang, ['jiang', 'tianJiang', 'shen']);
  const jianXing = asText(item.jianXing, ['jianChu', 'jian', 'jianXingName']);
  if (!branch && !tianPan && !yueJiang && !shenJiang && !jianXing) return null;
  return { branch, tianPan, yueJiang, shenJiang, jianXing };
}

function normalizeCrItems(items) {
  return (Array.isArray(items) ? items : []).map(normalizeCrItem).filter(Boolean);
}

function normalizeTopChuanRen(raw) {
  const cr = raw && raw.chuanRen;
  if (!cr || typeof cr !== 'object') return null;
  const yueJiang = cr.yueJiang && typeof cr.yueJiang === 'object'
    ? { branch: asText(cr.yueJiang.branch, ['zhi']), name: asText(cr.yueJiang.name, ['jiangName', 'label']) }
    : { branch: asText(cr.yueJiang, []), name: '' };
  const guiren = cr.guiren && typeof cr.guiren === 'object'
    ? { branch: asText(cr.guiren.branch, ['zhi']), earth: asText(cr.guiren.earth, ['diPan', 'position']), shun: cr.guiren.shun === true || cr.guiren.shun === '顺' }
    : null;
  const items = normalizeCrItems(cr.items);
  const dayNight = cr.dayNight === '夜' ? '夜' : cr.dayNight === '昼' ? '昼' : '';
  const monthBranch = asText(cr.monthBranch, []);
  if (!yueJiang.branch && !yueJiang.name && !items.length && !guiren) return null;
  return { yueJiang, dayNight, guiren, monthBranch, items };
}

function normalizePalaceChuanRen(palace) {
  const cr = palace && palace.chuanRen;
  if (!cr || typeof cr !== 'object') return null;
  const diPanDiZhi = (Array.isArray(cr.diPanDiZhi) ? cr.diPanDiZhi : [cr.diPanDiZhi])
    .map((x) => asText(x, []))
    .filter(Boolean);
  const items = normalizeCrItems(cr.items);
  if (!diPanDiZhi.length && !items.length) return null;
  return { diPanDiZhi, items };
}

/* ============================================================
 * 盘面压缩：保留前端所需字段；缺字段不补
 * ============================================================ */
function buildInput(scene, chart) {
  try {
    const alm = almanacModule.getAlmanac(new Date(scene.datetime));
    return {
      datetime: alm.local,
      solarTerm: alm.solarTerm && alm.solarTerm.current ? alm.solarTerm.current.name : '',
      fourPillars: alm.ganzhi || {},
      dayKong: alm.xunKong || [],
      hourKong: (chart && chart.kongWang) || [],
      monthBranch: alm.monthBranch || '',
      lunar: alm.lunar ? `${alm.lunar.year}年${alm.lunar.isLeap ? '闰' : ''}${alm.lunar.month}月${alm.lunar.day}日` : '',
    };
  } catch (error) {
    return { datetime: scene.datetime, error: String(error && error.message ? error.message : error) };
  }
}

const HINT_LIMIT = 9;
const HINT_MAX_CHARS = 240;

function trimHints(hints) {
  return (Array.isArray(hints) ? hints : [])
    .slice(0, HINT_LIMIT)
    .map((h) => String(h).slice(0, HINT_MAX_CHARS));
}

function compactChart(raw, scene, settings, flags) {
  const meta = raw.meta || null;
  const experimentalItems = Array.isArray(meta && meta.experimentalItems) ? meta.experimentalItems : [];
  const experimental = Boolean(
    (meta && (meta.experimental === true || meta.unverified === true)) ||
    experimentalItems.length ||
    (flags && flags.experimental === true)
  );
  const palaces = (Array.isArray(raw.palaces) ? raw.palaces : []).map((p) => {
    const out = {
      index: p.index,
      gua: p.gua,
      direction: p.direction,
      element: p.element,
      diPanGan: p.diPanGan,
      tianPanGan: p.tianPanGan,
      star: p.star,
      door: p.door,
      shen: p.shen,
      anGan: p.anGan,
      starElement: p.starElement,
      doorElement: p.doorElement,
      starWangShuai: p.starWangShuai,
      doorWangShuai: p.doorWangShuai,
      kong: Boolean(p.kong),
      ma: Boolean(p.ma),
      notes: Array.isArray(p.notes) ? p.notes : [],
    };
    if (p.diPanShen) out.diPanShen = p.diPanShen;
    if (p.kuoNangDoor) out.kuoNangDoor = p.kuoNangDoor;
    const cr = normalizePalaceChuanRen(p);
    if (cr) out.chuanRen = cr;
    return out;
  });
  const chart = {
    input: buildInput(scene, raw),
    ju: raw.ju || null,
    zhiFu: raw.zhiFu || null,
    zhiShi: raw.zhiShi || null,
    xunShou: raw.xunShou || null,
    kongWang: raw.kongWang || [],
    maXing: raw.maXing || '',
    palaces,
    hints: trimHints(raw.hints),
    meta: meta
      ? {
          dayGanzhi: meta.dayGanzhi || '',
          hourGanzhi: meta.hourGanzhi || '',
          monthBranch: meta.monthBranch || '',
          seasonElement: meta.seasonElement || '',
          jiGong: meta.jiGong || settings.jiGong,
          jiPalace: meta.jiPalace || null,
          lateZi: meta.lateZi || settings.lateZi,
          lateZiAdjusted: Boolean(meta.lateZiAdjusted),
          zhirunDays: meta.zhirunDays,
          anGanMode: meta.anGanMode || settings.anGanMode,
          panMethod: meta.panMethod || (raw.settings && raw.settings.panMethod) || null,
          effectiveJuMethod: meta.effectiveJuMethod || (raw.settings && raw.settings.juMethod) || null,
          effectiveJuType: meta.effectiveJuType || (raw.settings && raw.settings.juType) || null,
          experimental,
          experimentalItems,
          unverified: experimental,
          // 多局附加信息（引擎有则透传，无则 null，前端显示「—」）
          extras: {
            luoPan: meta.luoPan || null,
            shanXiang: meta.shanXiang || null,
            xuanKong: meta.xuanKong || null,
            taiYiRiJia: meta.taiYiRiJia || null,
            jiuYun: (raw.ju && raw.ju.jiuYun) || null,
            chaoJie: (raw.ju && raw.ju.chaoJie) || null,
            chaoJieDays: (raw.ju && raw.ju.chaoJieDays) != null ? raw.ju.chaoJieDays : null,
            leap: (raw.ju && raw.ju.leap) || false,
            shangYuanFuTou: (raw.ju && raw.ju.shangYuanFuTou) || null,
            actualSolarTerm: (raw.ju && raw.ju.actualSolarTerm) || null,
          },
        }
      : null,
    settings: raw.settings && typeof raw.settings === 'object' ? raw.settings : { ...settings },
    requested: raw.requested && typeof raw.requested === 'object' ? raw.requested : null,
    experimental,
    experimentalItems,
  };
  const topCr = normalizeTopChuanRen(raw);
  if (topCr) {
    // 顶层 12 条 items 与每宫 chuanRen 重叠，示例数据只保留月将/昼夜/贵人/月建，控制体积。
    delete topCr.items;
    chart.chuanRenTop = topCr;
  }
  return chart;
}

/* ============================================================
 * 探测：单变量盘 + 支持/实验判定
 * ============================================================ */
const FALLBACK_RE = /未实现|尚未实现|暂未实现|暂未支持|不支持|按转盘出盘|按拆补出盘|忽略|无法|出错/;
const EXPERIMENTAL_RE = /实验|待校核|未校核|供参考/;

function collectHints(raw) {
  const out = [];
  if (Array.isArray(raw && raw.hints)) out.push(...raw.hints);
  if (raw && raw.meta && raw.meta.experimentalItems) out.push(...[].concat(raw.meta.experimentalItems));
  return out;
}

function judgeProbe(raw, keywords = []) {
  const hints = collectHints(raw);
  const meta = (raw && raw.meta) || {};
  const experimentalItems = Array.isArray(meta.experimentalItems) ? meta.experimentalItems : [];
  const matched = keywords.length ? hints.filter((h) => keywords.some((k) => k && String(h).includes(String(k)))) : [];
  const fallback = matched.some((h) => FALLBACK_RE.test(h));
  const experimental = Boolean(meta.experimental === true || meta.unverified === true || experimentalItems.length)
    || matched.some((h) => EXPERIMENTAL_RE.test(h));
  const notes = matched.filter((h) => FALLBACK_RE.test(h) || EXPERIMENTAL_RE.test(h)).slice(0, 3);
  return { experimental, fallback, notes, experimentalItems, matchedHints: matched.slice(0, 3) };
}

/** 只匹配与当前设置相关的那几条 hints，避免把「其余四种暗干排法尚未实现」误判到基准盘上。 */
function keywordsForSettings(settings) {
  const out = [];
  const ju = JU_MODE_BY_ID[settings.juMode];
  if (ju && settings.juMode !== DEFAULT_SETTINGS.juMode) {
    if (ju.juMethod) out.push(ju.juMethod);
    if (ju.juType) out.push(ju.juType);
  }
  if (settings.panMode !== DEFAULT_SETTINGS.panMode) out.push(settings.panMode);
  if (settings.anGanMode !== DEFAULT_SETTINGS.anGanMode) out.push(settings.anGanMode);
  if (settings.lateZi !== DEFAULT_SETTINGS.lateZi) out.push('夜子时');
  return out.filter(Boolean);
}

function tryChart(settings, scene) {
  const args = engineArgsFor(settings, scene);
  try {
    const raw = castQimen(args);
    if (!raw || typeof raw !== 'object') return { ok: false, error: '引擎返回空盘', args };
    return { ok: true, raw, args, key: settingsKey(settings), ...judgeProbe(raw, keywordsForSettings(settings)) };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error), args };
  }
}

function chartSignature(chart) {
  try {
    return JSON.stringify({
      ju: chart.ju,
      zhiFu: chart.zhiFu,
      zhiShi: chart.zhiShi,
      palaces: (chart.palaces || []).map((p) => ({
        i: p.index, d: p.diPanGan, t: p.tianPanGan, s: p.star, m: p.door, sh: p.shen, a: p.anGan,
      })),
    });
  } catch {
    return '';
  }
}

const baseProbe = tryChart(DEFAULT_SETTINGS, SCENES[0]);
if (!baseProbe.ok) {
  console.error('基准盘生成失败：' + baseProbe.error);
  process.exit(1);
}
const baseSignature = chartSignature(baseProbe.raw);

function probeOption(dimension, option) {
  const settings = { ...DEFAULT_SETTINGS };
  if (dimension === 'juMode') {
    settings.juMode = option.id;
    if (option.id === '时家置闰') settings.zhirunDays = 8;
  } else if (dimension === 'panMode') {
    settings.panMode = option.id;
  } else if (dimension === 'jiGong') {
    settings.jiGong = option.id;
  } else if (dimension === 'lateZi') {
    settings.lateZi = option.id;
  } else if (dimension === 'zhirunDays') {
    settings.juMode = '时家置闰';
    settings.zhirunDays = option.id;
  } else if (dimension === 'anGanMode') {
    settings.anGanMode = option.id;
  }
  const probe = tryChart(settings, SCENES[0]);
  const isDefault = settingsKey(settings) === settingsKey(DEFAULT_SETTINGS);
  const entry = {
    id: option.id,
    label: option.label,
    requested: settings,
    supported: false,
    experimental: Boolean(option.experimentalByRef),
    fallback: false,
    notes: [],
  };
  if (!probe.ok) {
    entry.fallback = true;
    entry.notes.push('引擎调用失败：' + probe.error);
    return entry;
  }
  const sameAsBase = !isDefault && (dimension === 'juMode' || dimension === 'panMode' || dimension === 'anGanMode')
    && chartSignature(probe.raw) === baseSignature;
  entry.experimentalItems = probe.experimentalItems || [];
  entry.notes.push(...probe.notes);
  if (isDefault) {
    // 基准选项本身：只要引擎没明确回退，就是支持的（置闰/寄宫等与基准不同属正常变体）
    entry.supported = !probe.fallback;
    entry.experimental = Boolean(option.experimentalByRef) && Boolean(probe.experimental);
  } else if (probe.fallback) {
    entry.fallback = true;
    entry.supported = false;
  } else if (probe.experimental) {
    // 引擎已实现但口径未校核：盘面可用，标实验
    entry.supported = true;
    entry.experimental = true;
  } else if (sameAsBase) {
    entry.fallback = true;
    entry.notes.push('引擎忽略该参数（盘面与基准相同），按未实现处理');
    entry.supported = false;
  } else {
    entry.supported = true;
    entry.experimental = Boolean(option.experimentalByRef);
  }
  return entry;
}

const probes = {
  juModes: JU_MODE_OPTIONS.map((option) => probeOption('juMode', option)),
  panModes: PAN_MODE_OPTIONS.map((option) => probeOption('panMode', option)),
  jiGongs: JI_GONG_OPTIONS.map((option) => probeOption('jiGong', option)),
  lateZis: LATE_ZI_OPTIONS.map((option) => probeOption('lateZi', option)),
  zhirunDays: ZHIRUN_DAY_OPTIONS.map((option) => probeOption('zhirunDays', option)),
  anGanModes: AN_GAN_OPTIONS.map((option) => probeOption('anGanMode', option)),
};

const supported = {
  juModes: probes.juModes.filter((p) => p.supported).map((p) => p.id),
  panModes: probes.panModes.filter((p) => p.supported).map((p) => p.id),
  jiGongs: probes.jiGongs.filter((p) => p.supported).map((p) => p.id),
  lateZis: probes.lateZis.filter((p) => p.supported).map((p) => p.id),
  zhirunDays: probes.zhirunDays.filter((p) => p.supported).map((p) => p.id),
  anGanModes: probes.anGanModes.filter((p) => p.supported).map((p) => p.id),
};

/* ============================================================
 * 场景盘生成
 * ============================================================ */
function recipesForScene(scene) {
  const recipes = [];
  const seen = new Set();
  const push = (settings) => {
    const key = settingsKey(settings);
    if (seen.has(key)) return;
    seen.add(key);
    recipes.push({ ...settings });
  };
  push(DEFAULT_SETTINGS);
  const juList = supported.juModes.length ? supported.juModes : ['时家拆补'];
  const jiList = supported.jiGongs.length ? supported.jiGongs : ['坤二'];
  const ziList = supported.lateZis.length ? supported.lateZis : ['nextDay'];
  const timedJus = juList.filter((id) => TIMED_JU_MODES.has(id));

  if (scene.depth === 'full') {
    // 局式1：所有起局方式（含多局）各一张基准盘，供设置面板逐个切换验证
    juList.forEach((juMode) => push({ ...DEFAULT_SETTINGS, juMode }));
    const matrixJus = timedJus.slice(0, 2); // 只对拆补/置闰铺「寄宫 × 早晚子时」矩阵；其余起局法各一张基准盘即可
    for (const juMode of matrixJus) {
      for (const jiGong of jiList) {
        for (const lateZi of ziList) {
          if (juMode === '时家置闰') {
            push({ ...DEFAULT_SETTINGS, juMode, jiGong, lateZi, zhirunDays: 8 });
            push({ ...DEFAULT_SETTINGS, juMode, jiGong, lateZi, zhirunDays: 9 });
          } else {
            push({ ...DEFAULT_SETTINGS, juMode, jiGong, lateZi });
          }
        }
      }
    }
    supported.panModes.filter((id) => id !== '转盘').forEach((panMode) => push({ ...DEFAULT_SETTINGS, panMode }));
    supported.anGanModes.filter((id) => id !== DEFAULT_SETTINGS.anGanMode).forEach((anGanMode) => push({ ...DEFAULT_SETTINGS, anGanMode }));
  } else {
    if (juList.includes('时家置闰')) {
      push({ ...DEFAULT_SETTINGS, juMode: '时家置闰' });
      push({ ...DEFAULT_SETTINGS, juMode: '时家置闰', zhirunDays: 9 });
    }
    if (jiList.includes('阳艮阴坤')) push({ ...DEFAULT_SETTINGS, jiGong: '阳艮阴坤' });
  }

  const charts = [];
  for (const settings of recipes) {
    const probe = tryChart(settings, scene);
    if (!probe.ok) continue;
    if (probe.fallback) continue; // 引擎明说未实现：不存盘，避免冒充
    charts.push({
      key: settingsKey(settings),
      settings,
      experimental: probe.experimental,
      experimentalItems: probe.experimentalItems || [],
      notes: probe.notes,
      chart: compactChart(probe.raw, scene, settings, { experimental: probe.experimental }),
    });
  }
  return charts;
}

/* ============================================================
 * 命运局（castQimenMingYun）
 * ============================================================ */
function generateMingyun() {
  const out = {
    supported: false,
    experimental: true,
    birth: MINGYUN_BIRTH,
    notes: [],
    natal: null,
    steps: [],
    experimentalItems: [],
  };
  if (typeof castQimenMingYun !== 'function') {
    out.notes.push('引擎尚无命运局入口 castQimenMingYun（task-19 契约项）');
    return out;
  }
  const scene = { id: 'mingyun', label: '命运局', datetime: MINGYUN_BIRTH, question: '命运局示例（原命局 + 十步大运局）' };
  const settings = { ...DEFAULT_SETTINGS, juMode: '命运局' };
  try {
    const raw = castQimenMingYun({ date: new Date(MINGYUN_BIRTH) });
    const judge = judgeProbe(raw);
    out.experimental = judge.experimental !== false;
    out.experimentalItems = judge.experimentalItems || [];
    out.notes.push(...judge.notes);
    const natalRaw = raw.natal || raw.chart || raw.original || null;
    if (natalRaw) {
      out.natal = compactChart(natalRaw, scene, settings, { experimental: true });
      out.natal.label = '原命局';
    }
    const daYun = Array.isArray(raw.daYun) ? raw.daYun : Array.isArray(raw.steps) ? raw.steps : [];
    out.steps = daYun.map((step, i) => {
      const stepChart = step && (step.chart || step.raw) ? compactChart(step.chart || step.raw, scene, settings, { experimental: true }) : null;
      const ageFrom = step && step.ageFrom != null ? step.ageFrom : step && step.age != null ? step.age : null;
      const ageTo = step && step.ageTo != null ? step.ageTo : null;
      return {
        index: step && step.index != null ? step.index : i + 1,
        label: `第${step && step.index != null ? step.index : i + 1}步`,
        ageFrom,
        ageTo,
        year: step && step.year != null ? step.year : null,
        hourGanzhi: step && step.hourGanzhi ? step.hourGanzhi : '',
        chart: stepChart,
      };
    });
    out.supported = Boolean(out.natal || out.steps.some((s) => s.chart));
    if (!out.supported) out.notes.push('castQimenMingYun 已存在但未返回可解析的 natal/daYun 盘面');
  } catch (error) {
    out.notes.push('命运局生成失败：' + String(error && error.message ? error.message : error));
  }
  return out;
}

const scenes = SCENES.map((scene) => {
  const charts = recipesForScene(scene);
  return {
    id: scene.id,
    label: scene.label,
    datetime: scene.datetime,
    question: scene.question,
    depth: scene.depth,
    charts,
  };
});

const mingyun = generateMingyun();

/* ============================================================
 * 汇总输出
 * ============================================================ */
const catalog = {
  juModes: JU_MODE_OPTIONS.map((option) => {
    const probe = probes.juModes.find((p) => p.id === option.id);
    return {
      id: option.id,
      label: option.label,
      family: option.family,
      supported: Boolean(probe && probe.supported),
      experimental: Boolean(probe && probe.experimental),
      experimentalItems: (probe && probe.experimentalItems) || [],
      notes: (probe && probe.notes) || [],
    };
  }),
  panModes: PAN_MODE_OPTIONS.map((option) => {
    const probe = probes.panModes.find((p) => p.id === option.id);
    return {
      id: option.id,
      label: option.label,
      supported: Boolean(probe && probe.supported),
      experimental: Boolean(probe && probe.experimental),
      experimentalItems: (probe && probe.experimentalItems) || [],
      notes: (probe && probe.notes) || [],
    };
  }),
  jiGongs: JI_GONG_OPTIONS.map((option) => {
    const probe = probes.jiGongs.find((p) => p.id === option.id);
    return { id: option.id, label: option.label, supported: Boolean(probe && probe.supported), experimental: false, notes: (probe && probe.notes) || [] };
  }),
  lateZis: LATE_ZI_OPTIONS.map((option) => {
    const probe = probes.lateZis.find((p) => p.id === option.id);
    return { id: option.id, label: option.label, supported: Boolean(probe && probe.supported), experimental: false, notes: (probe && probe.notes) || [] };
  }),
  zhirunDays: ZHIRUN_DAY_OPTIONS.map((option) => {
    const probe = probes.zhirunDays.find((p) => p.id === option.id);
    return { id: option.id, label: option.label, supported: Boolean(probe && probe.supported), experimental: false, notes: (probe && probe.notes) || [] };
  }),
  anGanModes: AN_GAN_OPTIONS.map((option) => {
    const probe = probes.anGanModes.find((p) => p.id === option.id);
    return {
      id: option.id,
      label: option.label,
      supported: Boolean(probe && probe.supported),
      experimental: Boolean(probe && (probe.experimental || option.experimentalByRef)),
      experimentalItems: (probe && probe.experimentalItems) || [],
      notes: (probe && probe.notes) || [],
    };
  }),
};

const chartCount = scenes.reduce((n, s) => n + s.charts.length, 0);
const summary = {
  generatedAt: new Date().toISOString(),
  generatedBy: 'client/qimen-chart/tools/gen-sample.mjs',
  engine: {
    path: 'dsh-guashi-agent/lib/engine/qimen.js',
    mtime: engineStat.mtime.toISOString(),
    bytes: engineStat.size,
    almanacMtime: almanacStat.mtime.toISOString(),
    exports: Object.keys(engineModule).sort(),
    hasMingYun: typeof castQimenMingYun === 'function',
  },
  note: '示例数据由 engine castQimen 实算生成；引擎未实现的起局方式/盘式/暗干排法与命运局留空，前端显示「—」并标「实验/待校核」，不以其他盘冒充。',
  counts: {
    scenes: scenes.length,
    charts: chartCount,
    expCharts: scenes.reduce((n, s) => n + s.charts.filter((c) => c.experimental).length, 0),
    mingyunSteps: mingyun.steps.length,
    chuanRenCharts: scenes.reduce((n, s) => n + s.charts.filter((c) => c.chart.chuanRenTop).length, 0),
  },
};

const workspace = {
  version: '2.0.0',
  meta: summary,
  catalog,
  defaults: { ...DEFAULT_SETTINGS },
  scenes,
  mingyun,
  tabs: [
    ...scenes.map((s) => ({ id: s.id, label: s.label, type: 'scene', sceneId: s.id })),
    { id: 'mingyun', label: '命运局', type: 'mingyun' },
  ],
};

const header = [
  '/*!',
  ' * 奇门九宫盘 · 示例数据（自动生成，勿手改）',
  ' * 生成器：client/qimen-chart/tools/gen-sample.mjs',
  ` * 生成时间：${summary.generatedAt}`,
  ` * 引擎：${summary.engine.path}（${summary.engine.bytes} bytes，mtime ${summary.engine.mtime}）`,
  ` * 盘数：${summary.counts.charts}（其中实验盘 ${summary.counts.expCharts}）；穿壬盘 ${summary.counts.chuanRenCharts}；命运局 ${summary.counts.mingyunSteps} 步`,
  ' * 说明：引擎未实现/未提供的字段一律不写或置空，前端显示「—」；不伪造盘面。',
  ' */',
].join('\n');

const baseChartOut = scenes[0] && scenes[0].charts.length ? scenes[0].charts[0].chart : null;
const body = [
  header,
  `window.QIMEN_SAMPLE = ${JSON.stringify(baseChartOut)};`,
  '',
  `window.QIMEN_WORKSPACE = ${JSON.stringify(workspace)};`,
  '',
  'window.QIMEN_DATA_META = window.QIMEN_WORKSPACE.meta;',
  '',
].join('\n');

writeFileSync(OUT_PATH, body, 'utf8');
const sizeKb = (Buffer.byteLength(body, 'utf8') / 1024).toFixed(1);

const supportedJu = catalog.juModes.filter((x) => x.supported).map((x) => `${x.id}${x.experimental ? '(实验)' : ''}`);
const supportedPan = catalog.panModes.filter((x) => x.supported).map((x) => `${x.id}${x.experimental ? '(实验)' : ''}`);
const supportedAn = catalog.anGanModes.filter((x) => x.supported).map((x) => `${x.id}${x.experimental ? '(实验)' : ''}`);
console.log('已生成：' + OUT_PATH);
console.log(`  场景 ${summary.counts.scenes} 个，盘 ${summary.counts.charts} 个（实验盘 ${summary.counts.expCharts}），大小 ${sizeKb} KB`);
console.log('  引擎 mtime：' + summary.engine.mtime);
console.log('  支持起局方式：' + (supportedJu.join('、') || '（无）'));
console.log('  支持盘式：' + (supportedPan.join('、') || '（无）'));
console.log('  支持暗干排法：' + (supportedAn.join('、') || '（无）'));
console.log('  穿壬盘：' + summary.counts.chuanRenCharts + ' 个');
console.log('  命运局：' + (mingyun.supported ? `支持，${mingyun.steps.length} 步` : '未提供（留空）：' + (mingyun.notes[0] || '')));
