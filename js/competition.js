/* ==========================================================================
   赛事聚合页面脚本
   - 纯原生 JS，无构建依赖
   - 幂等初始化，兼容 Sakura 的 PJAX
   - 数据优先读取页面内联 JSON，失败时回退到 /competition/data.json
   - 手动录入保存在 localStorage，可导出 JSON
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'sakura.competitions.manual.v1';
  var PAGE_SIZE = 9;
  var STATUS_ORDER = ['open', 'upcoming', 'running', 'ended'];
  var STATUS_MAP = {
    open: { label: '报名中', cls: 'cp-status-open' },
    upcoming: { label: '未开始', cls: 'cp-status-upcoming' },
    running: { label: '进行中', cls: 'cp-status-running' },
    ended: { label: '已结束', cls: 'cp-status-ended' }
  };
  var LEVEL_ORDER = ['国际级', '国家级', '省级', '校级', '其他'];

  var root = null;
  var els = {};
  var baseData = { updatedAt: '', sources: [], items: [] };
  var allItems = [];
  var manualItems = [];
  var lastFocus = null;
  var tooltipDate = '';
  var searchTimer = null;
  var toastTimer = null;
  var globalBound = false;

  var state = {
    view: 'list',
    search: '',
    time: 'all',
    level: 'all',
    status: 'all',
    type: 'all',
    sort: 'default',
    page: 1,
    calYear: 0,
    calMonth: 0,
    calLevel: 'all',
    calStatus: 'all'
  };

  /* ----------------------------- 工具函数 ----------------------------- */

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(value) {
    var url = String(value || '').trim();
    if (/^https?:\/\//i.test(url)) return url;
    if (url.charAt(0) === '/') return url;
    return '#';
  }

  function parseDate(value) {
    var matched = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!matched) return null;
    var date = new Date(Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function todayParts() {
    var now = new Date();
    return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  }

  function todayUTC() {
    var t = todayParts();
    return Date.UTC(t.y, t.m, t.d);
  }

  function daysFromToday(date) {
    if (!date) return null;
    return Math.round((date.getTime() - todayUTC()) / 86400000);
  }

  function fmtDate(date) {
    if (!date) return '';
    return date.getUTCFullYear() + '.' + pad(date.getUTCMonth() + 1) + '.' + pad(date.getUTCDate());
  }

  function fmtDateKey(date) {
    if (!date) return '';
    return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate());
  }

  function fmtRange(start, end) {
    var s = parseDate(start);
    var e = parseDate(end);
    if (s && e) return fmtDate(s) + ' - ' + fmtDate(e);
    if (s) return fmtDate(s) + ' 起';
    if (e) return '截止 ' + fmtDate(e);
    return '待公布';
  }

  function fmtUpdated(value) {
    if (!value) return '--';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.getFullYear() + '.' + pad(date.getMonth() + 1) + '.' + pad(date.getDate());
  }

  function levelClass(level) {
    var text = String(level || '');
    if (text.indexOf('国际') >= 0) return 'cp-level-intl';
    if (text.indexOf('国家') >= 0) return 'cp-level-national';
    if (text.indexOf('省') >= 0) return 'cp-level-provincial';
    if (text.indexOf('校') >= 0) return 'cp-level-school';
    if (text.indexOf('企业') >= 0) return 'cp-level-enterprise';
    return 'cp-level-other';
  }

  function statusInfo(status) {
    return STATUS_MAP[status] || STATUS_MAP.ended;
  }

  function getStatus(item) {
    var now = todayUTC();
    var regStart = parseDate(item.registrationStart);
    var regEnd = parseDate(item.registrationEnd);
    var compEnd = parseDate(item.competitionEnd);

    if (regStart && now < regStart.getTime()) return 'upcoming';
    if (regEnd && now <= regEnd.getTime()) return 'open';
    if (compEnd && now <= compEnd.getTime()) return 'running';
    if (!regEnd && !compEnd && regStart && now >= regStart.getTime()) return 'open';
    return 'ended';
  }

  function deadlineHint(item) {
    var status = getStatus(item);
    if (status !== 'open') return null;
    var end = parseDate(item.registrationEnd);
    if (!end) return null;
    var days = daysFromToday(end);
    if (days < 0) return null;
    if (days === 0) return { text: '今天截止', cls: 'is-urgent' };
    if (days <= 3) return { text: '剩 ' + days + ' 天', cls: 'is-urgent' };
    if (days <= 7) return { text: '剩 ' + days + ' 天', cls: 'is-soon' };
    return { text: days + ' 天后截止', cls: '' };
  }

  function normalizeItem(raw) {
    var tags = raw && Array.isArray(raw.tags) ? raw.tags : [];
    return {
      id: String((raw && raw.id) || (raw && raw.name) || 'item-' + Math.random().toString(36).slice(2)),
      name: String((raw && raw.name) || '未命名赛事'),
      organizer: String((raw && raw.organizer) || '未知'),
      level: String((raw && raw.level) || '其他'),
      type: String((raw && raw.type) || '综合'),
      tags: tags.map(function (tag) { return String(tag); }).filter(Boolean),
      registrationStart: parseDate(raw && raw.registrationStart) ? String(raw.registrationStart).slice(0, 10) : '',
      registrationEnd: parseDate(raw && raw.registrationEnd) ? String(raw.registrationEnd).slice(0, 10) : '',
      competitionStart: parseDate(raw && raw.competitionStart) ? String(raw.competitionStart).slice(0, 10) : '',
      competitionEnd: parseDate(raw && raw.competitionEnd) ? String(raw.competitionEnd).slice(0, 10) : '',
      prize: String((raw && raw.prize) || '以官网公布为准'),
      url: String((raw && raw.url) || ''),
      participants: String((raw && raw.participants) || ''),
      source: String((raw && raw.source) || 'unknown'),
      sourceName: String((raw && raw.sourceName) || '未知来源'),
      sourceUrl: String((raw && raw.sourceUrl) || ''),
      verified: !(raw && raw.verified === false),
      note: String((raw && raw.note) || ''),
      manual: !!(raw && raw.manual)
    };
  }

  function debounce(fn, delay) {
    return function () {
      var args = arguments;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { fn.apply(null, args); }, delay);
    };
  }

  /* ----------------------------- 数据加载 ----------------------------- */

  function readInlineData() {
    var node = document.getElementById('competition-data');
    if (!node) return null;
    try {
      return JSON.parse(node.textContent || node.innerHTML || '{}');
    } catch (error) {
      return null;
    }
  }

  function loadManualItems() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(function (item) {
        return normalizeItem(Object.assign({}, item, {
          manual: true,
          source: 'manual',
          sourceName: '本地录入',
          sourceUrl: '',
          verified: true
        }));
      });
    } catch (error) {
      return [];
    }
  }

  function saveManualItems() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(manualItems));
      return true;
    } catch (error) {
      toast('保存失败：浏览器存储空间不足或已被禁用');
      return false;
    }
  }

  function rebuildItems() {
    var map = {};
    baseData.items.forEach(function (raw) {
      var item = normalizeItem(raw);
      map[item.id] = item;
    });
    manualItems.forEach(function (raw) {
      var item = normalizeItem(Object.assign({}, raw, {
        manual: true,
        source: 'manual',
        sourceName: '本地录入',
        sourceUrl: '',
        verified: true
      }));
      map[item.id] = item;
    });
    allItems = Object.keys(map).map(function (key) { return map[key]; });
  }

  function setBaseData(data) {
    baseData = {
      updatedAt: (data && data.updatedAt) || '',
      sources: data && Array.isArray(data.sources) ? data.sources : [],
      items: data && Array.isArray(data.items) ? data.items : []
    };
    rebuildItems();
    populateFilters();
    syncControls();
    renderAll();
  }

  function fetchFallbackData() {
    var url = root.getAttribute('data-data-url') || '/competition/data.json';
    els.grid.innerHTML = '<div class="cp-loading">正在加载赛事数据…</div>';
    els.result.textContent = '正在加载赛事…';

    if (typeof window.fetch !== 'function') {
      finishWithError('当前浏览器不支持 fetch，请升级浏览器。');
      return;
    }

    window.fetch(url, { cache: 'no-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        setBaseData(data);
      })
      .catch(function (error) {
        finishWithError('数据加载失败：' + (error && error.message ? error.message : '未知错误'));
      });
  }

  function finishWithError(message) {
    baseData = { updatedAt: '', sources: [], items: [] };
    rebuildItems();
    populateFilters();
    syncControls();
    renderAll();
    els.grid.innerHTML =
      '<div class="cp-empty">' +
      '<i class="fa fa-plug" aria-hidden="true"></i>' +
      '<strong>暂时无法读取赛事数据</strong>' +
      '<p>' + esc(message) + '</p>' +
      '<p>请检查 <code>/competition/data.json</code> 是否存在，或重新执行数据抓取脚本。</p>' +
      '</div>';
    els.result.textContent = '共 0 项赛事';
  }

  /* ----------------------------- 筛选与排序 ----------------------------- */

  function matchesSearch(item, keyword) {
    if (!keyword) return true;
    var haystack = [
      item.name,
      item.organizer,
      item.type,
      item.level,
      item.sourceName,
      item.tags.join(' ')
    ].join(' ').toLowerCase();
    return haystack.indexOf(keyword.toLowerCase()) >= 0;
  }

  function matchesTime(item, range) {
    if (range === 'all') return true;
    var end = parseDate(item.registrationEnd);
    if (!end) return false;
    var days = daysFromToday(end);

    if (range === 'ended') return days < 0;
    if (range === 'month') {
      var today = new Date(todayUTC());
      return days >= 0 &&
        end.getUTCFullYear() === today.getUTCFullYear() &&
        end.getUTCMonth() === today.getUTCMonth();
    }
    var limit = Number(range);
    return days >= 0 && days <= limit;
  }

  function defaultCompare(a, b) {
    var rank = { open: 0, upcoming: 1, running: 2, ended: 3 };
    var sa = getStatus(a);
    var sb = getStatus(b);
    if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb];

    if (sa === 'open') {
      var ae = parseDate(a.registrationEnd);
      var be = parseDate(b.registrationEnd);
      if (ae && be && ae.getTime() !== be.getTime()) return ae - be;
      if (ae && !be) return -1;
      if (!ae && be) return 1;
    } else if (sa === 'upcoming') {
      var as = parseDate(a.registrationStart);
      var bs = parseDate(b.registrationStart);
      if (as && bs && as.getTime() !== bs.getTime()) return as - bs;
      var ae2 = parseDate(a.registrationEnd);
      var be2 = parseDate(b.registrationEnd);
      if (ae2 && be2 && ae2.getTime() !== be2.getTime()) return ae2 - be2;
    } else if (sa === 'running') {
      var ac = parseDate(a.competitionEnd);
      var bc = parseDate(b.competitionEnd);
      if (ac && bc && ac.getTime() !== bc.getTime()) return ac - bc;
    } else {
      var ae3 = parseDate(a.competitionEnd);
      var be3 = parseDate(b.competitionEnd);
      if (ae3 && be3 && ae3.getTime() !== be3.getTime()) return be3 - ae3;
      if (ae3 && !be3) return -1;
      if (!ae3 && be3) return 1;
    }
    return a.name.localeCompare(b.name, 'zh-CN');
  }

  function compareByDeadline(a, b) {
    var ae = parseDate(a.registrationEnd);
    var be = parseDate(b.registrationEnd);
    if (!ae && !be) return a.name.localeCompare(b.name, 'zh-CN');
    if (!ae) return 1;
    if (!be) return -1;
    return ae - be || a.name.localeCompare(b.name, 'zh-CN');
  }

  function compareByStart(a, b) {
    var as = parseDate(a.registrationStart);
    var bs = parseDate(b.registrationStart);
    if (!as && !bs) return a.name.localeCompare(b.name, 'zh-CN');
    if (!as) return 1;
    if (!bs) return -1;
    return as - bs || a.name.localeCompare(b.name, 'zh-CN');
  }

  function getFilteredItems() {
    var keyword = state.search.trim();
    var list = allItems.filter(function (item) {
      if (!matchesSearch(item, keyword)) return false;
      if (state.level !== 'all' && item.level !== state.level) return false;
      if (state.status !== 'all' && getStatus(item) !== state.status) return false;
      if (state.type !== 'all' && item.type !== state.type) return false;
      if (!matchesTime(item, state.time)) return false;
      return true;
    });

    if (state.sort === 'deadline') {
      list.sort(compareByDeadline);
    } else if (state.sort === 'start') {
      list.sort(compareByStart);
    } else if (state.sort === 'name') {
      list.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-CN'); });
    } else {
      list.sort(defaultCompare);
    }
    return list;
  }

  function getCalendarItems() {
    return allItems.filter(function (item) {
      if (state.calLevel !== 'all' && item.level !== state.calLevel) return false;
      if (state.calStatus !== 'all' && getStatus(item) !== state.calStatus) return false;
      return true;
    });
  }

  function calendarEventsFor(dateKey) {
    return getCalendarItems()
      .filter(function (item) { return item.registrationEnd === dateKey; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-CN'); });
  }

  /* ----------------------------- 选项渲染 ----------------------------- */

  function setSelectOptions(select, values, allLabel) {
    if (!select) return;
    var current = select.value || 'all';
    var html = '<option value="all">' + esc(allLabel) + '</option>';
    values.forEach(function (value) {
      html += '<option value="' + esc(value) + '">' + esc(value) + '</option>';
    });
    select.innerHTML = html;
    select.value = values.indexOf(current) >= 0 ? current : 'all';
  }

  function populateFilters() {
    var levels = LEVEL_ORDER.filter(function (level) {
      return allItems.some(function (item) { return item.level === level; });
    });
    allItems.forEach(function (item) {
      if (levels.indexOf(item.level) < 0) levels.push(item.level);
    });

    var typeCount = {};
    allItems.forEach(function (item) {
      typeCount[item.type] = (typeCount[item.type] || 0) + 1;
    });
    var types = Object.keys(typeCount).sort(function (a, b) {
      return typeCount[b] - typeCount[a] || a.localeCompare(b, 'zh-CN');
    });

    setSelectOptions(els.level, levels, '全部级别');
    setSelectOptions(els.type, types, '全部类型');
    setSelectOptions(els.calLevel, levels, '全部级别');

    if (state.level !== 'all' && levels.indexOf(state.level) < 0) state.level = 'all';
    if (state.type !== 'all' && types.indexOf(state.type) < 0) state.type = 'all';
    if (state.calLevel !== 'all' && levels.indexOf(state.calLevel) < 0) state.calLevel = 'all';

    if (els.status) {
      var currentStatus = els.status.value || 'all';
      els.status.innerHTML = '<option value="all">全部状态</option>' + STATUS_ORDER.map(function (key) {
        return '<option value="' + key + '">' + STATUS_MAP[key].label + '</option>';
      }).join('');
      els.status.value = STATUS_ORDER.indexOf(currentStatus) >= 0 ? currentStatus : 'all';
    }

    if (els.calStatus) {
      var currentCalStatus = els.calStatus.value || 'all';
      els.calStatus.innerHTML = '<option value="all">全部状态</option>' + STATUS_ORDER.map(function (key) {
        return '<option value="' + key + '">' + STATUS_MAP[key].label + '</option>';
      }).join('');
      els.calStatus.value = STATUS_ORDER.indexOf(currentCalStatus) >= 0 ? currentCalStatus : 'all';
    }
  }

  /* ----------------------------- 列表渲染 ----------------------------- */

  function renderStats() {
    var open = 0;
    var soon = 0;
    allItems.forEach(function (item) {
      var status = getStatus(item);
      if (status === 'open') {
        open += 1;
        var end = parseDate(item.registrationEnd);
        var days = daysFromToday(end);
        if (days !== null && days >= 0 && days <= 7) soon += 1;
      }
    });

    els.statOpen.textContent = String(open);
    els.statSoon.textContent = String(soon);
    els.statTotal.textContent = String(allItems.length);
    els.statUpdated.textContent = fmtUpdated(baseData.updatedAt);
    els.statUpdated.title = baseData.updatedAt || '暂无更新时间';
  }

  function renderSources() {
    var html = '<span class="cp-sources-label">数据来源</span>';
    baseData.sources.forEach(function (source) {
      var cls = 'cp-source-pill';
      if (source.status === 'failed') cls += ' is-failed';
      if (source.status === 'manual') cls += ' is-manual';
      var title = source.name + (source.count != null ? ' · ' + source.count + ' 条' : '') +
        (source.message ? ' · ' + source.message : '');
      var inner = '<span class="cp-source-dot"></span>' + esc(source.name) +
        (source.count != null ? ' <span>' + source.count + '</span>' : '');

      if (source.url) {
        html += '<a class="' + cls + '" href="' + esc(safeUrl(source.url)) +
          '" target="_blank" rel="noopener noreferrer" title="' + esc(title) + '">' + inner + '</a>';
      } else {
        html += '<span class="' + cls + '" title="' + esc(title) + '">' + inner + '</span>';
      }
    });

    if (manualItems.length > 0) {
      html += '<span class="cp-source-pill is-manual" title="保存在当前浏览器 localStorage 中">' +
        '<span class="cp-source-dot"></span>本地录入 <span>' + manualItems.length + '</span></span>';
    }

    if (!baseData.sources.length && !manualItems.length) {
      html += '<span class="cp-source-pill is-failed"><span class="cp-source-dot"></span>暂无来源信息</span>';
    }

    els.sources.innerHTML = html;
  }

  function renderActiveFilters() {
    var chips = [];
    if (state.search.trim()) {
      chips.push({ key: 'search', label: '关键词：' + state.search.trim() });
    }
    if (state.time !== 'all') {
      var timeLabels = {
        '7': '7 天内截止',
        '30': '30 天内截止',
        '90': '90 天内截止',
        month: '本月截止',
        ended: '已截止报名'
      };
      chips.push({ key: 'time', label: timeLabels[state.time] || state.time });
    }
    if (state.level !== 'all') chips.push({ key: 'level', label: '级别：' + state.level });
    if (state.status !== 'all') chips.push({ key: 'status', label: '状态：' + statusInfo(state.status).label });
    if (state.type !== 'all') chips.push({ key: 'type', label: '类型：' + state.type });

    if (!chips.length) {
      els.activeFilters.hidden = true;
      els.activeFilters.innerHTML = '';
      return;
    }

    els.activeFilters.hidden = false;
    els.activeFilters.innerHTML = chips.map(function (chip) {
      return '<span class="cp-filter-chip">' + esc(chip.label) +
        '<button type="button" data-clear="' + chip.key + '" aria-label="移除筛选">×</button></span>';
    }).join('');
  }

  function tagHTML(tags) {
    if (!tags.length) return '';
    var shown = tags.slice(0, 4);
    var html = shown.map(function (tag) {
      return '<span class="cp-tag">' + esc(tag) + '</span>';
    }).join('');
    if (tags.length > shown.length) {
      html += '<span class="cp-tag">+' + (tags.length - shown.length) + '</span>';
    }
    return html;
  }

  function cardHTML(item) {
    var status = getStatus(item);
    var info = statusInfo(status);
    var hint = deadlineHint(item);
    var url = safeUrl(item.url);
    var external = /^https?:\/\//i.test(url);
    var target = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    var title = esc(item.name);
    var levelCls = levelClass(item.level);

    return '<article class="cp-card" data-id="' + esc(item.id) + '">' +
      '<div class="cp-card-top">' +
        '<span class="cp-badge cp-badge-level ' + levelCls + '">' + esc(item.level) + '</span>' +
        '<span class="cp-badge cp-badge-status ' + info.cls + '">' + info.label + '</span>' +
        (item.verified === false
          ? '<span class="cp-unverified" title="' + esc(item.note || '该条目来自动态页面的人工收录，请以官网为准') + '">待核验</span>'
          : '') +
        (hint ? '<span class="cp-deadline ' + hint.cls + '">' + esc(hint.text) + '</span>' : '') +
      '</div>' +
      '<h3 class="cp-card-title"><a href="' + esc(url) + '"' + target + ' title="' + title + '">' + title + '</a></h3>' +
      '<p class="cp-card-org"><i class="fa fa-users" aria-hidden="true"></i>' + esc(item.organizer) + '</p>' +
      '<dl class="cp-card-meta">' +
        '<div><dt>报名</dt><dd>' + esc(fmtRange(item.registrationStart, item.registrationEnd)) + '</dd></div>' +
        '<div><dt>比赛</dt><dd>' + esc(fmtRange(item.competitionStart, item.competitionEnd)) + '</dd></div>' +
        '<div><dt>奖项</dt><dd title="' + esc(item.prize) + '">' + esc(item.prize) + '</dd></div>' +
      '</dl>' +
      '<div class="cp-card-tags">' + tagHTML(item.tags.length ? item.tags : [item.type]) + '</div>' +
      '<div class="cp-card-foot">' +
        '<span class="cp-source-name" title="' + esc(item.sourceName + (item.sourceUrl ? ' · ' + item.sourceUrl : '')) + '">' +
          '<i class="fa fa-globe" aria-hidden="true"></i>' + esc(item.sourceName) +
        '</span>' +
        '<span class="cp-card-links">' +
          '<button type="button" data-cp-detail="' + esc(item.id) + '">详情</button>' +
          '<a href="' + esc(url) + '"' + target + '>官网 <i class="fa fa-external-link" aria-hidden="true"></i></a>' +
        '</span>' +
      '</div>' +
    '</article>';
  }

  function emptyHTML() {
    var hasFilters = state.search || state.time !== 'all' || state.level !== 'all' ||
      state.status !== 'all' || state.type !== 'all';
    return '<div class="cp-empty">' +
      '<i class="fa fa-calendar-times-o" aria-hidden="true"></i>' +
      '<strong>' + (hasFilters ? '没有符合条件的赛事' : '暂无赛事数据') + '</strong>' +
      '<p>' + (hasFilters ? '试试放宽时间范围，或清除部分筛选条件。' : '请先运行数据抓取脚本生成赛事数据。') + '</p>' +
      (hasFilters ? '<button type="button" class="cp-btn cp-btn-ghost" data-cp-reset>清除筛选</button>' : '') +
      '</div>';
  }

  function pageNumbers(current, total) {
    if (total <= 7) {
      var all = [];
      for (var i = 1; i <= total; i += 1) all.push(i);
      return all;
    }
    var set = [1, total, current - 1, current, current + 1].filter(function (page) {
      return page >= 1 && page <= total;
    });
    set = set.filter(function (page, index) { return set.indexOf(page) === index; });
    set.sort(function (a, b) { return a - b; });

    var result = [];
    set.forEach(function (page, index) {
      if (index > 0 && page - set[index - 1] > 1) result.push('...');
      result.push(page);
    });
    return result;
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      els.pagination.innerHTML = '';
      return;
    }
    var html = '<button type="button" class="cp-page-btn" data-page="' + (state.page - 1) + '"' +
      (state.page === 1 ? ' disabled' : '') + ' aria-label="上一页"><i class="fa fa-angle-left"></i></button>';

    pageNumbers(state.page, totalPages).forEach(function (page) {
      if (page === '...') {
        html += '<span class="cp-page-ellipsis">…</span>';
      } else {
        html += '<button type="button" class="cp-page-btn' + (page === state.page ? ' is-active' : '') +
          '" data-page="' + page + '"' + (page === state.page ? ' aria-current="page"' : '') + '>' + page + '</button>';
      }
    });

    html += '<button type="button" class="cp-page-btn" data-page="' + (state.page + 1) + '"' +
      (state.page === totalPages ? ' disabled' : '') + ' aria-label="下一页"><i class="fa fa-angle-right"></i></button>';
    els.pagination.innerHTML = html;
  }

  function renderList() {
    var items = getFilteredItems();
    var total = items.length;
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), totalPages);

    var start = (state.page - 1) * PAGE_SIZE;
    var pageItems = items.slice(start, start + PAGE_SIZE);

    els.result.innerHTML = total
      ? '共 <strong>' + total + '</strong> 项赛事 · 第 ' + state.page + ' / ' + totalPages + ' 页'
      : '共 <strong>0</strong> 项赛事';

    els.grid.innerHTML = pageItems.length ? pageItems.map(cardHTML).join('') : emptyHTML();
    renderPagination(totalPages);
  }

  /* ----------------------------- 日历渲染 ----------------------------- */

  function monthLabel(year, month) {
    return year + '年' + (month + 1) + '月';
  }

  function renderCalendar() {
    var year = state.calYear;
    var month = state.calMonth;
    els.calTitle.textContent = monthLabel(year, month);

    var first = new Date(Date.UTC(year, month, 1));
    var offset = (first.getUTCDay() + 6) % 7;
    var daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    var cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
    var start = new Date(Date.UTC(year, month, 1 - offset));
    var todayKey = fmtDateKey(new Date(todayUTC()));
    var html = '';

    for (var i = 0; i < cellCount; i += 1) {
      var day = new Date(start.getTime() + i * 86400000);
      var key = fmtDateKey(day);
      var events = calendarEventsFor(key);
      var classes = ['cp-cal-day'];
      if (day.getUTCMonth() !== month) classes.push('is-outside');
      if (key === todayKey) classes.push('is-today');

      if (!events.length) {
        html += '<div class="' + classes.join(' ') + '">' +
          '<span class="cp-cal-num">' + day.getUTCDate() + '</span>' +
          '</div>';
        continue;
      }

      classes.push('has-events');
      var chips = events.slice(0, 2).map(function (item) {
        return '<span class="cp-cal-chip ' + levelClass(item.level) + '" title="' + esc(item.name) + '">' +
          esc(item.name) + '</span>';
      }).join('');
      var dots = events.slice(0, 4).map(function (item) {
        return '<span class="cp-cal-dot ' + levelClass(item.level) + '"></span>';
      }).join('');
      var more = events.length > 2 ? '<span class="cp-cal-more">+' + (events.length - 2) + '</span>' : '';
      var label = (day.getUTCMonth() + 1) + '月' + day.getUTCDate() + '日，' + events.length + ' 项赛事报名截止';

      html += '<button type="button" class="' + classes.join(' ') + '" data-date="' + key +
        '" aria-label="' + esc(label) + '">' +
        '<span class="cp-cal-num">' + day.getUTCDate() + '</span>' +
        '<span class="cp-cal-events">' + chips + more + '</span>' +
        '<span class="cp-cal-dots">' + dots + '</span>' +
        '</button>';
    }

    els.calendar.innerHTML = html;
  }

  function renderAgenda() {
    var prefix = state.calYear + '-' + pad(state.calMonth + 1);
    var items = getCalendarItems()
      .filter(function (item) { return item.registrationEnd.indexOf(prefix) === 0; })
      .sort(function (a, b) {
        return a.registrationEnd.localeCompare(b.registrationEnd) ||
          a.name.localeCompare(b.name, 'zh-CN');
      });

    els.agendaCount.textContent = items.length ? items.length + ' 项' : '';

    if (!items.length) {
      els.agenda.innerHTML = '<div class="cp-agenda-empty">本月没有符合条件的报名截止赛事。</div>';
      return;
    }

    els.agenda.innerHTML = items.map(function (item) {
      var date = parseDate(item.registrationEnd);
      var status = statusInfo(getStatus(item));
      return '<button type="button" class="cp-agenda-item" data-cp-detail="' + esc(item.id) + '">' +
        '<span class="cp-agenda-date">' + pad(date.getUTCDate()) + '<small>' + (date.getUTCMonth() + 1) + '月</small></span>' +
        '<span class="cp-agenda-info">' +
          '<strong>' + esc(item.name) + '</strong>' +
          '<span>' + esc(item.level) + ' · ' + status.label + ' · ' + esc(item.organizer) + '</span>' +
        '</span>' +
        '<i class="fa fa-angle-right" aria-hidden="true"></i>' +
        '</button>';
    }).join('');
  }

  function renderAll() {
    renderStats();
    renderSources();
    renderActiveFilters();
    renderList();
    renderCalendar();
    renderAgenda();
  }

  /* ----------------------------- 详情 / 弹窗 ----------------------------- */

  function cell(label, value) {
    return '<div class="cp-detail-cell"><span>' + esc(label) + '</span><strong>' +
      esc(value || '待公布') + '</strong></div>';
  }

  function detailHTML(item) {
    var status = getStatus(item);
    var info = statusInfo(status);
    var url = safeUrl(item.url);
    var external = /^https?:\/\//i.test(url);
    var target = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    var tags = item.tags.length
      ? item.tags.map(function (tag) { return '<span class="cp-tag">' + esc(tag) + '</span>'; }).join('')
      : '<span class="cp-tag">' + esc(item.type) + '</span>';

    return '<div class="cp-detail-head">' +
        '<div class="cp-detail-badges">' +
          '<span class="cp-badge cp-badge-level ' + levelClass(item.level) + '">' + esc(item.level) + '</span>' +
          '<span class="cp-badge cp-badge-status ' + info.cls + '">' + info.label + '</span>' +
          (item.verified === false ? '<span class="cp-unverified">待核验</span>' : '') +
        '</div>' +
        '<h2 id="cp-detail-title">' + esc(item.name) + '</h2>' +
        '<p class="cp-detail-org"><i class="fa fa-users" aria-hidden="true"></i> ' + esc(item.organizer) + '</p>' +
      '</div>' +
      (item.note ? '<p class="cp-detail-note"><i class="fa fa-info-circle" aria-hidden="true"></i> ' + esc(item.note) + '</p>' : '') +
      '<div class="cp-detail-grid">' +
        cell('赛事级别', item.level) +
        cell('赛事类型', item.type) +
        cell('当前状态', info.label) +
        cell('奖项', item.prize) +
        cell('报名时间', fmtRange(item.registrationStart, item.registrationEnd)) +
        cell('比赛时间', fmtRange(item.competitionStart, item.competitionEnd)) +
      '</div>' +
      (item.participants
        ? '<div class="cp-detail-section"><h3>参赛对象</h3><p>' + esc(item.participants) + '</p></div>'
        : '') +
      '<div class="cp-detail-section"><h3>标签</h3><div class="cp-detail-tags">' + tags + '</div></div>' +
      '<div class="cp-detail-source">' +
        '<span>来源：' + esc(item.sourceName) + '</span>' +
        (item.sourceUrl
          ? '<a href="' + esc(safeUrl(item.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">' +
            esc(item.sourceUrl) + '</a>'
          : '') +
      '</div>' +
      '<div class="cp-detail-actions">' +
        '<a class="cp-btn cp-btn-primary" href="' + esc(url) + '"' + target + '>' +
          '<i class="fa fa-external-link" aria-hidden="true"></i> 访问官网</a>' +
        '<button type="button" class="cp-btn cp-btn-ghost" data-cp-close="detail">关闭</button>' +
        (item.manual
          ? '<button type="button" class="cp-btn cp-btn-danger-ghost" data-cp-delete-manual="' +
            esc(item.id) + '"><i class="fa fa-trash" aria-hidden="true"></i> 删除本地录入</button>'
          : '') +
      '</div>';
  }

  function showDetail(id) {
    var item = allItems.filter(function (entry) { return entry.id === id; })[0];
    if (!item) return;
    els.detailBody.innerHTML = detailHTML(item);
    openModal('detail');
  }

  function showDay(dateKey) {
    var events = calendarEventsFor(dateKey);
    if (!events.length) return;
    if (events.length === 1) {
      showDetail(events[0].id);
      return;
    }

    var date = parseDate(dateKey);
    var title = date.getUTCFullYear() + '年' + (date.getUTCMonth() + 1) + '月' + date.getUTCDate() + '日';
    els.detailBody.innerHTML = '<h2 id="cp-detail-title">' + title + ' · ' + events.length + ' 项赛事</h2>' +
      '<p class="cp-modal-desc">以下赛事均在这一天报名截止，点击查看完整信息。</p>' +
      '<div class="cp-day-list">' + events.map(function (item) {
        var info = statusInfo(getStatus(item));
        return '<button type="button" class="cp-day-item" data-cp-detail="' + esc(item.id) + '">' +
          '<span class="cp-day-item-main">' +
            '<strong>' + esc(item.name) + '</strong>' +
            '<span>' + esc(item.level) + ' · ' + info.label + ' · ' + esc(item.organizer) + '</span>' +
          '</span>' +
          '<i class="fa fa-angle-right" aria-hidden="true"></i>' +
          '</button>';
      }).join('') + '</div>';
    openModal('detail');
  }

  function openModal(name) {
    var modal = document.getElementById('cp-' + name + '-modal');
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('cp-modal-open');
    var close = modal.querySelector('.cp-modal-close');
    if (close) close.focus();
  }

  function closeModal(name) {
    var modal = document.getElementById('cp-' + name + '-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (!document.querySelector('.cp-modal:not([hidden])')) {
      document.body.classList.remove('cp-modal-open');
    }
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus();
      lastFocus = null;
    }
  }

  function closeAllModals() {
    ['detail', 'manual'].forEach(function (name) { closeModal(name); });
    hideTooltip();
    document.body.classList.remove('cp-modal-open');
  }

  /* ----------------------------- 提示 ----------------------------- */

  function toast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.hidden = true;
    }, 2600);
  }

  function showTooltip(dayEl, event) {
    var dateKey = dayEl.getAttribute('data-date');
    var events = calendarEventsFor(dateKey);
    if (!events.length) {
      hideTooltip();
      return;
    }

    if (tooltipDate !== dateKey) {
      tooltipDate = dateKey;
      var date = parseDate(dateKey);
      var title = date.getUTCFullYear() + '年' + (date.getUTCMonth() + 1) + '月' + date.getUTCDate() + '日';
      var shown = events.slice(0, 4);
      var html = '<div class="cp-tooltip-title">' + title + ' · ' + events.length + ' 项报名截止</div>';

      html += shown.map(function (item) {
        var info = statusInfo(getStatus(item));
        return '<div class="cp-tooltip-item">' +
          '<strong>' + esc(item.name) + '</strong>' +
          '<p class="cp-tooltip-meta"><b>级别</b> ' + esc(item.level) + ' · <b>状态</b> ' + info.label + '</p>' +
          '<p class="cp-tooltip-meta"><b>主办</b> ' + esc(item.organizer) + '</p>' +
          '<p class="cp-tooltip-meta"><b>报名</b> ' + esc(fmtRange(item.registrationStart, item.registrationEnd)) + '</p>' +
          '<p class="cp-tooltip-meta"><b>比赛</b> ' + esc(fmtRange(item.competitionStart, item.competitionEnd)) + '</p>' +
          '<p class="cp-tooltip-meta"><b>奖项</b> ' + esc(item.prize) + '</p>' +
          '</div>';
      }).join('');

      if (events.length > shown.length) {
        html += '<div class="cp-tooltip-more">还有 ' + (events.length - shown.length) + ' 项，点击日期查看全部</div>';
      } else {
        html += '<div class="cp-tooltip-more">点击日期查看详情</div>';
      }

      els.tooltip.innerHTML = html;
      els.tooltip.hidden = false;
    }

    var rect = els.tooltip.getBoundingClientRect();
    var x = event.clientX + 18;
    var y = event.clientY + 18;
    if (x + rect.width > window.innerWidth - 12) x = event.clientX - rect.width - 18;
    if (y + rect.height > window.innerHeight - 12) y = event.clientY - rect.height - 18;
    els.tooltip.style.left = Math.max(8, x) + 'px';
    els.tooltip.style.top = Math.max(8, y) + 'px';
  }

  function hideTooltip() {
    if (!els.tooltip) return;
    els.tooltip.hidden = true;
    tooltipDate = '';
  }

  /* ----------------------------- 导出 / 手动录入 ----------------------------- */

  function downloadJson(payload, filename) {
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
  }

  function exportAll() {
    if (!allItems.length) {
      toast('暂无可导出的赛事数据');
      return;
    }
    downloadJson({
      exportedAt: new Date().toISOString(),
      count: allItems.length,
      items: allItems
    }, 'competitions-' + fmtDate(new Date(todayUTC())).replace(/\./g, '') + '.json');
    toast('已导出 ' + allItems.length + ' 项赛事');
  }

  function exportManual() {
    if (!manualItems.length) {
      toast('还没有本地录入的赛事');
      return;
    }
    downloadJson({
      exportedAt: new Date().toISOString(),
      count: manualItems.length,
      items: manualItems
    }, 'competitions-manual.json');
    toast('已导出 ' + manualItems.length + ' 条本地录入');
  }

  function renderManualList() {
    if (!els.manualList) return;
    els.manualCount.textContent = String(manualItems.length);

    if (!manualItems.length) {
      els.manualList.innerHTML = '<div class="cp-manual-empty">还没有本地录入的赛事。</div>';
      return;
    }

    els.manualList.innerHTML = manualItems.map(function (item) {
      return '<div class="cp-manual-item">' +
        '<span class="cp-manual-item-main">' +
          '<strong>' + esc(item.name) + '</strong>' +
          '<span>' + esc(item.level) + ' · 截止 ' +
            esc(item.registrationEnd ? fmtDate(parseDate(item.registrationEnd)) : '未填写') + '</span>' +
        '</span>' +
        '<button type="button" data-manual-del="' + esc(item.id) + '">删除</button>' +
        '</div>';
    }).join('');
  }

  function removeManualItem(id) {
    var target = manualItems.filter(function (item) { return item.id === id; })[0];
    if (!target) return;
    if (!window.confirm('确定删除“' + target.name + '”吗？此操作只影响当前浏览器。')) return;
    manualItems = manualItems.filter(function (item) { return item.id !== id; });
    saveManualItems();
    rebuildItems();
    populateFilters();
    renderAll();
    renderManualList();
    closeModal('detail');
    toast('已删除本地录入');
  }

  function handleManualSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var data = new FormData(form);
    var name = String(data.get('name') || '').trim();

    if (!name) {
      toast('请填写赛事名称');
      form.querySelector('[name="name"]').focus();
      return;
    }

    var regStart = String(data.get('registrationStart') || '');
    var regEnd = String(data.get('registrationEnd') || '');
    if (regStart && regEnd && regEnd < regStart) {
      toast('报名截止时间不能早于报名开始时间');
      return;
    }

    var compStart = String(data.get('competitionStart') || '');
    var compEnd = String(data.get('competitionEnd') || '');
    if (compStart && compEnd && compEnd < compStart) {
      toast('比赛结束时间不能早于比赛开始时间');
      return;
    }

    var duplicate = manualItems.some(function (item) {
      return item.name === name && item.registrationEnd === regEnd;
    });
    if (duplicate) {
      toast('已存在同名且截止日期相同的本地赛事');
      return;
    }

    var tags = String(data.get('tags') || '').split(/[,，、|]/).map(function (tag) {
      return tag.trim();
    }).filter(Boolean);

    var item = normalizeItem({
      id: 'manual-' + Date.now(),
      name: name,
      organizer: String(data.get('organizer') || '').trim() || '未知',
      level: String(data.get('level') || '其他'),
      type: String(data.get('type') || '').trim() || '综合',
      tags: tags,
      registrationStart: regStart,
      registrationEnd: regEnd,
      competitionStart: compStart,
      competitionEnd: compEnd,
      prize: String(data.get('prize') || '').trim() || '以官网公布为准',
      url: String(data.get('url') || '').trim(),
      source: 'manual',
      sourceName: '本地录入',
      sourceUrl: '',
      verified: true,
      note: '',
      manual: true
    });

    manualItems.push(item);
    if (!saveManualItems()) {
      manualItems.pop();
      return;
    }

    rebuildItems();
    populateFilters();
    renderAll();
    renderManualList();
    form.reset();
    toast('已保存到本地，可在列表中查看');
  }

  function clearManualItems() {
    if (!manualItems.length) {
      toast('还没有本地录入的赛事');
      return;
    }
    if (!window.confirm('确定清空全部 ' + manualItems.length + ' 条本地录入吗？此操作不可撤销。')) return;
    manualItems = [];
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      /* ignore */
    }
    rebuildItems();
    populateFilters();
    renderAll();
    renderManualList();
    toast('已清空本地录入');
  }

  /* ----------------------------- 控件同步 ----------------------------- */

  function syncControls() {
    if (els.search) els.search.value = state.search;
    if (els.time) els.time.value = state.time;
    if (els.level) els.level.value = state.level;
    if (els.status) els.status.value = state.status;
    if (els.type) els.type.value = state.type;
    if (els.sort) els.sort.value = state.sort;
    if (els.calLevel) els.calLevel.value = state.calLevel;
    if (els.calStatus) els.calStatus.value = state.calStatus;
  }

  function setView(view) {
    state.view = view;
    Array.prototype.forEach.call(root.querySelectorAll('.cp-tab'), function (tab) {
      var active = tab.getAttribute('data-view') === view;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    els.listView.hidden = view !== 'list';
    els.calendarView.hidden = view !== 'calendar';
    if (view === 'calendar') {
      renderCalendar();
      renderAgenda();
    }
    if (window.history && typeof window.history.replaceState === 'function') {
      var nextUrl = window.location.pathname + window.location.search + (view === 'calendar' ? '#calendar' : '');
      window.history.replaceState(null, '', nextUrl);
    }
  }

  function resetFilters() {
    state.search = '';
    state.time = 'all';
    state.level = 'all';
    state.status = 'all';
    state.type = 'all';
    state.sort = 'default';
    state.page = 1;
    syncControls();
    renderActiveFilters();
    renderList();
  }

  function clearFilter(key) {
    if (key === 'search') state.search = '';
    else state[key] = 'all';
    state.page = 1;
    syncControls();
    renderActiveFilters();
    renderList();
  }

  function scrollToListTop() {
    var anchor = root.querySelector('.cp-filter') || els.grid;
    var top = anchor.getBoundingClientRect().top + window.pageYOffset - 82;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  /* ----------------------------- 事件绑定 ----------------------------- */

  function bindEvents() {
    Array.prototype.forEach.call(root.querySelectorAll('.cp-tab'), function (tab) {
      tab.addEventListener('click', function () {
        setView(tab.getAttribute('data-view'));
      });
    });

    els.search.addEventListener('input', debounce(function () {
      state.search = els.search.value;
      state.page = 1;
      renderActiveFilters();
      renderList();
    }, 220));

    els.time.addEventListener('change', function () {
      state.time = els.time.value;
      state.page = 1;
      renderActiveFilters();
      renderList();
    });

    els.level.addEventListener('change', function () {
      state.level = els.level.value;
      state.page = 1;
      renderActiveFilters();
      renderList();
    });

    els.status.addEventListener('change', function () {
      state.status = els.status.value;
      state.page = 1;
      renderActiveFilters();
      renderList();
    });

    els.type.addEventListener('change', function () {
      state.type = els.type.value;
      state.page = 1;
      renderActiveFilters();
      renderList();
    });

    els.sort.addEventListener('change', function () {
      state.sort = els.sort.value;
      state.page = 1;
      renderList();
    });

    els.reset.addEventListener('click', resetFilters);

    els.activeFilters.addEventListener('click', function (event) {
      var button = event.target.closest('[data-clear]');
      if (button) clearFilter(button.getAttribute('data-clear'));
    });

    els.grid.addEventListener('click', function (event) {
      var detail = event.target.closest('[data-cp-detail]');
      if (detail) {
        event.preventDefault();
        showDetail(detail.getAttribute('data-cp-detail'));
        return;
      }
      if (event.target.closest('[data-cp-reset]')) resetFilters();
    });

    els.pagination.addEventListener('click', function (event) {
      var button = event.target.closest('[data-page]');
      if (!button || button.disabled) return;
      var page = Number(button.getAttribute('data-page'));
      if (!page || page === state.page) return;
      state.page = page;
      renderList();
      scrollToListTop();
    });

    els.calPrev.addEventListener('click', function () {
      var date = new Date(Date.UTC(state.calYear, state.calMonth - 1, 1));
      state.calYear = date.getUTCFullYear();
      state.calMonth = date.getUTCMonth();
      renderCalendar();
      renderAgenda();
      hideTooltip();
    });

    els.calNext.addEventListener('click', function () {
      var date = new Date(Date.UTC(state.calYear, state.calMonth + 1, 1));
      state.calYear = date.getUTCFullYear();
      state.calMonth = date.getUTCMonth();
      renderCalendar();
      renderAgenda();
      hideTooltip();
    });

    els.calToday.addEventListener('click', function () {
      var today = todayParts();
      state.calYear = today.y;
      state.calMonth = today.m;
      renderCalendar();
      renderAgenda();
      hideTooltip();
    });

    els.calLevel.addEventListener('change', function () {
      state.calLevel = els.calLevel.value;
      renderCalendar();
      renderAgenda();
      hideTooltip();
    });

    els.calStatus.addEventListener('change', function () {
      state.calStatus = els.calStatus.value;
      renderCalendar();
      renderAgenda();
      hideTooltip();
    });

    els.calendar.addEventListener('mousemove', function (event) {
      var day = event.target.closest('.cp-cal-day[data-date]');
      if (!day) {
        hideTooltip();
        return;
      }
      showTooltip(day, event);
    });

    els.calendar.addEventListener('mouseleave', hideTooltip);

    els.calendar.addEventListener('click', function (event) {
      var day = event.target.closest('.cp-cal-day[data-date]');
      if (day) {
        hideTooltip();
        showDay(day.getAttribute('data-date'));
      }
    });

    els.agenda.addEventListener('click', function (event) {
      var button = event.target.closest('[data-cp-detail]');
      if (button) showDetail(button.getAttribute('data-cp-detail'));
    });

    els.detailBody.addEventListener('click', function (event) {
      var detail = event.target.closest('[data-cp-detail]');
      if (detail) {
        showDetail(detail.getAttribute('data-cp-detail'));
        return;
      }
      var remove = event.target.closest('[data-cp-delete-manual]');
      if (remove) removeManualItem(remove.getAttribute('data-cp-delete-manual'));
    });

    els.addManual.addEventListener('click', function () {
      renderManualList();
      openModal('manual');
    });

    els.export.addEventListener('click', exportAll);

    els.manualForm.addEventListener('submit', handleManualSubmit);
    els.manualExport.addEventListener('click', exportManual);
    els.manualClear.addEventListener('click', clearManualItems);

    els.manualList.addEventListener('click', function (event) {
      var button = event.target.closest('[data-manual-del]');
      if (button) removeManualItem(button.getAttribute('data-manual-del'));
    });
  }

  function cacheElements() {
    els = {
      sources: root.querySelector('#cp-sources'),
      statOpen: root.querySelector('#cp-stat-open'),
      statSoon: root.querySelector('#cp-stat-soon'),
      statTotal: root.querySelector('#cp-stat-total'),
      statUpdated: root.querySelector('#cp-stat-updated'),
      listView: root.querySelector('#cp-list-view'),
      calendarView: root.querySelector('#cp-calendar-view'),
      search: root.querySelector('#cp-search'),
      time: root.querySelector('#cp-time'),
      level: root.querySelector('#cp-level'),
      status: root.querySelector('#cp-status'),
      type: root.querySelector('#cp-type'),
      sort: root.querySelector('#cp-sort'),
      reset: root.querySelector('#cp-reset'),
      activeFilters: root.querySelector('#cp-active-filters'),
      result: root.querySelector('#cp-result'),
      grid: root.querySelector('#cp-grid'),
      pagination: root.querySelector('#cp-pagination'),
      calTitle: root.querySelector('#cp-cal-title'),
      calPrev: root.querySelector('#cp-cal-prev'),
      calNext: root.querySelector('#cp-cal-next'),
      calToday: root.querySelector('#cp-cal-today'),
      calLevel: root.querySelector('#cp-cal-level'),
      calStatus: root.querySelector('#cp-cal-status'),
      calendar: root.querySelector('#cp-calendar'),
      agenda: root.querySelector('#cp-agenda'),
      agendaCount: root.querySelector('#cp-agenda-count'),
      addManual: root.querySelector('#cp-add-manual'),
      export: root.querySelector('#cp-export'),
      detailBody: document.getElementById('cp-detail-body'),
      manualForm: document.getElementById('cp-manual-form'),
      manualList: document.getElementById('cp-manual-list'),
      manualCount: document.getElementById('cp-manual-count'),
      manualExport: document.getElementById('cp-manual-export'),
      manualClear: document.getElementById('cp-manual-clear'),
      tooltip: document.getElementById('cp-tooltip'),
      toast: document.getElementById('cp-toast')
    };
  }

  /* ----------------------------- 初始化 ----------------------------- */

  function init() {
    var app = document.getElementById('competition-app');
    if (!app) return;
    if (app.getAttribute('data-cp-ready') === '1') return;

    app.setAttribute('data-cp-ready', '1');
    root = app;
    document.body.classList.remove('cp-modal-open');
    hideTooltip();

    cacheElements();
    if (!els.grid || !els.calendar) return;

    var today = todayParts();
    state.calYear = today.y;
    state.calMonth = today.m;
    manualItems = loadManualItems();

    bindEvents();

    var params = new URLSearchParams(window.location.search);
    var initialView = params.get('view');
    if (initialView === 'calendar' || window.location.hash === '#calendar') {
      setView('calendar');
    } else {
      setView('list');
    }

    var inline = readInlineData();
    if (inline && Array.isArray(inline.items) && inline.items.length) {
      setBaseData(inline);
    } else {
      fetchFallbackData();
    }
  }

  function bindGlobalOnce() {
    if (globalBound) return;
    globalBound = true;

    document.addEventListener('click', function (event) {
      var close = event.target.closest('[data-cp-close]');
      if (close) {
        event.preventDefault();
        closeModal(close.getAttribute('data-cp-close'));
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      var open = document.querySelector('.cp-modal:not([hidden])');
      if (open) {
        closeModal(open.id.replace('cp-', '').replace('-modal', ''));
      }
    });

    if (window.jQuery) {
      // pjax:complete 在不同版本的 jquery.pjax 中可能早于 DOM 替换；
      // 同时监听 success / end，确保新页面内容已经在 DOM 中。
      window.jQuery(document)
        .on('pjax:complete', init)
        .on('pjax:success', init)
        .on('pjax:end', init)
        .on('pjax:send', closeAllModals);
    }
  }

  // 即使当前页面不是赛事页，也要先绑定 PJAX 事件；
  // 否则从首页第一次通过 PJAX 进入 /competition/ 时不会触发 init。
  bindGlobalOnce();

  if (document.getElementById('competition-app')) {
    // 赛事页内容已经解析完成，不必等待被外部 CDN 脚本拖慢的 DOMContentLoaded。
    init();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.initCompetition = init;
})();
