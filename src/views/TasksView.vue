<template>
  <div class="tasks-wrapper">
    <!-- 动态背景装饰 -->
    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>

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
                <th class="align-left">搜索需求</th>
                <th class="align-left">检索标签</th>
                <th class="align-left">查询理解</th>
                <th class="align-center sortable" @click="toggleSort">
                  日期
                  <span class="sort-icon">
                    <span class="triangle-up" :class="{ active: sortOrder === 0 }">▲</span>
                    <span class="triangle-down" :class="{ active: sortOrder === 1 }">▼</span>
                  </span>
                </th>
                <th class="align-center">进度</th>
                <th class="align-center">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="task in tasks" :key="task.id" :class="{ 'highlight': task.id.toString() === highlightTaskId }">
                <td class="align-left search-demand-cell">
                  <div class="task-row-header">任务{{ task.id }}</div>
                  <div class="search-demand-text">{{ task.searchPrompt }}</div>
                </td>
                <td class="align-left">
                  <div class="tags-cell">
                    <span
                      v-for="tag in getSearchTagVisibleTags(task)"
                      :key="`${task.id}-${tag.kind}-${tag.label}`"
                      class="filter-tag"
                      :class="`${tag.kind}-tag`"
                    >
                      {{ tag.label }}
                    </span>
                    <button
                      v-if="getSearchTagHiddenCount(task) > 0 || isSearchTagExpanded(task.id)"
                      class="tag-more"
                      type="button"
                      @click="toggleSearchTagExpanded(task.id)"
                    >
                      {{ isSearchTagExpanded(task.id) ? '收起' : `+${getSearchTagHiddenCount(task)}` }}
                    </button>
                  </div>
                </td>
                <td class="align-left query-understanding-cell">
                  <div v-if="task.promptUnderstanding" class="understanding-cell">
                    <div class="understanding-title">
                      {{ task.promptUnderstanding.topic || '未识别主题' }}
                    </div>
                    <div class="understanding-meta-pills">
                      <span class="understanding-pill understanding-pill-intent">
                        {{ task.promptUnderstanding.intent || 'mixed' }}
                      </span>
                      <span
                        v-if="formatPromptYearRange(task.promptUnderstanding)"
                        class="understanding-pill understanding-pill-time"
                      >
                        {{ formatPromptYearRange(task.promptUnderstanding) }}
                      </span>
                      <span v-if="task.promptUnderstanding.requiresCode" class="understanding-pill understanding-pill-code">
                        需要代码
                      </span>
                    </div>
                    <div
                      v-if="getPromptUnderstandingPreviewTags(task.promptUnderstanding).length"
                      class="understanding-tag-list"
                    >
                      <span
                        v-for="item in getPromptUnderstandingVisibleTags(task)"
                        :key="`${task.id}-${item.kind}-${item.label}`"
                        class="understanding-tag"
                        :class="`understanding-tag-${item.kind}`"
                      >
                        {{ item.label }}
                      </span>
                      <button
                        v-if="getPromptUnderstandingHiddenCount(task.promptUnderstanding) > 0 || isPromptUnderstandingExpanded(task.id)"
                        class="understanding-more"
                        type="button"
                        @click="togglePromptUnderstandingExpanded(task.id)"
                      >
                        {{ isPromptUnderstandingExpanded(task.id) ? '收起' : `+${getPromptUnderstandingHiddenCount(task.promptUnderstanding)}` }}
                      </button>
                    </div>
                  </div>
                  <div v-else class="understanding-empty">暂无查询理解</div>
                </td>
                <td class="align-center">{{ task.searchTime }}</td>
                <td class="align-center">
                  <div class="status-cell">
                    <span 
                      class="progress-badge" 
                      :class="getProgressClass(task.status)"
                    >
                      {{ task.progress }}
                    </span>
                    <div v-if="task.status === 'failed' && task.errorMessage" class="status-reason">
                      {{ task.errorMessage }}
                    </div>
                  </div>
                </td>
                <td class="align-center">
                  <div class="action-buttons">
                    <button 
                      class="btn btn-sm btn-warning"
                      @click="pauseTask(task.id)"
                      :disabled="task.status !== 'searching'"
                      v-if="task.status === 'searching'"
                      title="暂停任务"
                    >
                      暂停
                    </button>
                    <button 
                      class="btn btn-sm btn-success"
                      @click="restartTask(task.id)"
                      v-if="task.status === 'cancelled'"
                      title="恢复任务"
                    >
                      恢复
                    </button>
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

    <!-- 确认弹窗 -->
    <div v-if="showConfirmModal" class="modal-overlay" @click="closeConfirmModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header" :class="confirmConfig.type">
          <div class="modal-title-wrapper">
            <span class="modal-icon">
              {{ confirmConfig.type === 'delete' ? '🗑️' : (confirmConfig.type === 'pause' ? '⏸️' : '▶️') }}
            </span>
            <h3 class="modal-title">{{ confirmConfig.title }}</h3>
          </div>
          <button class="modal-close" @click="closeConfirmModal">&times;</button>
        </div>
        <div class="modal-body">
          <p>{{ confirmConfig.message }}</p>
        </div>
        <div class="modal-footer">
          <div class="checkbox-wrapper">
            <input type="checkbox" id="dontShowAgain" v-model="dontShowAgain">
            <label for="dontShowAgain">不再弹出窗口</label>
          </div>
          <div class="modal-buttons">
            <button class="btn btn-outline" @click="closeConfirmModal">取消</button>
            <button 
              class="btn" 
              :class="getConfirmButtonClass(confirmConfig.type)"
              @click="executeConfirmAction"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { apiService, type SearchTask, type TasksRequestParams } from '@/services/api'
import { DEFAULT_SOURCE_TAGS } from '@/constants/searchTagMappings'

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
const expandedSearchTagTaskIds = ref<number[]>([])
const expandedUnderstandingTaskIds = ref<number[]>([])
const pollingTimer = ref<NodeJS.Timeout | null>(null)
const pollingInterval = ref(3000) // 动态轮询间隔，默认3秒
const consecutiveNoChanges = ref(0) // 连续无变化次数
const isPageVisible = ref(true) // 页面可见性状态

const sortOrder = ref<number>(1) // 0=asc, 1=desc, 默认降序

// 确认弹窗状态
// 确认弹窗状态
const showConfirmModal = ref(false)
const dontShowAgain = ref(false)
const confirmConfig = ref({
  title: '',
  message: '',
  type: 'delete', // 'delete' | 'pause' | 'restart'
  taskId: 0
})

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
    case 'cancelled':
      return 'secondary' // 新增已取消状态样式
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
      pageIndex: page,
      pageSize: pageSize.value,
      orderWord: 'search_time',
      orderId: sortOrder.value
    }
    
    const response = await apiService.getSearchTasks(params)
    tasks.value = response.tasks
    expandedSearchTagTaskIds.value = expandedSearchTagTaskIds.value.filter(taskId =>
      response.tasks.some(task => task.id === taskId)
    )
    expandedUnderstandingTaskIds.value = expandedUnderstandingTaskIds.value.filter(taskId =>
      response.tasks.some(task => task.id === taskId)
    )
    totalTasks.value = response.total
    currentPage.value = response.page
    pageSize.value = response.pageSize
    
    // 首次加载完成后设置为false
    if (isInitialLoading.value) {
      isInitialLoading.value = false
    }
    
    // 立即检查正在检索的任务状态
    const searchingTasks = tasks.value.filter(task => task.status === 'searching')
    if (searchingTasks.length > 0) {
      // 批量更新任务状态（限制并发数为3）
      const batchSize = 3
      for (let i = 0; i < searchingTasks.length; i += batchSize) {
        const batch = searchingTasks.slice(i, i + batchSize)
        await Promise.all(
          batch.map(task => updateTaskStatus(task.id))
        )
      }
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
const updateTaskStatus = async (taskId: number): Promise<boolean> => {
  try {
    const response = await apiService.getTaskStatus(taskId)
    if (response.code === 0 && response.success) {
      const task = tasks.value.find(t => t.id === taskId)
      if (task) {
        const oldStatus = task.status
        // 根据状态字符串更新任务状态和进度
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
            task.status = 'cancelled'
            task.progress = '已取消'
            task.errorMessage = null
            break
        }
        // 返回状态是否发生变化
        return oldStatus !== task.status
      }
    }
  } catch (error) {
    console.error('Failed to update task status:', error)
  }
  return false
}

// 计算动态轮询间隔
const calculatePollingInterval = (searchingCount: number): number => {
  if (searchingCount === 0) return 0 // 无任务时不轮询
  if (searchingCount === 1) return 2000 // 1个任务：2秒
  if (searchingCount <= 3) return 3000 // 2-3个任务：3秒
  if (searchingCount <= 5) return 5000 // 4-5个任务：5秒
  return 8000 // 6个以上任务：8秒
}

// 启动状态轮询（优化版）
const startPolling = () => {
  // 清除之前的定时器
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value)
  }
  
  const searchingTasks = tasks.value.filter(task => task.status === 'searching')
  
  // 如果没有检索中的任务，停止轮询
  if (searchingTasks.length === 0) {
    stopPolling()
    return
  }
  
  // 如果页面不可见，停止轮询
  if (!isPageVisible.value) {
    return
  }
  
  // 根据任务数量动态计算轮询间隔
  const interval = calculatePollingInterval(searchingTasks.length)
  pollingInterval.value = interval
  
  // 执行轮询
  const pollTasks = async () => {
    const currentSearchingTasks = tasks.value.filter(task => task.status === 'searching')
    
    if (currentSearchingTasks.length === 0) {
      stopPolling()
      return
    }
    
    // 如果页面不可见，跳过本次轮询
    if (!isPageVisible.value) {
      return
    }
    
    // 批量更新任务状态（限制并发数为3）
    let hasChanges = false
    const batchSize = 3
    for (let i = 0; i < currentSearchingTasks.length; i += batchSize) {
      const batch = currentSearchingTasks.slice(i, i + batchSize)
      const results = await Promise.all(
        batch.map(task => updateTaskStatus(task.id))
      )
      if (results.some(changed => changed)) {
        hasChanges = true
      }
    }
    
    // 指数退避策略：如果连续多次无变化，增加轮询间隔
    if (!hasChanges) {
      consecutiveNoChanges.value++
      if (consecutiveNoChanges.value >= 3) {
        // 连续3次无变化，将间隔增加50%（最多20秒）
        pollingInterval.value = Math.min(pollingInterval.value * 1.5, 20000)
        consecutiveNoChanges.value = 0 // 重置计数器
        
        // 重新启动轮询以应用新间隔
        startPolling()
      }
    } else {
      // 有变化时重置
      consecutiveNoChanges.value = 0
      const newInterval = calculatePollingInterval(currentSearchingTasks.length)
      if (newInterval !== pollingInterval.value) {
        pollingInterval.value = newInterval
        startPolling() // 重新启动以应用新间隔
      }
    }
  }
  
  // 立即执行一次
  pollTasks()
  
  // 设置定时器
  pollingTimer.value = setInterval(pollTasks, pollingInterval.value)
}

// 停止状态轮询
const stopPolling = () => {
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value)
    pollingTimer.value = null
  }
  consecutiveNoChanges.value = 0
}

// 页面可见性变化处理
const handleVisibilityChange = () => {
  isPageVisible.value = !document.hidden
  
  if (isPageVisible.value) {
    // 页面变为可见时，重新检查是否需要轮询
    const searchingTasks = tasks.value.filter(task => task.status === 'searching')
    if (searchingTasks.length > 0) {
      console.log('页面可见，恢复轮询')
      startPolling()
    }
  } else {
    // 页面不可见时，停止轮询以节省资源
    console.log('页面不可见，暂停轮询')
    stopPolling()
  }
}

// 检查任务是否可以查看
const canViewTask = (task: SearchTask) => {
  return task.status === 'success'
}

type SearchTagKind = 'year' | 'paper' | 'source'

interface SearchTagDisplayItem {
  label: string
  kind: SearchTagKind
}

const buildSearchTagItems = (task: SearchTask): SearchTagDisplayItem[] => {
  const tags: SearchTagDisplayItem[] = []

  if (task.tags.yearTag !== 0) {
    tags.push({
      label: formatYearTag(task.tags.yearTag),
      kind: 'year'
    })
  }

  task.tags.paperTag.forEach(paperTag => {
    tags.push({
      label: paperTag,
      kind: 'paper'
    })
  })

  const sourceTags = task.tags.sourceTag.length > 0 ? task.tags.sourceTag : DEFAULT_SOURCE_TAGS
  sourceTags.forEach(sourceTag => {
    tags.push({
      label: sourceTag,
      kind: 'source'
    })
  })

  return tags
}

const isSearchTagExpanded = (taskId: number) => {
  return expandedSearchTagTaskIds.value.includes(taskId)
}

const toggleSearchTagExpanded = (taskId: number) => {
  if (isSearchTagExpanded(taskId)) {
    expandedSearchTagTaskIds.value = expandedSearchTagTaskIds.value.filter(id => id !== taskId)
    return
  }

  expandedSearchTagTaskIds.value = [...expandedSearchTagTaskIds.value, taskId]
}

const getSearchTagVisibleTags = (task: SearchTask) => {
  const allTags = buildSearchTagItems(task)

  if (isSearchTagExpanded(task.id)) {
    return allTags
  }

  return allTags.slice(0, 6)
}

const getSearchTagHiddenCount = (task: SearchTask) => {
  return Math.max(0, buildSearchTagItems(task).length - 6)
}

const formatPromptYearRange = (promptUnderstanding: SearchTask['promptUnderstanding']) => {
  if (!promptUnderstanding) {
    return ''
  }

  const { yearFrom, yearTo } = promptUnderstanding

  if (yearFrom == null && yearTo == null) {
    return ''
  }

  if (yearFrom != null && yearTo != null) {
    return `${yearFrom} - ${yearTo}`
  }

  if (yearFrom != null) {
    return `${yearFrom} 起`
  }

  return `截至 ${yearTo}`
}

type PromptUnderstandingPreviewTagKind = 'keyword' | 'subfield' | 'synonym' | 'include' | 'exclude'

interface PromptUnderstandingPreviewTag {
  label: string
  kind: PromptUnderstandingPreviewTagKind
}

const buildPromptUnderstandingPreviewItems = (promptUnderstanding: SearchTask['promptUnderstanding']) => {
  if (!promptUnderstanding) {
    return []
  }

  const previewItems: PromptUnderstandingPreviewTag[] = [
    ...promptUnderstanding.keywords.map(label => ({ label, kind: 'keyword' as const })),
    ...promptUnderstanding.subfields.map(label => ({ label, kind: 'subfield' as const })),
    ...promptUnderstanding.synonyms.map(label => ({ label, kind: 'synonym' as const })),
    ...promptUnderstanding.includeTerms.map(label => ({ label: `+${label}`, kind: 'include' as const })),
    ...promptUnderstanding.excludeTerms.map(label => ({ label: `-${label}`, kind: 'exclude' as const }))
  ]

  const dedupedItems = new Map<string, PromptUnderstandingPreviewTag>()

  previewItems.forEach(item => {
    const trimmedLabel = item.label.trim()
    if (!trimmedLabel) {
      return
    }

    const dedupeKey = `${item.kind}:${trimmedLabel}`
    if (!dedupedItems.has(dedupeKey)) {
      dedupedItems.set(dedupeKey, {
        ...item,
        label: trimmedLabel
      })
    }
  })

  return [...dedupedItems.values()]
}

const getPromptUnderstandingPreviewTags = (promptUnderstanding: SearchTask['promptUnderstanding']) => {
  return buildPromptUnderstandingPreviewItems(promptUnderstanding).slice(0, 6)
}

const getPromptUnderstandingHiddenCount = (promptUnderstanding: SearchTask['promptUnderstanding']) => {
  return Math.max(0, buildPromptUnderstandingPreviewItems(promptUnderstanding).length - 6)
}

const isPromptUnderstandingExpanded = (taskId: number) => {
  return expandedUnderstandingTaskIds.value.includes(taskId)
}

const togglePromptUnderstandingExpanded = (taskId: number) => {
  if (isPromptUnderstandingExpanded(taskId)) {
    expandedUnderstandingTaskIds.value = expandedUnderstandingTaskIds.value.filter(id => id !== taskId)
    return
  }

  expandedUnderstandingTaskIds.value = [...expandedUnderstandingTaskIds.value, taskId]
}

const getPromptUnderstandingVisibleTags = (task: SearchTask) => {
  const allTags = buildPromptUnderstandingPreviewItems(task.promptUnderstanding)

  if (isPromptUnderstandingExpanded(task.id)) {
    return allTags
  }

  return allTags.slice(0, 6)
}

// 查看任务详情
const viewTask = (taskId: number) => {
  const task = tasks.value.find(t => t.id === taskId)
  if (task && task.status === 'success') {
    const keywords = task.promptUnderstanding?.keywords.join(',') || ''
    // 跳转到检索信息页
    router.push({
      name: 'search-results',
      query: { 
        keyword: task.searchPrompt, 
        taskId: taskId.toString(),
        keywords
      }
    })
  }
}

// 删除任务
const deleteTask = (taskId: number) => {
  // 检查是否选择了不再提示
  const hideDeleteModal = localStorage.getItem('hideDeleteTaskModal') === 'true'
  if (hideDeleteModal) {
    handleDeleteTask(taskId)
    return
  }

  confirmConfig.value = {
    title: '确认删除',
    message: '确定要删除这个任务吗？此操作无法撤销。',
    type: 'delete',
    taskId
  }
  dontShowAgain.value = false // 重置复选框状态
  showConfirmModal.value = true
}

// 暂停任务
const pauseTask = (taskId: number) => {
  // 检查是否选择了不再提示
  const hidePauseModal = localStorage.getItem('hidePauseTaskModal') === 'true'
  if (hidePauseModal) {
    handlePauseTask(taskId)
    return
  }

  confirmConfig.value = {
    title: '确认暂停',
    message: '确定要暂停这个任务吗？暂停后可以重新开始。',
    type: 'pause',
    taskId
  }
  dontShowAgain.value = false // 重置复选框状态
  showConfirmModal.value = true
}

// 恢复任务
const restartTask = (taskId: number) => {
  // 检查是否选择了不再提示
  const hideRestartModal = localStorage.getItem('hideRestartTaskModal') === 'true'
  if (hideRestartModal) {
    handleRestartTask(taskId)
    return
  }

  confirmConfig.value = {
    title: '确认恢复',
    message: '确定要恢复这个任务吗？任务将重新开始检索。',
    type: 'restart',
    taskId
  }
  dontShowAgain.value = false // 重置复选框状态
  showConfirmModal.value = true
}

// 获取确认按钮样式
const getConfirmButtonClass = (type: string) => {
  switch (type) {
    case 'delete': return 'btn-danger'
    case 'pause': return 'btn-warning'
    case 'restart': return 'btn-success'
    default: return 'btn-primary'
  }
}


// 关闭弹窗
const closeConfirmModal = () => {
  showConfirmModal.value = false
}

// 执行确认操作
const executeConfirmAction = async () => {
  const { type, taskId } = confirmConfig.value
  
  // 保存不再提示的偏好设置
  if (dontShowAgain.value) {
    if (type === 'delete') {
      localStorage.setItem('hideDeleteTaskModal', 'true')
    } else if (type === 'pause') {
      localStorage.setItem('hidePauseTaskModal', 'true')
    } else if (type === 'restart') {
      localStorage.setItem('hideRestartTaskModal', 'true')
    }
  }
  
  closeConfirmModal()
  
  if (type === 'delete') {
    await handleDeleteTask(taskId)
  } else if (type === 'pause') {
    await handlePauseTask(taskId)
  } else if (type === 'restart') {
    await handleRestartTask(taskId)
  }
}

// 处理删除逻辑
const handleDeleteTask = async (taskId: number) => {
  try {
    const response = await apiService.deleteTask(taskId)
    if (response.code === 0 && response.success && response.data) {
      // 从本地列表中移除已删除的任务
      tasks.value = tasks.value.filter(task => task.id !== taskId)
      console.log('任务删除成功:', taskId)
    } else {
      throw new Error(response.message || '删除失败')
    }
  } catch (error) {
    console.error('删除任务失败:', error)
    alert('删除任务失败，请稍后重试')
  }
}

// 处理暂停逻辑
const handlePauseTask = async (taskId: number) => {
  try {
    const response = await apiService.cancelTask(taskId)
    if (response.code === 0 && response.success && response.data) {
      // 更新任务状态
      const task = tasks.value.find(t => t.id === taskId)
      if (task) {
        task.status = 'cancelled'
        task.progress = '已取消'
        // 立即刷新状态
        updateTaskStatus(taskId)
      }
      console.log('任务暂停成功:', taskId)
    } else {
      throw new Error(response.message || '暂停失败')
    }
  } catch (error) {
    console.error('暂停任务失败:', error)
    alert('暂停任务失败，请稍后重试')
  }
}

// 处理恢复逻辑
const handleRestartTask = async (taskId: number) => {
  try {
    const response = await apiService.restartTask(taskId)
    if (response.code === 0 && response.success && response.data) {
      // 更新任务状态为正在搜索
      const task = tasks.value.find(t => t.id === taskId)
      if (task) {
        task.status = 'searching'
        task.progress = '正在检索'
        // 立即刷新状态
        updateTaskStatus(taskId)
        // 重新启动轮询（如果之前停止了）
        startPolling()
      }
      console.log('任务恢复成功:', taskId)
    } else {
      throw new Error(response.message || '恢复失败')
    }
  } catch (error) {
    console.error('恢复任务失败:', error)
    alert('恢复任务失败，请稍后重试')
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

// 切换排序方式
const toggleSort = async () => {
  sortOrder.value = sortOrder.value === 0 ? 1 : 0
  currentPage.value = 1
  await fetchTasks(1, false)
}

// 格式化年份标签显示
const formatYearTag = (yearTag: number): string => {
  const currentYear = new Date().getFullYear()
  const yearsAgo = currentYear - yearTag
  if (yearsAgo === 0) {
    return '近1年'
  } else if (yearsAgo > 0) {
    return `近${yearsAgo + 1}年`
  }
  return String(yearTag)
}

// 组件挂载时获取任务列表
onMounted(() => {
  fetchTasks()
  
  // 监听页面可见性变化
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

// 组件卸载时清理定时器
onUnmounted(() => {
  stopPolling()
  
  // 移除页面可见性监听
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<style scoped>
.tasks-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* 动态背景形状 */
.background-shapes {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 0;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.5;
  animation: float 20s ease-in-out infinite;
  will-change: transform;
  backface-visibility: hidden;
  transform: translateZ(0);
}

.shape-1 {
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  top: -100px;
  left: -100px;
  animation-delay: 0s;
}

.shape-2 {
  width: 350px;
  height: 350px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  top: 50%;
  right: -100px;
  animation-delay: 7s;
}

.shape-3 {
  width: 300px;
  height: 300px;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  bottom: -100px;
  left: 50%;
  animation-delay: 14s;
}

.search-demand-cell {
  min-width: 260px;
  max-width: 360px;
  white-space: normal;
  word-break: break-word;
  line-height: 1.6;
}

.task-row-header {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #2563eb;
  text-transform: uppercase;
}

.search-demand-text {
  font-size: 14px;
  color: #1e293b;
  line-height: 1.7;
  word-break: break-word;
}

.query-understanding-cell {
  min-width: 340px;
  max-width: 420px;
}

.understanding-cell {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.understanding-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.6;
  word-break: break-word;
}

.understanding-meta-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.understanding-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: #475569;
  font-size: 12px;
  line-height: 1.4;
}

.understanding-pill-intent {
  background: rgba(37, 99, 235, 0.12);
  color: #1d4ed8;
}

.understanding-pill-time {
  background: rgba(13, 148, 136, 0.14);
  color: #0f766e;
}

.understanding-pill-code {
  background: rgba(217, 119, 6, 0.14);
  color: #b45309;
}

.understanding-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.understanding-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
  font-size: 12px;
  line-height: 1.4;
}

.understanding-tag-keyword {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.understanding-tag-subfield {
  background: rgba(8, 145, 178, 0.12);
  color: #0e7490;
}

.understanding-tag-synonym {
  background: rgba(124, 58, 237, 0.12);
  color: #7c3aed;
}

.understanding-tag-include {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}

.understanding-tag-exclude {
  background: rgba(220, 38, 38, 0.12);
  color: #dc2626;
}

.understanding-more {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: #475569;
  font-size: 12px;
  line-height: 1.4;
  border: none;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.understanding-more:hover {
  background: rgba(37, 99, 235, 0.12);
  color: #1d4ed8;
}

.tag-more {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  border: none;
  background: rgba(15, 23, 42, 0.06);
  color: #475569;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.tag-more:hover {
  background: rgba(37, 99, 235, 0.12);
  color: #1d4ed8;
}

.understanding-empty {
  font-size: 13px;
  color: #94a3b8;
}

.status-reason {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #dc2626;
  text-align: left;
  word-break: break-word;
}

@keyframes float {
  0%, 100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  33% {
    transform: translate3d(50px, -50px, 0) scale(1.1);
  }
  66% {
    transform: translate3d(-50px, 50px, 0) scale(0.9);
  }
}

.tasks-container {
  margin-top: 30px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-items: center;
  position: relative;
  z-index: 1;
}

.page-header {
  text-align: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 45px;
  font-weight: 600;
  line-height: 1.2; 
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-align: center;
  margin: 0 0 13px 0;
  letter-spacing: 4px; 
}

.table-container {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: relative;
  width: 95%;
  max-width: 1600px;
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

.tasks-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
}

.tasks-table th.sortable:hover {
  background-color: #e9ecef;
}

.sort-icon {
  display: inline-flex;
  flex-direction: column;
  margin-left: 6px;
  vertical-align: middle;
  line-height: 1;
}

.triangle-up,
.triangle-down {
  font-size: 10px;
  color: #d1d5db;
  transition: color 0.2s ease;
  display: block;
  height: 8px;
  line-height: 8px;
}

.triangle-up.active,
.triangle-down.active {
  color: #3b82f6;
  font-weight: bold;
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
  background-color: #fffbeb;
}

.tasks-table tr.highlight:hover {
  background-color: #fef3c7;
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

.tags-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.filter-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  border: 1px solid;
}

.year-tag {
  background: linear-gradient(135deg, #c7d2fe 0%, #ddd6fe 100%);
  color: #4c1d95;
  border-color: transparent;
}

.paper-tag {
  background: linear-gradient(135deg, #fecdd3 0%, #fbcfe8 100%);
  color: #831843;
  border-color: transparent;
}

.source-tag {
  background: linear-gradient(135deg, #bfdbfe 0%, #dbeafe 100%);
  color: #1e3a8a;
  border-color: transparent;
}

.status-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
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

.progress-badge.secondary {
  background-color: #f3f4f6;
  color: #4b5563;
}

.progress-badge.info {
  background-color: #dbeafe;
  color: #1e40af;
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

.btn-warning {
  background-color: #f59e0b;
  color: #ffffff;
  border-color: #f59e0b;
}

.btn-warning:hover:not(:disabled) {
  background-color: #d97706;
  border-color: #b45309;
}

.btn-success {
  background-color: #10b981;
  color: #ffffff;
  border-color: #10b981;
}

.btn-success:hover:not(:disabled) {
  background-color: #059669;
  border-color: #047857;
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
/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px); /* 增加模糊效果 */
  transition: all 0.3s ease;
}

.modal-content {
  background: white;
  border-radius: 16px; /* 更大的圆角 */
  width: 90%;
  max-width: 420px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); /* 更深的阴影 */
  animation: modal-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1); /* 更平滑的动画 */
  overflow: hidden; /* 防止内容溢出圆角 */
  border: 1px solid rgba(255, 255, 255, 0.1);
}

@keyframes modal-pop {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
}

/* 根据类型改变标题颜色 */
.modal-header.delete .modal-title {
  color: #dc2626;
}

.modal-header.pause .modal-title {
  color: #d97706;
}

.modal-header.restart .modal-title {
  color: #10b981;
}

.modal-title-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-icon {
  font-size: 24px;
}

.modal-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  letter-spacing: -0.025em;
}

.modal-close {
  background: none;
  border: none;
  font-size: 28px;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  border-radius: 6px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.modal-close:hover {
  color: #4b5563;
  background-color: #f3f4f6;
}

.modal-body {
  padding: 24px;
  color: #4b5563;
  font-size: 15px;
  line-height: 1.6;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #6b7280;
}

.checkbox-wrapper input[type="checkbox"] {
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
  border-radius: 4px;
}

.checkbox-wrapper label {
  cursor: pointer;
  user-select: none;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #f9fafb;
}

.modal-buttons {
  display: flex;
  gap: 12px;
}

</style>
