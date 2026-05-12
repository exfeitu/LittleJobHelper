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
- 导出数据预览
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
