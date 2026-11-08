/*!
 * 紫微斗数命盘 · 前端原型 v0.1
 * 数据驱动：ZiweiChart.render(data) 重绘整盘。
 * 布局参考：文墨天机（12 宫环形 + 中宫信息）；浅色纸面为主，可切墨色。
 * 本文件零依赖，直接双击 index.html 可运行。
 */
(function () {
  'use strict';

  /* ─────────────────────────── 常量 ─────────────────────────── */

  // 十二宫名，从命宫起顺排
  var PALACE_ORDER = [
    '命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄',
    '迁移', '交友', '官禄', '田宅', '福德', '父母'
  ];

  // 盘面环序（沿四边逆时针一圈）：寅→丑→子→亥→戌→酉→申→未→午→巳→辰→卯
  var RING = ['寅', '丑', '子', '亥', '戌', '酉', '申', '未', '午', '巳', '辰', '卯'];

  // 地支 → 4×4 网格位置 [列, 行]，0 基：
  //   巳午未申
  //   辰□□酉
  //   卯□□戌
  //   寅丑子亥
  var POS = {
    '巳': [0, 0], '午': [1, 0], '未': [2, 0], '申': [3, 0],
    '辰': [0, 1], '酉': [3, 1],
    '卯': [0, 2], '戌': [3, 2],
    '寅': [0, 3], '丑': [1, 3], '子': [2, 3], '亥': [3, 3]
  };

  var ZHI_YINYANG = {
    '子': '阳', '丑': '阴', '寅': '阳', '卯': '阴', '辰': '阳', '巳': '阴',
    '午': '阳', '未': '阴', '申': '阳', '酉': '阴', '戌': '阳', '亥': '阴'
  };

  /* ─────────────────────────── 示例盘（非真实排盘，仅供版式） ─────────────────────────── */
  // 命宫在午，庚年四化：太阳禄、武曲权、太阴科、天同忌（示例）
  var SAMPLE_DATA = {
    meta: {
      name: '示例盘',
      gender: '男',
      birthSolar: '1990-05-15 14:30',
      birthLunar: '庚午年 四月 廿一 未时',
      fourPillars: '庚午 辛巳 乙酉 癸未',
      wuxingJu: '火六局',
      mingZhu: '贪狼',
      shenZhu: '天相',
      shenGongZhi: '申',
      daxian: '6-15 丙戌',
      liunian: '2026 丙午',
      note: '示例数据，用于版式演示，非真实排盘'
    },
    palaces: [
      { zhi: '寅', name: '财帛', isMing: false, isShen: false, daxian: '86-95', liunian: '',
        stars: [{ name: '天同', bright: '平', sihua: '忌' }, { name: '天相', bright: '庙' }],
        aux: [{ name: '右弼' }], sha: ['寡宿'] },

      { zhi: '丑', name: '疾厄', isMing: false, isShen: false, daxian: '76-85', liunian: '',
        stars: [{ name: '巨门', bright: '旺' }],
        aux: [{ name: '铃星' }], sha: ['华盖'] },

      { zhi: '子', name: '迁移', isMing: false, isShen: false, daxian: '66-75', liunian: '',
        stars: [{ name: '贪狼', bright: '旺' }],
        aux: [{ name: '火星' }], sha: ['驿马'] },

      { zhi: '亥', name: '交友', isMing: false, isShen: false, daxian: '56-65', liunian: '',
        stars: [{ name: '廉贞', bright: '陷' }, { name: '太阴', bright: '庙', sihua: '科' }],
        aux: [{ name: '地空' }], sha: ['天哭'] },

      { zhi: '戌', name: '官禄', isMing: false, isShen: false, daxian: '46-55', liunian: '',
        stars: [{ name: '天府', bright: '庙' }],
        aux: [{ name: '地劫' }], sha: ['天虚'] },

      { zhi: '酉', name: '田宅', isMing: false, isShen: false, daxian: '36-45', liunian: '',
        stars: [],
        aux: [{ name: '擎羊' }], sha: ['破碎'] },

      { zhi: '申', name: '福德', isMing: false, isShen: true, daxian: '26-35', liunian: '',
        stars: [{ name: '破军', bright: '得' }],
        aux: [{ name: '禄存' }], sha: ['大耗'] },

      { zhi: '未', name: '父母', isMing: false, isShen: false, daxian: '16-25', liunian: '',
        stars: [],
        aux: [{ name: '陀罗' }], sha: ['白虎'] },

      { zhi: '午', name: '命宫', isMing: true, isShen: false, daxian: '6-15', liunian: '流年命宫',
        stars: [{ name: '紫微', bright: '庙' }],
        aux: [{ name: '文昌' }, { name: '天魁' }], sha: ['天刑', '红鸾'] },

      { zhi: '巳', name: '兄弟', isMing: false, isShen: false, daxian: '116-125', liunian: '',
        stars: [{ name: '天机', bright: '旺' }],
        aux: [{ name: '左辅' }], sha: ['天姚'] },

      { zhi: '辰', name: '夫妻', isMing: false, isShen: false, daxian: '106-115', liunian: '',
        stars: [{ name: '太阳', bright: '得', sihua: '禄' }, { name: '七杀', bright: '庙' }],
        aux: [{ name: '文曲' }], sha: ['咸池'] },

      { zhi: '卯', name: '子女', isMing: false, isShen: false, daxian: '96-105', liunian: '',
        stars: [{ name: '武曲', bright: '旺', sihua: '权' }, { name: '天梁', bright: '庙' }],
        aux: [{ name: '天钺' }], sha: ['孤辰'] }
    ]
  };

  /* ─────────────────────────── 工具 ─────────────────────────── */

  var API = {
    version: '0.1.0',
    data: null,
    selected: null,
    onSelect: null
  };

  function $(sel, root) { return (root || document).querySelector(sel); }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function ringIndex(zhi) {
    var i = RING.indexOf(zhi);
    if (i < 0) throw new Error('未知地支：' + zhi);
    return i;
  }

  function validate(data) {
    if (!data || typeof data !== 'object') throw new Error('盘面数据为空');
    if (!data.meta || typeof data.meta !== 'object') throw new Error('缺少 meta');
    if (!Array.isArray(data.palaces) || data.palaces.length !== 12) {
      throw new Error('palaces 必须是 12 个宫位');
    }
    var seen = {};
    data.palaces.forEach(function (p) {
      if (!p || typeof p.zhi !== 'string') throw new Error('宫位缺少 zhi');
      if (RING.indexOf(p.zhi) < 0) throw new Error('宫位地支不合法：' + p.zhi);
      if (seen[p.zhi]) throw new Error('地支重复：' + p.zhi);
      seen[p.zhi] = true;
      if (p.stars && !Array.isArray(p.stars)) throw new Error('stars 必须是数组');
      if (p.aux && !Array.isArray(p.aux)) throw new Error('aux 必须是数组');
      if (p.sha && !Array.isArray(p.sha)) throw new Error('sha 必须是数组');
    });
    return true;
  }

  function palaceByZhi(zhi) {
    var data = API.data;
    if (!data) return null;
    for (var i = 0; i < data.palaces.length; i++) {
      if (data.palaces[i].zhi === zhi) return data.palaces[i];
    }
    return null;
  }

  function opponentOf(zhi) {
    var i = ringIndex(zhi);
    return RING[(i + 6) % 12];
  }

  function starRow(star) {
    var row = el('div', 'star-row');
    var name = el('span', 'star', star.name);
    if (star.bright) name.classList.add(brightClass(star.bright));
    row.appendChild(name);
    if (star.bright) {
      var b = el('span', 'bright', star.bright);
      row.appendChild(b);
    }
    if (star.sihua) {
      var s = el('span', 'sihua ' + sihuaClass(star.sihua), star.sihua);
      row.appendChild(s);
    }
    return row;
  }

  function brightClass(bright) {
    if (bright === '庙') return 'miao';
    if (bright === '旺') return 'wang';
    if (bright === '得' || bright === '利' || bright === '平') return 'de';
    if (bright === '陷') return 'xian';
    return 'de';
  }

  function sihuaClass(sihua) {
    if (sihua === '禄') return 'lu';
    if (sihua === '权') return 'quan';
    if (sihua === '科') return 'ke';
    if (sihua === '忌') return 'ji';
    return '';
  }

  /* ─────────────────────────── 渲染 ─────────────────────────── */

  function render(data) {
    validate(data);
    API.data = data;
    API.selected = null;

    var chart = $('#chart');
    if (!chart) return;
    chart.innerHTML = '';

    RING.forEach(function (zhi) {
      var p = palaceByZhi(zhi);
      if (!p) return;
      var pos = POS[zhi];
      var cell = el('div', 'palace');
      if (p.isMing) cell.classList.add('ming');
      if (p.isShen) cell.classList.add('shen');
      cell.style.gridColumn = String(pos[0] + 1);
      cell.style.gridRow = String(pos[1] + 1);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('data-zhi', zhi);
      cell.setAttribute('tabindex', '0');
      cell.title = p.name + '宫 · ' + zhi;

      /* 宫名 + 地支 */
      var head = el('div', 'p-head');
      head.appendChild(el('span', 'p-name', p.name));
      head.appendChild(el('span', 'p-zhi', zhi));
      cell.appendChild(head);

      /* 大限 / 流年 */
      var limit = el('div', 'p-limit');
      limit.appendChild(el('span', 'dx', p.daxian ? p.daxian + '岁' : ''));
      if (p.liunian) {
        var ln = el('span', 'ln', p.liunian);
        limit.appendChild(ln);
      }
      cell.appendChild(limit);

      /* 主星 */
      var stars = el('div', 'p-stars');
      (p.stars || []).forEach(function (star) { stars.appendChild(starRow(star)); });
      cell.appendChild(stars);

      /* 辅星 */
      if (p.aux && p.aux.length) {
        var aux = el('div', 'aux');
        aux.textContent = p.aux.map(function (a) { return a.name; }).join(' ');
        cell.appendChild(aux);
      }

      /* 神煞 */
      if (p.sha && p.sha.length) {
        var sha = el('div', 'sha');
        sha.textContent = p.sha.join(' · ');
        cell.appendChild(sha);
      }

      cell.addEventListener('click', function () { focus(zhi); });
      cell.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); focus(zhi); }
      });
      chart.appendChild(cell);
    });

    chart.appendChild(buildCenter(data.meta));
    $('#detail').classList.remove('collapsed');
    showOverview();
    $('#status').textContent = '数据：' + (data.meta && data.meta.name ? data.meta.name : '紫薇命盘') +
      (data.meta && data.meta.note ? '（' + data.meta.note + '）' : '');
  }

  function buildCenter(meta) {
    var center = el('div', 'center');
    center.appendChild(el('div', 'c-title', meta.name || '紫薇命盘'));
    center.appendChild(el('div', 'c-sub', (meta.gender ? meta.gender + '命' : '') +
      (meta.birthLunar ? ' · ' + meta.birthLunar : '')));

    var grid = el('div', 'c-grid');
    function pair(key, val) {
      if (!val) return;
      grid.appendChild(el('span', 'c-key', key));
      grid.appendChild(el('span', 'c-val', val));
    }
    pair('公历', meta.birthSolar);
    pair('农历', meta.birthLunar);
    pair('四柱', meta.fourPillars);
    pair('五行局', meta.wuxingJu);
    pair('命主', meta.mingZhu);
    pair('身主', meta.shenZhu);
    pair('身宫', meta.shenGongZhi ? meta.shenGongZhi + '宫' : '');
    pair('大限', meta.daxian);
    center.appendChild(grid);

    var four = el('div', 'c-four');
    var tags = [];
    (API.data.palaces || []).forEach(function (p) {
      (p.stars || []).concat(p.aux || []).forEach(function (s) {
        if (s && s.sihua) tags.push({ name: s.name, sihua: s.sihua });
      });
    });
    if (tags.length) {
      tags.forEach(function (t) {
        var tag = el('span', 'tag', t.name + '化' + t.sihua);
        four.appendChild(tag);
      });
    } else {
      four.appendChild(el('span', 'tag', '本年无四化示例'));
    }
    center.appendChild(four);

    var bottom = el('div', 'c-bottom');
    var ln = el('span');
    ln.appendChild(document.createTextNode('流年 '));
    var b = el('b', '', meta.liunian || '—');
    ln.appendChild(b);
    bottom.appendChild(ln);
    bottom.appendChild(el('span', '', '底盘 · 本命'));
    center.appendChild(bottom);
    return center;
  }

  /* ─────────────────────────── 详情栏 ─────────────────────────── */

  function clearDetail() {
    var body = $('#detail-body');
    body.innerHTML = '';
    return body;
  }

  function showOverview() {
    var meta = (API.data && API.data.meta) || {};
    var body = clearDetail();
    $('#detail-title').textContent = '紫薇命盘总览';
    var h3 = el('h3', '', '基本信息');
    body.appendChild(h3);
    [['姓名', meta.name], ['性别', meta.gender], ['公历', meta.birthSolar],
     ['农历', meta.birthLunar], ['四柱', meta.fourPillars], ['五行局', meta.wuxingJu],
     ['命主', meta.mingZhu], ['身主', meta.shenZhu], ['身宫', meta.shenGongZhi],
     ['当前大限', meta.daxian], ['流年', meta.liunian]].forEach(function (kv) {
      if (!kv[1]) return;
      var row = el('div', 'row');
      row.appendChild(el('span', 'k', kv[0]));
      row.appendChild(el('span', 'v', kv[1]));
      body.appendChild(row);
    });
    body.appendChild(el('h3', '', '十二宫速览'));
    (API.data.palaces || []).forEach(function (p) {
      var row = el('div', 'row');
      row.appendChild(el('span', 'k', p.zhi));
      var v = el('span', 'v', p.name + (p.isMing ? '（命）' : '') + (p.isShen ? '（身）' : '') +
        (p.stars && p.stars.length ? ' · ' + p.stars.map(function (s) { return s.name; }).join('、') : ' · 无主星'));
      row.appendChild(v);
      body.appendChild(row);
    });
  }

  function showDetail(p) {
    var body = clearDetail();
    $('#detail-title').textContent = p.name + '宫 · ' + p.zhi;
    var h3 = el('h3', '', '宫位');
    body.appendChild(h3);
    [['宫名', p.name + '宫'], ['地支', p.zhi + '（' + (ZHI_YINYANG[p.zhi] || '') + '）'],
     ['大限', p.daxian], ['流年', p.liunian], ['对宫', opponentOf(p.zhi)]].forEach(function (kv) {
      if (!kv[1]) return;
      var row = el('div', 'row');
      row.appendChild(el('span', 'k', kv[0]));
      row.appendChild(el('span', 'v', kv[1]));
      body.appendChild(row);
    });

    body.appendChild(el('h3', '', '主星'));
    if (p.stars && p.stars.length) {
      p.stars.forEach(function (s) {
        var row = el('div', 'row');
        row.appendChild(el('span', 'k', ''));
        var v = el('span', 'v');
        v.appendChild(document.createTextNode(s.name));
        if (s.bright) v.appendChild(document.createTextNode(' ' + s.bright));
        if (s.sihua) v.appendChild(document.createTextNode(' 化' + s.sihua));
        row.appendChild(v);
        body.appendChild(row);
      });
    } else {
      body.appendChild(el('p', '', '无主星（借对宫 ' + opponentOf(p.zhi) + ' 宫看）。'));
    }

    body.appendChild(el('h3', '', '辅星'));
    body.appendChild(el('p', '', p.aux && p.aux.length ? p.aux.map(function (a) { return a.name; }).join('、') : '—'));

    body.appendChild(el('h3', '', '神煞'));
    body.appendChild(el('p', '', p.sha && p.sha.length ? p.sha.join('、') : '—'));

    body.appendChild(el('p', 'api-hint', '后续由 gua_ziwei 引擎输出本宫数据；此处为版式演示。'));
  }

  function focus(zhi) {
    var p = palaceByZhi(zhi);
    if (!p) return;
    API.selected = zhi;
    var cells = document.querySelectorAll('.palace');
    for (var i = 0; i < cells.length; i++) {
      cells[i].classList.toggle('selected', cells[i].getAttribute('data-zhi') === zhi);
    }
    showDetail(p);
    var detail = $('#detail');
    if (detail) detail.classList.remove('collapsed');
    if (typeof API.onSelect === 'function') API.onSelect(p);
    try {
      window.dispatchEvent(new CustomEvent('ziwei:select', { detail: p }));
    } catch (e) { /* 老浏览器忽略 */ }
  }

  /* ─────────────────────────── 交互与对外 API ─────────────────────────── */

  function bindUI() {
    var btnSha = $('#btn-shensha');
    var btnSihua = $('#btn-sihua');
    var btnTheme = $('#btn-theme');
    var btnReset = $('#btn-reset');
    var btnClose = $('#detail-close');

    if (btnSha) {
      btnSha.classList.add('on');
      btnSha.addEventListener('click', function () {
        var hidden = document.body.classList.toggle('hide-sha');
        btnSha.classList.toggle('on', !hidden);
      });
    }
    if (btnSihua) {
      btnSihua.classList.add('on');
      btnSihua.addEventListener('click', function () {
        var hidden = document.body.classList.toggle('hide-sihua');
        btnSihua.classList.toggle('on', !hidden);
      });
    }
    if (btnTheme) {
      btnTheme.addEventListener('click', function () {
        var dark = document.body.classList.toggle('dark');
        btnTheme.classList.toggle('on', dark);
        btnTheme.textContent = dark ? '纸色' : '墨色';
      });
    }
    if (btnReset) {
      btnReset.addEventListener('click', function () {
        render(SAMPLE_DATA);
      });
    }
    if (btnClose) {
      btnClose.addEventListener('click', function () {
        $('#detail').classList.add('collapsed');
      });
    }
  }

  API.render = function (data) {
    render(data);
    return API;
  };
  API.getData = function () { return API.data; };
  API.setTheme = function (name) {
    var dark = name === 'dark';
    document.body.classList.toggle('dark', dark);
    var btn = $('#btn-theme');
    if (btn) {
      btn.classList.toggle('on', dark);
      btn.textContent = dark ? '纸色' : '墨色';
    }
  };
  API.toggle = function (name, show) {
    if (name !== 'sha' && name !== 'sihua') throw new Error('toggle 仅支持 sha / sihua');
    var hidden = !show;
    document.body.classList.toggle('hide-' + name, hidden);
    var btn = $('#btn-' + (name === 'sha' ? 'shensha' : 'sihua'));
    if (btn) btn.classList.toggle('on', show);
  };
  API.focus = focus;
  API.showOverview = showOverview;

  window.ZiweiChart = API;

  /* ─────────────────────────── 启动 ─────────────────────────── */

  function boot() {
    bindUI();
    render(SAMPLE_DATA);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

