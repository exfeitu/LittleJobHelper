# Task Plan: 待办列表方案 A 与时间轴任务卡片方案

## Goal

将首页普通待办树改为已确认的方案 A，并在不改动时间轴实现的前提下提供多套可缩放时间轴任务卡片视觉方案供用户选择。

## Next Step

等待用户选择时间轴任务卡片方案，再按选定方向实现。

## Current Phase

Phase 5

## Phases

### Phase 1: Scope & Discovery

- [x] 核对普通待办树现状与交互
- [x] 核对时间轴任务卡片在不同缩放级别的布局约束
- [x] 将结论记录到 findings.md
- **Status:** complete

### Phase 2: Implement List Scheme A

- [x] 将普通待办卡片改为紧凑列表行
- [x] 保留树形层级、批量选择、编辑入口和现有数据字段
- [x] 将详情改为可展开显示
- **Status:** complete

### Phase 3: Validate Implementation

- [x] 安装项目依赖（如仍缺失）
- [x] 运行 lint、测试和静态构建
- [x] 检查响应式与键盘交互
- **Status:** complete

### Phase 4: Timeline Visual Directions

- [x] 基于真实时间轴结构设计三套卡片方案
- [x] 体现不同缩放级别下的信息收缩策略
- [x] 输出可直接查看的图片预览
- **Status:** complete

### Phase 5: Delivery

- [x] 复查改动范围和 git diff
- [x] 汇总验证结果
- [x] 交付普通待办改动和时间轴方案对比
- **Status:** complete

## Key Questions

1. 方案 A 如何兼容当前批量选择和整卡点击编辑？
2. 时间轴缩放时哪些信息必须保留，哪些信息应逐级隐藏？

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| 只实现普通待办方案 A | 用户要求先改普通列表，再选择新的时间轴方案 |
| 时间轴本轮只出视觉方案 | 避免在用户选择前擅自更改核心时间轴表现 |
| 普通列表增加显式批量模式 | 默认隐藏批量选择框，保持方案 A 的单一状态圆点；进入批量模式后才替换为选择框 |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| 上一轮内嵌 HTML 预览未在用户界面显示 | 1 | 后续方案统一输出普通 PNG 图片 |
| 单次补丁同时删除并重建 `todo-tree.tsx` 被拒绝 | 1 | 改为原地更新文件，不重复删除/新增操作 |
| 安装依赖后 `npm run dev` 仍报 `spawn ...\\.bin\\next ENOENT` | 2 | 确认为 `scripts/dev.js` 在 Windows 直接 spawn 无扩展名 shim；不改脚本，改用 `npx next dev -p 3536 --webpack` 验证 |
| 浏览器会话未保留上一轮绑定 | 1 | 重新初始化当前会话并按 localhost URL 选择浏览器 |
| 当前浏览器不支持 `networkidle` 等待状态 | 1 | 改用 `domcontentloaded` 并读取 DOM 快照确认页面就绪 |

## Notes

- 不改 `types.ts` 数据字段，不引入组件库或 CSS 框架。
- 所有任务数组更新仍通过现有 `setData()` 与 `syncLinkedItems()`。
