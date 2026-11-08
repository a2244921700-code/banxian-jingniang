/**
 * index.js —— 卦师引擎统一入口（纯 ESM、零第三方依赖）
 *
 * 汇总导出 SPEC §3.1 的全部函数：
 *  历法：getAlmanac / trueSolarTime / solarTerms / lunarFromDate / dayPillar / hourPillar / xunKong
 *  卦典：getHexagram / hexagrams
 *  起卦：castMeihua / castLiuyao / castLiuyaoRandom
 *  数据：data
 * 三式（奇门 qimen.js / 六壬 liuren.js）由 engine-sanshi 提供，可能尚未就绪：
 * 这里用动态 import + try/catch 接入，未就绪时不影响其余能力，调用时给出明确报错。
 */

export * from './almanac.js';
export * from './hexagrams.js';
export * from './najia.js';
export * from './meihua.js';
export * from './liuyao.js';

import {
  STEMS, BRANCHES, STEM_ELEMENTS, BRANCH_ELEMENTS, SOLAR_TERMS,
} from './almanac.js';
import {
  TRIGRAMS, TRIGRAM_ORDER, WUXING_SHENG, WUXING_KE, wuxingRelation, palaceTable,
} from './hexagrams.js';
import { NAJIA_STEMS, NAJIA_BRANCHES, LIUSHEN, LIUQIN } from './najia.js';

/** 引擎版本 */
export const VERSION = '1.0.0';

/**
 * 静态基础数据（速查表用）。
 * palances 沿用 SPEC 拼写，为 64 条扁平八宫表（每宫 8 卦）；palacesByPalace 为按宫分组版。
 */
const _palacesByPalace = palaceTable();
const _palances = Object.entries(_palacesByPalace).flatMap(([palace, list]) =>
  list.map((x) => ({ ...x, palace, palaceElement: TRIGRAMS[palace].element })));

export const data = {
  stems: STEMS,
  branches: BRANCHES,
  stemElements: STEM_ELEMENTS,
  branchElements: BRANCH_ELEMENTS,
  trigrams: TRIGRAMS,
  trigramOrder: TRIGRAM_ORDER,
  wuxing: {
    sheng: WUXING_SHENG, // 我生
    ke: WUXING_KE, // 我克
    relation: wuxingRelation,
  },
  palances: _palances,
  palaces: _palances,
  palacesByPalace: _palacesByPalace,
  najia: {
    stems: NAJIA_STEMS,
    branches: NAJIA_BRANCHES,
  },
  liushen: LIUSHEN,
  liuqin: LIUQIN,
  solarTerms: SOLAR_TERMS,
};

// ============================================================
// 三式（奇门 / 六壬）：动态接入
// ============================================================

const _sanshi = { qimen: null, liuren: null, loaded: false, errors: {} };

async function loadModule(name) {
  try {
    // 用 URL 动态导入，文件不存在时抛错，由调用方降级
    return await import(new URL('./' + name + '.js', import.meta.url));
  } catch (err) {
    _sanshi.errors[name] = err && err.message ? err.message : String(err);
    return null;
  }
}

/**
 * 加载三式模块（幂等）。返回 { qimen, liuren } 模块命名空间，未就绪者为 null。
 */
export async function loadSanshi(force = false) {
  if (_sanshi.loaded && !force) return { qimen: _sanshi.qimen, liuren: _sanshi.liuren };
  _sanshi.qimen = await loadModule('qimen');
  _sanshi.liuren = await loadModule('liuren');
  _sanshi.loaded = true;
  return { qimen: _sanshi.qimen, liuren: _sanshi.liuren };
}

/** 三式模块就绪状态（不抛错） */
export async function sanshiStatus() {
  await loadSanshi();
  return {
    qimen: {
      ready: Boolean(_sanshi.qimen && typeof _sanshi.qimen.castQimen === 'function'),
      error: _sanshi.errors.qimen || null,
    },
    liuren: {
      ready: Boolean(_sanshi.liuren && typeof _sanshi.liuren.castLiuren === 'function'),
      error: _sanshi.errors.liuren || null,
    },
  };
}

/**
 * 时家奇门排盘（委托 lib/engine/qimen.js，engine-sanshi 提供）。
 * @param {object} opts { date, method, pan }
 */
export async function castQimen(opts = {}) {
  const m = await loadSanshi();
  if (!m.qimen || typeof m.qimen.castQimen !== 'function') {
    throw new Error('奇门模块 lib/engine/qimen.js 未就绪（由 engine-sanshi 交付）：' + (_sanshi.errors.qimen || '未找到 castQimen'));
  }
  return m.qimen.castQimen(opts);
}

/**
 * 大六壬排盘（委托 lib/engine/liuren.js，engine-sanshi 提供）。
 * @param {object} opts { date, daynight }
 */
export async function castLiuren(opts = {}) {
  const m = await loadSanshi();
  if (!m.liuren || typeof m.liuren.castLiuren !== 'function') {
    throw new Error('六壬模块 lib/engine/liuren.js 未就绪（由 engine-sanshi 交付）：' + (_sanshi.errors.liuren || '未找到 castLiuren'));
  }
  return m.liuren.castLiuren(opts);
}

export default {
  VERSION,
  data,
  loadSanshi,
  sanshiStatus,
  castQimen,
  castLiuren,
};
