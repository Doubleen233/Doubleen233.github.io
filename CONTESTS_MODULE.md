# 编程比赛子页（`/contests/`）

在现有 Sakura 博客中新增一个独立的编程比赛日历页，聚合：

- Codeforces
- AtCoder
- LeetCode（leetcode.cn）
- 牛客网

页面地址：

```text
https://doubleen233.github.io/contests/
```

页面只展示近期比赛：**过去 30 天 + 未来 180 天**。所有时间统一按**北京时间（Asia/Shanghai）**显示。

---

## 1. 功能

- 按平台筛选：全部 / Codeforces / AtCoder / LeetCode / 牛客
- 按状态筛选：全部 / 即将开始 / 进行中 / 已结束
- 按时间筛选：全部 / 未来 7 天 / 未来 30 天 / 最近结束
- 按日期分组展示
- 显示开始时间、结束时间、时长、Rated 信息
- 显示平台来源和跳转链接
- 响应式布局，适配手机
- 支持 PJAX，从首页第一次进入也能直接显示

牛客的高校校赛会过滤掉其他学校的校内赛，只保留中山大学和公开赛事。

---

## 2. 数据来源

| 平台 | 来源 | 说明 |
| --- | --- | --- |
| Codeforces | `https://codeforces.com/api/contest.list?gym=false` | 官方公开 API；过滤 practice，保留近期和未来比赛 |
| AtCoder | `https://atcoder.jp/contests/` | 解析页面的 Upcoming Contests 和 Recent Contests；时间从 JST 转为 UTC 存储 |
| LeetCode | `https://leetcode.cn/graphql` | `allContests` GraphQL 查询；标题为中文，链接指向 leetcode.cn |
| 牛客 | `https://ac.nowcoder.com/acm/contest/vip-index` | 解析 `div.platform-item` 的 `data-json`；抓取牛客系列赛和高校校赛两个分类 |

---

## 3. 文件结构

```text
source/
├─ contests/
│  ├─ index.md                 # 页面 front matter（layout: contests）
│  └─ data.json                # 运行时兜底数据
└─ _data/
   └─ contests.json            # 构建期数据，EJS 读取并内联

themes/Sakura/
├─ layout/contests.ejs         # 页面结构、筛选器、内联 JSON
├─ layout/_partial/head.ejs    # 引入 contests.css
├─ layout/_partial/footer.ejs  # 引入 contests.js
└─ source/
   ├─ css/contests.css
   └─ js/contests.js

tools/contests/
└─ fetch-contests.mjs          # 抓取 / 归一化 / 过滤 / 输出 JSON

.cache/contests/               # 各平台缓存，失败时兜底
```

---

## 4. 数据结构

```json
{
  "updatedAt": "2026-11-28T05:43:07.785Z",
  "generatedBy": "tools/contests/fetch-contests.mjs",
  "timezone": "Asia/Shanghai",
  "sources": [
    {
      "id": "codeforces",
      "name": "Codeforces",
      "url": "https://codeforces.com/contests",
      "status": "ok",
      "count": 14,
      "message": "抓取成功（14 条）"
    }
  ],
  "items": [
    {
      "id": "atcoder-abc486",
      "platform": "atcoder",
      "platformName": "AtCoder",
      "name": "AtCoder Beginner Contest 486",
      "url": "https://atcoder.jp/contests/abc486",
      "startTime": "2026-11-28T12:00:00.000Z",
      "endTime": "2026-11-28T13:40:00.000Z",
      "durationMinutes": 100,
      "rated": "Rated (- 1999)",
      "note": ""
    }
  ]
}
```

`startTime` / `endTime` 使用 UTC ISO 字符串，前端统一格式化为北京时间。

---

## 5. 命令

```bash
# 抓取四个平台
npm run contests:fetch

# 只使用本地缓存，不发起网络请求
npm run contests:fetch:offline

# 只抓取指定平台
node tools/contests/fetch-contests.mjs --only=codeforces,atcoder

# 只检查结果，不写文件
node tools/contests/fetch-contests.mjs --dry-run
```

每次运行会写入：

- `source/_data/contests.json`
- `source/contests/data.json`

---

## 6. 自动更新

GitHub Actions workflow：

```text
.github/workflows/deploy.yml
```

每天 01:17 UTC（北京时间 09:17）执行：

```text
npm install
→ npm run competition:fetch
→ 校验综合赛事来源
→ npm run contests:fetch
→ 校验四个比赛平台
→ npm run build:static
→ 部署到 master
```

四个平台任意一个抓取失败，workflow 会中止，避免用不完整数据覆盖线上。

也可以在 GitHub Actions 页面手动运行 `Build and deploy blog`。

---

## 7. 时间与过滤规则

- 页面显示时间：北京时间（Asia/Shanghai）
- 数据窗口：过去 30 天 + 未来 180 天
- Codeforces：过滤名称包含 `Practice` 的练习赛
- AtCoder：
  - 解析 Upcoming Contests 和 Recent Contests
  - 页面时间是 JST（UTC+9），存储时转为 UTC
  - 过滤时长超过 7 天的常驻/超长内容
- LeetCode：使用 leetcode.cn 的中文标题
- 牛客：
  - 抓取 `topCategoryFilter=13`（牛客系列赛）和 `14`（高校校赛）
  - 过滤名称含“重现赛”的条目
  - 过滤其他高校的校内赛，保留中山大学和公开赛事

---

## 8. 已知限制

- 各平台接口/页面结构可能变化；脚本会优先使用本地缓存，但 CI 中四个平台任一失败会中止部署。
- AtCoder 和牛客依赖 HTML 结构，平台改版时需要更新解析器。
- 比赛时间以平台官网为准；页面只做聚合和提醒。
- 牛客“高校校赛”中部分比赛名称不含学校名，可能无法自动识别为其他学校校内赛，需要后续补充规则。
- 页面是构建期静态数据，访客打开页面不会实时抓取平台；更新由 GitHub Actions 每日构建完成。

---

## 9. 验收清单

- [ ] `/contests/` 可访问，首屏统计有数据
- [ ] 菜单「比赛」可进入
- [ ] 平台筛选正常
- [ ] 状态、时间范围筛选正常
- [ ] 日期分组和北京时间显示正常
- [ ] 比赛链接可跳转
- [ ] 手机宽度下布局不溢出
- [ ] `npm run contests:fetch` 与 `npm run build:static` 可重复执行
- [ ] GitHub Actions 部署成功
