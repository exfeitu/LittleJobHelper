# 常见改动模式

每个模式按步骤排列。遵循这些步骤可以避免常见的遗漏。

---

## 1. 给 EventItem、TodoItem 或 MemoItem 加字段

1. 在 `types.ts` 中加字段（可选字段用 `?`）
2. `CURRENT_DATA_VERSION` 加 1，在 `migrations` 末尾追加迁移函数
3. 在用到该类型的组件中处理新字段的展示和编辑
4. **容易遗漏**：`lib/utils.ts` 的 `exportRows()` 函数需要在导出映射中加上新字段
5. **容易遗漏**：`components/export-panel.tsx` 的 `buildCsv()` 函数需要在 CSV 表头和数据行中加上新字段
6. **容易遗漏**：组件代码需要对旧数据中 `undefined` 的新字段做空值兜底

---

## 2. 新增一个页面

1. 在 `app/` 下创建目录 + `page.tsx`（以 `"use client"` 开头）
2. 使用 `useAppData()` hook 获取数据和 cloudEnabled
3. 在 `components/app-header.tsx` 中加入页面入口，并更新 `activePage` 类型/高亮逻辑
4. **不要**创建 `layout.tsx`（除非该路由有独立布局需求）
5. **不要**使用 `generateStaticParams` 或 `generateMetadata`（静态导出不支持）
6. 如果页面需要共享数据、云同步、导入导出或撤销，优先复用 `useAppData()` 和现有 `SettingsPanel` / `ExportPanel` 模式

---

## 3. 新增一个组件

1. 在 `components/` 下创建文件，以 `"use client"` 开头
2. Props 类型定义在组件文件内，用 `type` 不用 `interface`
3. 样式按职责加入 `styles/variables.css`、`layout.css`、`timeline.css`、`components.css` 或 `modal.css`
4. `app/globals.css` 主要维护模块 `@import` 顺序；不要把大段组件样式重新堆回 `globals.css`

---

## 4. 新增一个模态弹窗

1. 在 `components/` 下创建文件
2. 使用 `.modal-overlay > .modal-panel` 的 HTML 结构（CSS 已有）
3. 表单状态自管理，通过 `onSave(data)` + `onClose()` 回调与父通信
4. 点击遮罩层关闭：`e.target === e.currentTarget` 判断
5. 标签选择用 chip 模式：预设标签 `.chip-button.chip-tag` + 自定义输入
6. 保存逻辑在 `page.tsx` 回调中执行（`syncLinkedItems` + `setData`）

---

## 5. 修改双向关联

1. 修改 events 或 todos 后，必须调用 `syncLinkedItems(nextEvents, nextTodos)`
2. 新 TodoItem 关联 Event 时，需同时更新 Event 的 `linkedTodoIds`
3. 删除 Event 时，需清理所有 Todo 中对该 Event 的 `linkedEventIds` 引用
4. **参考实现**：`app/page.tsx` 中 `handleSaveTask()` 和 `handleSaveWorkRecord()`

---

## 6. 修改数据存储结构

1. 先在 `types.ts` 中改类型
2. 在 `lib/storage-migrate.ts` 中更新 `CURRENT_DATA_VERSION` 并追加 migration
3. 在 `lib/storage-local.ts` 同步 LocalStorage、导入导出和结构校验；**不要**直接改既有 key 名
4. 在 `lib/storage-gist.ts` 同步 `createGist`、`updateGist`、`fetchRawGist`、`pushToCloud` / `pullAndMerge`
5. 新字段必须考虑旧备份/旧 Gist 缺失时的默认值，并补对应 migration / storage 单测
