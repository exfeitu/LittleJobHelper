# Little Job Helper AI 开发总说明

## 1. 项目定位

`Little Job Helper` 是一个面向体制内人事科、办公室、组织口岗位的工作回溯与待办管理工具。

当前仓库中的基础代码目标不是一次性做完所有功能，而是提供一个可以继续让 AI 稳定迭代的最小可行底座，重点覆盖：

- Web 首版原型
- 清晰的数据结构
- 可扩展到云端同步
- 可扩展到 iOS / Android App
- 可继续通过 AI 分阶段补完功能

## 2. 当前基础代码包含内容

当前已经落地：

- `Next.js 14 + TypeScript` Web 项目脚手架
- `app/page.tsx` 单页原型工作台
- 日程、待办、搜索结果的领域类型定义
- 支持多级子任务的树形构建逻辑
- 包含 `department`、`contactPerson`、`remarks` 字段
- 今日待办视图
- 文字日记视图
- 全局搜索结果原型
- Excel 导出数据预览结构
- 面向未来 App 的架构说明区块

## 3. 推荐技术路线

### Web 版

- 框架：`Next.js`
- 语言：`TypeScript`
- UI：原生 CSS 起步，后续可引入 `Tailwind CSS`
- 数据：前期本地模拟，随后切到 `Supabase`

### 后端/云端

优先推荐：`Supabase`

原因：

- 自带账号体系
- 自带 PostgreSQL
- 自带文件存储
- 对 AI 生成 SQL、表结构、RLS 策略很友好
- 后续给 App 端复用非常顺手

推荐模块：

- `Supabase Auth`：手机号验证码或邮箱登录
- `Supabase Postgres`：事件、待办、标签、用户设置
- `Supabase Storage`：附件上传
- `Supabase Edge Functions`：导出、聚合统计、自动摘要

### App 版

推荐第二阶段采用：`React Native + Expo`

理由：

- 与 Web 同样使用 TypeScript
- 领域模型、校验逻辑、接口类型可复用
- AI 生成跨端代码的成功率较高
- Android / iOS 可以同步推进

## 4. 建议的仓库演进结构

第一阶段可先保持当前简单结构。

第二阶段建议演进为：

```text
apps/
  web/
  mobile/
packages/
  ui/
  domain/
  api/
  config/
```

说明：

- `apps/web`：Next.js Web 应用
- `apps/mobile`：Expo App
- `packages/domain`：事件、待办、搜索、导出等共享类型与业务逻辑
- `packages/ui`：可复用组件
- `packages/api`：Supabase 调用封装
- `packages/config`：eslint、tsconfig、主题常量

## 5. 核心数据模型建议

### events

建议字段：

- `id`
- `user_id`
- `start_time`
- `end_time`
- `title`
- `detail`
- `tags`（text[]）
- `created_at`
- `updated_at`

### todos

建议字段：

- `id`
- `user_id`
- `parent_id`
- `title`
- `due_date`
- `priority`
- `status`
- `tags`（text[]）
- `department`
- `contact_person`
- `remarks`
- `pinned_to_today`
- `sort_order`
- `created_at`
- `updated_at`

### attachments

后期可加：

- `id`
- `user_id`
- `owner_type` (`event` / `todo`)
- `owner_id`
- `file_name`
- `file_path`
- `file_size`
- `mime_type`
- `created_at`

## 6. 搜索设计建议

用户明确要求可以按以下信息搜索：

- 待办标题
- 子任务标题
- 部门
- 联系人
- 备注
- 日程标题
- 日程详情
- 标签

Web MVP 阶段：

- 前端本地过滤即可

正式版阶段：

- PostgreSQL `tsvector` 全文搜索
- 中文搜索可先采用 `ILIKE` + 多字段拼接过渡
- 如果后期数据很多，再引入 `Meilisearch` 或 `Typesense`

## 7. 导出设计建议

首版建议：

- Web 前端直接使用 `xlsx` 生成工作簿
- 两个 sheet：`events`、`todos`
- 按日期范围导出

App 端建议：

- 导出操作优先放到 Web
- App 提供“发送到邮箱”或“生成临时下载链接”即可

## 8. AI 驱动开发原则

这个项目非常适合 AI 协作开发，但前提是任务拆得足够细。

推荐原则：

1. 一次只让 AI 处理一个明确功能块。
2. 先让 AI 阅读现有文件，再要求修改。
3. 每次要求 AI 输出：
   - 修改了哪些文件
   - 为什么这么改
   - 下一步建议是什么
4. 每做完一个功能，就让 AI 自查：
   - 类型错误
   - lint 问题
   - 边界交互
   - 数据字段是否齐全
5. 避免一口气让 AI “做完整个平台”，应按模块迭代。

## 9. 推荐的 AI 开发工作流

### 阶段 A：原型搭建

让 AI 完成：

- 页面结构
- 示例数据
- 组件拆分
- 视觉样式
- 本地交互原型

### 阶段 B：数据接入

让 AI 完成：

- Supabase 表结构 SQL
- 登录流程
- CRUD 接口
- 行级权限策略

### 阶段 C：高级能力

让 AI 完成：

- 搜索
- Excel 导出
- 时间轴图表
- 附件上传
- 周报总结

### 阶段 D：移动端迁移

让 AI 完成：

- Expo 工程初始化
- 登录页
- 今日页
- 待办树
- 数据同步

## 10. 建议直接给 AI 的任务拆分清单

你后续可以把以下任务逐条交给 AI：

1. 接入 Supabase 登录与数据库
2. 把 sample data 改成真实数据库读取
3. 实现新增/编辑/删除待办
4. 实现新增/编辑/删除日程
5. 实现待办多级折叠展开
6. 实现今日待办固定到今天
7. 实现全局搜索筛选器
8. 实现 Excel 导出
9. 实现月/周/日时间轴图表
10. 实现附件上传
11. 实现移动端 Expo 版本
12. 实现部署脚本与环境变量模板

## 11. 当前阶段最合适的下一步

建议优先顺序：

1. 接入 `Supabase`
2. 完成真实登录
3. 完成待办 CRUD
4. 完成日程 CRUD
5. 完成搜索与导出
6. 再做 App

原因很简单：

只有先把 Web 版的业务闭环跑通，后续 App 才不会重复返工。
