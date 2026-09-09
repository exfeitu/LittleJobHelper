# Task Plan: 待办列表方案 A 与时间轴密度自适应任务卡片

## Goal

在保留已完成的普通待办方案 A 基础上，实现已确认的时间轴密度自适应任务展示：随可见时间跨度按优先级降级信息、聚合低优先级任务，并通过上下多泳道和水平错位提高时间轴空间利用率，验证后提交并推送。

## Next Step

已完成实现与验证；提交并推送到 `origin/master`。

## Current Phase

Complete

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

### Phase 6: Confirm Timeline Density Rules

- [x] 将用户反馈转化为低、中、高密度规则
- [x] 核对现有缩放值、可见天数、lane 与卡片偏移实现
- [x] 确认不修改数据契约和存储结构
- **Status:** complete

### Phase 7: Implement Adaptive Timeline Tasks

- [x] 增加基于可见天数的任务显示层级
- [x] 高优先级保留完整卡，中优先级压缩，低优先级在高密度聚合
- [x] 改进卡片 lane 分配与左右错位，充分使用上下空间
- [x] 保持工作记录、点击编辑、虚拟化和缩放锚点行为
- **Status:** complete

### Phase 8: Validate, Commit & Push

- [x] 增补布局纯函数单元测试
- [x] 运行 lint、单元测试和静态构建
- [x] 检查中景真实页面，并以单元测试覆盖近景/远景规则、碰撞和窄屏弹层边界
- [x] 复查 diff，提交并推送到 origin/master
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
| 时间轴使用单一密度自适应方案 | 用户确认不再选择装饰风格，而是按不同时间跨度自动降级 |
| 优先级驱动远景可见性 | 高优先级始终保持完整摘要，中优先级压缩，低优先级聚合为数量标记 |
| 错位布局仍保留精确时间锚点 | 卡片可以左右移动填补空隙，但菱形锚点继续标记真实时间 |

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
