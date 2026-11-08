/**
 * verify_almanac.mjs —— 开发期核对脚本（不属于交付测试）
 * 把 almanac.js 的输出与香港天文台《公历农历对照表》逐项比对。
 *
 * 用法：node lib/engine/scripts/verify_almanac.mjs
 */
import { readFileSync } from 'node:fs';
import {
  solarTerms, lunarFromDate, dayPillar, getAlmanac, fmtBeijing, springFestivals,
} from '../almanac.js';

const HKO = JSON.parse(
  readFileSync(new URL('./.cache/hko-expect.json', import.meta.url), 'utf8'),
);

let termOk = 0; let termBad = [];
let lunarOk = 0; let lunarBad = [];

for (const [yearStr, data] of Object.entries(HKO.years)) {
  const year = Number(yearStr);
  const mine = new Map(solarTerms(year).map((t) => [t.name, t.local.slice(0, 10)]));
  for (const [name, expect] of Object.entries(data.terms)) {
    const got = mine.get(name);
    if (got === expect) termOk++; else termBad.push(`${year} ${name} 期望 ${expect} 实得 ${got}`);
  }
  for (const m of data.months) {
    const d = new Date(`${m.date}T12:00:00+08:00`);
    const l = lunarFromDate(d);
    const okMonth = l.month === m.month && l.isLeap === m.leap && l.day === 1;
    if (okMonth) lunarOk++;
    else lunarBad.push(`${m.date} 期望 ${m.leap ? '闰' : ''}${m.month}月初一 实得 ${l.isLeap ? '闰' : ''}${l.month}月${l.dayName || l.day}`);
  }
}

console.log(`节气日期核对：${termOk} 项一致，${termBad.length} 项不一致`);
for (const b of termBad) console.log('  ✗ ' + b);
console.log(`农历月首核对：${lunarOk} 项一致，${lunarBad.length} 项不一致`);
for (const b of lunarBad.slice(0, 40)) console.log('  ✗ ' + b);

console.log('\n春节（农历正月初一）对照：');
const sf = new Map(springFestivals().map((x) => [x.year, x.local]));
for (const [yearStr, data] of Object.entries(HKO.years)) {
  if (!data.lunarNewYear) continue;
  const year = Number(yearStr);
  console.log(`  ${year} 天文台 ${data.lunarNewYear} 本引擎 ${sf.get(year)} ${sf.get(year) === data.lunarNewYear ? '✓' : '✗'}`);
}

console.log('\n日柱（儒略日法）若干日期：');
for (const s of [
  '1900-01-01T12:00:00+08:00', '1900-01-31T12:00:00+08:00', '1949-10-01T15:00:00+08:00',
  '2000-01-01T12:00:00+08:00', '2024-01-01T12:00:00+08:00', '2026-10-25T21:30:00+08:00',
]) {
  const d = new Date(s);
  console.log(`  ${fmtBeijing(d)} → ${dayPillar(d).name}`);
}

console.log('\ngetAlmanac(2026-10-25T21:30+08:00)：');
const a = getAlmanac(new Date('2026-10-25T21:30:00+08:00'));
console.log(JSON.stringify({
  local: a.local, lunar: a.lunar.fullName, ganzhi: a.ganzhi,
  monthBranch: a.monthBranch, dayBranch: a.dayBranch, xunKong: a.xunKong,
  solarTerm: a.solarTerm, hourBranch: a.hourBranch,
}, null, 1));

console.log('\ngetAlmanac(2026-10-25T21:30+08:00, {longitude:121.46}) 真太阳时：');
const b = getAlmanac(new Date('2026-10-25T21:30:00+08:00'), { longitude: 121.46 });
console.log(JSON.stringify({
  trueSolarTime: b.trueSolarTime, hourBranch: b.hourBranch,
  hourGanzhi: b.hourGanzhi, hourBasis: b.hourBasis,
}, null, 1));
