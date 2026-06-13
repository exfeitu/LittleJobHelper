# 常见改动模式

每个模式按步骤排列。遵循这些步骤可以避免常见的遗漏。

---

## 1. 给 EventItem 或 TodoItem 加字段

1. 在 `types.ts` 中加字段（可选字段用 `?`）
2. `CURRENT_DATA_VERSION` 加 1，在 `migrations` 末尾追加迁移函数
3. 在用到该类型的组件中处理新字段的展示和编辑
4. **容易遗漏**：`lib/utils.ts` 的 `exportRows()` 函数需要在导出映射中加上新字段
5. **容易遗漏**：`lib/storage.ts` 的 `buildCsv()` 函数需要在 CSV 表头和数据行中加上新字段
6. **容易遗漏**：组件代码需要对旧数据中 `undefined` 的新字段做空值兜底

---

## 2. 新增一个页面

1. 在 `app/` 下创建目录 + `page.tsx`（以 `"use client"` 开头）
2. 使用 `useAppData()` hook 获取数据和 cloudEnabled
3. 在 `app/page.tsx` 的 `<nav>` 中加 `<Link>` 入口
4. **不要**创建 `layout.tsx`（除非该路由有独立布局需求）
5. **不要**使用 `generateStaticParams` 或 `generateMetadata`（静态导出不支持）
6. 如果要加云同步入口，参考 `app/page.tsx` 中的 `SettingsPanel` 调用方式

---

## 3. 新增一个组件

1. 在 `components/` 下创建文件，以 `"use client"` 开头
2. Props 类型定义在组件文件内，用 `type` 不用 `interface`
3. 样式加在 `app/globals.css` 中
4. **不要**为组件创建独立 CSS 文件 — 所有样式集中在 `globals.css`

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
2. 在 `lib/storage.ts` 中：加版本号 → 加迁移函数 → 更新 Gist 数据结构
3. **不要**直接改 LocalStorage key 名 — 导致用户历史数据丢失
4. `importDataFromFile()` 只检查 `events` 和 `todos` 字段存在，不校验完整性
5. 如果改了 Gist JSON 结构，`createGist`、`updateGist`、`fetchRawGist` 都要同步更新
