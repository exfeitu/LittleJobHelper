# 改进清单（已全部完成 ✅）

本清单于 2026-08-02 提出并一次性全部落地，作为后续工作的归档参考。
新增功能与修复均可通过 `npm run build` + `npm run lint` + `npm test` 验证。

---

## ✅ P0 — 功能缺口与 Bug 修复

| # | 项目 | 状态 |
|---|------|------|
| 1 | 日历页卡片点击编辑/删除 | ✅ |
| 2 | 任务步骤（TodoStep）可编辑（增删、勾选、提醒时间） | ✅ |
| 3 | pinnedToToday 编辑时保留用户选择 | ✅ |
| 4 | JSON 文件导入入口（导出面板内） | ✅ |
| 5 | 标签管理面板挂载（顶部"🏷️ 标签"按钮） | ✅ |
| 6 | TodoTree 递归遗漏 linkedEventTitles（子任务看不到关联事件） | ✅ |
| 7 | 手动同步遗漏 customTags | ✅ |
| 8 | JSON 导出遗漏 customTags | ✅ |

## ✅ P1 — 代码质量 / 架构

| # | 项目 | 状态 |
|---|------|------|
| 9 | 提取 `components/app-header.tsx`（消除两页 Header 重复） | ✅ |
| 10 | 提取共享 `BASE_TAGS` → `lib/constants.ts` | ✅ |
| 11 | 拆 `day-timeline.tsx` → `lib/timeline-layout.ts`（lane 分配、周聚合、转换） | ✅ |
| 12 | 拆 `lib/storage.ts` → `storage-migrate.ts` + `storage-local.ts` + `storage-gist.ts` + re-export | ✅ |
| 13 | 拆 `globals.css` → `styles/` 五个模块（顺序即级联顺序） | ✅ |
| 14 | ID 生成改用 `crypto.randomUUID()`（`lib/utils.ts` 的 `genId()`） | ✅ |
| 15 | 云同步状态指示器（Header 圆点：idle/syncing/success/error） | ✅ |
| 16 | README.md 更新为当前功能与正确端口 | ✅ |

## ✅ P2 — 功能增强

| # | 项目 | 状态 |
|---|------|------|
| 17 | 拼音搜索（pinyin-pro，全拼 + 首字母，预计算缓存） | ✅ |
| 18 | 搜索结果命中高亮（`<mark>`） | ✅ |
| 19 | 数据统计面板（`stats-dashboard.tsx`） | ✅ |
| 20 | 操作撤销（Ctrl+Z，最近 20 步，`use-app-data` 内置） | ✅ |
| 21 | 待办批量操作（勾选 → 批量状态 / 删除） | ✅ |
| 22 | 日历页增强（前后切换日、卡片可点、回到今天） | ✅ |
| 23 | JSON 导入结构校验（id/startTime/title） | ✅ |
| 24 | 离线检测（`navigator.onLine`，Header"离线"徽标，离线暂停同步） | ✅ |
| 25 | searchResults 拆为预计算 + 过滤两个 memo | ✅ |
| 26 | TodoTree 时间显示语义修正（区分 startTime/dueDate 缺失） | ✅ |

## ✅ P3 — 体验打磨 / 无障碍

| # | 项目 | 状态 |
|---|------|------|
| 27 | 暗色模式（`data-theme` + 主题切换按钮 + 防 FOUC 内联脚本） | ✅ |
| 28 | 移动端适配（响应式断点、header 换行） | ✅ |
| 29 | 键盘快捷键（Ctrl+K / Ctrl+N / Ctrl+Shift+N / Ctrl+Z / Esc） | ✅ |
| 30 | 加载骨架屏（isInitialized 之前） | ✅ |
| 31 | 空状态引导页 | ✅ |
| 32 | 弹窗无障碍（role="dialog" + aria-modal + 焦点锁定 `use-focus-trap`） | ✅ |
| 33 | HelpIcon 无障碍（aria-haspopup / aria-expanded） | ✅ |
| 34 | TodoTree 卡片键盘可访问（role="button" + tabIndex + Enter/Space） | ✅ |
| 35 | 顶层 ErrorBoundary | ✅ |

## ✅ P4 — 质量保障 / 配置

| # | 项目 | 状态 |
|---|------|------|
| 36 | Vitest 单元测试（35 例：utils / migrate / gist / timeline / buildCsv） | ✅ |
| 37 | CI 加 lint + test 步骤（deploy.yml） | ✅ |
| 38 | Playwright E2E 冒烟测试（`tests/smoke.spec.ts`，需 `npx playwright install chromium`） | ✅ |
| 39 | 配置修正：端口统一 3536、eslint 升级 v9 + flat config、eslint-config-next@16 | ✅ |

---

## 📌 仍可继续的方向（非本次范围）

以下为本次未处理、或需要投入更多的前瞻性方向：

1. **E2E 实际运行**：`tests/smoke.spec.ts` 已就绪，本地 `npx playwright install chromium && npm run test:e2e`。
2. **day-timeline 进一步拆分**：`hooks/use-timeline-zoom.ts`（缩放/定位逻辑）可再抽出。
3. **数据统计深度**：热力图、按人/部门聚合报表。
4. **月视图日历**：当前日历页为"按天"视图，可扩展月视图导航。
5. **service worker / PWA**：离线缓存与安装体验。
6. **撤销策略细化**：区分用户操作与云端合并，避免误撤销。
