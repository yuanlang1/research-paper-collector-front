# 任务状态查询 API 更新说明

## 更新概述

修改了 `/search/state` 接口的响应结构，将 `data` 字段从简单的字符串改为包含 `state` 和 `errorMessage` 的对象。

## 修改详情

### 1. API 接口定义更新 (`src/services/api.ts`)

#### TaskStatusResponse 接口

**修改前：**
```typescript
export interface TaskStatusResponse {
  code: number
  success: boolean
  data: string // 状态字符串: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  message: string
  other: string | null
}
```

**修改后：**
```typescript
export interface TaskStatusResponse {
  code: number
  success: boolean
  data: {
    state: string // 状态字符串: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
    errorMessage: string | null // 错误信息
  }
  message: string
  other: string | null
}
```

#### 模拟数据更新

更新了 `getMockTaskStatus` 方法，返回包含 `state` 和 `errorMessage` 的对象：

```typescript
private getMockTaskStatus(taskId: number): TaskStatusResponse {
  const randomState = Math.random()
  let state = 'RUNNING'
  let errorMessage: string | null = null
  
  // ... 状态判断逻辑 ...
  
  if (taskId === 3) {
    state = 'FAILED'
    errorMessage = '搜索超时，请稍后重试'
  }
  
  return {
    code: 0,
    success: true,
    data: {
      state,
      errorMessage
    },
    message: '',
    other: null
  }
}
```

### 2. 前端使用更新 (`src/views/TasksView.vue`)

#### 状态更新逻辑

更新了 `updateTaskStatus` 函数，从 `response.data.state` 读取状态，并处理 `errorMessage`：

```typescript
const updateTaskStatus = async (taskId: number) => {
  try {
    const response = await apiService.getTaskStatus(taskId)
    if (response.code === 0 && response.success) {
      const task = tasks.value.find(t => t.id === taskId)
      if (task) {
        switch (response.data.state) {
          case 'PENDING':
            task.status = 'searching'
            task.progress = '等待中'
            task.errorMessage = null
            break
          case 'RUNNING':
            task.status = 'searching'
            task.progress = '正在检索'
            task.errorMessage = null
            break
          case 'COMPLETED':
            task.status = 'success'
            task.progress = '检索成功'
            task.errorMessage = null
            break
          case 'FAILED':
            task.status = 'failed'
            task.progress = '检索失败'
            task.errorMessage = response.data.errorMessage
            break
          case 'CANCELLED':
            task.status = 'failed'
            task.progress = '已取消'
            task.errorMessage = null
            break
        }
      }
    }
  } catch (error) {
    console.error('Failed to update task status:', error)
  }
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
    "state": "PENDING|RUNNING|COMPLETED|FAILED|CANCELLED",
    "errorMessage": "错误信息或null"
  }
}
```

### 字段说明

#### data.state
任务状态字符串，可能的值：
- `PENDING` - 等待中
- `RUNNING` - 正在检索
- `COMPLETED` - 检索成功
- `FAILED` - 检索失败
- `CANCELLED` - 已取消

#### data.errorMessage
- 当任务状态为 `FAILED` 时，应包含具体的错误描述信息
- 其他状态时应为 `null`
- 前端会在任务列表的状态列中显示此错误信息

## 示例数据

### 成功状态
```json
{
  "code": 0,
  "success": true,
  "message": "",
  "other": null,
  "data": {
    "state": "COMPLETED",
    "errorMessage": null
  }
}
```

### 失败状态
```json
{
  "code": 0,
  "success": true,
  "message": "",
  "other": null,
  "data": {
    "state": "FAILED",
    "errorMessage": "搜索超时，请稍后重试"
  }
}
```

### 运行中状态
```json
{
  "code": 0,
  "success": true,
  "message": "",
  "other": null,
  "data": {
    "state": "RUNNING",
    "errorMessage": null
  }
}
```

## 功能说明

1. **状态轮询**：TasksView 会定期调用此接口更新任务状态
2. **错误显示**：当任务失败时，错误信息会显示在任务列表的状态列下方
3. **状态同步**：前端会根据返回的状态自动更新任务的显示状态和进度文本

## 与 /search/tasks 接口的关系

- `/search/tasks` 接口返回任务列表，包含初始的 `errorMessage`
- `/search/state` 接口用于实时查询单个任务的状态，也返回 `errorMessage`
- 两个接口的 `errorMessage` 字段应保持一致，确保用户看到的错误信息是最新的

## 测试建议

1. 测试正常任务状态查询（state 为 COMPLETED，errorMessage 为 null）
2. 测试失败任务状态查询（state 为 FAILED，errorMessage 有值）
3. 测试运行中任务的状态轮询更新
4. 测试从运行中状态变为失败状态时，errorMessage 的正确显示
5. 验证前端状态轮询能正确处理新的响应格式
