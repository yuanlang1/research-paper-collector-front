# 任务列表 API 更新说明

## 更新概述

根据需求，修改了 `/search/tasks` 接口的响应结构，主要变更如下：

1. **keywords 字段类型变更**：从 `string[]` 改为 `string`（逗号分隔的字符串）
2. **新增 errorMessage 字段**：用于显示任务失败时的错误信息

## 修改详情

### 1. API 接口定义更新 (`src/services/api.ts`)

#### SearchTaskRaw 接口
```typescript
export interface SearchTaskRaw {
  id: number
  searchWord: string
  keywords: string // 关键词字符串，逗号分隔（原为 string[]）
  taskState: string
  errorMessage: string | null // 新增：错误信息，任务失败时显示
  searchTime: string
}
```

#### SearchTask 接口
```typescript
export interface SearchTask {
  id: number
  taskName: string
  searchTerm: string
  keywords: string[]
  date: string  
  progress: string
  status: 'searching' | 'success' | 'failed'
  errorMessage?: string | null // 新增：错误信息
}
```

#### 数据转换逻辑更新
在 `convertRawTask` 方法中添加了关键词字符串到数组的转换：

```typescript
private convertRawTask(rawTask: SearchTaskRaw): SearchTask {
  const { status, progress } = this.convertTaskStatus(rawTask.taskState)
  
  // 将逗号分隔的关键词字符串转换为数组
  const keywordsArray = rawTask.keywords 
    ? rawTask.keywords.split(',').map(k => k.trim()).filter(k => k)
    : []
  
  return {
    id: rawTask.id,
    taskName: `任务${rawTask.id.toString().padStart(3, '0')}`,
    searchTerm: rawTask.searchWord,
    keywords: keywordsArray,
    date: this.formatDateTime(rawTask.searchTime),
    progress,
    status,
    errorMessage: rawTask.errorMessage // 新增
  }
}
```

### 2. 前端显示更新 (`src/views/TasksView.vue`)

#### 模板更新
在进度列中添加了错误信息显示：

```vue
<td class="align-center">
  <div class="status-cell">
    <span 
      class="progress-badge" 
      :class="getProgressClass(task.status)"
    >
      {{ task.progress }}
    </span>
    <div v-if="task.errorMessage" class="error-message">
      {{ task.errorMessage }}
    </div>
  </div>
</td>
```

#### 样式更新
添加了新的 CSS 类：

```css
.status-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.error-message {
  font-size: 11px;
  color: #dc2626;
  background-color: #fef2f2;
  padding: 4px 8px;
  border-radius: 4px;
  border-left: 2px solid #dc2626;
  max-width: 200px;
  text-align: left;
  line-height: 1.4;
}
```

## 后端接口要求

后端需要返回以下格式的数据：

```json
{
  "code": 0,
  "success": true,
  "message": "string",
  "other": "string",
  "data": {
    "total": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "pages": 0,
    "list": [
      {
        "id": 0,
        "searchWord": "string",
        "keywords": "keyword1, keyword2, keyword3",
        "taskState": "string",
        "errorMessage": "错误信息或null",
        "searchTime": "string"
      }
    ]
  }
}
```

### 关键点：
1. **keywords**：必须是字符串类型，多个关键词用英文逗号 `,` 分隔
2. **errorMessage**：
   - 任务成功时应为 `null`
   - 任务失败时包含具体的错误描述信息
   - 前端会在状态徽章下方显示此错误信息

## 示例数据

### 成功的任务
```json
{
  "id": 1,
  "searchWord": "深度学习",
  "keywords": "Deep Learning, Neural Networks, Machine Learning",
  "taskState": "COMPLETED",
  "errorMessage": null,
  "searchTime": "2024-11-01"
}
```

### 失败的任务
```json
{
  "id": 3,
  "searchWord": "计算机视觉",
  "keywords": "Computer Vision, Image Processing, Object Detection",
  "taskState": "FAILED",
  "errorMessage": "搜索超时，请稍后重试",
  "searchTime": "2024-10-28"
}
```

## 显示效果

- **正常任务**：只显示状态徽章（如"检索成功"、"检索中"等）
- **失败任务**：状态徽章下方会显示红色的错误信息框，包含具体的错误描述

## 测试建议

1. 测试正常任务（errorMessage 为 null）的显示
2. 测试失败任务（errorMessage 有值）的显示
3. 测试 keywords 字符串的正确解析（包括空字符串、单个关键词、多个关键词）
4. 测试长错误信息的显示效果（应该换行显示，最大宽度 200px）
