# 📦 数据持久化功能说明

## ✨ 功能概述

LittleJobHelper 现已支持 **LocalStorage 数据持久化**，所有任务和时间轴数据会自动保存到浏览器本地存储，刷新页面后数据不会丢失。

---

## 🎯 核心功能

### 1. 自动保存
- **触发时机**：每次添加、修改、删除任务或事件时自动保存
- **存储位置**：浏览器 LocalStorage
- **存储键名**：
  - `little-job-helper-events`：时间轴事件数据
  - `little-job-helper-todos`：待办任务数据
- **初始化逻辑**：优先从 LocalStorage 读取数据，若无则使用示例数据

### 2. 导出数据（备份）
- **操作方式**：点击页面顶部"📥 导出数据"按钮
- **导出格式**：JSON 文件
- **文件命名**：`little-job-helper-backup-YYYY-MM-DD.json`
- **包含内容**：
  ```json
  {
    "version": "1.0.0",
    "exportedAt": "2026-05-27T...",
    "events": [...],
    "todos": [...]
  }
  ```

### 3. 导入数据（恢复）
- **操作方式**：点击"📤 导入数据"按钮，选择 JSON 文件
- **验证机制**：自动检查文件格式和数据完整性
- **错误提示**：导入失败时显示具体错误信息
- **数据同步**：导入后自动重建 Event ↔ Todo 双向关联

### 4. 清空数据
- **操作方式**：点击"🗑️ 清空数据"按钮
- **安全确认**：弹出确认对话框，防止误操作
- **影响范围**：清除所有 LocalStorage 数据和页面状态
- **不可恢复**：清空后无法恢复，请提前导出备份

---

## 🔧 技术实现

### 文件结构
```
lib/
└── storage.ts          # 数据存储工具模块
    ├── loadEventsFromStorage()      # 读取事件数据
    ├── loadTodosFromStorage()       # 读取待办数据
    ├── saveEventsToStorage()        # 保存事件数据
    ├── saveTodosToStorage()         # 保存待办数据
    ├── clearAllStorage()            # 清空所有数据
    ├── exportDataAsFile()           # 导出为 JSON 文件
    └── importDataFromFile()         # 从 JSON 文件导入
```

### 核心代码逻辑

#### 初始化数据
```typescript
const [{ events, todos }, setData] = useState(() => {
  const storedEvents = loadEventsFromStorage();
  const storedTodos = loadTodosFromStorage();
  
  if (storedEvents && storedTodos) {
    return syncLinkedItems(storedEvents, storedTodos);
  }
  
  return syncLinkedItems(sampleEvents, sampleTodos);
});
```

#### 自动保存
```typescript
useEffect(() => {
  if (isInitialized) {
    saveEventsToStorage(events);
    saveTodosToStorage(todos);
  }
}, [events, todos, isInitialized]);
```

#### 数据导出
```typescript
export function exportDataAsFile(events: EventItem[], todos: TodoItem[]): void {
  const data = {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    events,
    todos,
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `little-job-helper-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

---

## 📊 数据存储限制

| 项目 | 说明 |
|------|------|
| **存储容量** | 通常 5-10 MB（足够存储数千条任务） |
| **数据类型** | 仅支持字符串（自动 JSON 序列化） |
| **安全性** | 数据存储在客户端，不适合敏感信息 |
| **跨设备** | 不同设备/浏览器数据不共享（通过导入/导出解决） |
| **持久性** | 除非手动清除，否则永久保存 |

---

## 🚀 使用场景

### 场景 1：日常工作
1. 打开应用，自动加载上次保存的数据
2. 添加/修改任务，数据自动保存
3. 关闭浏览器，下次打开数据依然存在

### 场景 2：数据备份
1. 定期点击"📥 导出数据"
2. 保存 JSON 文件到云盘或本地文件夹
3. 需要时可通过"📤 导入数据"恢复

### 场景 3：设备迁移
1. 在旧设备导出 JSON 文件
2. 将文件传输到新设备
3. 在新设备导入 JSON 文件
4. 完成数据迁移

### 场景 4：团队协作
1. 团队成员 A 导出数据
2. 分享给团队成员 B
3. 成员 B 导入数据查看
4. （注意：会覆盖现有数据）

---

## ⚠️ 注意事项

### 数据安全
- LocalStorage 数据未加密，不建议存储敏感信息
- 建议定期导出备份，防止浏览器清理导致数据丢失
- 清空数据前务必确认已备份

### 兼容性
- ✅ Chrome / Edge / Firefox / Safari（现代版本）
- ✅ 移动端浏览器
- ❌ IE11 及以下版本（不支持）

### 性能考虑
- 数据量过大（>1000 条）时可能影响性能
- 建议定期清理已完成/已取消的任务
- 大数据量时可考虑升级到 IndexedDB

---

## 🔮 未来升级路径

```
LocalStorage (当前) 
    ↓
IndexedDB (大数据量、结构化存储)
    ↓
Supabase/后端API (云端同步、多设备支持)
```

**升级优势**：
- 业务逻辑保持不变
- 只需替换 `lib/storage.ts` 中的实现
- 平滑过渡，无需重构其他代码

---

## 📝 常见问题

### Q1: 刷新页面后数据还在吗？
✅ 是的，所有数据会自动保存到 LocalStorage，刷新后依然存在。

### Q2: 清除浏览器缓存会影响数据吗？
⚠️ 会的。清除浏览器缓存/数据会删除 LocalStorage 中的内容，请提前导出备份。

### Q3: 可以在多个标签页同时使用吗？
✅ 可以，但建议只在一个标签页编辑，避免数据冲突。

### Q4: 导出的 JSON 文件可以手动编辑吗？
⚠️ 技术上可以，但不建议。错误的格式会导致导入失败。

### Q5: 如何彻底重置为初始状态？
点击"🗑️ 清空数据"按钮，或手动清除浏览器 LocalStorage。

---

**最后更新**: 2026-05-27  
**维护者**: LittleJobHelper 团队
