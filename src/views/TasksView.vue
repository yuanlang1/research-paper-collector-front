<template>
  <div class="tasks-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">任务列表</h1>
    </div>

    <!-- 任务表格 -->
    <div class="table-container">
      <div class="table-wrapper">
        <table class="tasks-table">
          <thead>
            <tr>
              <th class="align-left">任务</th>
              <th class="align-left">搜索词</th>
              <th class="align-left">搜索关键词</th>
              <th class="align-center">日期</th>
              <th class="align-center">进度</th>
              <th class="align-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in tasks" :key="task.id" :class="{ 'highlight': task.id.toString() === highlightTaskId }">
              <td class="align-left">{{ task.taskName }}</td>
              <td class="align-left">{{ task.searchTerm }}</td>
              <td class="align-left">
                <div class="keywords-cell">
                  <span 
                    v-for="(keyword, index) in task.keywords" 
                    :key="index"
                    class="keyword-tag"
                  >
                    {{ keyword }}
                  </span>
                </div>
              </td>
              <td class="align-center">{{ task.date }}</td>
              <td class="align-center">
                <span 
                  class="progress-badge" 
                  :class="getProgressClass(task.status)"
                >
                  {{ task.progress }}
                </span>
              </td>
              <td class="align-center">
                <div class="action-buttons">
                  <button 
                    class="btn btn-sm btn-outline"
                    @click="viewTask(task.id)"
                    :disabled="!canViewTask(task)"
                    :title="canViewTask(task) ? '查看检索结果' : '只有检索成功的任务才能查看'"
                  >
                    查看
                  </button>
                  <button 
                    class="btn btn-sm btn-danger"
                    @click="deleteTask(task.id)"
                    :disabled="task.status === 'searching'"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 空状态 -->
      <div v-if="tasks.length === 0 && !isLoading" class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>暂无任务</h3>
        <p>还没有任何搜索任务</p>
        <button class="btn btn-primary" @click="goHome">
          返回首页
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="isInitialLoading && isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>正在加载任务列表...</p>
      </div>
    </div>

    <!-- 分页控制 -->
    <div v-if="tasks.length > 0" class="pagination-container">
      <!-- 分页导航和页数选择器在一行 -->
      <div class="pagination-row">
        <!-- 页数选择器 -->
        <div class="page-size-selector">
          <label for="pageSize">每页显示：</label>
          <select 
            id="pageSize" 
            v-model="pageSize" 
            @change="handlePageSizeChange"
            class="page-size-select"
          >
            <option :value="5">5条</option>
            <option :value="10">10条</option>
            <option :value="20">20条</option>
            <option :value="50">50条</option>
          </select>
        </div>
        
        <!-- 分页导航 -->
        <div class="pagination">
          <button 
            class="btn btn-outline"
            :disabled="currentPage === 1"
            @click="changePage(currentPage - 1)"
          >
            上一页
          </button>
          
          <!-- 页码显示 -->
          <div class="page-numbers">
            <button 
              v-for="page in visiblePages" 
              :key="page"
              class="btn page-btn"
              :class="{ 'active': page === currentPage }"
              @click="changePage(page)"
            >
              {{ page }}
            </button>
          </div>
          
          <button 
            class="btn btn-outline"
            :disabled="currentPage === totalPages"
            @click="changePage(currentPage + 1)"
          >
            下一页
          </button>
        </div>
      </div>
      
      <!-- 分页信息 -->
      <div class="page-info">
        第 {{ currentPage }} 页，共 {{ totalPages }} 页（总计 {{ totalTasks }} 条）
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { apiService, type SearchTask, type TasksRequestParams } from '@/services/api'

// 路由
const router = useRouter()
const route = useRoute()

// 状态
const tasks = ref<SearchTask[]>([])
const isLoading = ref(false)
const isInitialLoading = ref(true)
const currentPage = ref(1)
const pageSize = ref(10)
const totalTasks = ref(0)
const pollingTimer = ref<NodeJS.Timeout | null>(null)

// 高亮显示的任务ID（从查询参数获取）
const highlightTaskId = computed(() => {
  return route.query.taskId as string || ''
})

// 总页数
const totalPages = computed(() => {
  return Math.ceil(totalTasks.value / pageSize.value)
})

// 可见的页码（最多显示5个页码）- 优化计算性能
const visiblePages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  
  // 快速返回简单情况
  if (total <= 1) return [1]
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  
  // 复杂情况的优化计算
  if (current <= 3) return [1, 2, 3, 4, 5]
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total]
  return [current - 2, current - 1, current, current + 1, current + 2]
})

// 获取进度样式类
const getProgressClass = (status: string | number) => {
  switch (status) {
    case 'success':
    case 1:
      return 'success'
    case 'searching':
    case 0:
      return 'warning'
    case 'failed':
    case 2:
      return 'danger'
    default:
      return 'info'
  }
}

// 获取任务列表
const fetchTasks = async (page: number = currentPage.value, showLoading: boolean = true) => {
  if (showLoading) {
    isLoading.value = true
  }
  
  try {
    const params: TasksRequestParams = {
      page,
      size: pageSize.value
    }
    
    const response = await apiService.getSearchTasks(params)
    tasks.value = response.tasks
    totalTasks.value = response.total
    currentPage.value = response.page
    pageSize.value = response.pageSize
    
    // 首次加载完成后设置为false
    if (isInitialLoading.value) {
      isInitialLoading.value = false
    }
    
    // 启动状态轮询
    startPolling()
  } catch (error) {
    console.error('Failed to fetch tasks:', error)
  } finally {
    if (showLoading) {
      isLoading.value = false
    }
  }
}

// 更新任务状态
const updateTaskStatus = async (taskId: number) => {
  try {
    const response = await apiService.getTaskStatus(taskId)
    if (response.code === 0) {
      const task = tasks.value.find(t => t.id === taskId)
      if (task) {
        // 根据状态码更新任务状态和进度
        switch (response.data.state) {
          case 0:
            task.status = 'searching'
            task.progress = '正在检索'
            break
          case 1:
            task.status = 'success'
            task.progress = '检索成功'
            break
          case 2:
            task.status = 'failed'
            task.progress = '检索失败'
            break
        }
      }
    }
  } catch (error) {
    console.error('Failed to update task status:', error)
  }
}

// 启动状态轮询
const startPolling = () => {
  // 清除之前的定时器
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value)
  }
  
  // 每3秒检查一次检索中的任务状态（减少轮询间隔提升响应速度）
  pollingTimer.value = setInterval(async () => {
    const searchingTasks = tasks.value.filter(task => task.status === 'searching')
    
    if (searchingTasks.length === 0) {
      // 如果没有检索中的任务，停止轮询
      stopPolling()
      return
    }
    
    // 并发更新所有检索中任务的状态
    await Promise.all(
      searchingTasks.map(task => updateTaskStatus(task.id))
    )
  }, 3000)
}

// 停止状态轮询
const stopPolling = () => {
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value)
    pollingTimer.value = null
  }
}

// 检查任务是否可以查看
const canViewTask = (task: SearchTask) => {
  return task.status === 'success'
}

// 查看任务详情
const viewTask = (taskId: number) => {
  const task = tasks.value.find(t => t.id === taskId)
  if (task && task.status === 'success') {
    // 跳转到检索信息页
    router.push({
      name: 'search-results',
      query: { 
        keyword: task.searchTerm, 
        taskId: taskId.toString(),
        keywords: task.keywords.join(',') // 将关键词数组转为逗号分隔的字符串
      }
    })
  }
}

// 删除任务
const deleteTask = async (taskId: number) => {
  if (confirm('确定要删除这个任务吗？')) {
    try {
      await apiService.deleteTask(taskId)
      // 从本地列表中移除已删除的任务
      tasks.value = tasks.value.filter(task => task.id !== taskId)
      console.log('任务删除成功:', taskId)
    } catch (error) {
      console.error('删除任务失败:', error)
      alert('删除任务失败，请稍后重试')
    }
  }
}

// 返回首页
const goHome = () => {
  router.push({ name: 'home' })
}

// 切换页面
const changePage = async (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    await fetchTasks(page, false) // 不显示加载提示
  }
}

// 处理每页条数变化
const handlePageSizeChange = async () => {
  // 重置到第一页
  currentPage.value = 1
  await fetchTasks(1, false) // 不显示加载提示
}

// 组件挂载时获取任务列表
onMounted(() => {
  fetchTasks()
})

// 组件卸载时清理定时器
onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.tasks-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 16px;
}

.page-title {
  font-size: 32px;
  font-weight: 600;
  color: #000000;
  margin: 0;
}

.table-container {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: relative;
}

.table-wrapper {
  overflow-x: auto;
  max-height: 70vh;
  overflow-y: auto;
}

.tasks-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.tasks-table th {
  background-color: #f8f9fa;
  padding: 12px 10px;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* 粘性表头在滚动时的增强效果 */
.table-wrapper::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.table-wrapper::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.table-wrapper::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.tasks-table td {
  padding: 12px 10px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
}

/* 对齐方式 */
.align-left {
  text-align: left;
}

.align-center {
  text-align: center;
}

.align-right {
  text-align: right;
}

.tasks-table tr:hover {
  background-color: #f9fafb;
}

.tasks-table tr.highlight {
  background-color: #fef3c7;
}

.tasks-table tr.highlight:hover {
  background-color: #fde68a;
}

.keywords-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 250px;
}

.keyword-tag {
  display: inline-block;
  background-color: #e5e7eb;
  color: #374151;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  white-space: nowrap;
}

.progress-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.progress-badge.success {
  background-color: #d1fae5;
  color: #065f46;
}

.progress-badge.warning {
  background-color: #fef3c7;
  color: #92400e;
}

.progress-badge.danger {
  background-color: #fee2e2;
  color: #991b1b;
}

.progress-badge.info {
  background-color: #dbeafe;
  color: #1e40af;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  white-space: nowrap;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #0088ff;
  color: #ffffff;
  border-color: #0088ff;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0066cc;
  border-color: #0066cc;
}

.btn-outline {
  background-color: transparent;
  color: #666666;
  border-color: #d0d7de;
}

.btn-outline:hover:not(:disabled) {
  background-color: #f6f8fa;
  border-color: #d0d7de;
}

.btn-danger {
  background-color: #dc3545;
  color: #ffffff;
  border-color: #dc3545;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
  border-color: #bd2130;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: #374151;
}

.empty-state p {
  margin: 0 0 24px 0;
  font-size: 14px;
}

.loading-state {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f4f6;
  border-top: 3px solid #0088ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 分页容器 */
.pagination-container {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

/* 分页行 - 页数选择器和分页导航在一行 */
.pagination-row {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  justify-content: center;
}

/* 页数选择器 */
.page-size-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
}

.page-size-selector label {
  font-weight: 500;
}

.page-size-select {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background-color: white;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.page-size-select:hover {
  border-color: #9ca3af;
}

.page-size-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 分页导航 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 页码按钮容器 */
.page-numbers {
  display: flex;
  gap: 4px;
  margin: 0 16px;
}

/* 页码按钮 */
.page-btn {
  min-width: 40px;
  height: 40px;
  padding: 8px;
  border: 1px solid #d1d5db;
  background-color: white;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-btn:hover {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}

.page-btn.active {
  background-color: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.page-btn.active:hover {
  background-color: #2563eb;
  border-color: #2563eb;
}

.page-info {
  font-size: 14px;
  color: #6b7280;
}

@media (max-width: 768px) {
  .page-title {
    font-size: 24px;
  }

  .tasks-table {
    font-size: 12px;
  }

  .tasks-table th,
  .tasks-table td {
    padding: 8px 6px;
  }

  .keywords-cell {
    max-width: 150px;
  }

  .action-buttons {
    flex-direction: column;
  }

  .btn {
    font-size: 12px;
    padding: 6px 12px;
  }

  .pagination-container {
    gap: 12px;
  }
  
  .pagination-row {
    flex-direction: column;
    gap: 16px;
  }
  
  .page-size-selector {
    font-size: 13px;
  }
  
  .page-size-select {
    padding: 4px 8px;
    font-size: 13px;
  }
  
  .pagination {
    flex-direction: column;
    gap: 8px;
  }
  
  .page-numbers {
    margin: 0 8px;
  }
  
  .page-btn {
    min-width: 36px;
    height: 36px;
    font-size: 13px;
  }
}
</style>
