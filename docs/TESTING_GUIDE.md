# 🧪 LocalStorage 功能测试指南

## 测试步骤

### 1️⃣ 启动应用
```bash
npm run dev
```
访问 http://localhost:10352

---

### 2️⃣ 测试自动保存

#### 步骤：
1. 打开浏览器开发者工具（F12）
2. 切换到 **Application** 标签
3. 左侧选择 **Local Storage** → `http://localhost:10352`
4. 观察是否有以下键：
   - `little-job-helper-events`
   - `little-job-helper-todos`

#### 预期结果：
✅ 应该看到两个键，值为 JSON 字符串

---

### 3️⃣ 测试数据持久化

#### 步骤：
1. 在页面上添加一个新任务（点击"+ 添加任务"）
2. 填写任务信息并提交
3. **刷新页面**（F5 或 Ctrl+R）
4. 检查新任务是否依然存在

#### 预期结果：
✅ 刷新后，新添加的任务应该还在

---

### 4️⃣ 测试导出数据

#### 步骤：
1. 点击页面顶部的"📥 导出数据"按钮
2. 浏览器应自动下载一个 JSON 文件
3. 文件名格式：`little-job-helper-backup-YYYY-MM-DD.json`
4. 用文本编辑器打开文件，检查内容

#### 预期结果：
✅ 下载的 JSON 文件包含完整的事件和待办数据
```json
{
  "version": "1.0.0",
  "exportedAt": "2026-05-27T...",
  "events": [...],
  "todos": [...]
}
```

---

### 5️⃣ 测试导入数据

#### 步骤：
1. 先清空一些数据（或删除几个任务）
2. 点击"📤 导入数据"按钮
3. 选择之前导出的 JSON 文件
4. 检查数据是否恢复

#### 预期结果：
✅ 导入成功后，所有数据恢复到导出时的状态
✅ 弹出提示："数据导入成功！"

#### 错误测试：
1. 尝试导入一个无效的 JSON 文件
2. 应该显示错误提示

---

### 6️⃣ 测试清空数据

#### 步骤：
1. 点击"🗑️ 清空数据"按钮
2. 确认对话框中选择"确定"
3. 检查页面是否变为空状态
4. 刷新页面，确认数据已清除

#### 预期结果：
✅ 清空后页面显示"暂无今日待办"等空状态提示
✅ 刷新后依然为空
✅ LocalStorage 中的两个键被删除

---

### 7️⃣ 测试数据同步

#### 步骤：
1. 添加一个任务，并关联到某个时间轴事件
2. 在 LocalStorage 中查看 `little-job-helper-todos`
3. 检查任务的 `linkedEventIds` 字段
4. 查看 `little-job-helper-events`
5. 检查事件的 `linkedTodoIds` 字段

#### 预期结果：
✅ Event 和 Todo 的双向关联正确建立
✅ 修改一方，另一方自动同步

---

## 🔍 调试技巧

### 查看 LocalStorage 数据
```javascript
// 在浏览器控制台执行
console.log(JSON.parse(localStorage.getItem('little-job-helper-events')));
console.log(JSON.parse(localStorage.getItem('little-job-helper-todos')));
```

### 手动清除数据
```javascript
// 在浏览器控制台执行
localStorage.removeItem('little-job-helper-events');
localStorage.removeItem('little-job-helper-todos');
location.reload();
```

### 模拟大数据量
```javascript
// 在浏览器控制台执行，测试性能
const events = JSON.parse(localStorage.getItem('little-job-helper-events'));
const todos = JSON.parse(localStorage.getItem('little-job-helper-todos'));
console.log(`Events: ${events.length}, Todos: ${todos.length}`);
```

---

## ✅ 测试检查清单

- [ ] LocalStorage 中有两个键（events 和 todos）
- [ ] 添加任务后刷新页面，数据依然存在
- [ ] 导出数据生成有效的 JSON 文件
- [ ] 导入数据能正确恢复
- [ ] 导入无效文件时显示错误提示
- [ ] 清空数据后 LocalStorage 被清除
- [ ] Event ↔ Todo 双向关联正确同步
- [ ] 示例数据在无缓存时正确加载
- [ ] 所有操作无控制台错误

---

## 🐛 常见问题排查

### 问题 1：刷新后数据丢失
**可能原因**：
- 浏览器禁用了 LocalStorage
- 使用了无痕/隐私模式
- 代码未正确调用 `saveEventsToStorage()`

**解决方法**：
1. 检查浏览器是否允许 LocalStorage
2. 退出无痕模式
3. 在控制台查看是否有保存错误

### 问题 2：导入失败
**可能原因**：
- JSON 文件格式错误
- 缺少必需的 `events` 或 `todos` 字段
- 文件编码问题

**解决方法**：
1. 用 JSON 验证工具检查文件格式
2. 确保包含 `events` 和 `todos` 数组
3. 使用 UTF-8 编码保存文件

### 问题 3：数据不同步
**可能原因**：
- `syncLinkedItems()` 未正确调用
- 数据结构损坏

**解决方法**：
1. 检查控制台是否有同步错误
2. 清空数据后重新添加
3. 确保使用最新版本的代码

---

**最后更新**: 2026-05-27  
**维护者**: LittleJobHelper 团队
