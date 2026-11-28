# 赛事聚合模块（`/competition/`）

本模块在现有 Hexo Sakura 博客中增加一个独立的赛事聚合页，聚合公开渠道的编程、AI、创新创业等赛事信息，提供列表与日历两种视图，并支持筛选、排序、分页、详情弹窗和人工录入。

页面地址：

- 列表视图：`/competition/`
- 日历视图：`/competition/?view=calendar` 或 `/competition/#calendar`

> 数据截至 2026-11-27 的本地快照为 76 条（第三方聚合 26 条 + 华为云 6 条 + GitCode 41 条 + HarmonyOS 人工兜底 3 条），其中 25 条报名中、13 条未开始、18 条进行中、20 条已结束。已过滤其他高校的校内赛；实际数量以重新抓取后的 `source/_data/competitions.json` 为准。

---

## 1. 功能概览

### 列表视图

- 关键词搜索：赛事名称、主办方、标签、类型。
- 时间范围筛选：全部、7 天内截止、30 天内截止、90 天内截止、本月截止、已截止报名。
- 赛事级别筛选：国际级、国家级、省级、校级、企业级、其他（按数据中实际出现的级别动态生成）。
- 赛事状态筛选：报名中、未开始、进行中、已结束。
- 赛事类型筛选：AI 与算力、CANN / 算子、昇腾 / AI 算力、开源鸿蒙、AI Agent、云 / AI 编程、应用开发、编程算法、开源征稿、创新创业等（动态生成）。
- 排序：
  - 即将截止优先（默认）
  - 报名截止从早到晚
  - 报名开始从早到晚
  - 名称 A → Z
- 分页：每页 9 条。
- 卡片信息：名称、主办方、级别、类型、状态、报名/比赛时间、奖金、标签、来源站点、详情链接、待核验标记、截止提醒。
- 当前筛选条件会以标签形式展示，可单独移除或一键重置。

### 日历视图

- 月历网格，默认标记**报名截止日**。
- 上个月 / 下个月 / 回到本月。
- 日历内按级别、状态筛选。
- 鼠标悬停日期时显示当天赛事提示。
- 点击日期打开当天赛事清单，可继续打开详情。
- 日历下方展示当月赛事议程（按报名截止日排序）。

### 其他

- 响应式布局，适配桌面与手机。
- 与 Sakura 主题的橙色主色 `#FE9600` 保持一致。
- 支持 PJAX：从其他页面进入 `/competition/` 或从本页离开再返回时，脚本会自动重新初始化且不会重复绑定事件。
- 人工录入：数据保存在浏览器 `localStorage`，可删除、清空、导出。
- 数据来源状态展示：成功、失败、人工兜底会以不同颜色标识。

---

## 2. 文件结构

```text
.
├─ source/
│  ├─ competition/
│  │  ├─ index.md                 # 页面 front matter（layout: competition）
│  │  └─ data.json                # 运行时 fetch 兜底数据，构建后复制到 public/competition/data.json
│  └─ _data/
│     └─ competitions.json        # 构建期数据，EJS 读取并内联到页面
├─ themes/Sakura/
│  ├─ _config.yml                 # 顶部菜单「赛事」
│  ├─ layout/
│  │  ├─ competition.ejs          # 页面结构、筛选器、弹窗、内联 JSON
│  │  └─ _partial/
│  │     ├─ head.ejs              # 全局引入 competition.css
│  │     └─ footer.ejs            # 全局引入 competition.js
│  └─ source/
│     ├─ css/competition.css      # 页面样式
│     └─ js/competition.js        # 数据加载、筛选、排序、分页、日历、弹窗、人工录入
├─ tools/
│  ├─ competition/
│  │  ├─ fetch-competitions.mjs   # 抓取 / 聚合 / 去重 / 输出 JSON
│  │  └─ manual.json              # 人工兜底数据（当前主要是 HarmonyOS）
│  ├─ compat-util-isdate.cjs      # Node.js 23+ 的 util.isDate 兼容垫片
│  └─ build-static.cjs            # Node.js 23+ 下绕过 Hexo 3.9 零字节输出的静态构建脚本
├─ .cache/competition/            # 抓取缓存（thirdplayer / 华为云 / GitCode），离线时兜底
└─ .github/workflows/
   └─ update-competitions.yml     # 可选的每日数据刷新工作流
```

### 页面入口

`source/competition/index.md`：

```yaml
---
layout: competition
title: 赛事聚合
comments: false
date: '2026-11-27 09:00:00'
keywords: 竞赛,赛事,报名,日历,HarmonyOS,华为云,GitCode
description: 聚合公开渠道的编程、AI、创新创业等赛事信息，支持列表与日历视图、条件筛选和报名截止提醒。
---
```

### 菜单入口

`themes/Sakura/_config.yml`：

```yaml
menu:
  赛事: { path: /competition/, fa: fa-trophy faa-shake }
```

如果菜单文字出现乱码，请确认文件以 UTF-8 保存。

### 全局资源

`themes/Sakura/layout/_partial/head.ejs`：

```html
<link rel="stylesheet" href="/css/competition.css" media="all">
```

`themes/Sakura/layout/_partial/footer.ejs`：

```html
<script type="text/javascript" src="/js/competition.js"></script>
```

> 当前站点部署在根目录（`_config.yml` 中 `root: /`），因此使用 `/css/...` 和 `/js/...`。如果部署到子目录，请改为 `<%- url_for('/css/competition.css') %>` 和 `<%- url_for('/js/competition.js') %>`。
>
> CSS/JS 采用全局引入，是因为 Sakura 使用 PJAX。脚本内部会判断 `#competition-app` 是否存在，不存在时直接返回，因此不会影响其他页面。

---

## 3. 数据格式

`source/_data/competitions.json` 与 `source/competition/data.json` 内容相同：

```json
{
  "updatedAt": "2026-11-27T03:20:51.640Z",
  "generatedBy": "tools/competition/fetch-competitions.mjs",
  "sources": [
    {
      "id": "thirdplayer",
      "name": "第三方赛事聚合",
      "url": "https://competition.thirdplayer.cn/",
      "status": "ok",
      "count": 26,
      "message": "抓取成功"
    },
    {
      "id": "huaweicloud",
      "name": "华为云开发者大赛",
      "url": "https://developer.huaweicloud.com/competition/list",
      "status": "ok",
      "count": 6,
      "message": "抓取成功（36 条，过滤后 6 条）"
    },
    {
      "id": "harmonyos",
      "name": "华为开发者联盟 · HarmonyOS",
      "url": "https://developer.huawei.com/consumer/cn/activity/digixActivity/",
      "status": "failed",
      "count": 0,
      "message": "接口可访问，但字段为 activityStartTime/signStartTime/activityURL，通用解析器尚未适配；已使用人工收录"
    },
    {
      "id": "gitcode",
      "name": "GitCode 赛事平台",
      "url": "https://competition.gitcode.com/",
      "status": "ok",
      "count": 41,
      "message": "抓取成功（43 条，过滤/去重后 41 条）"
    },
    {
      "id": "manual",
      "name": "人工收录 / 兜底数据",
      "url": "",
      "status": "manual",
      "count": 3,
      "message": "人工收录 3 条（7 条已由官方接口覆盖）"
    }
  ],
  "items": [
    {
      "id": "tp-example",
      "name": "示例赛事",
      "organizer": "示例主办方",
      "level": "国家级",
      "type": "AI 与算力",
      "tags": ["AI", "大模型", "算法"],
      "registrationStart": "2026-11-01",
      "registrationEnd": "2026-12-20",
      "competitionStart": "2027-01-05",
      "competitionEnd": "2027-02-10",
      "prize": "奖金与算力资源，详见官网",
      "url": "https://example.com/competition",
      "participants": "",
      "source": "thirdplayer",
      "sourceName": "第三方赛事聚合",
      "sourceUrl": "https://competition.thirdplayer.cn/",
      "verified": true,
      "note": ""
    }
  ]
}
```

### 字段说明

| 字段 | 说明 |
| --- | --- |
| `id` | 唯一标识。第三方数据使用 `tp-*`，GitCode 使用 `gitcode-*`，华为云使用 `huaweicloud-*`，人工数据使用自定义 id。 |
| `name` | 赛事名称。 |
| `organizer` | 主办方。 |
| `level` | 级别。常用值：国际级、国家级、省级、校级、企业级、其他。 |
| `type` | 类型。常用值：AI 与算力、CANN / 算子、昇腾 / AI 算力、开源鸿蒙、AI Agent、云 / AI 编程、应用开发、编程算法、开源征稿、创新创业、数模、数据库、设计等。 |
| `tags` | 标签数组。 |
| `registrationStart` | 报名开始日期，`YYYY-MM-DD`。 |
| `registrationEnd` | 报名截止日期，`YYYY-MM-DD`。日历以此日期打点。 |
| `competitionStart` | 比赛开始日期。 |
| `competitionEnd` | 比赛结束日期。 |
| `prize` | 奖金 / 奖励说明。 |
| `url` | 官方详情页。 |
| `participants` | 报名人数或面向人群，可为空。 |
| `source` | 数据来源 id：`thirdplayer`、`huaweicloud`、`harmonyos`、`gitcode`。 |
| `sourceName` | 来源显示名称。 |
| `sourceUrl` | 来源站点首页。 |
| `verified` | `false` 时卡片显示「待核验」，提示以官网为准。 |
| `note` | 核验提示或补充说明。 |

> 华为云的 `level`、`type` 是推断字段：`level` 主要看赛事名称中的范围词（国际/全球、全国/中国、省赛、大学/学院、企业/公司等），`type` 看名称关键词。GitCode 按站点约定统一标为“企业级”，`type` 按平台分类和名称关键词推断。名称、时间、奖金、报名人数等字段来自官方接口。HarmonyOS 仍是人工兜底数据。

> 华为云的 `registrationStart` 使用平台的活动开始时间，`registrationEnd` 使用页面的倒计时截止时间；GitCode 从 `activity_time_line` 中解析“报名开始/报名截止/比赛开始/比赛结束”。

### 状态判定

前端按浏览器本地日历日判定，日期只精确到天：

| 状态 | 判定条件 |
| --- | --- |
| 未开始 `upcoming` | 当前日期早于 `registrationStart`。 |
| 报名中 `open` | 当前日期在报名窗口内（`registrationStart` ≤ 今天 ≤ `registrationEnd`）；没有报名截止日但有报名开始日且已开始，也按报名中处理。 |
| 进行中 `running` | 报名已截止，但当前日期不晚于 `competitionEnd`。 |
| 已结束 `ended` | 比赛结束日已过，或缺少可用日期。 |

默认排序「即将截止优先」的顺序为：

1. 报名中：按报名截止日从早到晚。
2. 未开始：按报名开始日从早到晚。
3. 进行中：按比赛结束日从早到晚。
4. 已结束：按比赛结束日从近到远。

---

## 4. 页面集成

如果要把本模块迁移到另一个 Sakura 站点，按以下步骤操作：

1. 复制 `source/competition/` 到目标站点 `source/`。
2. 复制 `source/_data/competitions.json` 到目标站点 `source/_data/`。
3. 复制 `themes/Sakura/layout/competition.ejs` 到目标主题 `layout/`。
4. 复制 `themes/Sakura/source/css/competition.css` 和 `themes/Sakura/source/js/competition.js` 到主题对应目录。
5. 在目标主题 `_config.yml` 增加菜单项。
6. 在 `head.ejs` 引入 CSS，在 `footer.ejs` 引入 JS。
7. 复制 `tools/competition/` 与相关 npm scripts，按需运行抓取。
8. 执行构建，确认 `public/competition/index.html` 与 `public/competition/data.json` 均已生成。

### 内联数据与运行时兜底

`competition.ejs` 通过 `site.data.competitions` 读取构建期数据，并序列化到：

```html
<script id="competition-data" type="application/json">...</script>
```

`competition.js` 优先读取这段内联 JSON；如果内联数据不存在或解析失败，则请求页面上的 `data-data-url`（默认 `/competition/data.json`）。这样即使静态托管环境不能执行服务端逻辑，页面也能正常展示。

因此每次更新数据后，需要**重新构建并部署**，内联 JSON 才会更新。仅替换 `public/competition/data.json` 只能作为临时兜底。

### PJAX 注意事项

- CSS/JS 必须全局引入，不能只放在 `competition.ejs` 内，否则 PJAX 返回页面时资源不会重新加载。
- 脚本在检测到 `#competition-app` 时立即初始化，同时监听 `DOMContentLoaded`、`pjax:complete`、`pjax:success`、`pjax:end`，兼顾直接访问和 PJAX 进入。
- `competition.js` 放在 clipboard / LeanCloud / Valine 等外部脚本之前，避免慢资源阻塞 `DOMContentLoaded` 导致首屏赛事不显示。
- 初始化前会检查 `#competition-app`，不存在则直接返回。
- 重复初始化会先清理旧状态，避免事件重复绑定。

---

## 5. 抓取与数据更新

### 命令

```bash
# 完整抓取（第三方 + 华为云 + HarmonyOS + GitCode + 人工数据）
npm run competition:fetch

# 离线模式：只使用 .cache 缓存 + manual.json，不发起网络请求
npm run competition:fetch:offline

# 只抓取指定来源
node tools/competition/fetch-competitions.mjs --only=thirdplayer,huaweicloud,gitcode,manual

# 只检查结果，不写文件
node tools/competition/fetch-competitions.mjs --dry-run
```

脚本只依赖 Node.js 内置模块（`node:fs`、`node:path`、`node:vm`、`node:url` 和全局 `fetch`），不需要额外安装依赖。建议使用 Node.js 18 LTS 或更高版本。

### 输出

每次运行会同时写入：

- `source/_data/competitions.json`：供 Hexo EJS 读取并内联。
- `source/competition/data.json`：供页面运行时 fetch 兜底。

### 处理流程

1. 逐个来源发起低频请求：第三方 1 次；华为云按“进行中 / 未开始 / 最近结束”查询 3 次；GitCode 分页请求 1–2 次。失败不重试轰炸。
2. 将不同来源的字段归一化为统一 schema。
3. 读取 `tools/competition/manual.json`；如果某个官方来源本次抓取成功且有数据，则自动跳过该来源的人工兜底条目，避免重复。
4. 过滤其他高校的校内赛：赛事名称中出现具体大学/学院/学校/职业技术院校，且不是中山大学的，直接排除；`中山大学` / `SYSU` 的校内赛保留。全国/国际/区域性公开赛事不受影响。
5. 按「赛事名称（去空格/符号）」去重；同名赛事保留先出现的一条。
6. 按报名截止日从早到晚排序。
7. 写入两个 JSON 文件，并记录 `updatedAt` 与每个来源的 `status`、`count`、`message`。来源 `count` 会在过滤和去重后回填为最终收录数。

### 来源与当前状态

| 来源 | 入口 | 抓取方式 | 当前情况 |
| --- | --- | --- | --- |
| 第三方赛事聚合 | `https://competition.thirdplayer.cn/` | 请求 `https://competition.thirdplayer.cn/data.js`，在 `vm` 沙箱中读取 `competitionData` 数组 | 可用。当前 26 条，是最稳定的数据源。 |
| 华为云开发者大赛 | `https://developer.huaweicloud.com/competition/list` | POST `https://devdata2.huaweicloud.com/rest/developer/fwdo/rest/developer/servlet/hdcompetitionservice/v1/competition/get-competition-list`，参数含 `category_id`、`statuses`、`limit`、`offset` | 可用。抓取 36 条（进行中 16 条 + 最近结束 20 条），过滤其他高校校内赛后收录 6 条；详情链接为 `developer.huaweicloud.com/competition/information/{url_id}`。 |
| 华为开发者联盟 · HarmonyOS | `https://developer.huawei.com/consumer/cn/activity/digixActivity/` | 尝试 POST 活动列表接口 | 接口可访问（HTTP 200，`code: "00000"`），但字段为 `activityStartTime` / `signStartTime` / `activityURL`，当前通用解析器未适配；且返回结果混合了课程、论坛、招募等活动，需要按 `activitySubtag` 7/9 筛选。目前仍使用人工收录兜底。 |
| GitCode 赛事平台 | `https://competition.gitcode.com/` | GET `https://web-api.gitcode.com/aihub/api/v1/activity/page?page=1&per_page=100` | 可用。抓取 43 条（进行中/评审中 + 最近 90 天结束），过滤其他高校校内赛并去重后收录 41 条；级别统一标为企业级；详情链接为 `competition.gitcode.com/competition/{activity_id}/intro`。 |
| 人工收录 | `tools/competition/manual.json` | 本地 JSON 合并 | 当前 3 条（HarmonyOS），标记为 `verified: false`，页面显示「待核验」；华为云/GitCode 的 7 条人工兜底数据因官方接口成功而自动跳过。 |

> 原始需求中的 GitCode 短链 `shturl.cc/f8jyqINkrJtTie9A0l0lcOmXEPqxq4WLY` 已无法解析，因此改用 GitCode 赛事平台首页 `https://competition.gitcode.com/` 作为来源入口。若后续拿到有效短链，可在 `manual.json` 中补充对应详情地址。

### 缓存

- 第三方数据缓存：`.cache/competition/thirdplayer-data.js`。
- 华为云缓存：`.cache/competition/huaweicloud.json`（成功抓取时写入）。
- GitCode 缓存：`.cache/competition/gitcode.json`（成功抓取时写入）。
- HarmonyOS 缓存：`.cache/competition/harmonyos.json`（仅成功抓取时写入）。
- 在线抓取第三方失败时会自动回退到缓存；`--offline` 模式完全依赖缓存。
- 如果 CI 环境没有缓存，主来源抓取失败时数据会明显减少，因此 GitHub Actions 工作流会在提交前检查第三方、华为云、GitCode 三个来源是否成功。

### 人工数据与自动数据的关系

- `manual.json` 中的数据会与自动抓取数据一起合并、去重、排序。
- 人工数据的 `source` 可以是 `harmonyos`、`huaweicloud`、`gitcode`，但来源汇总里会归入 `manual`。
- 如果某个官方来源本次抓取成功且有数据，脚本会自动跳过该来源的人工兜底条目；如果接口失败，人工条目重新作为兜底加入。
- 当前 Huawei/GitCode 官方接口可用，因此 `manual.json` 中只保留 3 条 HarmonyOS 兜底数据；其余 7 条被自动跳过。

---

## 6. 反爬限制与合规说明

本模块只抓取**公开可访问**的赛事信息，不登录、不绕过验证码、不破解签名、不进行高频请求。

### 第三方赛事聚合

- `data.js` 是页面自身加载的公开脚本，结构稳定，包含 `competitionData` 数组。
- 仍建议每次运行只请求一次，并保留缓存。
- 如果对方调整数据结构，脚本会在 `vm` 沙箱执行后检查 `competitionData` 是否为数组，失败时不会阻塞构建。

### 华为云

- 列表页 `https://developer.huaweicloud.com/competition/list` 是 Vue SPA，但页面自身调用的公开接口可用：

```http
POST https://devdata2.huaweicloud.com/rest/developer/fwdo/rest/developer/servlet/hdcompetitionservice/v1/competition/get-competition-list
Content-Type: application/json
Origin: https://competition.huaweicloud.com
Referer: https://competition.huaweicloud.com/competition/list

{
  "category_id": "a849fed4b5fa11ef9f37fa163ebe27b7",
  "track_id": "",
  "technology_id": "",
  "statuses": "0",
  "limit": 100,
  "offset": 1,
  "name": ""
}
```

- `statuses`：`0` = 进行中，`1` = 未开始，`2` = 已结束。当前脚本分别请求 `0`、`1` 和最近 20 条 `2`，在 2026-11-27 抓到 36 条。
- 之前返回 `HTTP 500 / HD.66009999` 的原因是使用了旧参数（`pageNum`、`pageSize`、`status` 等），不是永久风控。接口契约变化时，应重新查看页面 JS 中的请求参数，或回退人工收录。
- 仍需低频、正常 UA 访问；不伪造签名、不复用登录态、不绕过 WAF。
- 详情链接使用 `https://developer.huaweicloud.com/competition/information/{url_id}`，`type=1` 时使用 `advance`。

### HarmonyOS / 华为开发者联盟

- 该活动列表接口本身可以公开访问：POST 返回 `HTTP 200`、`code: "00000"` 和约 233 KB JSON，不是硬性风控拦截。
- 当前失败原因是解析适配，而不是“抓不到”：
  - 赛事字段是 `activityStartTime`、`activityEndTime`、`signStartTime`、`signEndTime`、`activityURL`，而通用解析器只识别 `startTime`、`regStart`、`url` 等字段。
  - 返回结果包含 `featuredEvents`、`filteredEvents`、`recentEvents`、`exploreEvents`、`historicalEvents`，其中混合了课程、论坛、Beta 招募、生态合作等活动，并非全部是赛事；需要按 `activitySubtag`（7 = 开发者挑战赛，9 = Digix 大赛）或名称/类型进一步筛选。
- 因此可以新增专用适配器 `normalizeHarmonyOS`：只导入赛事类活动，映射上述日期与链接字段，并保留人工兜底。当前版本尚未实现该适配。
- 不建议高频轮询或模拟登录。

### GitCode

- 赛事页是 Next.js App Router，HTML 只有骨架屏和「加载中…」，没有 `__NEXT_DATA__`；真实列表来自：

```http
GET https://web-api.gitcode.com/aihub/api/v1/activity/page?page=1&per_page=100
Origin: https://competition.gitcode.com
Referer: https://competition.gitcode.com/
```

- 脚本串行分页（`per_page=100`，最多 10 页），保留 `activity_status=judging` 以及最近 90 天结束的 `completed` 赛事，避免导入多年历史数据。
- 2026-11-27 抓取 43 条，按名称去重后收录 42 条。
- 详情链接：`https://competition.gitcode.com/competition/{activity_id}/intro`。
- 原短链 `shturl.cc/f8jyqINkrJtTie9A0l0lcOmXEPqxq4WLY` 已失效，当前使用 `https://competition.gitcode.com/`。
- 接口字段或路径变化时，回退人工收录；不要高频轮询。

### robots.txt 与访问频率

- 抓取前应查看目标站点 `robots.txt` 与使用条款；若明确禁止抓取，应停止自动抓取，改用人工收录。
- 单次运行对每个来源按需请求 1–3 次，串行执行，不并发轰炸。
- 使用可识别的 User-Agent：`SakuraCompetitionBot/1.0`。
- 不抓取需要登录、付费或明确标注禁止转载的内容。
- 页面保留来源名称和官方链接，赛事时间与奖金等信息以官方公告为准。

---

## 7. 人工兜底

### 7.1 维护 `manual.json`

`tools/competition/manual.json` 是一个数组，字段与上面的 item schema 一致。当前保留 3 条 HarmonyOS 兜底数据；华为云/GitCode 的 7 条兜底数据仍保留在文件中，官方接口成功时会被自动跳过，接口失败时重新生效。

示例：

```json
[
  {
    "id": "harmonyos-example-2026",
    "name": "示例 HarmonyOS 赛事",
    "organizer": "华为开发者联盟",
    "level": "国家级",
    "type": "应用开发",
    "tags": ["HarmonyOS", "鸿蒙"],
    "registrationStart": "2026-11-01",
    "registrationEnd": "2026-12-20",
    "competitionStart": "2027-01-05",
    "competitionEnd": "2027-02-10",
    "prize": "奖金与开发者资源，详见官网",
    "url": "https://developer.huawei.com/consumer/cn/activity/digixActivity/",
    "source": "harmonyos",
    "sourceName": "华为开发者联盟 · HarmonyOS",
    "sourceUrl": "https://developer.huawei.com/consumer/cn/activity/digixActivity/",
    "verified": false,
    "note": "HarmonyOS 活动接口字段尚未适配，本条由人工收录，请以官网最新公告为准。"
  }
]
```

维护后运行：

```bash
# 使用所有已存在的缓存，不发起网络请求
node tools/competition/fetch-competitions.mjs --offline
npm run build:static
```

`verified: false` 的条目会在卡片和详情中显示「待核验」，鼠标悬停可看到 `note`。

### 7.2 页面内手动录入

页面首屏提供「手动录入」：

- 录入字段：名称、主办方、级别、类型、报名开始/截止、比赛开始/结束、奖金、详情链接、标签、备注。
- 数据保存在 `localStorage`，key 为 `sakura.competitions.manual.v1`。
- 支持逐条删除、全部清空。
- 「导出 JSON」会导出当前页面全部数据；手动录入弹窗内还有「导出人工数据」，只导出本地录入条目。
- 导出的 JSON 可以粘贴到 `manual.json`，纳入构建期数据。

> 页面内录入只影响当前浏览器，不会自动写回服务器或 Git 仓库。若希望所有访客看到，需要把导出的数据合并进 `manual.json` 并重新构建。

---

## 8. 构建与部署

### 推荐环境

- Node.js 18 LTS
- 现有 Hexo 3.9 依赖
- 首次部署：

```bash
npm install
npm run competition:fetch:offline   # 或 competition:fetch
npm run generate
```

### Node.js 23+ 兼容

本项目使用的 Hexo 3.9 较旧，在 Node.js 23+ 下可能遇到：

1. `util.isDate` 被移除，导致 Hexo 启动失败。
2. `hexo generate` 生成 0 字节文件。

已提供两个兼容文件：

- `tools/compat-util-isdate.cjs`：通过 `node -r` 预加载，补齐 `util.isDate`。
- `tools/build-static.cjs`：直接读取 Hexo route 流并写入 `public/`，绕过旧版 `CacheStream` 在现代 Node 下的问题。

对应命令：

```bash
# 仍使用 Hexo generate（推荐 Node 18）
npm run generate

# Node 23+ 下如果 generate 输出 0 字节文件，使用：
npm run build:static

# 本地预览
npm run server

# 清理
npm run clean
```

`npm run build:static` 会输出每个生成文件的路径和字节数，便于确认 `/competition/index.html` 和数据文件是否正常。

### GitHub Pages

现有 `_config.yml` 的部署配置为：

```yaml
deploy:
  type: git
  repo:
    github: https://github.com/doubleen233/doubleen233.github.io.git
  branch: master
```

构建并部署（Node 18）：

```bash
npm run competition:fetch
npm run generate
npm run deploy
```

Node 23+ 或已用 `build:static` 生成好 `public/` 时：

```bash
npm run competition:fetch
npm run build:static
npm run deploy
```

> `hexo deploy` 在 `public/` 已存在时不会重新 generate，而是直接复制并推送当前 `public/`。因此 Node 25 下不要使用 `hexo deploy -g`，否则可能重新生成 0 字节文件。部署前请确认已配置 GitHub 写权限（PAT 或 SSH）。

部署后检查：

- `https://你的域名/competition/`
- `https://你的域名/competition/data.json`
- 页面首屏「数据更新」时间是否为本次构建时间。

如果使用 GitHub Actions 自动部署，请确保部署步骤在数据抓取和 Hexo 构建之后执行，并且 `public/competition/index.html` 与 `public/competition/data.json` 都包含在产物中。

### 可选：每日自动刷新数据

已提供 `.github/workflows/update-competitions.yml`：

- 每天 01:17 UTC 运行，也支持手动触发。
- 只运行 `node tools/competition/fetch-competitions.mjs`，无需安装 npm 依赖。
- 提交前检查第三方、华为云、GitCode 三个主来源是否成功；任一失败或仅命中缓存时中止，避免用不完整/过期数据覆盖现有 JSON。
- 只提交 `source/_data/competitions.json` 和 `source/competition/data.json`，由现有 Pages 构建流程重新部署。

如果仓库分支启用了保护规则，`git push` 可能被拒绝，此时可改为创建 Pull Request，或在本机定时运行后手动提交。

---

## 9. 更新频率建议

- **每日一次**：适合赛事截止提醒场景，能及时反映报名截止变化。
- **每周一次**：如果只做静态展示，最低建议每周一次。
- **大赛季/报名高峰**：可提高到每天两次，但应保持每个来源 1–3 次串行请求，避免给对方站点造成压力。
- **人工数据**：每次官方发布新赛事或截止日期变更时更新 `manual.json`。
- **页面展示**：`updatedAt` 会显示在首屏统计区，便于访客判断数据新鲜度。

自动化工作流默认每天运行一次。若 HarmonyOS 长期未适配，可把定时任务改为 `node tools/competition/fetch-competitions.mjs --only=thirdplayer,huaweicloud,gitcode,manual`，减少一次无效请求。

---

## 10. 常见问题排查

### 页面没有数据

1. 打开浏览器控制台，确认 `#competition-data` 是否存在且为合法 JSON。
2. 检查 `/competition/data.json` 是否可访问。
3. 确认构建产物中存在 `public/competition/index.html`。
4. 运行 `npm run competition:fetch`（或 `node tools/competition/fetch-competitions.mjs --offline`）后重新构建。

### 从其他页面通过 PJAX 进入后样式或交互失效

- 确认 `competition.css` 在 `head.ejs` 全局引入。
- 确认 `competition.js` 在 `footer.ejs` 全局引入。
- 确认脚本监听 `pjax:complete` / `pjax:success` / `pjax:end`，并且初始化前检查 `#competition-app`。
- 确认 `competition.js` 位于外部 CDN 脚本之前，否则慢资源可能让首屏一直停在“正在加载赛事…”。

### `npm run generate` 生成 0 字节文件

- 使用 Node.js 18 LTS，或改用 `npm run build:static`。
- 确认命令带有 `-r ./tools/compat-util-isdate.cjs`。

### 菜单文字乱码

- 确认 `_config.yml` 以 UTF-8 保存。
- 不要用 Windows 默认 ANSI 编码另存。

### GitHub Actions 提交失败

- 检查仓库 `Settings → Actions → General → Workflow permissions` 是否允许读写。
- 如果分支保护禁止直接推送，改为创建 PR 或手动运行。

### 主来源失败

- 第三方：保留 `.cache/competition/thirdplayer-data.js`，离线模式可直接使用。
- 华为云/GitCode：成功抓取后会写入 `.cache/competition/huaweicloud.json` 和 `.cache/competition/gitcode.json`；`--offline` 模式可直接使用。
- 如果某个官方来源失败，该来源对应的人工兜底条目会自动重新加入。
- 工作流会检查第三方、华为云、GitCode 三个主来源；任一失败则中止提交，现有 JSON 不会被覆盖。
- 可在本地运行 `npm run competition:fetch` 后检查 `sources` 中的 `status` 和 `message`。

---

## 11. 已知限制

- 已过滤其他高校的校内赛，只保留中山大学校内赛和公开赛事；如果某个校内赛名称中没有出现具体学校名，可能无法自动识别，需要在过滤规则中补充。
- 华为云、GitCode 已接入官方页面使用的公开接口，但接口属于页面内部契约，可能随前端版本变化；失败时回退人工收录。
- HarmonyOS 接口可访问，但当前通用解析器未适配 `activityStartTime` / `signStartTime` / `activityURL` 字段，且需要筛选赛事类活动；当前使用 3 条人工兜底数据。
- 华为云的 `level`、`type` 是推断字段，可能不完全准确；GitCode 按站点约定统一标为“企业级”。名称、时间、奖金等字段来自官方接口。
- GitCode 只导入进行中/评审中以及最近 90 天结束的赛事，较早的历史赛事不会出现在页面。
- GitCode 原短链已失效，使用平台首页代替。
- 人工收录条目标记 `verified: false`，页面显示「待核验」，不保证与官网实时一致。
- 页面内手动录入只保存在当前浏览器，不会同步给其他访客。
- 日历只标记有 `registrationEnd` 的赛事；缺少报名截止日的条目仍会出现在列表中。
- 状态按日期判定，不包含具体时刻；截止日当天仍视为报名中。
- 数据去重基于规范化后的赛事名称；同名赛事只保留一条。

---

## 12. 验收清单

- [ ] `/competition/` 可访问，首屏统计有数据。
- [ ] 列表默认按「即将截止优先」排序。
- [ ] 关键词、时间、级别、状态、类型筛选正常。
- [ ] 分页每页 9 条，翻页正常。
- [ ] 卡片显示来源、详情链接、状态、截止提醒。
- [ ] 「待核验」条目有提示。
- [ ] 日历视图可切换月份，报名截止日有标记。
- [ ] 日历悬停提示、日期弹窗、详情弹窗正常。
- [ ] 手动录入可新增、删除、清空、导出。
- [ ] 从其他页面通过 PJAX 进入后功能仍正常。
- [ ] 手机宽度下布局不溢出。
- [ ] `npm run competition:fetch`、`node tools/competition/fetch-competitions.mjs --offline` 与 `npm run build:static` 可重复执行。
- [ ] `public/competition/index.html` 与 `public/competition/data.json` 均已生成。
