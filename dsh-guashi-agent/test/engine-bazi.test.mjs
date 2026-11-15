import test from 'node:test';
import assert from 'node:assert/strict';
import { castBazi } from '../lib/engine/bazi.js';

function cast(iso, opts = {}) {
  return castBazi({
    date: new Date(iso),
    gender: opts.gender || '男',
    name: opts.name,
    longitude: opts.longitude,
    trueSolarTime: opts.trueSolarTime,
    now: new Date('2026-11-07T01:00:00+08:00'),
  });
}

test('八字：1988-11-02 09:30 男（虚构示例，对照 lunar_python）', () => {
  const c = cast('1988-11-02T09:30:00+08:00');
  assert.equal(c.meta.fourPillars, '戊辰 壬戌 辛酉 癸巳');
  assert.equal(c.meta.lunar, '戊辰年 九月廿三');
  assert.equal(c.meta.rizhu, '辛金');
  assert.equal(c.meta.rizhuElement, '金');
  assert.equal(c.meta.shengxiao, '龙');
  assert.equal(c.meta.direction, '顺行'); // 阳年男 → 顺行
  assert.equal(c.pillars.length, 4);
  assert.equal(c.pillars[0].shishen, '正印');
  assert.equal(c.pillars[1].shishen, '伤官');
  assert.equal(c.pillars[2].shishen, '元男');
  assert.equal(c.pillars[3].shishen, '食神');
  assert.deepEqual(c.pillars[0].canggan.map((x) => x.gan + x.shishen), ['戊正印', '乙偏财', '癸食神']);
  assert.deepEqual(c.pillars[2].canggan.map((x) => x.gan + x.shishen), ['辛比肩']);
  assert.deepEqual(c.pillars.map((p) => p.xingyun), ['墓', '冠带', '临官', '死']);
  assert.deepEqual(c.pillars.map((p) => p.zizuo), ['冠带', '冠带', '临官', '胎']);
  assert.deepEqual(c.pillars.map((p) => p.kongwang), ['戌亥', '子丑', '子丑', '午未']);
  assert.deepEqual(c.pillars.map((p) => p.nayin), ['大林木', '大海水', '石榴木', '长流水']);
});

test('八字：大运顺逆、起运与流年流月', () => {
  const c = cast('1988-11-02T09:30:00+08:00');
  assert.equal(c.dayun.length, 10);
  assert.deepEqual(c.dayun.slice(0, 5).map((d) => [d.from, d.gan + d.zhi, d.shishen]), [
    [1990, '癸亥', '食神'],
    [2000, '甲子', '正财'],
    [2010, '乙丑', '偏财'],
    [2020, '丙寅', '正官'],
    [2030, '丁卯', '七杀'],
  ]);
  assert.equal(c.meta.startAge, 3);
  assert.equal(c.meta.startYear, 1990);
  const d20 = c.dayun.find((d) => d.from === 2020);
  assert.equal(d20.liunian.length, 10);
  const ln2026 = d20.liunian.find((x) => x.year === 2026);
  assert.equal(ln2026.gan + ln2026.zhi, '丙午');
  assert.equal(ln2026.shishen, '正官');
  assert.equal(ln2026.liuyue.length, 12);
  assert.deepEqual(ln2026.liuyue.map((m) => m.gan + m.zhi), [
    '庚寅', '辛卯', '壬辰', '癸巳', '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑',
  ]);
  assert.equal(ln2026.liuyue[11].jieqi, '小寒');
  assert.equal(ln2026.liuyue[11].shishen, '比肩');

  // 阳年女 → 逆行
  const f = cast('1988-11-02T09:30:00+08:00', { gender: '女' });
  assert.equal(f.meta.direction, '逆行');
});

test('八字：晚子时按子时换日（23:00 进次日）', () => {
  const c = cast('1988-11-02T23:30:00+08:00');
  assert.equal(c.meta.fourPillars, '戊辰 壬戌 壬戌 庚子');
  assert.ok(c.hints.some((h) => h.includes('晚子时')));
});

test('八字：真太阳时开关与提示', () => {
  const plain = cast('1988-11-02T09:30:00+08:00', { longitude: 121.47, trueSolarTime: false });
  assert.equal(plain.meta.useTrueSolarTime, false);
  assert.ok(plain.hints.some((h) => h.includes('按北京时间')));
  const solar = cast('1988-11-02T09:30:00+08:00', { longitude: 121.47 });
  assert.equal(solar.meta.useTrueSolarTime, true);
  assert.ok(solar.hints.some((h) => h.includes('真太阳时')));
  assert.equal(solar.meta.fourPillars, '戊辰 壬戌 辛酉 癸巳');
});

test('八字：非法输入与结构完整性', () => {
  assert.throws(() => castBazi({ date: new Date('x') }), /出生时间/);
  const c = cast('2020-06-21T06:30:00+08:00');
  assert.equal(c.meta.fourPillars.length > 0, true);
  for (const d of c.dayun) {
    assert.equal(d.liunian.length, 10);
    for (const ln of d.liunian) {
      assert.equal(ln.year >= d.from && ln.year <= d.to, true);
      assert.equal(ln.liuyue.length, 12);
      assert.match(ln.gan + ln.zhi, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
    }
  }
  assert.ok(Array.isArray(c.hints));
  assert.equal(typeof c.meta.qiyun, 'string');
});

