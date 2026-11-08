/*!
 * 八字命盘前端原型 · bazi.js
 * 专业细盘版式（自研）；数据为虚构示例（1988-11-02 09:30，戊辰年 壬戌月 辛酉日 癸巳时，男），非真人命例。
 * 结构：列 = 流月 / 流年 / 大运 / 年柱 / 月柱 / 日柱 / 时柱；行 = 主星、天干、地支、藏干、星运、自坐、空亡、纳音、神煞。
 * 交互：点大运 → 换 10 年流年；点流年 → 换 12 月流月；点流月 → 换流月列。
 * 对外：window.BaziChart.render/getState/selectDayun/selectLiunian/selectLiuyue/onSelect
 */
(function () {
  'use strict';

  /* ───────── 基础表 ───────── */
  var STEMS = '甲乙丙丁戊己庚辛壬癸';
  var BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
  var STEM_EL = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
  var BRANCH_EL = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];

  var HIDDEN = {
    子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
    辰: ['戊', '乙', '癸'], 巳: ['丙', '戊', '庚'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
    申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲']
  };

  var CS_ORDER = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
  var CS_START = { 甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅', 己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯' };

  var NAYIN = [
    '海中金', '炉中火', '大林木', '路旁土', '剑锋金', '山头火', '涧下水', '城头土', '白蜡金', '杨柳木',
    '泉中水', '屋上土', '霹雳火', '松柏木', '长流水', '沙中金', '山下火', '平地木', '壁上土', '金箔金',
    '覆灯火', '天河水', '大驿土', '钗钏金', '桑柘木', '大溪水', '沙中土', '天上火', '石榴木', '大海水'
  ];

  var JIEQI = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];

  var EL_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  var EL_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

  function idx(str, ch) { return str.indexOf(ch); }
  function ganIdx(g) { return STEMS.indexOf(g); }
  function zhiIdx(z) { return BRANCHES.indexOf(z); }
  function mod12(n) { return ((n % 12) + 12) % 12; }

  function sexagenaryIndex(gan, zhi) {
    var gi = ganIdx(gan), zi = zhiIdx(zhi);
    for (var i = 0; i < 60; i += 1) if (i % 10 === gi && i % 12 === zi) return i;
    return -1;
  }

  function shishen(dayGan, targetGan) {
    var di = ganIdx(dayGan), ti = ganIdx(targetGan);
    var de = STEM_EL[di], te = STEM_EL[ti];
    var sameYY = di % 2 === ti % 2;
    if (de === te) return sameYY ? '比肩' : '劫财';
    if (EL_SHENG[de] === te) return sameYY ? '食神' : '伤官';
    if (EL_KE[de] === te) return sameYY ? '偏财' : '正财';
    if (EL_KE[te] === de) return sameYY ? '七杀' : '正官';
    if (EL_SHENG[te] === de) return sameYY ? '偏印' : '正印';
    return '';
  }

  function changSheng(gan, zhi) {
    var start = CS_START[gan];
    if (!start) return '';
    var si = zhiIdx(start), zi = zhiIdx(zhi);
    var odd = ganIdx(gan) % 2 === 1;
    var step = odd ? mod12(si - zi) : mod12(zi - si);
    return CS_ORDER[step];
  }

  function xunKong(gan, zhi) {
    var i = sexagenaryIndex(gan, zhi);
    if (i < 0) return '';
    var xun = Math.floor(i / 10);
    var a = mod12(xun * 10 + 10);
    return BRANCHES[a] + BRANCHES[mod12(a + 1)];
  }

  function nayin(gan, zhi) {
    var i = sexagenaryIndex(gan, zhi);
    return i < 0 ? '' : NAYIN[Math.floor(i / 2)];
  }

  /* 三合局 */
  var GROUP = {};
  [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']].forEach(function (g) {
    g.forEach(function (z) { GROUP[z] = g.join(''); });
  });
  var TAOHUA = { '申子辰': '酉', '寅午戌': '卯', '巳酉丑': '午', '亥卯未': '子' };
  var YIMA = { '申子辰': '寅', '寅午戌': '申', '巳酉丑': '亥', '亥卯未': '巳' };
  var HUAGAI = { '申子辰': '辰', '寅午戌': '戌', '巳酉丑': '丑', '亥卯未': '未' };
  var JIANGXING = { '申子辰': '子', '寅午戌': '午', '巳酉丑': '酉', '亥卯未': '卯' };
  var JIESHA = { '申子辰': '巳', '寅午戌': '亥', '巳酉丑': '寅', '亥卯未': '申' };
  var WANGSHEN = { '申子辰': '亥', '寅午戌': '巳', '巳酉丑': '申', '亥卯未': '寅' };
  var GUCHEN = { '亥子丑': '寅', '寅卯辰': '巳', '巳午未': '申', '申酉戌': '亥' };
  var GUASU = { '亥子丑': '戌', '寅卯辰': '丑', '巳午未': '辰', '申酉戌': '未' };

  function group3(z) {
    var g = GROUP[z] || '';
    return g;
  }

  function tianyiOf(gan) {
    var map = { 甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉', 辛: '午寅', 壬: '卯巳', 癸: '卯巳' };
    return (map[gan] || '').split('');
  }
  var WENCHANG = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
  var LUSHEN = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };

  function calcShensha(gan, zhi, dayGan, yearBranch) {
    var out = [];
    function add(name, ok) { if (ok && out.indexOf(name) < 0) out.push(name); }
    add('天乙贵人', tianyiOf(dayGan).indexOf(zhi) >= 0);
    add('文昌贵人', WENCHANG[dayGan] === zhi);
    add('禄神', LUSHEN[dayGan] === zhi);
    add('羊刃', changSheng(dayGan, zhi) === '帝旺');
    var g = group3(yearBranch);
    add('桃花', TAOHUA[g] === zhi);
    add('驿马', YIMA[g] === zhi);
    add('华盖', HUAGAI[g] === zhi);
    add('将星', JIANGXING[g] === zhi);
    add('劫煞', JIESHA[g] === zhi);
    add('亡神', WANGSHEN[g] === zhi);
    var yb = zhiIdx(yearBranch);
    var hong = BRANCHES[mod12(3 - yb)];
    add('红鸾', hong === zhi);
    add('天喜', BRANCHES[mod12(3 - yb + 6)] === zhi);
    var gu = null, gua = null;
    Object.keys(GUCHEN).forEach(function (k) { if (k.indexOf(yearBranch) >= 0) { gu = GUCHEN[k]; gua = GUASU[k]; } });
    add('孤辰', gu === zhi);
    add('寡宿', gua === zhi);
    return out;
  }

  /* ───────── 示例盘 ───────── */
  // 四柱：戊辰 / 壬戌 / 辛酉 / 癸巳；日主辛；男（元男）。虚构示例，非真人命例。
  var BIRTH = {
    year: 1988,
    gender: '男',
    solar: '1988年11月2日 巳时（虚构示例）',
    lunar: '戊辰年 九月廿三',
    pillarsRaw: [['戊', '辰'], ['壬', '戌'], ['辛', '酉'], ['癸', '巳']],
    qiyun: '出生后1年8个月16天起运，3岁交运（1990年）',
    jiaoyun: '1990年起交入第一步大运（顺行）',
    siling: '—',
    // 四柱神煞（示例盘计算值）
    pillarShensha: [
      ['华盖'],
      [],
      ['禄神', '桃花'],
      ['劫煞', '天喜', '孤辰']
    ]
  };

  // 大运（据示例盘，10 步）
  var DAYUN = [
    { from: 1990, to: 1999, label: '1990', age: '3岁', gan: '癸', zhi: '亥' },
    { from: 2000, to: 2009, label: '2000', age: '13岁', gan: '甲', zhi: '子' },
    { from: 2010, to: 2019, label: '2010', age: '23岁', gan: '乙', zhi: '丑' },
    { from: 2020, to: 2029, label: '2020', age: '33岁', gan: '丙', zhi: '寅' },
    { from: 2030, to: 2039, label: '2030', age: '43岁', gan: '丁', zhi: '卯' },
    { from: 2040, to: 2049, label: '2040', age: '53岁', gan: '戊', zhi: '辰' },
    { from: 2050, to: 2059, label: '2050', age: '63岁', gan: '己', zhi: '巳' },
    { from: 2060, to: 2069, label: '2060', age: '73岁', gan: '庚', zhi: '午' },
    { from: 2070, to: 2079, label: '2070', age: '83岁', gan: '辛', zhi: '未' },
    { from: 2080, to: 2089, label: '2080', age: '93岁', gan: '壬', zhi: '申' }
  ];

  // 动态列神煞：留空，按规则计算常用子集
  var SHENSHA_OVERRIDE = {};

  var DAY_MAIN = BIRTH.gender === '男' ? '元男' : '元女';
  var DAY_GAN = BIRTH.pillarsRaw[2][0];
  var DAY_ZHI = BIRTH.pillarsRaw[2][1];
  var YEAR_BRANCH = BIRTH.pillarsRaw[0][1];

  /* ───────── 计算列 ───────── */
  function makeColumn(gan, zhi, label, opts) {
    opts = opts || {};
    var canggan = (HIDDEN[zhi] || []).map(function (g) {
      return { gan: g, shishen: shishen(DAY_GAN, g) };
    });
    var shensha = opts.shensha;
    if (!shensha) {
      var key = gan + zhi;
      shensha = SHENSHA_OVERRIDE[key] || calcShensha(gan, zhi, DAY_GAN, YEAR_BRANCH);
    }
    return {
      label: label,
      gan: gan,
      zhi: zhi,
      ganEl: STEM_EL[ganIdx(gan)],
      zhiEl: BRANCH_EL[zhiIdx(zhi)],
      shishen: label === '日柱' ? DAY_MAIN : shishen(DAY_GAN, gan),
      canggan: canggan,
      xingyun: changSheng(DAY_GAN, zhi),
      zizuo: changSheng(gan, zhi),
      kongwang: xunKong(gan, zhi),
      nayin: nayin(gan, zhi),
      shensha: shensha
    };
  }

  function yearGanzhi(year) {
    var n = year - 4;
    return { gan: STEMS[((n % 10) + 10) % 10], zhi: BRANCHES[((n % 12) + 12) % 12] };
  }

  function liunianList(dy) {
    var out = [];
    for (var y = dy.from; y <= dy.to; y += 1) {
      var gz = yearGanzhi(y);
      out.push({
        year: y,
        age: y - BIRTH.year + 1,
        gan: gz.gan,
        zhi: gz.zhi,
        shishen: shishen(DAY_GAN, gz.gan)
      });
    }
    return out;
  }

  function liuyueList(ln) {
    var out = [];
    var base = (ganIdx(ln.gan) % 5) * 2 + 2;
    for (var i = 0; i < 12; i += 1) {
      var zhi = BRANCHES[(2 + i) % 12]; // 寅..丑（含子、丑绕回）
      var gan = STEMS[(base + i) % 10];
      out.push({
        idx: i,
        jieqi: JIEQI[i],
        gan: gan,
        zhi: zhi,
        shishen: shishen(DAY_GAN, gan)
      });
    }
    return out;
  }

  /* ───────── 状态 ───────── */
  var state = {
    dayunIdx: 3,       // 2020-2029 丙寅（示例盘当前大运）
    liunianYear: 2026, // 丙午
    liuyueIdx: 8,      // 戌月 戊戌（按当前节气）
    columns: [],
    dayun: [],
    liunian: [],
    liuyue: []
  };
  

  function currentDayun() { return DAYUN[state.dayunIdx]; }

  function buildAll() {
    var dy = currentDayun();
    state.liunian = liunianList(dy);
    var ln = state.liunian.filter(function (x) { return x.year === state.liunianYear; })[0] || state.liunian[0];
    state.liunianYear = ln.year;
    state.liuyue = liuyueList(ln);
    if (state.liuyueIdx > 11) state.liuyueIdx = 11;

    var ly = state.liuyue[state.liuyueIdx];
    var dyCol = makeColumn(dy.gan, dy.zhi, '大运', {
      shensha: SHENSHA_OVERRIDE[dy.gan + dy.zhi]
    });
    var lnCol = makeColumn(ln.gan, ln.zhi, '流年', {
      shensha: SHENSHA_OVERRIDE[ln.gan + ln.zhi]
    });
    var lyCol = makeColumn(ly.gan, ly.zhi, '流月', {
      shensha: SHENSHA_OVERRIDE[ly.gan + ly.zhi]
    });
    var pillars = BIRTH.pillarsRaw.map(function (pz, i) {
      return makeColumn(pz[0], pz[1], ['年柱', '月柱', '日柱', '时柱'][i], {
        shensha: BIRTH.pillarShensha[i]
      });
    });
    state.columns = [lyCol, lnCol, dyCol].concat(pillars);
  }

  /* ───────── DOM 工具 ───────── */
  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function wxSpan(ganOrZhi, isBranch) {
    var elName = isBranch ? BRANCH_EL[zhiIdx(ganOrZhi)] : STEM_EL[ganIdx(ganOrZhi)];
    var s = el('span', 'wx-' + elName, ganOrZhi);
    return s;
  }

  /* ───────── 盘面渲染 ───────── */
  function renderChart() {
    var chart = $('#chart');
    if (!chart) return;
    chart.innerHTML = '';
    var labels = ['日期'].concat(state.columns.map(function (c) { return c.label; }));
    labels.forEach(function (t, i) {
      var c = el('div', 'cell head' + (i >= 1 && i <= 3 ? ' selected' : ''), t);
      chart.appendChild(c);
    });

    function rowHead(title) { chart.appendChild(el('div', 'cell label', title)); }

    // 主星
    rowHead('主星');
    state.columns.forEach(function (c) {
      chart.appendChild(el('div', 'cell row-main', c.shishen || ''));
    });
    // 天干
    rowHead('天干');
    state.columns.forEach(function (c) {
      var d = el('div', 'cell row-gan');
      d.appendChild(wxSpan(c.gan, false));
      chart.appendChild(d);
    });
    // 地支
    rowHead('地支');
    state.columns.forEach(function (c) {
      var d = el('div', 'cell row-zhi');
      d.appendChild(wxSpan(c.zhi, true));
      chart.appendChild(d);
    });
    // 藏干（含副星）
    rowHead('藏干');
    state.columns.forEach(function (c) {
      var d = el('div', 'cell row-cang');
      (c.canggan || []).forEach(function (x) {
        var line = el('div', 'hidden-gan');
        line.appendChild(wxSpan(x.gan, false));
        line.appendChild(el('span', 'shishen', x.shishen));
        d.appendChild(line);
      });
      chart.appendChild(d);
    });
    // 星运
    rowHead('星运');
    state.columns.forEach(function (c) { chart.appendChild(el('div', 'cell row-ss', c.xingyun)); });
    // 自坐
    rowHead('自坐');
    state.columns.forEach(function (c) { chart.appendChild(el('div', 'cell row-ss', c.zizuo)); });
    // 空亡
    rowHead('空亡');
    state.columns.forEach(function (c) { chart.appendChild(el('div', 'cell row-ss', c.kongwang)); });
    // 纳音
    rowHead('纳音');
    state.columns.forEach(function (c) { chart.appendChild(el('div', 'cell row-ss', c.nayin)); });
    // 神煞
    rowHead('神煞');
    state.columns.forEach(function (c) {
      var d = el('div', 'cell row-sha');
      (c.shensha || []).forEach(function (s) { d.appendChild(el('span', '', s)); });
      chart.appendChild(d);
    });
  }

  function renderDayunStrip() {
    var strip = $('#dayun-strip');
    if (!strip) return;
    strip.innerHTML = '';
    DAYUN.forEach(function (dy, i) {
      var item = el('div', 'strip-item' + (i === state.dayunIdx ? ' on' : ''));
      item.appendChild(el('div', 'age', dy.label + (dy.pre ? '（起运前）' : '')));
      var g = el('div', 'gi');
      g.appendChild(wxSpan(dy.gan, false));
      g.appendChild(wxSpan(dy.zhi, true));
      item.appendChild(g);
      item.appendChild(el('div', 'age', dy.age));
      item.addEventListener('click', function () { API.selectDayun(i); });
      strip.appendChild(item);
    });
  }

  function renderLiunianStrip() {
    var strip = $('#liunian-strip');
    if (!strip) return;
    strip.innerHTML = '';
    state.liunian.forEach(function (ln) {
      var item = el('div', 'strip-item' + (ln.year === state.liunianYear ? ' on' : ''));
      item.appendChild(el('div', 'age', ln.year + ' · ' + ln.age + '岁'));
      var g = el('div', 'gi');
      g.appendChild(wxSpan(ln.gan, false));
      g.appendChild(wxSpan(ln.zhi, true));
      item.appendChild(g);
      item.appendChild(el('div', 'age', ln.shishen));
      item.addEventListener('click', function () { API.selectLiunian(ln.year); });
      strip.appendChild(item);
    });
    var hint = $('#liunian-hint');
    if (hint) hint.textContent = '当前大运 ' + currentDayun().label + '–' + currentDayun().to + ' 年';
  }

  function renderLiuyueStrip() {
    var strip = $('#liuyue-strip');
    if (!strip) return;
    strip.innerHTML = '';
    state.liuyue.forEach(function (ly, i) {
      var item = el('div', 'strip-item' + (i === state.liuyueIdx ? ' on' : ''));
      item.appendChild(el('div', 'age', ly.jieqi));
      var g = el('div', 'gi');
      g.appendChild(wxSpan(ly.gan, false));
      g.appendChild(wxSpan(ly.zhi, true));
      item.appendChild(g);
      item.appendChild(el('div', 'age', ly.shishen));
      item.addEventListener('click', function () { API.selectLiuyue(i); });
      strip.appendChild(item);
    });
    var hint = $('#liuyue-hint');
    if (hint) hint.textContent = state.liunianYear + ' 年 · 节气换月';
  }

  /* ───────── 合婚页（虚构示例） ───────── */
  var HEHUN = {
    a: { name: '甲方（虚构示例）', gender: '男', rizhu: '辛金', pillars: '戊辰 壬戌 辛酉 癸巳', shengxiao: '龙', ju: '示例' },
    b: { name: '乙方（虚构示例）', gender: '女', rizhu: '己土', pillars: '戊寅 甲寅 己亥 甲子', shengxiao: '虎', ju: '示例' },
    rows: [
      ['生肖', '龙（辰）', '虎（寅）', '生肖只作参考，合婚以日主与夫妻宫为主'],
      ['日元', '辛金', '己土', '土生金：乙方对甲方有生扶'],
      ['夫妻宫', '酉（日支）', '亥（日支）', '无直接刑冲，合冲看大运流年'],
      ['旺衰', '示例未算', '示例未算', '此处不代替正式合盘'],
      ['格局', '示例未排', '示例未排', '以实际排盘为准'],
      ['五行', '示例未统计', '示例未统计', '正式合盘再补五行能量'],
      ['纳音', '大林木 / 大海水', '城头土 / 海中金', '纳音以年柱为主，作参考'],
      ['神煞', '示例未取', '示例未取', '待正式合盘后补'],
      ['相互关系', '—', '—', '待正式合盘后补']
    ]
  };

  function renderHehun() {
    function card(person) {
      var keys = [['姓名', person.name], ['性别', person.gender], ['日元', person.rizhu],
        ['四柱', person.pillars], ['生肖', person.shengxiao], ['五行局', person.ju]];
      return keys.map(function (kv) {
        return '<div><span class="k">' + kv[0] + '</span>' + kv[1] + '</div>';
      }).join('');
    }
    var a = $('#hehun-a'), b = $('#hehun-b');
    if (a) a.innerHTML = card(HEHUN.a);
    if (b) b.innerHTML = card(HEHUN.b);
    var table = $('#hehun-table');
    if (!table) return;
    table.innerHTML = '';
    var head = el('div', 'hh-row hh-head');
    ['项目', '甲方', '乙方', '解读'].forEach(function (t) { head.appendChild(el('div', '', t)); });
    table.appendChild(head);
    HEHUN.rows.forEach(function (row) {
      var r = el('div', 'hh-row');
      r.appendChild(el('div', 'hh-label', row[0]));
      r.appendChild(el('div', '', row[1]));
      r.appendChild(el('div', '', row[2]));
      r.appendChild(el('div', '', row[3]));
      table.appendChild(r);
    });
  }

  /* ───────── 对外 API ───────── */
  var API = {
    version: '0.1.0',
    state: state,
    getState: function () { return state; },
    selectDayun: function (i) {
      if (i < 0 || i >= DAYUN.length) return API;
      state.dayunIdx = i;
      var dy = currentDayun();
      state.liunianYear = Math.max(dy.from, Math.min(state.liunianYear, dy.to));
      buildAll();
      renderChart(); renderDayunStrip(); renderLiunianStrip(); renderLiuyueStrip();
      if (typeof API.onSelect === 'function') API.onSelect(state);
      return API;
    },
    selectLiunian: function (year) {
      var found = null;
      state.liunian.forEach(function (x) { if (x.year === year) found = x; });
      if (!found) return API;
      state.liunianYear = year;
      state.liuyueIdx = Math.min(state.liuyueIdx, 11);
      buildAll();
      renderChart(); renderLiunianStrip(); renderLiuyueStrip(); renderDayunStrip();
      if (typeof API.onSelect === 'function') API.onSelect(state);
      return API;
    },
    selectLiuyue: function (i) {
      if (i < 0 || i > 11) return API;
      state.liuyueIdx = i;
      buildAll();
      renderChart(); renderLiuyueStrip(); renderLiunianStrip(); renderDayunStrip();
      if (typeof API.onSelect === 'function') API.onSelect(state);
      return API;
    },
    render: function () {
      var m = $('#meta-name'), l1 = $('#meta-line'), l2 = $('#meta-line2');
      if (m) m.textContent = '示例盘 · ' + DAY_MAIN;
      if (l1) l1.textContent = '农历：' + BIRTH.lunar + ' ｜ 阳历：' + BIRTH.solar;
      if (l2) l2.textContent = '起运：' + BIRTH.qiyun + ' ｜ 交运：' + BIRTH.jiaoyun + ' ｜ 司令：' + BIRTH.siling;
      buildAll();
      renderChart(); renderDayunStrip(); renderLiunianStrip(); renderLiuyueStrip(); renderHehun();
      var status = $('#status');
      if (status) status.textContent = '虚构示例（1988 戊辰·壬戌·辛酉·癸巳 男） · 当前：' +
        currentDayun().gan + currentDayun().zhi + ' 大运 · ' + state.liunianYear + ' 年 · ' +
        state.liuyue[state.liuyueIdx].gan + state.liuyue[state.liuyueIdx].zhi + ' 月';
      return API;
    },
    onSelect: null
  };
  window.BaziChart = API;

  /* ───────── 页签与启动 ───────── */
  function bindTabs() {
    var tabs = $('#tabs');
    if (!tabs) return;
    tabs.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('.tab') : null;
      if (!btn) return;
      var page = btn.getAttribute('data-page');
      tabs.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('on', t === btn); });
      var pan = $('#page-pan'), hehun = $('#page-hehun');
      if (pan) pan.classList.toggle('hidden', page !== 'pan');
      if (hehun) hehun.classList.toggle('hidden', page !== 'hehun');
    });
  }

  function boot() {
    bindTabs();
    API.render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


