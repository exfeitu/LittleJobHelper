# 🤖 LittleJobHelper AI 开发上下文

> **重要**: 每次对话前,AI 必须阅读此文件以理解项目结构、技术栈和开发规范。

## 🎯 项目定位

轻量级日程/任务/日记管理 Web 应用,面向体制内人事工作场景。**当前为纯前端原型阶段**,数据已实现 LocalStorage 持久化,支持 GitHub Pages 静态部署。

**核心价值**: 提供工作回溯、待办事项管理及日程记录的 AI 驱动基础框架。

**部署状态**: ✅ 已配置 GitHub Actions 自动部署到 GitHub Pages

##  目录职责(AI 必须遵守)

| 路径 | 职责 | 约束 |
|------|------|------|
| `app/` | Next.js App Router 页面路由 | 每个目录对应一个路由,页面组件需声明 `"use client"` (若含状态) |
| `components/` | 可复用 UI 组件 | 严禁直接包含业务数据获取逻辑,仅接收 props |
| `lib/` | 工具函数、数据模拟、状态同步 | `storage.ts` 负责数据持久化,`utils.ts` 存放纯函数 |
| `types.ts` | 全局 TypeScript 类型定义 | 所有新增字段必须先在此声明类型 |
| `docs/` | 需求、规范、AI 开发指南 | 不引入业务代码,仅供人类/AI 阅读 |
| `.github/workflows/` | CI/CD 自动化部署 | `deploy.yml` 配置 GitHub Pages 自动部署流程 |
| `out/` | 静态构建产物 | `npm run build` 生成,用于生产环境部署 |

## ⚙️ 技术栈与强制约束

### 核心技术
- **框架**: Next.js 16.2.6 (App Router) + React 18.3.1
- **语言**: TypeScript 5.8.3 (**严格模式**,禁止 `any`)
- **样式**: Tailwind CSS + CSS Modules (禁止全局 CSS 污染)
- **日期处理**: `date-fns` (禁止硬拼 `T00:00:00` 等字符串)

### 状态管理
- **简单场景**: `useState` + `useMemo`
- **复杂跨组件**: 计划使用 Zustand (`lib/store/`,尚未实现)
- **当前阶段**: 所有状态在页面组件内部管理

### 数据流
- **读取**: 优先从 `lib/storage.ts` 的 LocalStorage 读取,若无则使用 `lib/sample-data.ts` 示例数据
- **写入**: 自动保存到 LocalStorage,支持 JSON 文件导入/导出备份
- **同步**: 新增 Event/Todo 时必须调用 `syncLinkedItems()` 保持双向引用

### 构建与部署
- **本地开发**: `npm run dev` (端口 10352)
- **生产构建**: `npm run build` → 生成 `out/` 目录静态文件
- **GitHub Pages**: push 到 `master` 分支自动触发部署
- **访问地址**: `https://exfeitu.github.io/LittleJobHelper/`

##  常见陷阱(AI 生成代码时必须规避)

1. **忘记双向同步**: 修改 `EventItem` 或 `TodoItem` 后未调用 `syncLinkedItems()`
2. **服务端/客户端混淆**: 含 `useState`/事件处理的组件缺少 `"use client"` 指令
3. **表单状态残留**: 提交后未重置 `form` 状态导致视图不刷新
4. **空列表无提示**: 未显示 `<p className="empty-note">暂无数据</p>` 占位
5. **类型缺失**: 新增接口未在 `types.ts` 中声明,或使用 `any` 绕过检查
6. **忽略持久化**: 修改数据后未通过 `setData()` 更新状态,导致 LocalStorage 不同步
7. **basePath 配置错误**: 静态导出时不要使用 `basePath`,否则会导致资源路径不匹配
8. **Node.js 版本问题**: CI 环境必须使用 Node.js >= 20.9.0,否则构建失败

## 📌 工作流约定

### 生成代码前
1. 阅读 `docs/CONVENTIONS.md` 了解编码规范
2. 查阅 `types.ts` 确认现有类型定义
3. 参考 `lib/sample-data.ts` 理解数据结构
4. 查看 `lib/storage.ts` 了解持久化机制

### 修改状态逻辑时
- 必须同步更新 `types.ts` 中的对应接口
- 确保所有相关组件的 props 类型一致
- 数据修改后通过 `setData()` 触发自动保存

### 提交前检查
```bash
npm run lint        # ESLint 检查
npm run build       # TypeScript 编译验证 + 静态导出
```

### 部署流程
```bash
# 1. 本地测试
npm run build
npx serve out -l [端口]

# 2. 提交代码
git add .
git commit -m "描述修改内容"
git push origin master

# 3. GitHub Actions 自动部署(约 2-3 分钟)
# 访问: https://exfeitu.github.io/LittleJobHelper/
```

##  按需加载的子文档

当需要详细信息时,AI 应通过 `@文件名` 引用以下文档:

- `@docs/ARCHITECTURE.md` - 系统架构、组件交互、数据流设计
- `@docs/CONVENTIONS.md` - 命名规范、组件结构、注释要求
- `@docs/WORKFLOWS.md` - Git 提交规范、测试流程、部署步骤
- `@docs/DATA_STORAGE.md` - 数据持久化方案详解
- `@docs/TESTING_GUIDE.md` - LocalStorage 功能测试指南
- `@DEPLOY_GUIDE.md` - GitHub Pages 完整部署指南
- `@DEPLOY_CHECKLIST.md` - 部署快速检查清单

## 📦 关键配置文件说明

### `next.config.mjs`
```javascript
{
  output: 'export',           // 启用静态导出
  images: { unoptimized: true } // 禁用图片优化(静态托管不支持)
}
```

**注意**: 
- ❌ 不要使用 `basePath` 配置,Next.js 会自动处理 GitHub Pages 子路径
- ✅ 必须设置 `output: 'export'` 才能生成静态文件

### `.github/workflows/deploy.yml`
- **触发条件**: push 到 `master` 分支或手动触发
- **Node.js 版本**: 20.x (必须 >= 20.9.0)
- **构建命令**: `npm ci && npm run build`
- **部署方式**: `actions/deploy-pages@v4`

### `.nojekyll`
- **作用**: 防止 GitHub Pages 使用 Jekyll 处理静态文件
- **位置**: 项目根目录(必须存在)

##  最后更新

- **版本**: v1.2.0 (新增 GitHub Pages 部署配置)
- **更新日期**: 2026-05-27
- **维护者**: LittleJobHelper 团队
- **在线演示**: https://exfeitu.github.io/LittleJobHelper/
