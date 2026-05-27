# 🔄 LittleJobHelper 开发工作流

## 📋 Git 提交规范

### 1. 分支策略

```
main          - 生产环境稳定版本
├── develop   - 开发集成分支
│   ├── feature/calendar-view    - 功能分支
│   ├── feature/supabase-integration
│   └── bugfix/fix-date-format
└── hotfix/critical-security     - 紧急修复分支
```

**规则**:
- ✅ `feature/*` 从 `develop` 切出,合并回 `develop`
- ✅ `hotfix/*` 从 `main` 切出,同时合并到 `main` 和 `develop`
- ❌ 禁止直接向 `main` 推送代码

### 2. Commit Message 格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范:

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type 类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(calendar): 添加月历视图组件` |
| `fix` | Bug 修复 | `fix(timeline): 修复跨天事件显示错误` |
| `docs` | 文档更新 | `docs(AGENTS): 补充状态管理规范` |
| `style` | 代码格式(不影响功能) | `style(components): 统一缩进为 2 空格` |
| `refactor` | 重构 | `refactor(utils): 提取日期格式化逻辑` |
| `test` | 测试相关 | `test(DayTimeline): 添加空列表测试用例` |
| `chore` | 构建/工具链变更 | `chore(deps): 升级 next 到 14.2.30` |

#### 完整示例

```
feat(todo-tree): 实现拖拽排序功能

- 添加 react-beautiful-dnd 依赖
- 实现 TodoTree 组件的 onDragEnd 处理
- 更新 sample-data.ts 中的测试数据

Closes #45
```

### 3. 提交前检查清单

```bash
# 1. 代码质量检查
npm run lint

# 2. TypeScript 编译验证
npm run build

# 3. 查看变更文件
git status

# 4. 暂存变更
git add .

# 5. 提交(使用 commitizen 或手动)
git commit -m "feat(component): 描述"

# 6. 推送到远程
git push origin feature/your-branch
```

---

## 🧪 测试流程(待实现)

### Phase 1: 基础单元测试

```bash
# 安装测试框架
npm install -D vitest @testing-library/react @testing-library/jest-dom

# 运行测试
npm test

# 监听模式(开发时)
npm run test:watch
```

### 测试覆盖率目标

| 模块 | 最低覆盖率 | 说明 |
|------|-----------|------|
| `lib/utils.ts` | 90% | 纯函数,易测试 |
| `components/` | 70% | UI 组件,侧重交互逻辑 |
| `app/` | 50% | 页面组件,侧重集成测试 |

---

## 🚀 部署流程

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器(端口 10352)
npm run dev

# 3. 访问 http://localhost:10352
```

### 生产构建

```bash
# 1. 清理旧构建
rm -rf .next out

# 2. 构建生产版本(生成静态文件到 out/ 目录)
npm run build

# 3. 本地预览静态文件
npx serve out -l 8080

# 4. 访问 http://localhost:8080
```

### GitHub Pages 部署(当前方案)

#### 自动部署流程

```bash
# 1. 修改代码
# ... 你的开发工作 ...

# 2. 提交并推送
git add .
git commit -m "feat: 描述你的修改"
git push origin master

# 3. GitHub Actions 自动触发(约 2-3 分钟)
# 查看进度: https://github.com/exfeitu/LittleJobHelper/actions

# 4. 访问线上版本
# https://exfeitu.github.io/LittleJobHelper/
```

#### 首次部署配置(仅需一次)

1. **访问仓库设置**: https://github.com/exfeitu/LittleJobHelper/settings/pages
2. **启用 GitHub Pages**:
   - Source: 选择 **GitHub Actions**
   - 保存即可
3. **验证部署**:
   - 访问 Actions 标签查看部署状态
   - 确认网站可正常访问

#### 关键配置文件

**.nojekyll** (必须存在)
- 位置: 项目根目录
- 作用: 防止 GitHub Pages 使用 Jekyll 处理静态文件
- 内容: 空文件即可

**next.config.mjs**
```javascript
{
  output: 'export',           // 启用静态导出
  images: { unoptimized: true } // 禁用图片优化
}
```

**注意**: 
- ❌ 不要使用 `basePath` 配置,Next.js 会自动处理 GitHub Pages 子路径
- ✅ 确保 `.github/workflows/deploy.yml` 中 Node.js 版本 >= 20.9.0

#### 常见问题排查

| 问题 | 解决方案 |
|------|---------|
| 页面显示 404 | 检查 URL 是否正确,等待 5 分钟让 CDN 刷新 |
| 样式加载失败 | 按 F12 查看控制台错误,确认资源路径正确 |
| Actions 运行失败 | 查看 Actions 日志,检查 TypeScript 错误 |
| Node.js 版本错误 | 确保 workflow 中使用 Node.js 20+ |
| 数据丢失 | LocalStorage 是浏览器级别存储,清除缓存会丢失 |

### Vercel 部署(备选方案)

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录
vercel login

# 3. 部署
vercel --prod
```

**环境变量配置**(Vercel Dashboard):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase 项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase 匿名密钥

---

## 📦 依赖管理规范

### 1. 添加新依赖

```bash
# 生产依赖
npm install date-fns

# 开发依赖
npm install -D @types/node
```

### 2. 依赖审查

```bash
# 检查过时包
npm outdated

# 安全审计
npm audit

# 自动修复安全问题
npm audit fix
```

### 3. package.json 脚本说明

```json
{
  "scripts": {
    "dev": "next dev -p 10352",    // 开发服务器(指定端口)
    "build": "next build",          // 生产构建
    "start": "next start",          // 启动生产服务器
    "lint": "next lint"             // ESLint 检查
  }
}
```

---

## 🔍 Code Review  checklist

### 提交 PR 前自查

- [ ] 代码通过 `npm run lint` 无警告
- [ ] TypeScript 编译无错误(`npm run build`)
- [ ] 新增功能有对应测试用例
- [ ] 更新了相关文档(AGENTS.md / docs/)
- [ ] Commit message 符合规范
- [ ] 无 console.log 等调试代码残留
- [ ] 无硬编码的魔法数字/字符串

### Reviewer 关注点

1. **功能正确性**: 是否满足需求文档
2. **代码质量**: 是否符合 CONVENTIONS.md
3. **性能影响**: 是否有不必要的重渲染
4. **安全性**: 是否有 XSS/注入风险
5. **可维护性**: 命名是否清晰,注释是否充分

---

## 🐛 Debug 指南

### 常见问题排查

#### 1. 组件不更新

```tsx
// ❌ 直接修改 state
state.items.push(newItem)
setState(state)

// ✅ 创建新数组
setState(prev => [...prev, newItem])
```

#### 2. TypeScript 类型错误

```bash
# 查看详细错误信息
npx tsc --noEmit

# 定位具体文件
npx tsc --noEmit --pretty false
```

#### 3. Next.js 路由 404

- 检查 `app/` 目录下是否有 `page.tsx`
- 确认文件夹命名与路由一致(小写+连字符)
- 重启开发服务器:`npm run dev`

### 浏览器 DevTools 技巧

```javascript
// 1. 查看 React 组件树
// 安装 React DevTools 扩展

// 2. 调试状态更新
console.table(events)  // 表格形式查看数组

// 3. 性能分析
// Performance 面板记录重渲染
```

---

## 📚 学习资源

### 官方文档

- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

### 本项目文档

- `AGENTS.md` - AI 全局上下文(必读)
- `docs/ARCHITECTURE.md` - 系统架构详解
- `docs/CONVENTIONS.md` - 编码规范
- `docs/AI_DEVELOPMENT_GUIDE.md` - AI 驱动开发指南

---

**最后更新**: 2026-05-27  
**维护者**: LittleJobHelper 团队
