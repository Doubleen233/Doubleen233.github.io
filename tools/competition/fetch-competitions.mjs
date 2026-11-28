#!/usr/bin/env node
/**
 * 赛事数据抓取 / 聚合脚本
 * ---------------------------------------------------------------
 * 设计原则：
 * 1. 构建期运行，只做少量、低频的公开页面请求，不在浏览器端跨域抓取；
 * 2. 每个来源单次运行最多请求一次，失败不重试轰炸；
 * 3. 任何来源失败都不阻塞构建，使用缓存 + 人工收录数据兜底；
 * 4. 输出同时写入 source/_data/competitions.json 与 source/competition/data.json。
 *
 * 用法：
 *   node tools/competition/fetch-competitions.mjs
 *   node tools/competition/fetch-competitions.mjs --offline
 *   node tools/competition/fetch-competitions.mjs --only=thirdplayer,manual
 *   node tools/competition/fetch-competitions.mjs --dry-run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CACHE_DIR = path.join(ROOT, '.cache', 'competition');
const DATA_DIR = path.join(ROOT, 'source', '_data');
const PAGE_DATA_DIR = path.join(ROOT, 'source', 'competition');
const MANUAL_FILE = path.join(__dirname, 'manual.json');

const USER_AGENT =
  'SakuraCompetitionBot/1.0 (+https://doubleen233.github.io/competition/; build-time one-shot fetch)';

const SOURCES = {
  thirdplayer: {
    name: '第三方赛事聚合',
    url: 'https://competition.thirdplayer.cn/',
    dataUrl: 'https://competition.thirdplayer.cn/data.js'
  },
  huaweicloud: {
    name: '华为云开发者大赛',
    url: 'https://developer.huaweicloud.com/competition/list',
    api: 'https://devdata2.huaweicloud.com/rest/developer/fwdo/rest/developer/servlet/hdcompetitionservice/v1/competition/get-competition-list',
    categoryId: 'a849fed4b5fa11ef9f37fa163ebe27b7'
  },
  harmonyos: {
    name: '华为开发者联盟 · HarmonyOS',
    url: 'https://developer.huawei.com/consumer/cn/activity/digixActivity/',
    api: 'https://svc-drcn.developer.huawei.com/community/servlet/consumer/partnerActivityService/v1/developer/activity/terminalActivities/overviewActivity'
  },
  gitcode: {
    name: 'GitCode 赛事平台',
    url: 'https://competition.gitcode.com/',
    api: 'https://web-api.gitcode.com/aihub/api/v1/activity/page'
  }
};

const args = new Set(process.argv.slice(2));
const OFFLINE = args.has('--offline');
const DRY_RUN = args.has('--dry-run');
const onlyArg = [...args].find((a) => a.startsWith('--only='));
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

async function request(url, options = {}) {
  const { method = 'GET', body, headers = {}, timeout = 15000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      body,
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/json,text/plain,text/html;q=0.8,*/*;q=0.5',
        ...headers
      }
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, contentType: res.headers.get('content-type') || '' };
  } finally {
    clearTimeout(timer);
  }
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateString(value) {
  if (!value) return '';
  if (typeof value === 'number') {
    const d = new Date(value < 1e12 ? value * 1000 : value);
    return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const text = String(value).trim();
  if (!text) return '';
  const matched = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (matched) {
    return `${matched[1]}-${pad(matched[2])}-${pad(matched[3])}`;
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pick(obj, keys, fallback = '') {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return fallback;
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,，、|/]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeThirdplayer(raw) {
  return {
    id: `tp-${raw.id ?? raw.name}`,
    name: String(raw.name || '').trim(),
    organizer: String(raw.organizer || '未知').trim(),
    level: String(raw.level || '其他').trim(),
    type: String(raw.type || '综合').trim(),
    tags: toStringArray(raw.keywords),
    registrationStart: toDateString(raw.regStart),
    registrationEnd: toDateString(raw.deadline),
    competitionStart: toDateString(raw.compStart),
    competitionEnd: toDateString(raw.compEnd),
    prize: String(raw.prize || '以官网公布为准').trim(),
    url: String(raw.url || SOURCES.thirdplayer.url).trim(),
    participants: String(raw.participants || '').trim(),
    source: 'thirdplayer',
    sourceName: SOURCES.thirdplayer.name,
    sourceUrl: SOURCES.thirdplayer.url,
    verified: true,
    note: ''
  };
}

function formatPrize(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '以官网公布为准';
  return '¥' + amount.toLocaleString('zh-CN');
}

function inferLevel(name, extra = '') {
  const title = String(name || '');
  const text = `${title} ${extra || ''}`;
  if (/国际|全球|亚太|ICPC/i.test(text)) return '国际级';
  if (/全国|中国|国家|挑战杯|大学生|高校|CCF|教育部/.test(text)) return '国家级';
  if (/省级|省赛|省赛区/.test(text)) return '省级';
  // 校级只看赛事名称，避免主办方里出现某所大学就被误判为校内赛。
  if (/大学|学院|校园|学校|职业技术/.test(title)) return '校级';
  // “企业级”只按赛事名称判断，避免所有由公司/平台主办的比赛都被标成企业级。
  if (/企业|公司|集团|内部|厂商|生态伙伴/.test(title)) return '企业级';
  return '其他';
}

function parseTimeline(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) return parsed;
    return Array.isArray(parsed.activityTimeLine) ? parsed.activityTimeLine : [];
  } catch {
    return [];
  }
}

function timelineDate(entries, patterns) {
  for (const entry of entries) {
    const label = String(entry.timeName || entry.name || entry.label || '');
    if (!patterns.some((pattern) => pattern.test(label))) continue;
    const date = toDateString(entry.activityDate || entry.date || entry.time || entry.value);
    if (date) return date;
  }
  return '';
}

function gitcodeType(codes, name) {
  const typeCodes = Array.isArray(codes) ? codes.map(Number) : [];
  const map = [
    [5, 'CANN / 算子'],
    [7, '开源鸿蒙'],
    [4, '昇腾 / AI 算力'],
    [8, 'AI Agent'],
    [9, '云 / AI 编程'],
    [3, '开源征稿']
  ];
  for (const [code, label] of map) {
    if (typeCodes.includes(code)) return label;
  }
  if (/CANN|HCCL|算子/.test(name)) return 'CANN / 算子';
  if (/昇腾/.test(name)) return '昇腾 / AI 算力';
  if (/鸿蒙|HarmonyOS/i.test(name)) return '开源鸿蒙';
  if (/Agent|智能体/i.test(name)) return 'AI Agent';
  if (/征文|征稿/.test(name)) return '开源征稿';
  if (typeCodes.includes(1)) return 'AI / 应用开发';
  if (typeCodes.includes(6)) return '高校 / 社区';
  if (typeCodes.includes(2)) return '模型优化';
  if (/算法|编程/.test(name)) return '编程算法';
  return '综合';
}

function huaweiType(name) {
  if (/算法|算子|编程|CodeArts|码道/.test(name)) return '编程算法';
  if (/嵌入式|硬件|射频|终端|芯片/.test(name)) return '硬件与嵌入式';
  if (/智能体|Agent|AI|大模型|模型|昇腾|CANN/i.test(name)) return 'AI 与算力';
  if (/应用|创新|创业|设计/.test(name)) return '应用开发';
  return '综合';
}

function keywordTags(name, extra = []) {
  const keywords = ['华为云', 'CodeArts', '码道', 'Agent', '智能体', 'AI', '大模型', '昇腾', 'CANN', '鸿蒙', '算法', '算子', '嵌入式', '硬件', '射频', '量子', '脑机', 'ICPC', '挑战杯', '开源'];
  const tags = keywords.filter((keyword) => String(name || '').includes(keyword));
  return [...new Set([...tags, ...extra])].slice(0, 6);
}

function normalizeHuaweicloud(raw) {
  const name = String(raw.title || '').trim();
  const detailType = Number(raw.type) === 1 ? 'advance' : 'information';
  const url = String(raw.link_url || `https://developer.huaweicloud.com/competition/${detailType}/${raw.url_id}`);
  return {
    id: `huaweicloud-${raw.competition_id || raw.url_id || name}`,
    name,
    organizer: String(raw.organizers || '华为云').trim(),
    level: inferLevel(name, raw.organizers || ''),
    type: huaweiType(name),
    tags: keywordTags(name, [raw.current_stage_Name || '']),
    registrationStart: toDateString(raw.start_time),
    registrationEnd: toDateString(raw.countdown) || toDateString(raw.end_time),
    competitionStart: toDateString(raw.start_time),
    competitionEnd: toDateString(raw.end_time),
    prize: formatPrize(raw.bonus),
    url,
    participants: raw.is_show_registered_num && raw.registered_person_num ? `${raw.registered_person_num} 人报名` : '',
    source: 'huaweicloud',
    sourceName: SOURCES.huaweicloud.name,
    sourceUrl: SOURCES.huaweicloud.url,
    verified: true,
    note: ''
  };
}

function normalizeGitcode(raw) {
  const name = String(raw.activity_name || '').trim();
  const timeline = parseTimeline(raw.activity_time_line);
  return {
    id: `gitcode-${raw.activity_id || raw.id || name}`,
    name,
    organizer: String(raw.sponsor || 'GitCode').trim(),
    // GitCode 平台赛事统一归为企业级（按站点约定，不再按名称推断级别）。
    level: '企业级',
    type: gitcodeType(raw.competition_type, name),
    tags: keywordTags(name, raw.type_labels || []),
    registrationStart: timelineDate(timeline, [/报名.*开始/]) || toDateString(raw.activity_start_time),
    registrationEnd: timelineDate(timeline, [/报名.*(截止|结束)/]),
    competitionStart: timelineDate(timeline, [/(比赛|活动|开赛).*开始/]) || toDateString(raw.activity_start_time),
    competitionEnd: timelineDate(timeline, [/(比赛|活动).*结束/]) || toDateString(raw.activity_end_time),
    prize: formatPrize(raw.prize_amount),
    url: `https://competition.gitcode.com/competition/${raw.activity_id}/intro`,
    participants: raw.current_participants ? `${raw.current_participants} 人报名` : '',
    source: 'gitcode',
    sourceName: SOURCES.gitcode.name,
    sourceUrl: SOURCES.gitcode.url,
    verified: true,
    note: ''
  };
}

function normalizeGeneric(raw, sourceId) {
  const source = SOURCES[sourceId];
  return {
    id: `${sourceId}-${raw.id ?? raw.name ?? Math.random().toString(36).slice(2)}`,
    name: String(pick(raw, ['name', 'title', 'activityName', 'competitionName'], '')).trim(),
    organizer: String(pick(raw, ['organizer', 'host', 'sponsor', 'organizerName', 'hostName'], '未知')).trim(),
    level: String(pick(raw, ['level', 'competitionLevel', 'levelName'], '其他')).trim(),
    type: String(pick(raw, ['type', 'competitionType', 'typeName', 'category'], '综合')).trim(),
    tags: toStringArray(pick(raw, ['tags', 'keywords', 'labels'], [])),
    registrationStart: toDateString(
      pick(raw, ['registrationStart', 'regStart', 'enrollStartTime', 'signUpStartTime', 'applyStartTime'])
    ),
    registrationEnd: toDateString(
      pick(raw, ['registrationEnd', 'deadline', 'enrollEndTime', 'signUpEndTime', 'applyEndTime', 'endTime'])
    ),
    competitionStart: toDateString(
      pick(raw, ['competitionStart', 'compStart', 'contestStartTime', 'startTime', 'beginTime'])
    ),
    competitionEnd: toDateString(
      pick(raw, ['competitionEnd', 'compEnd', 'contestEndTime', 'finishTime'])
    ),
    prize: String(pick(raw, ['prize', 'award', 'bonus', 'reward'], '以官网公布为准')).trim(),
    url: String(pick(raw, ['url', 'link', 'detailUrl', 'activityUrl'], source.url)).trim(),
    participants: String(pick(raw, ['participants', 'target', 'audience'], '')).trim(),
    source: sourceId,
    sourceName: source.name,
    sourceUrl: source.url,
    verified: true,
    note: ''
  };
}

/** 在任意 JSON 结构中寻找“看起来像赛事”的数组，作为接口字段变化时的兜底。 */
function findCompetitionArray(node, depth = 0) {
  if (!node || depth > 6) return null;
  if (Array.isArray(node)) {
    const looksLikeCompetition = node.some(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item.name || item.title || item.activityName || item.competitionName) &&
        (item.startTime || item.regStart || item.registrationStart || item.enrollStartTime || item.url)
    );
    if (looksLikeCompetition) return node;
    for (const item of node) {
      const found = findCompetitionArray(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node === 'object') {
    const preferredKeys = ['records', 'list', 'rows', 'items', 'data', 'result', 'activityList', 'competitionList'];
    for (const key of preferredKeys) {
      if (key in node) {
        const found = findCompetitionArray(node[key], depth + 1);
        if (found) return found;
      }
    }
    for (const value of Object.values(node)) {
      const found = findCompetitionArray(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

async function fetchThirdplayer() {
  const cacheFile = path.join(CACHE_DIR, 'thirdplayer-data.js');
  let text = null;
  let fromCache = false;

  if (!OFFLINE) {
    try {
      const res = await request(SOURCES.thirdplayer.dataUrl, {
        headers: { referer: SOURCES.thirdplayer.url }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.text.includes('competitionData')) throw new Error('响应中未找到 competitionData');
      text = res.text;
      await ensureDir(CACHE_DIR);
      await fs.writeFile(cacheFile, text, 'utf8');
    } catch (error) {
      const cached = await readText(cacheFile);
      if (!cached) throw error;
      text = cached;
      fromCache = true;
    }
  } else {
    text = await readText(cacheFile);
    if (!text) throw new Error('离线模式下没有 thirdplayer 缓存');
    fromCache = true;
  }

  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(text, sandbox, { timeout: 5000 });
  if (!Array.isArray(sandbox.competitionData)) throw new Error('competitionData 不是数组');

  return {
    items: sandbox.competitionData.map(normalizeThirdplayer).filter((item) => item.name),
    message: fromCache ? '使用本地缓存（未发起网络请求）' : '抓取成功'
  };
}

async function fetchHuaweicloud() {
  const cacheFile = path.join(CACHE_DIR, 'huaweicloud.json');
  if (OFFLINE) {
    const cached = await readText(cacheFile);
    if (!cached) throw new Error('离线模式下没有华为云缓存');
    const list = JSON.parse(cached);
    return { items: list.map(normalizeHuaweicloud).filter((item) => item.name), message: '使用本地缓存' };
  }

  // 华为云大赛列表页使用的公开接口。参数来自页面自身的请求：
  // statuses: 0=进行中, 1=未开始, 2=已结束；offset 从 1 开始。
  const basePayload = {
    category_id: SOURCES.huaweicloud.categoryId,
    track_id: '',
    technology_id: '',
    name: ''
  };
  const requests = [
    { statuses: '0', limit: 100, offset: 1 },
    { statuses: '1', limit: 100, offset: 1 },
    { statuses: '2', limit: 20, offset: 1 }
  ];
  const rawItems = [];
  for (const params of requests) {
    const res = await request(SOURCES.huaweicloud.api, {
      method: 'POST',
      body: JSON.stringify({ ...basePayload, ...params }),
      headers: {
        'content-type': 'application/json;charset=UTF-8',
        origin: 'https://competition.huaweicloud.com',
        referer: 'https://competition.huaweicloud.com/competition/list',
        accept: 'application/json'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let json;
    try {
      json = JSON.parse(res.text);
    } catch {
      throw new Error('接口返回非 JSON（可能被网关或风控拦截）');
    }
    if (json.error_code || json.error_msg) {
      throw new Error(`${json.error_code || 'API'} ${json.error_msg || '接口报错'}`);
    }
    if (!Array.isArray(json.results)) throw new Error('响应中未找到赛事列表');
    rawItems.push(...json.results);
  }

  const seen = new Set();
  const list = rawItems.filter((item) => {
    const key = String(item.competition_id || item.url_id || item.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  await ensureDir(CACHE_DIR);
  await fs.writeFile(cacheFile, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
  const items = list.map(normalizeHuaweicloud).filter((item) => item.name);
  return { items, message: `抓取成功（${items.length} 条）` };
}

async function fetchHarmonyOS() {
  const cacheFile = path.join(CACHE_DIR, 'harmonyos.json');
  if (OFFLINE) {
    const cached = await readText(cacheFile);
    if (!cached) throw new Error('离线模式下没有 HarmonyOS 缓存');
    const list = JSON.parse(cached);
    return { items: list.map((item) => normalizeGeneric(item, 'harmonyos')), message: '使用本地缓存' };
  }

  const payload = {
    belong: 1,
    count: 50,
    displayChannel: [1, 3],
    language: 'cn',
    orderBy: 'desc',
    pagestart: 1,
    status: 0,
    type: '5',
    digixType: '0'
  };
  const res = await request(SOURCES.harmonyos.api, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      origin: 'https://developer.huawei.com',
      referer: SOURCES.harmonyos.url
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let json;
  try {
    json = JSON.parse(res.text);
  } catch {
    throw new Error('接口返回非 JSON（可能需要浏览器环境 / 风控 Cookie）');
  }
  const list = findCompetitionArray(json);
  if (!list) {
    throw new Error('接口可访问，但字段为 activityStartTime/signStartTime/activityURL，通用解析器尚未适配；已使用人工收录');
  }
  await ensureDir(CACHE_DIR);
  await fs.writeFile(cacheFile, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
  return { items: list.map((item) => normalizeGeneric(item, 'harmonyos')), message: `抓取成功（${list.length} 条）` };
}

async function fetchGitcode() {
  const cacheFile = path.join(CACHE_DIR, 'gitcode.json');
  if (OFFLINE) {
    const cached = await readText(cacheFile);
    if (!cached) throw new Error('离线模式下没有 GitCode 缓存');
    const list = JSON.parse(cached);
    return { items: list.map(normalizeGitcode).filter((item) => item.name), message: '使用本地缓存' };
  }

  // GitCode 赛事页是 Next.js App Router，HTML 只有骨架屏；
  // 实际列表来自页面自身调用的 /aihub/api/v1/activity/page。
  const perPage = 100;
  const rawItems = [];
  let total = Infinity;
  for (let page = 1; page <= 10 && rawItems.length < total; page += 1) {
    const res = await request(`${SOURCES.gitcode.api}?page=${page}&per_page=${perPage}`, {
      headers: {
        accept: 'application/json',
        origin: SOURCES.gitcode.url,
        referer: `${SOURCES.gitcode.url}/`
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let json;
    try {
      json = JSON.parse(res.text);
    } catch {
      throw new Error('接口返回非 JSON');
    }
    const content = Array.isArray(json.content) ? json.content : [];
    total = Number(json.total) || content.length;
    rawItems.push(...content);
    if (!content.length) break;
  }

  // 保留进行中/待开始，以及最近 90 天结束的赛事，避免把多年历史数据全部塞进页面。
  const cutoff = Date.now() - 90 * 86400000;
  const candidate = rawItems.filter((raw) => {
    if (raw.is_hide === 1 || raw.is_hide === true) return false;
    if (String(raw.publish_status) !== '1') return false;
    const status = String(raw.activity_status || '');
    if (status === 'judging') return true;
    if (status === 'completed') {
      const end = toDateString(raw.activity_end_time);
      return end ? new Date(`${end}T00:00:00Z`).getTime() >= cutoff : false;
    }
    return status === 'unstart' || status === 'published';
  });

  const seen = new Set();
  const list = candidate.filter((item) => {
    const key = String(item.activity_id || item.id || item.activity_name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  await ensureDir(CACHE_DIR);
  await fs.writeFile(cacheFile, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
  const items = list.map(normalizeGitcode).filter((item) => item.name);
  return { items, message: `抓取成功（${items.length} 条）` };
}

async function loadManual() {
  const text = await readText(MANUAL_FILE);
  if (!text) return { items: [], message: '未找到 manual.json' };
  const list = JSON.parse(text);
  const items = list.map((raw) => ({
    ...normalizeGeneric(raw, raw.source || 'manual'),
    id: String(raw.id || `manual-${raw.name}`),
    source: raw.source || 'manual',
    sourceName: raw.sourceName || '人工收录',
    sourceUrl: raw.sourceUrl || raw.url || '',
    verified: raw.verified === true,
    note: raw.note || ''
  }));
  return { items, message: `人工收录 ${items.length} 条` };
}

// 只保留中山大学的校内赛；其他高校的校内赛不进入聚合结果。
const TARGET_SCHOOL_RE = /中山大学|SYSU/i;
const OTHER_SCHOOL_ABBRS = ['首经贸', '华科', '北邮'];
const CAMPUS_NAME_RE = /[\u4e00-\u9fa5]{2,20}(?:大学(?!生)|学院|学校|职业技术学院|职业学院|技术学院|师范大学|理工大学|科技大学|工业大学|农业大学|医科大学|财经大学|商业大学|城市学院|工程学院|师范学院)/;

function isOtherCampusInternal(item) {
  const name = String(item.name || '');
  const text = `${name} ${item.organizer || ''}`;
  if (TARGET_SCHOOL_RE.test(text)) return false;
  if (CAMPUS_NAME_RE.test(name)) return true;
  return OTHER_SCHOOL_ABBRS.some((abbr) => name.includes(abbr));
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.name.replace(/[\s·—\-_()（）【】\[\]「」“”"']/g, '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const startedAt = new Date();
  const sources = [];
  const all = [];

  const jobs = [];
  if (enabled('thirdplayer')) jobs.push(['thirdplayer', fetchThirdplayer]);
  if (enabled('huaweicloud')) jobs.push(['huaweicloud', fetchHuaweicloud]);
  if (enabled('harmonyos')) jobs.push(['harmonyos', fetchHarmonyOS]);
  if (enabled('gitcode')) jobs.push(['gitcode', fetchGitcode]);

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

  if (enabled('manual')) {
    try {
      const manual = await loadManual();
      const liveSources = new Set(
        sources.filter((source) => source.status === 'ok' && source.count > 0).map((source) => source.id)
      );
      const manualItems = manual.items.filter((item) => !liveSources.has(item.source));
      const skipped = manual.items.length - manualItems.length;
      all.push(...manualItems);
      sources.push({
        id: 'manual',
        name: '人工收录 / 兜底数据',
        url: '',
        status: 'manual',
        count: manualItems.length,
        message: skipped
          ? `人工收录 ${manualItems.length} 条（${skipped} 条已由官方接口覆盖）`
          : manual.message
      });
      console.log(`[ok] manual: ${manualItems.length} 条${skipped ? `（跳过 ${skipped} 条官方已有数据）` : ''}`);
    } catch (error) {
      console.warn(`[warn] manual: ${error.message || error}`);
    }
  }

  const kept = [];
  const filteredOut = [];
  for (const item of all) {
    if (isOtherCampusInternal(item)) filteredOut.push(item);
    else kept.push(item);
  }
  if (filteredOut.length) {
    console.log(
      `[filter] 排除其他高校校内赛 ${filteredOut.length} 条：` +
        filteredOut.slice(0, 8).map((item) => item.name).join('；') +
        (filteredOut.length > 8 ? ' …' : '')
    );
  }

  const items = dedupe(kept).sort((a, b) => {
    const aDate = a.registrationEnd || a.competitionEnd || '9999-12-31';
    const bDate = b.registrationEnd || b.competitionEnd || '9999-12-31';
    return aDate.localeCompare(bDate);
  });

  // 去重后回填来源数量，避免 GitCode 等来源显示“抓取数”而不是“最终收录数”。
  for (const source of sources) {
    if (source.id === 'manual' || source.status === 'failed') continue;
    source.count = items.filter((item) => item.source === source.id).length;
  }

  const output = {
    updatedAt: startedAt.toISOString(),
    generatedBy: 'tools/competition/fetch-competitions.mjs',
    sources,
    items
  };

  if (DRY_RUN) {
    console.log(`[dry-run] 共 ${items.length} 条，未写入文件。`);
    return;
  }

  await writeJson(path.join(DATA_DIR, 'competitions.json'), output);
  await writeJson(path.join(PAGE_DATA_DIR, 'data.json'), output);
  console.log(`[done] 共 ${items.length} 条 -> source/_data/competitions.json & source/competition/data.json`);
}

main().catch((error) => {
  console.error('[fatal]', error);
  process.exitCode = 1;
});
