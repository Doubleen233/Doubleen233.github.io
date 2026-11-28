#!/usr/bin/env node
/**
 * Codeforces / AtCoder / LeetCode / 牛客网 比赛聚合
 * ---------------------------------------------------------------
 * 构建期运行，只请求各平台公开接口或公开页面。
 * 输出：
 *   source/_data/contests.json
 *   source/contests/data.json
 *
 * 用法：
 *   node tools/contests/fetch-contests.mjs
 *   node tools/contests/fetch-contests.mjs --offline
 *   node tools/contests/fetch-contests.mjs --only=codeforces,atcoder
 *   node tools/contests/fetch-contests.mjs --dry-run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CACHE_DIR = path.join(ROOT, '.cache', 'contests');
const DATA_DIR = path.join(ROOT, 'source', '_data');
const PAGE_DATA_DIR = path.join(ROOT, 'source', 'contests');

const USER_AGENT =
  'SakuraContestBot/1.0 (+https://doubleen233.github.io/contests/; build-time one-shot fetch)';

const NOW = Date.now();
const PAST_WINDOW = NOW - 30 * 86400000;
const FUTURE_WINDOW = NOW + 180 * 86400000;

const SOURCES = {
  codeforces: {
    name: 'Codeforces',
    url: 'https://codeforces.com/contests',
    api: 'https://codeforces.com/api/contest.list?gym=false'
  },
  atcoder: {
    name: 'AtCoder',
    url: 'https://atcoder.jp/contests/',
    api: 'https://atcoder.jp/contests/'
  },
  leetcode: {
    name: 'LeetCode',
    url: 'https://leetcode.cn/contest/',
    api: 'https://leetcode.cn/graphql'
  },
  nowcoder: {
    name: '牛客',
    url: 'https://ac.nowcoder.com/acm/contest/vip-index',
    api: 'https://ac.nowcoder.com/acm/contest/vip-index'
  }
};

const args = new Set(process.argv.slice(2));
const OFFLINE = args.has('--offline');
const DRY_RUN = args.has('--dry-run');
const onlyArg = [...args].find((value) => value.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',').filter(Boolean) : null;

function enabled(id) {
  return !ONLY || ONLY.includes(id);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readText(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
}

async function writeJson(file, value) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readCache(file) {
  const text = await readText(file);
  if (!text) return null;
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

async function writeCache(file, items) {
  await ensureDir(CACHE_DIR);
  await fs.writeFile(file, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 20000);
  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      body: options.body,
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function inWindow(startMs, endMs) {
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= PAST_WINDOW && startMs <= FUTURE_WINDOW;
}

function makeItem({ platform, id, name, url, startMs, endMs, rated = '', note = '' }) {
  return {
    id: `${platform}-${id}`,
    platform,
    platformName: SOURCES[platform].name,
    name: String(name || '').trim(),
    url: String(url || SOURCES[platform].url).trim(),
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(endMs).toISOString(),
    durationMinutes: Math.max(1, Math.round((endMs - startMs) / 60000)),
    rated: String(rated || '').trim(),
    note: String(note || '').trim()
  };
}

function dedupe(items) {
  const map = new Map();
  for (const item of items) {
    if (item.name) map.set(item.id, item);
  }
  return [...map.values()];
}

// 牛客会有很多“XX大学/学院”的校内赛；这里只保留中山大学和公开赛事。
const TARGET_SCHOOL_RE = /中山大学|SYSU/i;
const OTHER_SCHOOL_ABBRS = ['首经贸', '华科', '北邮', '河南工大', 'HAUT', 'DNUI', 'DUE', '大连东软'];
const CAMPUS_NAME_RE = /[\u4e00-\u9fa5]{2,20}(?:大学(?!生)|学院|学校|职业技术|师范大学|理工大学|科技大学|工业大学|农业大学|医科大学|财经大学|商业大学|城市学院|工程学院|师范学院)/;

function isOtherCampusContest(name, extra = '') {
  const title = String(name || '');
  const text = `${title} ${extra || ''}`;
  if (TARGET_SCHOOL_RE.test(text)) return false;
  if (CAMPUS_NAME_RE.test(title) || CAMPUS_NAME_RE.test(extra)) return true;
  return OTHER_SCHOOL_ABBRS.some((abbr) => text.includes(abbr));
}

async function fetchCodeforces() {
  const cacheFile = path.join(CACHE_DIR, 'codeforces.json');
  if (OFFLINE) {
    const cached = await readCache(cacheFile);
    if (!cached) throw new Error('离线模式下没有 Codeforces 缓存');
    return { items: cached, message: '使用本地缓存' };
  }

  try {
    const text = await request(SOURCES.codeforces.api);
    const json = JSON.parse(text);
    if (json.status !== 'OK' || !Array.isArray(json.result)) {
      throw new Error('Codeforces 返回格式异常');
    }
    const items = json.result
      .filter((contest) => contest.startTimeSeconds && contest.durationSeconds)
      .filter((contest) => !/practice/i.test(contest.name))
      .filter((contest) =>
        inWindow(
          contest.startTimeSeconds * 1000,
          (contest.startTimeSeconds + contest.durationSeconds) * 1000
        )
      )
      .map((contest) =>
        makeItem({
          platform: 'codeforces',
          id: contest.id,
          name: contest.name,
          url: `https://codeforces.com/contest/${contest.id}`,
          startMs: contest.startTimeSeconds * 1000,
          endMs: (contest.startTimeSeconds + contest.durationSeconds) * 1000,
          rated: contest.type === 'CF' ? 'Rated' : contest.type,
          note: contest.phase === 'BEFORE' ? '未开始' : contest.phase === 'CODING' ? '进行中' : ''
        })
      );
    await writeCache(cacheFile, items);
    return { items, message: `抓取成功（${items.length} 条）` };
  } catch (error) {
    const cached = await readCache(cacheFile);
    if (cached) return { items: cached, message: `使用本地缓存（${error.message}）` };
    throw error;
  }
}

function parseAtCoderTime(text) {
  const matched = /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\+0900/.exec(String(text || ''));
  if (!matched) return null;
  // AtCoder 页面时间固定为 JST (UTC+9)
  return Date.UTC(
    Number(matched[1]),
    Number(matched[2]) - 1,
    Number(matched[3]),
    Number(matched[4]) - 9,
    Number(matched[5]),
    Number(matched[6])
  );
}

function parseDuration(text) {
  const matched = /^(\d+):(\d{2})$/.exec(String(text || '').trim());
  return matched ? Number(matched[1]) * 60 + Number(matched[2]) : 0;
}

function atCoderRated(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value || value === '-') return 'Unrated';
  if (/^all$/i.test(value)) return 'Rated (All)';
  return `Rated (${value})`;
}

async function fetchAtCoder() {
  const cacheFile = path.join(CACHE_DIR, 'atcoder.json');
  if (OFFLINE) {
    const cached = await readCache(cacheFile);
    if (!cached) throw new Error('离线模式下没有 AtCoder 缓存');
    return { items: cached, message: '使用本地缓存' };
  }

  try {
    const html = await request(SOURCES.atcoder.api, {
      headers: { accept: 'text/html,application/xhtml+xml' }
    });
    const $ = cheerio.load(html);
    const all = [];
    for (const selector of ['#contest-table-upcoming tbody tr', '#contest-table-recent tbody tr']) {
      $(selector).each((_, row) => {
        const timeText = $(row).find('time.fixtime').first().text().trim();
        const link = $(row).find('a[href^="/contests/"]').last();
        const href = link.attr('href');
        const name = link.text().trim();
        const startMs = parseAtCoderTime(timeText);
        if (!href || !name || !startMs) return;
        const cells = $(row).find('td');
        const durationMinutes = parseDuration($(cells[2]).text());
        if (!durationMinutes || durationMinutes > 7 * 24 * 60) return;
        const endMs = startMs + durationMinutes * 60000;
        if (!inWindow(startMs, endMs)) return;
        all.push(
          makeItem({
            platform: 'atcoder',
            id: href.replace('/contests/', ''),
            name,
            url: `https://atcoder.jp${href}`,
            startMs,
            endMs,
            rated: atCoderRated($(cells[3]).text())
          })
        );
      });
    }
    const items = dedupe(all);
    await writeCache(cacheFile, items);
    return { items, message: `抓取成功（${items.length} 条）` };
  } catch (error) {
    const cached = await readCache(cacheFile);
    if (cached) return { items: cached, message: `使用本地缓存（${error.message}）` };
    throw error;
  }
}

async function fetchLeetCode() {
  const cacheFile = path.join(CACHE_DIR, 'leetcode.json');
  if (OFFLINE) {
    const cached = await readCache(cacheFile);
    if (!cached) throw new Error('离线模式下没有 LeetCode 缓存');
    return { items: cached, message: '使用本地缓存' };
  }

  try {
    const text = await request(SOURCES.leetcode.api, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://leetcode.cn',
        referer: 'https://leetcode.cn/contest/'
      },
      body: JSON.stringify({
        query: '{ allContests { title titleSlug startTime duration } }'
      })
    });
    const json = JSON.parse(text);
    const list = json?.data?.allContests;
    if (!Array.isArray(list)) throw new Error('LeetCode 返回格式异常');
    const items = list
      .filter((contest) => contest.startTime && contest.duration)
      .filter((contest) => inWindow(contest.startTime * 1000, (contest.startTime + contest.duration) * 1000))
      .map((contest) =>
        makeItem({
          platform: 'leetcode',
          id: contest.titleSlug,
          name: contest.title,
          url: `https://leetcode.cn/contest/${contest.titleSlug}/`,
          startMs: contest.startTime * 1000,
          endMs: (contest.startTime + contest.duration) * 1000,
          rated: 'Rated'
        })
      );
    await writeCache(cacheFile, items);
    return { items, message: `抓取成功（${items.length} 条）` };
  } catch (error) {
    const cached = await readCache(cacheFile);
    if (cached) return { items: cached, message: `使用本地缓存（${error.message}）` };
    throw error;
  }
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchNowCoder() {
  const cacheFile = path.join(CACHE_DIR, 'nowcoder.json');
  if (OFFLINE) {
    const cached = await readCache(cacheFile);
    if (!cached) throw new Error('离线模式下没有牛客缓存');
    return { items: cached, message: '使用本地缓存' };
  }

  try {
    const all = [];
    const errors = [];
    for (const category of ['13', '14']) {
      try {
        const html = await request(`${SOURCES.nowcoder.api}?topCategoryFilter=${category}`, {
          headers: { accept: 'text/html,application/xhtml+xml' }
        });
        const $ = cheerio.load(html);
        $('.platform-item').each((_, element) => {
          const raw = $(element).attr('data-json');
          if (!raw) return;
          let data;
          try {
            data = JSON.parse(decodeEntities(raw));
          } catch {
            return;
          }
          const startMs = Number(data.contestStartTime);
          const endMs = Number(data.contestEndTime);
          if (!inWindow(startMs, endMs)) return;
          const name = String(data.contestName || '').trim();
          if (!name || name.includes('重现赛') || isOtherCampusContest(name, data.settingInfo?.organizerName)) return;
          const setting = data.settingInfo || {};
          all.push(
            makeItem({
              platform: 'nowcoder',
              id: data.contestId,
              name,
              url: `https://ac.nowcoder.com/acm/contest/${data.contestId}`,
              startMs,
              endMs,
              rated: setting.ratingUpperLimit ? 'Rated' : '',
              note: setting.organizerName || ''
            })
          );
        });
      } catch (error) {
        errors.push(`${category}: ${error.message}`);
      }
    }
    const items = dedupe(all);
    if (!items.length && errors.length) throw new Error(errors.join('; '));
    await writeCache(cacheFile, items);
    return {
      items,
      message: errors.length ? `抓取成功（${items.length} 条，部分分类失败）` : `抓取成功（${items.length} 条）`
    };
  } catch (error) {
    const cached = await readCache(cacheFile);
    if (cached) return { items: cached, message: `使用本地缓存（${error.message}）` };
    throw error;
  }
}

async function main() {
  const startedAt = new Date();
  const jobs = [];
  if (enabled('codeforces')) jobs.push(['codeforces', fetchCodeforces]);
  if (enabled('atcoder')) jobs.push(['atcoder', fetchAtCoder]);
  if (enabled('leetcode')) jobs.push(['leetcode', fetchLeetCode]);
  if (enabled('nowcoder')) jobs.push(['nowcoder', fetchNowCoder]);

  const sources = [];
  const all = [];
  for (const [id, job] of jobs) {
    const source = SOURCES[id];
    try {
      const result = await job();
      all.push(...result.items);
      sources.push({
        id,
        name: source.name,
        url: source.url,
        status: 'ok',
        count: result.items.length,
        message: result.message
      });
      console.log(`[ok] ${id}: ${result.items.length} 条 - ${result.message}`);
    } catch (error) {
      sources.push({
        id,
        name: source.name,
        url: source.url,
        status: 'failed',
        count: 0,
        message: String(error.message || error)
      });
      console.warn(`[warn] ${id}: ${error.message || error}`);
    }
  }

  const items = dedupe(all).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const output = {
    updatedAt: startedAt.toISOString(),
    generatedBy: 'tools/contests/fetch-contests.mjs',
    timezone: 'Asia/Shanghai',
    sources,
    items
  };

  if (DRY_RUN) {
    console.log(`[dry-run] 共 ${items.length} 条，未写入文件。`);
    return;
  }

  await writeJson(path.join(DATA_DIR, 'contests.json'), output);
  await writeJson(path.join(PAGE_DATA_DIR, 'data.json'), output);
  console.log(`[done] 共 ${items.length} 条 -> source/_data/contests.json & source/contests/data.json`);
}

main().catch((error) => {
  console.error('[fatal]', error);
  process.exitCode = 1;
});
