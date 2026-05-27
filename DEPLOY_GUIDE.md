# 🚀 LittleJobHelper GitHub Pages 部署指南

## 📋 部署前准备

### 1. 确保代码已推送到 GitHub

```bash
# 检查当前状态
git status

# 如果有未提交的更改
git add .
git commit -m "feat: 配置 GitHub Pages 静态导出"

# 推送到 GitHub
git push origin main
```

### 2. 确认仓库名称

你的 GitHub 仓库应该是：`https://github.com/[你的用户名]/LittleJobHelper`

---

## 🎯 首次部署步骤

### 第 1 步：启用 GitHub Pages

1. 访问你的 GitHub 仓库页面
2. 点击 **Settings**（设置）标签
3. 在左侧菜单找到 **Pages**
4. 在 **Build and deployment** 部分：
   - **Source**: 选择 `GitHub Actions`
   - 不需要选择分支（因为我们使用工作流）

### 第 2 步：触发自动部署

推送代码后，GitHub Actions 会自动运行：

1. 访问仓库的 **Actions** 标签
2. 你会看到 `Deploy to GitHub Pages` 工作流正在运行
3. 等待 2-3 分钟，直到显示绿色 ✅

### 第 3 步：访问部署后的网站

部署成功后，访问地址：

```
https://[你的用户名].github.io/LittleJobHelper/
```

例如：`https://exfeitu.github.io/LittleJobHelper/`

---

## 🔄 后续更新

每次你 push 代码到 `main` 分支时：

1. GitHub Actions 自动触发重新构建
2. 等待 2-3 分钟
3. 访问网址查看最新版本

**无需手动操作！**

---

## ⚠️ 常见问题

### 问题 1：部署后页面显示 404

**原因**：路径配置问题

**解决方案**：
1. 检查浏览器控制台是否有错误
2. 确认访问的是正确 URL（注意大小写）
3. 等待 5 分钟让 CDN 缓存刷新

### 问题 2：样式加载失败

**原因**：资源路径问题

**解决方案**：
1. 打开浏览器开发者工具（F12）
2. 查看 Console 和 Network 标签
3. 确认 CSS 文件是否正确加载
4. 如果路径错误，可能需要添加 `basePath` 配置

### 问题 3：LocalStorage 数据丢失

**说明**：这是正常现象！

- LocalStorage 是**浏览器级别**的存储
- 每个用户的浏览器都有独立的 LocalStorage
- 清除浏览器缓存会导致数据丢失
- **建议**：定期使用"导出数据"功能备份

### 问题 4：GitHub Actions 运行失败

**排查步骤**：
1. 访问 **Actions** 标签
2. 点击失败的工作流
3. 查看错误日志
4. 常见错误：
   - `npm ci` 失败 → 检查 package.json 是否有效
   - `next build` 失败 → 检查 TypeScript 错误
   - 权限错误 → 检查仓库 Settings → Actions → General

---

## 🛠️ 本地测试静态站点

在部署前，你可以在本地测试生成的静态文件：

```bash
# 1. 构建静态站点
npm run build

# 2. 安装静态文件服务器
npm install -g serve

# 3. 启动本地服务器
serve out

# 4. 访问 http://localhost:3000
```

---

## 📊 部署检查清单

部署前确认：

- [ ] 代码已推送到 GitHub main 分支
- [ ] GitHub Actions 工作流文件存在（`.github/workflows/deploy.yml`）
- [ ] `.nojekyll` 文件已创建
- [ ] `next.config.mjs` 中配置了 `output: 'export'`
- [ ] `package.json` 中有 `build` 脚本

部署后验证：

- [ ] 网站可以正常访问
- [ ] 首页时间轴正常显示
- [ ] 日历页面可以访问（`/calendar`）
- [ ] 搜索功能正常工作
- [ ] 待办事项可以添加/编辑
- [ ] 数据导出/导入功能正常
- [ ] 响应式设计在手机端正常

---

## 🎓 进阶配置

### 自定义域名

如果你想使用自己的域名：

1. 在 GitHub Pages 设置中添加自定义域名
2. 在你的域名服务商处配置 CNAME 记录
3. 在项目根目录创建 `CNAME` 文件，内容为你的域名

### 添加 basePath（如果需要）

如果你的仓库名称不是 `LittleJobHelper`，或者部署在子路径下，需要修改 `next.config.mjs`：

```javascript
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: '/LittleJobHelper', // 添加这一行
  images: {
    unoptimized: true,
  },
};
```

---

## 📞 获取帮助

如果遇到问题：

1. 查看 GitHub Actions 日志
2. 检查浏览器控制台错误
3. 参考 Next.js 静态导出文档：https://nextjs.org/docs/app/building-your-application/deploying/static-exports
4. 联系项目维护者

---

**最后更新**: 2026-05-27  
**维护者**: LittleJobHelper 团队
