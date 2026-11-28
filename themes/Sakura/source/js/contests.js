/* 编程比赛聚合页 /contests/ */
(function () {
  'use strict';

  var PLATFORM_MAP = {
    all: { label: '全部平台' },
    codeforces: { label: 'Codeforces' },
    atcoder: { label: 'AtCoder' },
    leetcode: { label: 'LeetCode' },
    nowcoder: { label: '牛客' }
  };

  var STATUS_MAP = {
    upcoming: { label: '即将开始', cls: 'ct-status-upcoming' },
    running: { label: '进行中', cls: 'ct-status-running' },
    ended: { label: '已结束', cls: 'ct-status-ended' }
  };

  var state = {
    platform: 'all',
    status: 'all',
    range: 'all'
  };

  var root = null;
  var els = {};
  var baseData = { updatedAt: '', sources: [], items: [] };
  var allItems = [];
  var globalBound = false;

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

  function normalizeItem(raw) {
    var start = Date.parse(raw && raw.startTime);
    var end = Date.parse(raw && raw.endTime);
    if (Number.isNaN(start) || Number.isNaN(end)) return null;
    var platform = String((raw && raw.platform) || 'other');
    return {
      id: String((raw && raw.id) || (raw && raw.name) || Math.random().toString(36).slice(2)),
      platform: platform,
      platformName: String((raw && raw.platformName) || (PLATFORM_MAP[platform] && PLATFORM_MAP[platform].label) || platform),
      name: String((raw && raw.name) || '未命名比赛'),
      url: String((raw && raw.url) || ''),
      start: start,
      end: end,
      startTime: String((raw && raw.startTime) || ''),
      endTime: String((raw && raw.endTime) || ''),
      durationMinutes: Number((raw && raw.durationMinutes) || Math.max(1, Math.round((end - start) / 60000))),
      rated: String((raw && raw.rated) || ''),
      note: String((raw && raw.note) || '')
    };
  }

  function getStatus(item) {
    var now = Date.now();
    if (item.end < now) return 'ended';
    if (item.start <= now) return 'running';
    return 'upcoming';
  }

  function statusInfo(status) {
    return STATUS_MAP[status] || STATUS_MAP.ended;
  }

  function dateParts(date) {
    var parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    var result = {};
    parts.forEach(function (part) {
      if (part.type !== 'literal') result[part.type] = part.value;
    });
    return result;
  }

  function dateKey(date) {
    var p = dateParts(date);
    return p.year + '-' + p.month + '-' + p.day;
  }

  function dateLabel(date) {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    }).format(date);
  }

  function timeLabel(date) {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }

  function rangeLabel(item) {
    return timeLabel(new Date(item.start)) + ' - ' + timeLabel(new Date(item.end));
  }

  function durationLabel(minutes) {
    var value = Number(minutes) || 0;
    if (value >= 1440) {
      var days = Math.floor(value / 1440);
      var restHours = Math.round((value % 1440) / 60);
      return days + ' 天' + (restHours ? ' ' + restHours + ' 小时' : '');
    }
    if (value >= 60) {
      var hours = Math.floor(value / 60);
      var rest = value % 60;
      return hours + ' 小时' + (rest ? ' ' + rest + ' 分' : '');
    }
    return value + ' 分钟';
  }

  function updatedLabel(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  function daysFromNow(item) {
    return Math.round((item.start - Date.now()) / 86400000);
  }

  function matchesRange(item, range, status) {
    var now = Date.now();
    if (range === 'all') return true;
    if (range === 'ended') return status === 'ended' && item.end >= now - 30 * 86400000;
    var days = range === '7' ? 7 : 30;
    return status !== 'ended' && item.start <= now + days * 86400000;
  }

  function compareItems(a, b) {
    var rank = { running: 0, upcoming: 1, ended: 2 };
    var sa = getStatus(a);
    var sb = getStatus(b);
    if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb];
    if (sa === 'ended') return b.start - a.start || a.name.localeCompare(b.name, 'zh-CN');
    return a.start - b.start || a.name.localeCompare(b.name, 'zh-CN');
  }

  function getFilteredItems() {
    return allItems
      .filter(function (item) {
        var status = getStatus(item);
        if (state.platform !== 'all' && item.platform !== state.platform) return false;
        if (state.status !== 'all' && status !== state.status) return false;
        if (!matchesRange(item, state.range, status)) return false;
        return true;
      })
      .sort(compareItems);
  }

  function setData(data) {
    baseData = data || { updatedAt: '', sources: [], items: [] };
    allItems = (baseData.items || []).map(normalizeItem).filter(Boolean);
    renderAll();
  }

  function renderStats() {
    var now = Date.now();
    var upcoming = 0;
    var running = 0;
    var week = 0;
    allItems.forEach(function (item) {
      var status = getStatus(item);
      if (status === 'upcoming') upcoming += 1;
      if (status === 'running') running += 1;
      if (status !== 'ended' && item.start <= now + 7 * 86400000) week += 1;
    });

    if (els.statUpcoming) els.statUpcoming.textContent = String(upcoming);
    if (els.statRunning) els.statRunning.textContent = String(running);
    if (els.statWeek) els.statWeek.textContent = String(week);
    if (els.statUpdated) {
      els.statUpdated.textContent = updatedLabel(baseData.updatedAt);
      els.statUpdated.title = baseData.updatedAt || '暂无更新时间';
    }
  }

  function platformCounts() {
    var counts = { all: allItems.length };
    allItems.forEach(function (item) {
      counts[item.platform] = (counts[item.platform] || 0) + 1;
    });
    return counts;
  }

  function renderPlatforms() {
    if (!els.platforms) return;
    var counts = platformCounts();
    var keys = ['all'].concat(Object.keys(PLATFORM_MAP).filter(function (key) {
      return key !== 'all' && counts[key];
    }));
    els.platforms.innerHTML = keys.map(function (key) {
      var meta = PLATFORM_MAP[key] || { label: key };
      var active = state.platform === key ? ' is-active' : '';
      var dot = key === 'all' ? '' : '<span class="ct-dot"></span>';
      return '<button type="button" class="ct-platform-btn' + active + '" data-platform="' + esc(key) + '">' +
        dot + esc(meta.label) + ' <span class="ct-count">' + (counts[key] || 0) + '</span></button>';
    }).join('');
  }

  function renderSources() {
    if (!els.sources) return;
    var sources = baseData.sources || [];
    if (!sources.length) {
      els.sources.innerHTML = '';
      return;
    }
    els.sources.innerHTML = sources.map(function (source) {
      var failed = source.status === 'failed' ? ' is-failed' : '';
      var title = source.message || '';
      return '<span class="ct-source' + failed + '" title="' + esc(title) + '">' +
        '<span class="ct-source-dot"></span>' + esc(source.name || source.id) +
        (source.count != null ? ' · ' + source.count : '') + '</span>';
    }).join('');
  }

  function itemHTML(item) {
    var status = getStatus(item);
    var info = statusInfo(status);
    var platform = PLATFORM_MAP[item.platform] || { label: item.platformName };
    var days = daysFromNow(item);
    var timeHint = '';
    if (status === 'upcoming' && days >= 0) {
      timeHint = days === 0 ? '今天' : days === 1 ? '明天' : days + ' 天后';
    }

    return '<article class="ct-item is-' + status + '" data-platform="' + esc(item.platform) + '">' +
      '<div class="ct-item-left">' +
        '<span class="ct-platform-name"><span class="ct-dot"></span>' + esc(platform.label) + '</span>' +
        '<div class="ct-time-block">' + esc(timeLabel(new Date(item.start))) + '</div>' +
        '<div class="ct-duration">' + esc(durationLabel(item.durationMinutes)) + (timeHint ? ' · ' + esc(timeHint) : '') + '</div>' +
      '</div>' +
      '<div class="ct-item-main">' +
        '<a class="ct-item-title" href="' + esc(safeUrl(item.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(item.name) + '</a>' +
        '<div class="ct-item-meta">' +
          '<span class="ct-status ' + info.cls + '">' + esc(info.label) + '</span>' +
          '<span>' + esc(rangeLabel(item)) + '</span>' +
          (item.rated ? '<span class="ct-badge ct-badge-rated">' + esc(item.rated) + '</span>' : '') +
        '</div>' +
        (item.note ? '<p class="ct-item-note">' + esc(item.note) + '</p>' : '') +
      '</div>' +
      '<div class="ct-item-side">' +
        '<a class="ct-go" href="' + esc(safeUrl(item.url)) + '" target="_blank" rel="noopener noreferrer">去比赛 <i class="fa fa-angle-right" aria-hidden="true"></i></a>' +
      '</div>' +
    '</article>';
  }

  function renderList() {
    if (!els.list) return;
    var items = getFilteredItems();
    var upcoming = items.filter(function (item) { return getStatus(item) === 'upcoming'; }).length;

    if (els.result) {
      els.result.innerHTML = '共 <strong>' + items.length + '</strong> 场比赛' +
        (upcoming ? ' · 即将开始 <strong>' + upcoming + '</strong> 场' : '');
    }

    if (!items.length) {
      els.list.innerHTML = '';
      if (els.empty) els.empty.hidden = false;
      return;
    }

    if (els.empty) els.empty.hidden = true;

    var groups = [];
    var currentKey = '';
    var currentGroup = null;
    items.forEach(function (item) {
      var key = dateKey(new Date(item.start));
      if (key !== currentKey) {
        currentKey = key;
        currentGroup = { key: key, label: dateLabel(new Date(item.start)), items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    });

    els.list.innerHTML = groups.map(function (group) {
      return '<section class="ct-day">' +
        '<h2 class="ct-day-title">' + esc(group.label) + '</h2>' +
        '<div class="ct-day-list">' + group.items.map(itemHTML).join('') + '</div>' +
      '</section>';
    }).join('');
  }

  function renderAll() {
    renderStats();
    renderPlatforms();
    renderList();
    renderSources();
  }

  function cacheElements() {
    els = {
      platforms: root.querySelector('#ct-platforms'),
      statUpcoming: root.querySelector('#ct-stat-upcoming'),
      statRunning: root.querySelector('#ct-stat-running'),
      statWeek: root.querySelector('#ct-stat-week'),
      statUpdated: root.querySelector('#ct-stat-updated'),
      status: root.querySelector('#ct-status'),
      range: root.querySelector('#ct-range'),
      result: root.querySelector('#ct-result'),
      list: root.querySelector('#ct-list'),
      empty: root.querySelector('#ct-empty'),
      sources: root.querySelector('#ct-sources')
    };
  }

  function bindEvents() {
    if (els.platforms) {
      els.platforms.addEventListener('click', function (event) {
        var button = event.target.closest('[data-platform]');
        if (!button) return;
        state.platform = button.getAttribute('data-platform') || 'all';
        renderAll();
      });
    }

    if (els.status) {
      els.status.addEventListener('change', function () {
        state.status = els.status.value || 'all';
        renderAll();
      });
    }

    if (els.range) {
      els.range.addEventListener('change', function () {
        state.range = els.range.value || 'all';
        renderAll();
      });
    }
  }

  function readInlineData() {
    var node = document.getElementById('contests-data');
    if (!node) return null;
    try {
      return JSON.parse(node.textContent || node.innerHTML || '{}');
    } catch (error) {
      return null;
    }
  }

  function finishWithError(message) {
    if (els.result) els.result.textContent = message;
    if (els.empty) els.empty.hidden = false;
    if (els.list) els.list.innerHTML = '';
  }

  function fetchFallbackData() {
    var url = (root && root.getAttribute('data-data-url')) || '/contests/data.json';
    if (els.result) els.result.textContent = '正在加载比赛…';
    if (typeof window.fetch !== 'function') {
      finishWithError('当前浏览器不支持 fetch，无法加载比赛数据。');
      return;
    }
    window.fetch(url, { cache: 'no-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.items)) throw new Error('数据格式异常');
        setData(data);
      })
      .catch(function () {
        finishWithError('比赛数据加载失败，请稍后刷新。');
      });
  }

  function init() {
    var app = document.getElementById('contests-app');
    if (!app) return;
    if (app.getAttribute('data-ct-ready') === '1') return;

    app.setAttribute('data-ct-ready', '1');
    root = app;
    cacheElements();
    if (!els.list || !els.platforms) return;

    bindEvents();

    var inline = readInlineData();
    if (inline && Array.isArray(inline.items) && inline.items.length) {
      setData(inline);
    } else {
      fetchFallbackData();
    }
  }

  function bindGlobalOnce() {
    if (globalBound) return;
    globalBound = true;

    if (window.jQuery) {
      window.jQuery(document)
        .on('pjax:complete', init)
        .on('pjax:success', init)
        .on('pjax:end', init);
    }
  }

  // 即使当前不是比赛页，也要先绑定 PJAX；否则从首页第一次进入时不会初始化。
  bindGlobalOnce();

  if (document.getElementById('contests-app')) {
    init();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.initContests = init;
})();
