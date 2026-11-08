import test from 'node:test';
import assert from 'node:assert/strict';
import { castZiwei } from '../lib/engine/ziwei.js';

const B = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function palaceOf(chart, name) {
  return chart.palaces.find((p) => p.name === name);
}

function starAt(chart, zhi, name) {
  const p = chart.palaces.find((x) => x.zhi === zhi);
  return p ? p.stars.find((s) => s.name === name) : null;
}

test('紫微：1990-05-15 14:30 男（通行盘例）', () => {
  // 参考：py-iztro（iztro 2.5.0）对照盘
  const c = castZiwei({ date: new Date('1990-05-15T14:30:00+08:00'), gender: '男', now: new Date(2026, 10, 7) });
  assert.equal(c.details.mingZhi, '戌');
  assert.equal(c.details.shenZhi, '子');
  assert.equal(c.meta.wuxingJu, '土五局');
  assert.equal(c.details.mingGanzhi, '丙戌');
  assert.equal(c.details.ziweiZhi, '戌');
  assert.equal(c.details.tianfuZhi, '午');
  assert.equal(c.meta.mingZhu, '禄存');
  assert.equal(c.meta.shenZhu, '火星');
  assert.equal(c.meta.birthLunar, '庚午年 四月廿一');
  assert.equal(c.meta.fourPillars, '庚午 辛巳 庚辰 癸未');
  // 十四主星位置（参考盘）
  const expectPos = {
    紫微: '戌', 天机: '酉', 太阳: '未', 武曲: '午', 天同: '巳', 廉贞: '寅',
    天府: '午', 太阴: '未', 贪狼: '申', 巨门: '酉', 天相: '戌', 天梁: '亥',
    七杀: '子', 破军: '辰',
  };
  for (const [star, zhi] of Object.entries(expectPos)) {
    const found = c.palaces.find((p) => p.stars.some((s) => s.name === star));
    assert.ok(found, `${star} 应在盘中`);
    assert.equal(found.zhi, zhi, `${star} 位置`);
  }
  // 四化：庚年 太阳禄 武曲权 太阴科 天同忌
  assert.equal(starAt(c, '未', '太阳').sihua, '禄');
  assert.equal(starAt(c, '午', '武曲').sihua, '权');
  assert.equal(starAt(c, '未', '太阴').sihua, '科');
  assert.equal(starAt(c, '巳', '天同').sihua, '忌');
  // 亮度抽样（参考盘）
  assert.equal(starAt(c, '戌', '紫微').bright, '得');
  assert.equal(starAt(c, '午', '天府').bright, '旺');
  // 大限：土五局起 5-14，阳男顺行；命宫 5-14、父母 15-24
  assert.equal(palaceOf(c, '命宫').daxian, '5-14');
  assert.equal(palaceOf(c, '父母').daxian, '15-24');
  assert.equal(c.details.daxianDirection, '顺行');
  // 十二宫齐全、支唯一
  assert.equal(c.palaces.length, 12);
  assert.equal(new Set(c.palaces.map((p) => p.zhi)).size, 12);
  // 主星共 14（部分宫空宫）
  const mainCount = c.palaces.reduce((n, p) => n + p.stars.length, 0);
  assert.equal(mainCount, 14);
});

test('紫微：晚子时（1991-03-15 23:30）命宫/月系按当日、紫微按次日', () => {
  const c = castZiwei({ date: new Date('1991-03-15T23:30:00+08:00'), gender: '男' });
  assert.equal(c.details.mingZhi, '寅');
  assert.equal(c.details.shenZhi, '寅');
  assert.equal(c.meta.wuxingJu, '木三局');
  assert.equal(c.details.ziweiZhi, '辰'); // 次日二月初一，木三局初一在辰
  assert.ok(c.hints.some((h) => h.includes('晚子时')));
});

test('紫微：闰八月（1995-10-15 21:30）按后半月算下月', () => {
  const c = castZiwei({ date: new Date('1995-10-15T21:30:00+08:00'), gender: '男' });
  assert.equal(c.details.mingZhi, '亥'); // 闰八月廿一 → 按九月
  assert.equal(c.details.shenZhi, '酉');
  assert.equal(c.meta.wuxingJu, '土五局');
  assert.ok(c.hints.some((h) => h.includes('闰')));
});

test('紫微：女命逆行（1990-05-15 14:30 女）', () => {
  const c = castZiwei({ date: new Date('1990-05-15T14:30:00+08:00'), gender: '女' });
  assert.equal(c.details.daxianDirection, '逆行');
  // 命宫 5-14，阴女逆行 → 兄弟 15-24
  assert.equal(palaceOf(c, '命宫').daxian, '5-14');
  assert.equal(palaceOf(c, '兄弟').daxian, '15-24');
  // 命主/身主不随性别变
  assert.equal(c.meta.mingZhu, '禄存');
  assert.equal(c.meta.shenZhu, '火星');
});

test('紫微：非法输入与数据完整性', () => {
  assert.throws(() => castZiwei({ date: new Date('x') }), /出生时间/);
  const c = castZiwei({ date: new Date('2000-01-01T12:00:00+08:00'), gender: '女' });
  for (const p of c.palaces) {
    assert.ok(p.zhi && B.includes(p.zhi));
    assert.ok(p.name);
    assert.ok(Array.isArray(p.stars) && Array.isArray(p.aux) && Array.isArray(p.sha));
    assert.match(p.daxian, /^\d+-\d+$/);
  }
  // 四化只出现在四颗星上（本命四化；含辅星四化，如文曲/左辅）
  const hua = c.palaces.flatMap((p) => p.stars.concat(p.aux).filter((s) => s.sihua));
  assert.equal(hua.length, 4);
  // 大限覆盖 12 宫、范围连续（起限=局数，每宫 10 年）
  const starts = c.palaces.map((p) => Number(p.daxian.split('-')[0])).sort((a, b) => a - b);
  assert.equal(starts.length, 12);
  assert.equal(starts[0], c.details.ju.num);
  for (let i = 1; i < starts.length; i += 1) assert.equal(starts[i], starts[i - 1] + 10);
});

