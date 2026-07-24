# Session State — Little Job Helper

> 此文件生成于 2026-07-14。在新环境中恢复工作前，请先通读。

---

## 一、项目概览

| 项目 | 详情 |
|---|---|
| 名称 | Little Job Helper — 体制内人事科办公助手 |
| 框架 | Next.js 16 (App Router), `output: 'export'` 静态导出 |
| 部署 | GitHub Pages (`exfeitu/LittleJobHelper`, master 分支自动推送) |
| 仓库 | `github.com:exfeitu/LittleJobHelper.git` |
| 开发端口 | `localhost:10352` |

**硬约束速记**：无 SSR/API Routes、无 CSS 框架、无数据库、不引入新 npm 依赖。

详细约束见 `AGENTS.md`，架构见 `docs/ARCHITECTURE.md`。

---

## 二、当前代码状态

### 最新提交
```
ae39b72 docs: update AI harness docs; UI: overlay scrollbar
```

### 未提交的改动（仅 `app/globals.css`）

1. **滚动条悬浮效果** — 始终显示极淡滚动条（12% 透明），hover 时加深（32% 透明），Firefox 同步处理。
2. **卡片展开宽度** — 从 `420px` 缩小到 `336px`（80%）。

### 分支
```
master (与 origin/master 同步)
```

---

## 三、数据存储与云端同步（"电话线"）

### LocalStorage Keys

| Key | 内容 |
|---|---|
| `little-job-helper-events` | 工作记录数组 (EventItem[]) |
| `little-job-helper-todos` | 待办任务数组 (TodoItem[]) |
| `little-job-helper-version` | 数据版本号 |
| `little-job-helper-settings` | Gist 设置 `{ token, gistId }` |
| `little-job-helper-custom-tags` | 自定义标签数组 |

### GitHub Gist 云同步

| 配置项 | 值 |
|---|---|
| Gist 文件名 | `little-job-helper-data.json` |
| Gist 描述 | `Little Job Helper 工作数据` |
| API 地址 | `https://api.github.com` |
| 认证方式 | HTTP Header `Authorization: Bearer <token>` |
| API 版本头 | `X-GitHub-Api-Version: 2022-11-28` |
| 当前数据版本 | `CURRENT_DATA_VERSION = 2` |

### 同步流程

```
新环境浏览器
  ↓
打开设置面板 → 输入 GitHub Token + Gist ID → 保存到 LocalStorage
  ↓
useAppData() hook 自动执行：
  1. loadAndMigrateFromStorage() — 从 LocalStorage 加载并迁移
  2. loadSettings() — 检测 cloudReady
  3. pullAndMerge() — 从 Gist 拉取并合并（仅首次加载）
  4. 3 秒防抖自动 pushToCloud() — 数据变更后自动推送
```

### 获取 Token 和 Gist ID

1. **Token**：GitHub → Settings → Developer settings → Personal access tokens → 勾选 `gist` scope → 生成
2. **Gist ID**：在设置面板中点击"创建云端备份"，会自动创建一个 Gist 并保存其 ID。或者手动从 `https://gist.github.com/<username>/<gistId>` 复制。

---

## 四、关键文件地图

| 文件 | 行数 | 职责 |
|---|---|---|
| `types.ts` | 52 | 全部类型定义（EventItem, TodoItem, TodoTreeNode 等） |
| `app/page.tsx` | 556 | 首页：时间轴 + 待办 + 搜索，状态中心 |
| `app/calendar/page.tsx` | 410 | 日历页，共享 useAppData() hook |
| `app/globals.css` | 1893 | 全部样式（手写，无框架） |
| `components/day-timeline.tsx` | 778 | 横向时间轴（最复杂组件） |
| `components/work-record-panel.tsx` | 403 | 工作记录编辑弹窗 |
| `components/settings-panel.tsx` | 293 | 云同步设置（Token + Gist ID） |
| `components/export-panel.tsx` | 246 | 导出 JSON/CSV |
| `lib/storage.ts` | 812 | 所有副作用：LocalStorage、Gist API、迁移 |
| `lib/utils.ts` | 184 | 纯函数：syncLinkedItems、树构建、格式化 |
| `hooks/use-app-data.ts` | 127 | 共享 hook（全站数据源） |

---

## 五、最近工作上下文

### 本轮对话完成的功能
1. **时间轴卡片悬浮横向展开** — hover 时卡片宽度从 ~180px 展开到 336px，高度固定 140px 不变
2. **卡片折叠时隐藏时间** — 使用 `visibility: hidden` + `order: 99`，时间信息仅 hover 时显示
3. **卡片悬浮置顶** — 使用 `.line-event:has(.line-event-card:hover) { z-index: 50 }` 突破父级层叠上下文
4. **滚动条悬浮叠加** — 始终极淡，hover 加深，不占页面空间
5. **AI Harness 文档更新** — 更新了代码量、提交数、效率评估等统计数据

### 已知但未解决
- 时间轴卡片交错排列仍有优化空间（当前使用 `lastSide` 交替算法）
- 大文件尚未拆分（day-timeline.tsx 778行、storage.ts 812行、globals.css 1893行）

---

## 六、在新环境恢复工作的步骤

### 1. 克隆仓库
```bash
git clone git@github.com:exfeitu/LittleJobHelper.git
cd LittleJobHelper
npm install
```

### 2. 配置云同步
- `npm run dev` → 打开 `http://localhost:10352`
- 点击右上角 "⚙️ 同步" → 输入 GitHub Token 和 Gist ID
- 点击 "从云端拉取" 恢复数据
- 数据会自动合并到浏览器 LocalStorage

### 3. 将本文件喂给 Claude Code
```
请你先读取 SESSION-STATE.md，了解项目当前状态，然后继续开发。
```

### 4. 验证环境
```bash
npm run build   # 确保编译通过（静态导出到 out/）
npm run lint    # ESLint 检查
```

---

## 七、常用命令

```bash
npm run dev      # localhost:10352 启动开发服务器
npm run build    # 静态导出到 out/
npm run lint     # ESLint
```

---

*此文件可以安全删除，不影响任何功能。建议在恢复工作后删除，避免过时信息误导后续开发。*
