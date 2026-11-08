/*!
 * 奇门遁甲九宫盘 · 多局/多设置前端原型 v0.2
 * 数据来自 gua_qimen 引擎同构输出（由 tools/gen-sample.mjs 生成），本页只做展示与交互，不排盘。
 * API: window.QimenChart.render(data) / getData / getState / setOption / setSettings / select / selectTab / onSelect
 */
(function () {
  'use strict';

  var ELEMENT_COLOR = {
    木: '#34a853', 火: '#ea4335', 土: '#cd7f32', 金: '#ffa601', 水: '#4285f4',
  };
  var STEM_ELEMENT = {
    甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
    己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
  };
  var GRID_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6];
  var CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var SETTING_DIMENSIONS = [
    { key: 'juMode', label: '起局方式', catalog: 'juModes' },
    { key: 'panMode', label: '盘式', catalog: 'panModes' },
    { key: 'jiGong', label: '寄宫', catalog: 'jiGongs' },
    { key: 'lateZi', label: '早晚子时', catalog: 'lateZis' },
    { key: 'zhirunDays', label: '置闰天数', catalog: 'zhirunDays' },
    { key: 'anGanMode', label: '暗干排法', catalog: 'anGanModes' },
  ];
  var DEFAULT_OPTIONS = { anGan: true, wangShuai: true, notes: true, chuanRen: true };

  var state = {
    workspace: null,
    activeTabId: null,
    tabSettings: {},
    mingyunStep: 0,
    selected: 5,
    options: assign({}, DEFAULT_OPTIONS),
    chart: null,
    chartEntry: null,
    notice: null,
  };
  var onSelect = null;

  function assign(target) {
    for (var i = 1; i < arguments.length; i += 1) {
      var src = arguments[i];
      if (src) Object.keys(src).forEach(function (k) { target[k] = src[k]; });
    }
    return target;
  }
  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  /** 字段缺失统一显示「—」，不臆造。 */
  function fmt(value) {
    if (value == null || value === '') return '—';
    if (Array.isArray(value)) return value.length ? value.join('、') : '—';
    return String(value);
  }
  function colorOfElement(element) { return ELEMENT_COLOR[element] || ''; }
  function stemSpan(stem) {
    var s = el('span', 'gan', stem || '—');
    var e = STEM_ELEMENT[stem];
    if (e) s.style.color = ELEMENT_COLOR[e];
    return s;
  }
  function settingsKey(settings) {
    var d = state.workspace && state.workspace.defaults ? state.workspace.defaults : {};
    var s = assign({}, d, settings || {});
    return [s.juMode, s.panMode, s.jiGong, s.lateZi, s.zhirunDays, s.anGanMode].join('|');
  }
  function catalogFor(dimKey) {
    var ws = state.workspace;
    if (!ws || !ws.catalog) return [];
    return ws.catalog[dimKey] || [];
  }
  function catalogEntry(dimKey, id) {
    var list = catalogFor(dimKey);
    for (var i = 0; i < list.length; i += 1) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }
  function labelFor(dimKey, id) {
    var entry = catalogEntry(dimKey, id);
    return entry ? entry.label : String(id);
  }
  function optionSuffix(entry) {
    if (!entry) return '';
    if (!entry.supported && entry.experimental) return '（未实现·实验/待校核）';
    if (!entry.supported) return '（未实现）';
    if (entry.experimental) return '（实验/待校核）';
    return '';
  }

  /* ============================================================
   * 工作区归一：支持「多局工作区」与「单盘数据」两种输入（后者兼容旧 API）
   * ============================================================ */
  function normalizeWorkspace(input) {
    if (!input || typeof input !== 'object') return null;
    if (Array.isArray(input.tabs) && Array.isArray(input.scenes)) return input;
    if (Array.isArray(input.palaces)) {
      var settings = assign({ juMode: '时家拆补', panMode: '转盘', jiGong: '坤二', lateZi: 'nextDay', zhirunDays: 8, anGanMode: '八门地盘携带之干' }, input.settings || {});
      return {
        version: 'single',
        single: true,
        meta: { note: '单盘数据（旧 API 兼容）', counts: { charts: 1 } },
        catalog: null,
        defaults: settings,
        scenes: [{ id: 'single', label: '单盘', datetime: input.input ? input.input.datetime : '', question: '', charts: [{ key: settingsKey(settings), settings: settings, chart: input }] }],
        mingyun: null,
        tabs: [{ id: 'single', label: '单盘', type: 'scene', sceneId: 'single' }],
      };
    }
    return null;
  }

  function activeTab() {
    var ws = state.workspace;
    if (!ws) return null;
    for (var i = 0; i < ws.tabs.length; i += 1) if (ws.tabs[i].id === state.activeTabId) return ws.tabs[i];
    return ws.tabs[0] || null;
  }

  function sceneForTab(tab) {
    var ws = state.workspace;
    if (!ws || !tab || tab.type !== 'scene') return null;
    for (var i = 0; i < ws.scenes.length; i += 1) if (ws.scenes[i].id === tab.sceneId) return ws.scenes[i];
    return null;
  }

  function settingsForTab(tab) {
    if (!tab) return null;
    if (state.tabSettings[tab.id]) return state.tabSettings[tab.id];
    state.tabSettings[tab.id] = clone(state.workspace.defaults || {});
    return state.tabSettings[tab.id];
  }

  function findChartEntry(scene, settings) {
    if (!scene) return null;
    var key = settingsKey(settings);
    for (var i = 0; i < scene.charts.length; i += 1) if (scene.charts[i].key === key) return scene.charts[i];
    return null;
  }

  function mingyunSteps() {
    var my = state.workspace && state.workspace.mingyun;
    if (!my) return [];
    var steps = [];
    if (my.natal) steps.push({ label: '原命局', age: null, year: null, hourGanzhi: '', chart: my.natal });
    (my.steps || []).forEach(function (s) {
      steps.push({ label: s.label, age: s.age, ageFrom: s.ageFrom, ageTo: s.ageTo, year: s.year, hourGanzhi: s.hourGanzhi, chart: s.chart });
    });
    return steps;
  }

  /** 解析当前标签的实际盘面与提示。 */
  function resolveChart() {
    var tab = activeTab();
    state.notice = null;
    state.chart = null;
    state.chartEntry = null;
    if (!tab || !state.workspace) return;

    if (tab.type === 'mingyun') {
      var steps = mingyunSteps();
      var my = state.workspace.mingyun;
      if (!my || !my.supported || !steps.length) {
        state.notice = {
          type: 'warn',
          title: '命运局暂无可显示的数据',
          lines: (my && my.notes && my.notes.length ? my.notes : ['引擎未返回命运局（原命局 + 十步大运局），示例数据未生成；本页不伪造。']),
        };
        return;
      }
      if (state.mingyunStep >= steps.length) state.mingyunStep = 0;
      var step = steps[state.mingyunStep];
      state.chart = step && step.chart ? step.chart : null;
      state.chartEntry = step ? { settings: null, experimental: true, label: step.label } : null;
      if (!state.chart) {
        state.notice = { type: 'warn', title: '该步大运局无盘面数据', lines: ['引擎未返回该步的九宫盘，显示「—」；不拿其他盘冒充。'] };
      } else {
        state.notice = {
          type: 'info',
          title: '命运局（实验）',
          lines: ['原命局 + 十步大运局；只变时柱干支与九宫内容，阴阳遁与局数不变（引擎口径），不做套八字。'],
        };
      }
      return;
    }

    var scene = sceneForTab(tab);
    var settings = settingsForTab(tab);
    var entry = findChartEntry(scene, settings);
    if (entry) {
      state.chartEntry = entry;
      state.chart = entry.chart;
      if (entry.experimental || (entry.chart && entry.chart.experimental)) {
        var items = entry.experimentalItems && entry.experimentalItems.length
          ? entry.experimentalItems
          : (entry.chart && entry.chart.experimentalItems) || [];
        state.notice = {
          type: 'info',
          title: '实验/待校核盘面',
          lines: [
            (items.length ? '实验项：' + items.join('、') + '。' : '') + '盘面由引擎按实验口径输出，未经完整校核；参考时以 hints 与基准盘为准。',
          ].concat((entry.notes || []).slice(0, 2)),
        };
      }
      return;
    }

    // 未生成：找出请求的设置里哪些是未实现/未校核项，明确提示，不冒充
    var reasons = [];
    SETTING_DIMENSIONS.forEach(function (dim) {
      var value = settings[dim.key];
      var cat = catalogEntry(dim.catalog, value === null || value === undefined ? '' : value);
      if (!cat) return;
      if (!cat.supported) {
        reasons.push('「' + dim.label + '：' + cat.label + '」未实现' + (cat.experimental ? '（实验/待校核）' : ''));
        (cat.notes || []).slice(0, 1).forEach(function (n) { reasons.push(n); });
      } else if (cat.experimental) {
        reasons.push('「' + dim.label + '：' + cat.label + '」为实验/待校核项，但该组合示例盘未生成');
      }
    });
    var known = reasons.length > 0;
    state.notice = {
      type: 'warn',
      title: known ? '该设置组合没有可用示例盘' : '该设置组合的示例盘未生成',
      lines: reasons.length
        ? reasons
        : ['示例数据由 tools/gen-sample.mjs 预生成，当前组合不在生成矩阵内；不拿临近设置的数据冒充。重新运行生成器可补。'],
      settings: settings,
    };
  }

  /* ============================================================
   * 顶部 / 标签
   * ============================================================ */
  function renderTabs() {
    var wraps = document.querySelectorAll('[data-tabs]');
    if (!wraps.length || !state.workspace) return;
    Array.prototype.forEach.call(wraps, function (wrap) {
      wrap.innerHTML = '';
      state.workspace.tabs.forEach(function (tab) {
        var btn = el('button', 'tab' + (tab.id === state.activeTabId ? ' on' : ''), tab.label);
        btn.type = 'button';
        btn.setAttribute('data-tab', tab.id);
        btn.addEventListener('click', function () { API.selectTab(tab.id); });
        wrap.appendChild(btn);
      });
    });
  }

  function renderHeader() {
    var chart = state.chart;
    var ws = state.workspace;
    var dateEl = $('#meta-date');
    var termEl = $('#meta-term');
    var pillars = $('#pillars');
    var juLine = $('#ju-line');
    var chips = $('#chips');
    var mode = $('#pill-mode');
    var tab = activeTab();

    if (!chart) {
      if (dateEl) dateEl.textContent = '—';
      if (termEl) termEl.textContent = '—';
      if (pillars) pillars.innerHTML = '';
      if (juLine) juLine.textContent = '当前设置无可显示的盘面（—）';
      if (chips) chips.innerHTML = '';
      if (mode) mode.textContent = tab ? tab.label + ' · 无示例盘' : '—';
      return;
    }

    var input = chart.input || {};
    var ju = chart.ju || {};
    var four = input.fourPillars || {};
    var labels = [['年', four.year], ['月', four.month], ['日', four.day], ['时', four.hour]];

    if (dateEl) dateEl.textContent = fmt(input.datetime) + (input.lunar ? '（' + input.lunar + '）' : '');
    if (termEl) termEl.textContent = fmt(input.solarTerm);
    if (pillars) {
      pillars.innerHTML = '';
      labels.forEach(function (pair) {
        var box = el('div', 'pillar');
        box.appendChild(el('div', 'label', pair[0]));
        var gz = el('div', 'gz');
        var text = String(pair[1] || '');
        var gan = el('span', '', text[0] || '—');
        var zhi = el('span', '', text[1] || '—');
        var gEl = STEM_ELEMENT[text[0]];
        if (gEl) gan.style.color = ELEMENT_COLOR[gEl];
        gz.appendChild(gan);
        gz.appendChild(zhi);
        box.appendChild(gz);
        pillars.appendChild(box);
      });
    }

    if (juLine) {
      juLine.innerHTML = '';
      juLine.appendChild(el('b', '', (ju.yinYang || '') + (ju.number != null ? ju.number : '') + '局'));
      juLine.appendChild(document.createTextNode(
        ' · ' + fmt(ju.yuan) + ' · ' + fmt(ju.solarTerm) + ' · 符头' + fmt(ju.futou) +
        ' · ' + fmt(ju.method) +
        ' · 值符' + fmt(chart.zhiFu && chart.zhiFu.star) + ' · 值使' + fmt(chart.zhiShi && chart.zhiShi.door) +
        ((chart.settings && (chart.settings.juType || chart.settings.juMethod))
          ? ' · 实际 ' + fmt(chart.settings.juType) + '/' + fmt(chart.settings.juMethod || '')
          : '')
      ));
    }

    if (mode) {
      var entrySettings = state.chartEntry && state.chartEntry.settings;
      var settings = entrySettings || (chart.settings || ws.defaults || {});
      var modeText;
      if (tab.type === 'mingyun') {
        modeText = '命运局 · ' + fmt(state.chartEntry && state.chartEntry.label);
      } else {
        modeText = settings.juMode
          ? settings.juMode + ' · ' + (settings.panMode || '转盘')
          : '奇门盘';
      }
      mode.textContent = modeText + (chart.experimental ? '（实验/待校核）' : '');
    }

    var xun = chart.xunShou || {};
    var crTop = chart.chuanRenTop || null;
    var chipTexts = [
      '值符：' + fmt(chart.zhiFu && chart.zhiFu.star) + '（' + fmt(chart.zhiFu && chart.zhiFu.palace) + '宫）',
      '值使：' + fmt(chart.zhiShi && chart.zhiShi.door) + '（' + fmt(chart.zhiShi && chart.zhiShi.palace) + '宫）',
      '旬首：' + fmt(xun.ganzhi) + '／' + fmt(xun.yi) + '仪',
      '寄宫：' + fmt(chart.settings && chart.settings.jiGong) ,
      '子时：' + (chart.settings && chart.settings.lateZi === 'sameDay' ? '夜子时' : '子时换日'),
      '暗干：' + fmt(chart.settings && chart.settings.anGanMode),
      '月建：' + fmt(chart.meta && chart.meta.monthBranch),
      crTop
        ? '穿壬：月将 ' + fmt(crTop.yueJiang && crTop.yueJiang.branch) + (crTop.yueJiang && crTop.yueJiang.name ? '（' + crTop.yueJiang.name + '）' : '') +
          ' · ' + fmt(crTop.dayNight) + '贵 · 贵人 ' + fmt(crTop.guiren && crTop.guiren.branch)
        : '穿壬：引擎未提供',
    ];
    if (chips) {
      chips.innerHTML = '';
      chipTexts.forEach(function (t) { chips.appendChild(el('span', 'chip', t)); });
      // 多局附加信息：引擎有则显示，无则不加（缺失字段已在别处显示「—」）
      var extras = chart.meta && chart.meta.extras ? chart.meta.extras : null;
      if (extras) {
        var extraChips = [];
        if (extras.jiuYun != null) extraChips.push('九运：' + extras.jiuYun);
        if (extras.shanXiang && (extras.shanXiang.shan || extras.shanXiang.xiang)) {
          extraChips.push('山向：' + fmt(extras.shanXiang.shan) + '山' + fmt(extras.shanXiang.xiang) + '向（山' +
            fmt(extras.shanXiang.shanPalace) + '宫／向' + fmt(extras.shanXiang.xiangPalace) + '宫）');
        }
        if (extras.luoPan && Array.isArray(extras.luoPan.shan24)) {
          extraChips.push('罗盘：二十四山（' + extras.luoPan.shan24.length + ' 山）');
        }
        if (extras.xuanKong && (extras.xuanKong.yun != null || extras.xuanKong.yunStar)) {
          extraChips.push('套玄空：' + (extras.xuanKong.yun != null ? extras.xuanKong.yun + '运 ' : '') +
            fmt(extras.xuanKong.yuan) + ' ' + fmt(extras.xuanKong.yunStar));
        }
        if (extras.taiYiRiJia) extraChips.push('太乙日家：实验/待校核');
        if (extras.chaoJie) {
          extraChips.push('置闰：' + extras.chaoJie + (extras.chaoJieDays != null ? '（' + extras.chaoJieDays + '日）' : ''));
        }
        extraChips.forEach(function (t) { chips.appendChild(el('span', 'chip', t)); });
      }
    }

    var hint = $('#chart-hint');
    if (hint) {
      hint.textContent = (chart.hints && chart.hints[0]) ? chart.hints[0] : (ju.yinYang || '') + '局 · 见下方提示';
    }
  }

  function renderBanner() {
    var box = $('#banner');
    if (!box) return;
    box.className = 'banner';
    box.innerHTML = '';
    var notice = state.notice;
    if (!notice) { box.hidden = true; return; }
    box.hidden = false;
    box.className = 'banner ' + (notice.type === 'warn' ? 'warn' : 'info');
    var head = el('div', 'banner-head');
    head.appendChild(el('b', '', notice.title));
    head.appendChild(el('span', 'banner-tag', notice.type === 'warn' ? '不伪造' : '实验/待校核'));
    box.appendChild(head);
    (notice.lines || []).forEach(function (line) { box.appendChild(el('div', 'banner-line', line)); });
    if (notice.settings) {
      var line = SETTING_DIMENSIONS.map(function (dim) {
        return dim.label + '=' + labelFor(dim.catalog, notice.settings[dim.key]);
      }).join(' · ');
      box.appendChild(el('div', 'banner-line muted', '当前请求：' + line));
    }
  }

  /* ============================================================
   * 设置面板
   * ============================================================ */
  function buildSettings() {
    var grid = $('#settings-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var tab = activeTab();
    if (!tab || !state.workspace || !state.workspace.catalog) {
      grid.appendChild(el('div', 'settings-empty', '单盘数据：无设置面板'));
      return;
    }
    if (tab.type === 'mingyun') {
      grid.appendChild(el('div', 'settings-empty', '命运局由引擎按出生时刻直接生成，不使用本页排盘设置（不做套八字）。'));
      return;
    }
    var settings = settingsForTab(tab);
    SETTING_DIMENSIONS.forEach(function (dim) {
      var field = el('label', 'field');
      field.appendChild(el('span', 'field-label', dim.label + suffixForDim(dim)));
      var select = el('select', 'field-select');
      select.setAttribute('data-setting', dim.key);
      var list = catalogFor(dim.catalog);
      list.forEach(function (item) {
        var opt = el('option', '', item.label + optionSuffix(item));
        opt.value = String(item.id);
        if (String(settings[dim.key]) === String(item.id)) opt.selected = true;
        if (!item.supported) opt.classList.add('unsupported');
        else if (item.experimental) opt.classList.add('experimental');
        select.appendChild(opt);
      });
      select.addEventListener('change', function () {
        var raw = select.value;
        var next = {};
        next[dim.key] = dim.catalog === 'zhirunDays' ? Number(raw) : raw;
        API.setSettings(next);
      });
      field.appendChild(select);
      var note = settingsNote(dim, settings);
      if (note) field.appendChild(el('span', 'field-note', note));
      grid.appendChild(field);
    });
    var reset = $('#btn-reset-settings');
    if (reset) reset.disabled = false;
  }

  function suffixForDim(dim) {
    if (dim.catalog === 'zhirunDays') return '（仅时家置闰生效）';
    return '';
  }

  function settingsNote(dim, settings) {
    var entry = catalogEntry(dim.catalog, settings[dim.key]);
    if (!entry) return '';
    if (!entry.supported) return '未实现：不生成示例盘';
    if (entry.experimental) return '实验/待校核';
    return '';
  }

  function renderSettingsMeta() {
    var box = $('#settings-flags');
    if (!box) return;
    box.innerHTML = '';
    var tab = activeTab();
    if (!tab || tab.type !== 'scene' || !state.workspace || !state.workspace.catalog) return;
    var settings = settingsForTab(tab);
    var flags = [];
    SETTING_DIMENSIONS.forEach(function (dim) {
      var entry = catalogEntry(dim.catalog, settings[dim.key]);
      if (!entry) return;
      if (!entry.supported) flags.push(dim.label + '未实现');
      else if (entry.experimental) flags.push(dim.label + '实验/待校核');
    });
    if (!flags.length) {
      box.appendChild(el('span', 'flag ok', '默认口径：时家 · 转盘 · 拆补（已校核）'));
      return;
    }
    flags.forEach(function (f) { box.appendChild(el('span', 'flag', f)); });
  }

  /* ============================================================
   * 九宫盘面
   * ============================================================ */
  function palaceBadges(p) {
    var box = el('div', 'badges');
    if (p.kong) box.appendChild(el('span', 'badge', '空'));
    if (p.ma) box.appendChild(el('span', 'badge ma', '马'));
    return box;
  }

  function chuanRenLine(p) {
    var wrap = el('div', 'cr');
    var head = el('div', 'cr-head', '穿壬');
    wrap.appendChild(head);
    var cr = p.chuanRen || null;
    if (!cr) {
      wrap.appendChild(el('div', 'cr-missing', p.index === 5
        ? '中宫不领地支 · 月将— · 神将— · 建星—'
        : '地盘— · 月将— · 神将— · 建星—'));
      wrap.classList.add('missing');
      return wrap;
    }
    var diZhi = (cr.diPanDiZhi || []).join('') || '—';
    wrap.appendChild(el('div', 'cr-dz', '地盘 ' + diZhi));
    var items = cr.items || [];
    if (!items.length) {
      wrap.appendChild(el('div', 'cr-missing', '月将— · 神将— · 建星—'));
      wrap.classList.add('missing');
      return wrap;
    }
    items.forEach(function (it) {
      var line = el('div', 'cr-item');
      line.appendChild(el('b', '', fmt(it.branch || (cr.diPanDiZhi || [])[0])));
      var parts = [
        (it.tianPan ? '天盘' + it.tianPan : ''),
        ('月将' + fmt(it.yueJiang)),
        ('神将' + fmt(it.shenJiang)),
        ('建星' + fmt(it.jianXing)),
      ].filter(Boolean);
      line.appendChild(document.createTextNode(' ' + parts.join(' · ')));
      var titleBits = [];
      titleBits.push('地盘支：' + fmt(it.branch));
      titleBits.push('天盘支：' + fmt(it.tianPan));
      titleBits.push('月将：' + fmt(it.yueJiang));
      titleBits.push('神将：' + fmt(it.shenJiang));
      titleBits.push('建星：' + fmt(it.jianXing));
      line.title = titleBits.join('；');
      wrap.appendChild(line);
    });
    return wrap;
  }

  function renderPalace(p, data) {
    var card = el('div', 'palace' + (p.index === 5 ? ' center' : '') + (state.selected === p.index ? ' on' : ''));
    card.setAttribute('data-index', String(p.index));
    card.addEventListener('click', function () { API.select(p.index); });

    var head = el('div', 'palace-head');
    var name = el('div');
    name.appendChild(el('b', '', p.gua + CN[p.index] + '宫'));
    name.appendChild(document.createTextNode(' ' + (p.direction || '')));
    head.appendChild(name);
    head.appendChild(palaceBadges(p));
    card.appendChild(head);

    var body = el('div', 'palace-body');
    if (p.index === 5) {
      var t = stemSpan(p.tianPanGan || '');
      t.style.fontSize = '20px';
      var d = stemSpan(p.diPanGan || '');
      d.style.fontSize = '20px';
      var gans = el('div', 'center-gan');
      gans.appendChild(t);
      gans.appendChild(d);
      body.appendChild(gans);
      body.appendChild(el('div', 'center-label', '天盘干 / 地盘干 · 天禽寄宫'));
      if (state.options.chuanRen) body.appendChild(chuanRenLine(p));
      if (state.options.notes && p.notes && p.notes.length) body.appendChild(el('div', 'notes', p.notes.slice(0, 1).join('；')));
      card.appendChild(body);
      return card;
    }

    body.appendChild(el('div', 'shen', fmt(p.shen)));
    var starLine = el('div', 'star-line');
    var star = el('span', 'star', fmt(p.star));
    star.style.color = colorOfElement(p.starElement);
    starLine.appendChild(star);
    var tg = stemSpan(p.tianPanGan || '');
    tg.style.fontSize = '14px';
    starLine.appendChild(tg);
    body.appendChild(starLine);

    var doorLine = el('div', 'door-line');
    var door = el('span', 'door', p.door ? p.door : '—');
    door.style.color = colorOfElement(p.doorElement);
    doorLine.appendChild(door);
    var dg = stemSpan(p.diPanGan || '');
    dg.style.fontSize = '14px';
    doorLine.appendChild(dg);
    body.appendChild(doorLine);

    if (state.options.anGan) {
      body.appendChild(el('div', 'angan', '暗干 ' + fmt(p.anGan)));
    }
    if (state.options.chuanRen) body.appendChild(chuanRenLine(p));
    if (state.options.wangShuai) {
      var tags = el('div', 'ws');
      if (p.starWangShuai) tags.appendChild(el('span', '', '星' + p.starWangShuai));
      if (p.doorWangShuai) tags.appendChild(el('span', '', '门' + p.doorWangShuai));
      if (tags.childNodes.length) body.appendChild(tags);
    }
    if (state.options.notes && p.notes && p.notes.length) {
      body.appendChild(el('div', 'notes', p.notes.slice(0, 2).join('；')));
    }
    card.appendChild(body);
    return card;
  }

  function renderGrid() {
    var grid = $('#qimen-grid');
    var placeholder = $('#chart-placeholder');
    if (!grid || !placeholder) return;
    var chart = state.chart;
    if (!chart) {
      grid.innerHTML = '';
      grid.hidden = true;
      placeholder.hidden = false;
      return;
    }
    placeholder.hidden = true;
    grid.hidden = false;
    grid.innerHTML = '';
    var byIndex = {};
    chart.palaces.forEach(function (p) { byIndex[p.index] = p; });
    GRID_ORDER.forEach(function (index) {
      if (byIndex[index]) grid.appendChild(renderPalace(byIndex[index], chart));
    });
  }

  function renderPlaceholder() {
    var box = $('#chart-placeholder');
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(el('div', 'placeholder-mark', '—'));
    box.appendChild(el('div', 'placeholder-title', '无可用盘面（不伪造）'));
    var lines = [];
    if (state.notice && state.notice.lines) lines = state.notice.lines.slice(0, 3);
    if (!lines.length) lines = ['示例盘未生成或引擎未实现该设置。'];
    lines.forEach(function (line) { box.appendChild(el('div', 'placeholder-line', line)); });
  }

  /* ============================================================
   * 点宫详情
   * ============================================================ */
  function renderDetail() {
    var card = $('#detail-card');
    if (!card) return;
    card.innerHTML = '';
    var chart = state.chart;
    if (!chart) {
      card.appendChild(el('div', 'detail-title', '宫位详情：—'));
      card.appendChild(el('div', 'detail-notes', '无盘面数据时不显示详情，避免臆造。'));
      return;
    }
    var p = null;
    (chart.palaces || []).forEach(function (x) { if (x.index === state.selected) p = x; });
    if (!p) { card.appendChild(el('div', 'detail-title', '宫位详情：—')); return; }
    card.appendChild(el('div', 'detail-title',
      '第' + CN[p.index] + '宫 · ' + fmt(p.gua) + fmt(p.direction) + ' · ' + fmt(p.element)));
    var grid = el('div', 'detail-grid');
    var rows = [
      ['八神', p.shen],
      ['九星', p.star],
      ['八门', p.door],
      ['天盘干', p.tianPanGan],
      ['地盘干', p.diPanGan],
      ['暗干', p.anGan],
      ['星旺衰', p.starWangShuai],
      ['门旺衰', p.doorWangShuai],
      ['旬空', p.kong ? '是' : '否'],
      ['驿马', p.ma ? '是' : '否'],
    ];
    var cr = p.chuanRen || null;
    if (cr) {
      rows.push(['穿壬地盘支', (cr.diPanDiZhi || []).join('、') || null]);
      var hasItems = (cr.items || []).length > 0;
      var joinItems = function (getter) {
        if (!hasItems) return null;
        var out = cr.items.map(function (it) { return fmt(getter(it)); }).filter(function (x) { return x !== '—'; });
        return out.length ? out.join('；') : null;
      };
      rows.push(['穿壬天盘支', joinItems(function (it) { return it.tianPan; })]);
      rows.push(['穿壬月将', joinItems(function (it) { return it.yueJiang; })]);
      rows.push(['穿壬神将', joinItems(function (it) { return it.shenJiang; })]);
      rows.push(['穿壬建星', joinItems(function (it) { return it.jianXing; })]);
    } else {
      rows.push(['穿壬', null]); // 显示 —
    }
    rows.forEach(function (row) {
      var line = el('div');
      line.appendChild(el('b', '', row[0] + '：'));
      line.appendChild(document.createTextNode(fmt(row[1])));
      grid.appendChild(line);
    });
    card.appendChild(grid);
    if (p.notes && p.notes.length) {
      card.appendChild(el('div', 'detail-notes', '备注：' + p.notes.join('；')));
    }
    var chartTop = chart.chuanRenTop;
    if (chartTop) {
      card.appendChild(el('div', 'detail-notes',
        '本盘穿壬：月将 ' + fmt(chartTop.yueJiang && chartTop.yueJiang.branch) +
        (chartTop.yueJiang && chartTop.yueJiang.name ? '（' + chartTop.yueJiang.name + '）' : '') +
        '；' + fmt(chartTop.dayNight) + '贵；月建 ' + fmt(chartTop.monthBranch) +
        (chartTop.guiren ? '；贵人 ' + fmt(chartTop.guiren.branch) + '（' + (chartTop.guiren.shun ? '顺' : '逆') + '布）' : '')));
    }
  }

  /* ============================================================
   * 底部 / 命运局选择带
   * ============================================================ */
  function renderBottom() {
    var meta = $('#bottom-meta');
    var chart = state.chart;
    if (meta) {
      meta.innerHTML = '';
      if (!chart) {
        meta.appendChild(el('span', '', '日空：— · 时空：— · 时马：— · 日柱：—'));
      } else {
        var input = chart.input || {};
        var pairs = [
          ['日空', (input.dayKong || []).join('')],
          ['时空', (chart.kongWang || []).join('')],
          ['时马', chart.maXing],
          ['日柱', (input.fourPillars || {}).day],
          ['月建', chart.meta && chart.meta.monthBranch],
        ];
        pairs.forEach(function (pair) {
          var box = el('span');
          box.appendChild(el('b', '', pair[0] + '：'));
          box.appendChild(document.createTextNode(fmt(pair[1])));
          meta.appendChild(box);
        });
      }
    }
    var toggles = [['anGan', 'opt-angan'], ['wangShuai', 'opt-wangshuai'], ['notes', 'opt-notes'], ['chuanRen', 'opt-chuanren']];
    toggles.forEach(function (pair) {
      var input = document.getElementById(pair[1]);
      if (input) input.checked = Boolean(state.options[pair[0]]);
    });
  }

  function renderMingyunStrip() {
    var card = $('#mingyun-card');
    if (!card) return;
    var tab = activeTab();
    var my = state.workspace && state.workspace.mingyun;
    if (!tab || tab.type !== 'mingyun' || !my || !my.supported) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    var strip = $('#mingyun-strip');
    if (!strip) return;
    strip.innerHTML = '';
    var steps = mingyunSteps();
    steps.forEach(function (step, i) {
      var item = el('button', 'step' + (i === state.mingyunStep ? ' on' : ''));
      item.type = 'button';
      item.appendChild(el('b', '', step.label));
      var sub = [];
      if (step.ageFrom != null && step.ageTo != null) sub.push(step.ageFrom + '-' + step.ageTo + '岁');
      else if (step.age != null) sub.push(step.age + '岁');
      if (step.year != null) sub.push(String(step.year) + '年');
      if (step.hourGanzhi) sub.push(step.hourGanzhi);
      item.appendChild(el('span', '', sub.join(' · ') || '—'));
      item.addEventListener('click', function () { API.selectMingyunStep(i); });
      strip.appendChild(item);
    });
    var note = $('#mingyun-note');
    if (note) {
      note.textContent = my.supported
        ? '共 ' + Math.max(0, steps.length - 1) + ' 步大运局；实验/待校核：' + ((my.experimentalItems || []).join('、') || '命运局') + '。'
        : (my.notes || []).join('；');
    }
  }

  /* ============================================================
   * 渲染入口
   * ============================================================ */
  function render() {
    if (!state.workspace) return;
    resolveChart();
    renderTabs();
    buildSettings();
    renderSettingsMeta();
    renderHeader();
    renderBanner();
    renderMingyunStrip();
    renderGrid();
    renderPlaceholder();
    renderDetail();
    renderBottom();
  }

  function bindControls() {
    [['anGan', 'opt-angan'], ['wangShuai', 'opt-wangshuai'], ['notes', 'opt-notes'], ['chuanRen', 'opt-chuanren']].forEach(function (pair) {
      var key = pair[0];
      var input = document.getElementById(pair[1]);
      if (!input) return;
      input.checked = state.options[key];
      input.addEventListener('change', function () {
        state.options[key] = input.checked;
        render();
      });
    });
    var resetSel = $('#btn-reset');
    if (resetSel) resetSel.addEventListener('click', function () { API.select(5); });
    var resetSet = $('#btn-reset-settings');
    if (resetSet) resetSet.addEventListener('click', function () {
      var tab = activeTab();
      if (!tab || tab.type !== 'scene') return;
      state.tabSettings[tab.id] = clone(state.workspace.defaults || {});
      render();
    });
  }

  var API = {
    version: '0.2.0',
    render: function (data) {
      var ws = normalizeWorkspace(data);
      if (!ws) { state.workspace = null; state.chart = null; render(); return API; }
      var sameWorkspace = state.workspace === ws;
      state.workspace = ws;
      if (!state.activeTabId || !ws.tabs.some(function (t) { return t.id === state.activeTabId; })) {
        state.activeTabId = ws.tabs[0] ? ws.tabs[0].id : null;
      }
      if (!sameWorkspace) state.tabSettings = {};
      var tab = activeTab();
      if (tab && tab.type === 'scene' && !state.tabSettings[tab.id]) state.tabSettings[tab.id] = clone(ws.defaults || {});
      state.selected = 5;
      render();
      return API;
    },
    getData: function () { return state.chart; },
    getState: function () {
      var tab = activeTab();
      return {
        activeTabId: state.activeTabId,
        tab: tab,
        settings: tab && tab.type === 'scene' ? clone(settingsForTab(tab)) : null,
        options: assign({}, state.options),
        selected: state.selected,
        mingyunStep: state.mingyunStep,
        chart: state.chart,
        experimental: Boolean(state.chart && state.chart.experimental),
        chuanRen: Boolean(state.chart && state.chart.chuanRenTop),
        notice: state.notice,
      };
    },
    getOptions: function () { return assign({}, state.options); },
    getWorkspace: function () { return state.workspace; },
    setOption: function (key, value) {
      if (key in state.options) state.options[key] = Boolean(value);
      render();
      return API;
    },
    setSettings: function (partial) {
      var tab = activeTab();
      if (!tab || tab.type !== 'scene') return API;
      var settings = assign({}, settingsForTab(tab), partial || {});
      state.tabSettings[tab.id] = settings;
      render();
      return API;
    },
    selectTab: function (id) {
      if (!state.workspace.tabs.some(function (t) { return t.id === id; })) return API;
      state.activeTabId = id;
      state.selected = 5;
      state.mingyunStep = 0;
      render();
      return API;
    },
    selectMingyunStep: function (index) {
      var steps = mingyunSteps();
      var i = Number(index);
      if (!isFinite(i) || i < 0 || i >= steps.length) return API;
      state.mingyunStep = i;
      render();
      return API;
    },
    select: function (index) {
      state.selected = Number(index) || 5;
      renderDetail();
      var grid = $('#qimen-grid');
      if (grid) {
        Array.prototype.forEach.call(grid.children, function (card) {
          var on = card.getAttribute('data-index') === String(state.selected);
          card.classList.toggle('on', on);
        });
      }
      if (typeof API.onSelect === 'function') {
        var p = null;
        if (state.chart) state.chart.palaces.forEach(function (x) { if (x.index === state.selected) p = x; });
        API.onSelect(p || null);
      }
      return API;
    },
    onSelect: null,
  };
  window.QimenChart = API;

  function boot() {
    bindControls();
    if (window.QIMEN_WORKSPACE) API.render(window.QIMEN_WORKSPACE);
    else API.render(window.QIMEN_SAMPLE || null);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
