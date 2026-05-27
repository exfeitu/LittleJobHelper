# Little Job Helper

这是一个为体制内人事工作场景设计的工作回溯与待办管理工具基础工程。

## 当前包含

- Next.js + TypeScript 基础工程
- 左侧导航 + 顶部搜索 + 右侧今日待办面板布局原型
- 多天纵向时间轴原型
- 多级子任务示例
- 部门 / 联系人 / 备注字段
- 日程文字日记视图
- 搜索结果原型
- **数据持久化**：LocalStorage 自动保存 + JSON 导入/导出
- AI 驱动开发文档
- 产品需求文档

## 运行方式

先安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

导出代码文件目录：
```bash
find . \( -path ./node_modules -o -path ./.next -o -path ./.git \) -prune -o -print
```

## 数据管理功能

### 自动保存
所有任务和时间轴数据会自动保存到浏览器的 LocalStorage，刷新页面后数据不会丢失。

### 导出数据
点击页面顶部的"📥 导出数据"按钮，会将所有数据导出为 JSON 文件，可用于备份或迁移。

### 导入数据
点击"📤 导入数据"按钮，选择之前导出的 JSON 文件，可以快速恢复数据。

### 清空数据
点击"🗑️ 清空数据"按钮，可以清除所有本地存储的数据（操作不可恢复）。

## 文档

- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/AI_DEVELOPMENT_GUIDE.md`
- `docs/PROMPT_TEMPLATES.md`
- `docs/ROADMAP.md`

## 下一步建议

1. 接入 Supabase
2. 补齐真实 CRUD
3. 实现提醒、日历联动和 Excel 真正导出
4. 再推进 iOS / Android App
