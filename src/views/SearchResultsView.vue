<template>
  <div class="search-results-wrapper">
    <!-- 动态背景装饰 -->
    <div class="background-decoration">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>

    <div class="search-results-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">检索信息页</h1>
        <div class="search-info">
          <div class="search-keywords">
            <span class="keywords-label">关键词:</span>
            <span 
              v-for="(keyword, index) in searchKeywords" 
              :key="index"
              class="keyword-tag1"
            >
              {{ keyword }} 
            </span>
          </div>
          <span class="result-count">共找到 {{ totalResults }} 条结果</span>
        </div>
    </div>

    <!-- 搜索结果表格 -->
    <div class="table-container">
      <div class="table-wrapper">
        <table class="results-table">
          <thead>
            <tr>
              <th class="col-select">
                <div class="select-header">
                  <input 
                    type="checkbox" 
                    v-model="selectAll" 
                    @change="handleSelectAll"
                    class="checkbox"
                  />
                  <span>选</span>
                </div>
              </th>
              <th class="col-title">论文标题</th>
              <th class="col-recommendation sortable" @click="handleSort('star')">
                <div class="sort-header">
                  <span>推荐星数</span>
                  <span class="sort-icon">
                    <div class="sort-arrows">
                      <i class="sort-arrow sort-up" :class="{ 'active': getSortDirection('star') === 'asc' }"></i>
                      <i class="sort-arrow sort-down" :class="{ 'active': getSortDirection('star') === 'desc' }"></i>
                    </div>
                  </span>
                </div>
              </th>
              <th class="col-authors">作者列表</th>
              <th class="col-year sortable" @click="handleSort('publishedDate')">
                <div class="sort-header">
                  <span>年份</span>
                  <span class="sort-icon">
                    <div class="sort-arrows">
                      <i class="sort-arrow sort-up" :class="{ 'active': getSortDirection('publishedDate') === 'asc' }"></i>
                      <i class="sort-arrow sort-down" :class="{ 'active': getSortDirection('publishedDate') === 'desc' }"></i>
                    </div>
                  </span>
                </div>
              </th>
              <th class="col-journal">发表刊物</th>
              <th class="col-venue-type">类型</th>
              <th class="col-tags">标签</th>
              <th class="col-keywords">关键词</th>
              <th class="col-abstract">原文摘要</th>
              <th class="col-summary">整理后摘要</th>
              <th class="col-citations sortable" @click="handleSort('citations')">
                <div class="sort-header">
                  <span>引用</span>
                  <span class="sort-icon">
                    <div class="sort-arrows">
                      <i class="sort-arrow sort-up" :class="{ 'active': getSortDirection('citations') === 'asc' }"></i>
                      <i class="sort-arrow sort-down" :class="{ 'active': getSortDirection('citations') === 'desc' }"></i>
                    </div>
                  </span>
                </div>
              </th>
              <th class="col-link">链接</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="paper in papers" 
              :key="paper.id"
              :class="{ 'selected': selectedPapers.includes(paper.id) }"
            >
              <td class="col-select">
                <input 
                  type="checkbox" 
                  :value="paper.id"
                  v-model="selectedPapers"
                  class="checkbox"
                />
              </td>
              <td class="col-title">
                <div class="title-content">
                  <h3 class="paper-title">{{ paper.title }}</h3>
                </div>
              </td>
              <td class="col-recommendation">
                <div class="recommendation-cell">
                  <div class="star-rating" :title="`${paper.star || 0} 星推荐`">
                    <span
                      v-for="index in 5"
                      :key="index"
                      class="star-icon"
                      :class="{ active: index <= (paper.star || 0) }"
                    >
                      ★
                    </span>
                    <span class="star-score">{{ paper.star || 0 }}</span>
                  </div>
                  <div class="recommendation-actions">
                    <button
                      class="recommendation-btn reason-btn"
                      type="button"
                      :disabled="!(paper.reasons?.length)"
                      @click="showReasonsModal(paper)"
                    >
                      推荐理由
                    </button>
                  </div>
                </div>
              </td>
              <td class="col-authors">
                <div class="authors-tags">
                  <span
                    v-for="(author, index) in getVisibleAuthors(paper)"
                    :key="`${paper.id}-author-${index}-${author}`"
                    class="author-tag"
                  >
                    {{ author }}
                  </span>
                  <button
                    v-if="getAuthorHiddenCount(paper) > 0 || isAuthorsExpanded(paper.id)"
                    class="tag-more"
                    type="button"
                    @click="toggleAuthorsExpanded(paper.id)"
                  >
                    {{ isAuthorsExpanded(paper.id) ? '收起' : `+${getAuthorHiddenCount(paper)}` }}
                  </button>
                </div>
              </td>
              <td class="col-year">{{ paper.year }}</td>
              <td class="col-journal">{{ paper.journal }}</td>
              <td class="col-venue-type">
                <span 
                  class="venue-type-tag"
                  :class="paper.venueType === 'journal' ? 'journal-tag' : 'conference-tag'"
                >
                  {{ paper.venueType === 'journal' ? '期刊' : '会议' }}
                </span>
              </td>
              <td class="col-tags">
                <div class="tags-container">
                  <span v-if="paper.ccfLevel" class="level-tag ccf-tag" :class="'ccf-' + paper.ccfLevel.toLowerCase()">
                    CCF {{ paper.ccfLevel }}
                  </span>
                  <span v-if="paper.sciLevel" class="level-tag sci-tag" :class="'sci-' + paper.sciLevel.toLowerCase()">
                    SCI {{ paper.sciLevel }}
                  </span>
                  <span v-if="paper.coreLevel" class="level-tag core-tag" :class="'core-' + paper.coreLevel.toLowerCase()">
                    CORE {{ paper.coreLevel }}
                  </span>
                  <span v-if="paper.sciUpFull" class="level-tag jcr-tag" :class="'jcr-' + paper.jcrLevel">
                    中科院大区：{{ paper.sciUpFull }}
                  </span>
                  <span 
                    v-if="paper.impactFactor" 
                    class="level-tag impact-factor-tag"
                    :class="getImpactFactorClass(paper.impactFactor)"
                  >
                    IF: {{ paper.impactFactor }}
                  </span>
                </div>
              </td>
              <td class="col-keywords">
                <div class="keywords-tags">
                  <span
                    v-for="(keyword, index) in getVisibleKeywords(paper)"
                    :key="`${paper.id}-keyword-${index}-${keyword}`"
                    class="keyword-tag"
                  >
                    {{ keyword }}
                  </span>
                  <button
                    v-if="getKeywordHiddenCount(paper) > 0 || isKeywordsExpanded(paper.id)"
                    class="tag-more keyword-more"
                    type="button"
                    @click="toggleKeywordsExpanded(paper.id)"
                  >
                    {{ isKeywordsExpanded(paper.id) ? '收起' : `+${getKeywordHiddenCount(paper)}` }}
                  </button>
                </div>
              </td>
              <td class="col-abstract">
                <div class="abstract-content">
                  <p class="abstract-text">
                    <span v-if="paper.abstract && paper.abstract.length > 100">
                      {{ truncateText(paper.abstract, 80) }}
                      <span class="expand-dots" @click="showAbstractModal(paper)">...</span>
                    </span>
                    <span v-else>
                      {{ paper.abstract }}
                    </span>
                  </p>
                </div>
              </td>
              <td class="col-summary">
                <div class="summary-content">
                  <p class="summary-text">
                    <span v-if="paper.summary && cleanMarkdown(paper.summary).length > 100">
                      {{ truncateText(cleanMarkdown(paper.summary), 80) }}
                      <span class="expand-dots" @click="showSummaryModal(paper)">...</span>
                    </span>
                    <span v-else>
                      {{ cleanMarkdown(paper.summary) }}
                    </span>
                  </p>
                </div>
              </td>
              <td class="col-citations">
                <div class="citations-count">
                  <span class="citation-number">{{ paper.citations || 0 }}</span>
                </div>
              </td>
              <td class="col-link">
                <div class="resource-links">
                  <a 
                    v-if="paper.link" 
                    :href="paper.link" 
                    target="_blank" 
                    class="link-btn"
                    title="查看原文"
                  >
                    原文
                  </a>
                  <button 
                    v-if="getPaperPdfFileName(paper)"
                    @click="previewPDFInBrowser(paper)"
                    class="action-btn pdf-btn compact-link-btn"
                    title="预览 PDF"
                  >
                    PDF
                  </button>
                  <span
                    v-if="!paper.link && !getPaperPdfFileName(paper)"
                    class="no-data"
                  >
                    -
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 分页控件 -->
    <div class="pagination-container">
      <div class="pagination-info">
        显示第 {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, totalResults) }} 条，
        共 {{ totalResults }} 条记录
      </div>
        <div class="pagination-controls">
          <div class="page-size-selector">
            <label for="pageSize">每页显示：</label>
            <select 
              id="pageSize"
              v-model="pageSize" 
              @change="handlePageSizeChange"
              class="page-size-select"
            >
              <option value="5">5条</option>
              <option value="10">10条</option>
              <option value="20">20条</option>
              <option value="50">50条</option>
              <option value="100">100条</option>
            </select>
          </div>
          <button 
            class="btn btn-outline"
            :disabled="currentPage === 1"
            @click="goToPage(currentPage - 1)"
          >
            上一页
          </button>
        <span class="page-numbers">
          <button 
            v-for="page in visiblePages" 
            :key="page"
            :class="['btn', 'btn-page', { 'active': page === currentPage }]"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
        </span>
        <button 
          class="btn btn-outline"
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
        >
          下一页
        </button>
      </div>
    </div>

    <!-- 批量操作 -->
    <div class="batch-actions" v-if="selectedPapers.length > 0">
      <div class="selected-info">
        已选择 {{ selectedPapers.length }} 条记录
      </div>
      <div class="batch-buttons">
        <button class="btn btn-primary" @click="batchDownload">
          批量下载
        </button>
        <button class="btn btn-secondary" @click="batchExport">
          导出选中
        </button>
        <button class="btn btn-outline" @click="clearSelection">
          清空选择
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>正在加载搜索结果...</p>
    </div>

    <!-- 摘要模态窗口 -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div 
        ref="modalRef"
        class="modal-content resizable-modal" 
        @click.stop
        :style="{
          left: modalPosition.x + 'px',
          top: modalPosition.y + 'px',
          width: modalSize.width + 'px',
          height: modalSize.height + 'px'
        }"
      >
        <div 
          class="modal-header draggable-header" 
          @mousedown="startDrag"
        >
          <h3>{{ modalTitle }}</h3>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-text markdown-body" v-html="renderedModalContent"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="closeModal">关闭</button>
        </div>
        
        <!-- 调整大小的拖拽点 -->
        <div class="resize-handle resize-right" @mousedown="startResize($event, 'right')"></div>
        <div class="resize-handle resize-bottom" @mousedown="startResize($event, 'bottom')"></div>
        <div class="resize-handle resize-corner" @mousedown="startResize($event, 'corner')"></div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="showError" class="error-notification" @click="closeError">
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span class="error-text">{{ errorMessage }}</span>
        <button class="error-close" @click.stop="closeError">&times;</button>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiService, type Paper, type OrderInfo } from '@/services/api'

import { ossService } from '@/services/ossService'
import { marked } from 'marked'

// 路由相关
const route = useRoute()
const router = useRouter()

// 搜索参数
const searchKeyword = ref(route.query.keyword as string || '')
const searchKeywords = ref<string[]>([])
const taskId = ref(parseInt(route.query.taskId as string) || 0)

// 从后端获取任务关键词
const fetchTaskKeywords = async () => {
  if (!taskId.value) return
  
  try {
    const response = await apiService.getTaskKeywords(taskId.value)
    if (response.code === 0 && response.success && response.data) {
      // 直接使用返回的数组
      searchKeywords.value = response.data
      console.log('获取到的关键词:', searchKeywords.value)
    }
  } catch (error) {
    console.error('获取任务关键词失败:', error)
  }
}

// 解析URL参数中的关键词
const parseKeywords = async () => {
  if (route.query.keywords) {
    // 从URL参数解析关键词数组
    searchKeywords.value = (route.query.keywords as string).split(',').filter(k => k.trim())
  } else if (searchKeyword.value) {
    // 如果没有关键词数组，使用搜索词作为关键词
    searchKeywords.value = [searchKeyword.value]
  } else if (!searchKeyword.value && taskId.value) {
    // 如果keyword为空，从后端获取关键词
    await fetchTaskKeywords()
  }
}

// 数据状态
const papers = ref<Paper[]>([])
const isLoading = ref(false)
const totalResults = ref(0)
const totalPages = ref(0)
const currentPage = ref(1)
const pageSize = ref(5)

// 多字段排序状态
const orderInfo = ref<OrderInfo[]>([
  { orderWord: 'star', orderId: 1 },           // 推荐星数降序
  { orderWord: 'publishedDate', orderId: 1 },  // 发表年份降序
  { orderWord: 'citations', orderId: 1 }       // 引用次数降序
])

// 选择状态
const selectedPapers = ref<string[]>([])
const selectAll = ref(false)
const isGlobalSelectAll = ref(false) // 全局全选模式
const expandedAuthorPaperIds = ref<string[]>([])
const expandedKeywordPaperIds = ref<string[]>([])

// 模态窗口状态
const showModal = ref(false)
const modalTitle = ref('')
const modalContent = ref('')
const modalRef = ref<HTMLElement | null>(null)

// 模态窗口位置和大小
const modalPosition = ref({ x: 0, y: 0 })
const modalSize = ref({ width: 600, height: 500 })

// 渲染 Markdown 内容
const renderedModalContent = computed(() => {
  if (!modalContent.value) return ''
  return marked.parse(modalContent.value)
})

// 拖拽状态
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

// 调整大小状态
const isResizing = ref(false)
const resizeType = ref<'right' | 'bottom' | 'corner' | null>(null)
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 })

// 错误提示状态
const showError = ref(false)
const errorMessage = ref('')
let errorTimer: number | null = null

// 显示错误提示
const showErrorMessage = (message: string, duration = 3000) => {
  errorMessage.value = message
  showError.value = true
  
  // 清除之前的定时器
  if (errorTimer) {
    clearTimeout(errorTimer)
  }
  
  // 自动隐藏
  errorTimer = setTimeout(() => {
    showError.value = false
  }, duration) as unknown as number
}

// 关闭错误提示
const closeError = () => {
  showError.value = false
  if (errorTimer) {
    clearTimeout(errorTimer)
    errorTimer = null
  }
}

// 计算属性

const visiblePages = computed(() => {
  const pages = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(totalPages.value, currentPage.value + 2)
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

// 文本截断函数
const truncateText = (text: string, maxLength: number) => {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength)
}

// 清除 Markdown 符号
const cleanMarkdown = (text: string) => {
  if (!text) return ''
  // 移除 # 符号 (标题)
  return text.replace(/#{1,6}\s?/g, '').trim()
}

// 排序处理函数
const handleSort = (field: string) => {
  // 查找当前字段的排序信息
  const currentSortIndex = orderInfo.value.findIndex(info => info.orderWord === field)
  
  if (currentSortIndex !== -1) {
    // 如果字段已存在，切换排序方向
    orderInfo.value[currentSortIndex].orderId = orderInfo.value[currentSortIndex].orderId === 1 ? 0 : 1
  } else {
    // 如果字段不存在，添加到排序数组的开头（最高优先级）
    orderInfo.value.unshift({ orderWord: field, orderId: 1 }) // 默认降序
  }
  
  // 重新获取数据
  currentPage.value = 1 // 排序后回到第一页
  fetchSearchResults()
}

// 获取排序方向
const getSortDirection = (field: string): string | null => {
  const sortInfo = orderInfo.value.find(info => info.orderWord === field)
  
  if (!sortInfo) {
    return null // 无排序
  }
  
  return sortInfo.orderId === 1 ? 'desc' : 'asc'
}

// 获取排序图标样式（保留兼容性）
const getSortIcon = (field: string): string => {
  const sortInfo = orderInfo.value.find(info => info.orderWord === field)
  
  if (!sortInfo) {
    return 'sort-none' // 无排序
  }
  
  return sortInfo.orderId === 1 ? 'sort-desc' : 'sort-asc'
}

// 影响因子等级判断函数
const getImpactFactorClass = (impactFactor: number) => {
  if (impactFactor >= 10) {
    return 'if-top-level' // 顶级：≥ 10，Very High Impact
  } else if (impactFactor >= 5) {
    return 'if-q1' // Q1：5 ≤ IF < 10，High Impact
  } else if (impactFactor >= 3) {
    return 'if-q2' // Q2：3 ≤ IF < 5，Medium
  } else if (impactFactor >= 1) {
    return 'if-q3' // Q3：1 ≤ IF < 3，Low
  } else {
    return 'if-q4' // Q4：< 1，Very Low
  }
}

// 显示原文摘要模态窗口
const showAbstractModal = (paper: Paper) => {
  modalTitle.value = `原文摘要 - ${paper.title}`
  modalContent.value = paper.abstract
  resetModalPosition()
  showModal.value = true
}

// 显示整理后摘要模态窗口
const showSummaryModal = (paper: Paper) => {
  modalTitle.value = `整理后摘要 - ${paper.title}`
  modalContent.value = paper.summary
  resetModalPosition()
  showModal.value = true
}

const showReasonsModal = (paper: Paper) => {
  modalTitle.value = `推荐理由 - ${paper.title}`
  modalContent.value = paper.reasons?.length
    ? paper.reasons.map(reason => `- ${reason}`).join('\n')
    : '暂无推荐理由'
  resetModalPosition()
  showModal.value = true
}

// 关闭模态窗口
const closeModal = () => {
  showModal.value = false
  modalTitle.value = ''
  modalContent.value = ''
  // 重置位置和大小
  resetModalPosition()
}

// 重置模态窗口位置（居中）
const resetModalPosition = () => {
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  modalPosition.value = {
    x: (windowWidth - modalSize.value.width) / 2,
    y: (windowHeight - modalSize.value.height) / 2
  }
}

// 开始拖拽
const startDrag = (e: MouseEvent) => {
  isDragging.value = true
  dragStart.value = {
    x: e.clientX - modalPosition.value.x,
    y: e.clientY - modalPosition.value.y
  }
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

// 拖拽中
const onDrag = (e: MouseEvent) => {
  if (!isDragging.value) return
  
  modalPosition.value = {
    x: e.clientX - dragStart.value.x,
    y: e.clientY - dragStart.value.y
  }
}

// 停止拖拽
const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// 开始调整大小
const startResize = (e: MouseEvent, type: 'right' | 'bottom' | 'corner') => {
  isResizing.value = true
  resizeType.value = type
  resizeStart.value = {
    x: e.clientX,
    y: e.clientY,
    width: modalSize.value.width,
    height: modalSize.value.height
  }
  
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
  e.stopPropagation()
}

// 调整大小中
const onResize = (e: MouseEvent) => {
  if (!isResizing.value || !resizeType.value) return
  
  const deltaX = e.clientX - resizeStart.value.x
  const deltaY = e.clientY - resizeStart.value.y
  
  if (resizeType.value === 'right' || resizeType.value === 'corner') {
    modalSize.value.width = Math.max(400, resizeStart.value.width + deltaX)
  }
  
  if (resizeType.value === 'bottom' || resizeType.value === 'corner') {
    modalSize.value.height = Math.max(300, resizeStart.value.height + deltaY)
  }
}

// 停止调整大小
const stopResize = () => {
  isResizing.value = false
  resizeType.value = null
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

const TAG_PREVIEW_LIMIT = 6

const isAuthorsExpanded = (paperId: string) => expandedAuthorPaperIds.value.includes(paperId)

const toggleAuthorsExpanded = (paperId: string) => {
  expandedAuthorPaperIds.value = isAuthorsExpanded(paperId)
    ? expandedAuthorPaperIds.value.filter(id => id !== paperId)
    : [...expandedAuthorPaperIds.value, paperId]
}

const getVisibleAuthors = (paper: Paper) => {
  return isAuthorsExpanded(paper.id) ? paper.authors : paper.authors.slice(0, TAG_PREVIEW_LIMIT)
}

const getAuthorHiddenCount = (paper: Paper) => {
  return Math.max(0, paper.authors.length - TAG_PREVIEW_LIMIT)
}

const isKeywordsExpanded = (paperId: string) => expandedKeywordPaperIds.value.includes(paperId)

const toggleKeywordsExpanded = (paperId: string) => {
  expandedKeywordPaperIds.value = isKeywordsExpanded(paperId)
    ? expandedKeywordPaperIds.value.filter(id => id !== paperId)
    : [...expandedKeywordPaperIds.value, paperId]
}

const getVisibleKeywords = (paper: Paper) => {
  return isKeywordsExpanded(paper.id) ? paper.keywords : paper.keywords.slice(0, TAG_PREVIEW_LIMIT)
}

const getKeywordHiddenCount = (paper: Paper) => {
  return Math.max(0, paper.keywords.length - TAG_PREVIEW_LIMIT)
}

const getPaperPdfFileName = (paper: Paper) => {
  if (paper.pdfFileName) return paper.pdfFileName
  if (paper.ossName) return `pdf/${paper.ossName}.pdf`
  return paper.pdfUrl || ''
}

const getPaperMdFileName = (paper: Paper) => {
  if (paper.mdFileName) return paper.mdFileName
  if (paper.ossName) return `md/${paper.ossName}.md`
  return paper.pdfUrl ? paper.pdfUrl.replace(/\.pdf$/i, '.md') : ''
}

// 打开文档查看器
const openDocumentViewer = (paper: Paper) => {
  const pdfFileName = getPaperPdfFileName(paper)
  const mdFileName = getPaperMdFileName(paper)
  router.push({
    name: 'document',
    query: {
      title: paper.title,
      pdfUrl: pdfFileName,
      mdFileName: mdFileName
    }
  })
}

// 在浏览器中预览 PDF
const previewPDFInBrowser = async (paper: Paper) => {
  const fallbackToPdfUrl = () => {
    if (!paper.pdfUrl) return false
    window.open(paper.pdfUrl, '_blank')
    return true
  }

  try {
    const pdfFileName = getPaperPdfFileName(paper)
    if (!pdfFileName) {
      if (!fallbackToPdfUrl()) {
        showErrorMessage('未找到 PDF 文件名')
      }
      return
    }

    isLoading.value = true
    await ossService.previewPDF(pdfFileName)
  } catch (error: any) {
    console.error('预览 PDF 失败，尝试使用原始 pdfUrl:', error)
    if (fallbackToPdfUrl()) {
      return
    }

    const errorMsg = error?.message || '预览 PDF 失败'
    if (errorMsg.includes('accessKeyId') || errorMsg.includes('accessKeySecret')) {
      showErrorMessage('OSS 凭证获取失败，且未找到可用的 PDF 原始链接')
    } else if (errorMsg.includes('凭证字段不完整')) {
      showErrorMessage('OSS 凭证不完整，且未找到可用的 PDF 原始链接')
    } else {
      showErrorMessage('预览 PDF 失败，请稍后重试')
    }
  } finally {
    isLoading.value = false
  }
}

// 获取搜索结果
const fetchSearchResults = async () => {
  if (!taskId.value) return
  
  isLoading.value = true
  
  try {
    const result = await apiService.searchPapers(
      taskId.value,
      currentPage.value,
      pageSize.value,
      orderInfo.value
    )
    
    // 转换数据格式以匹配表格需求
    papers.value = result.papers.map(paper => ({
      ...paper,
      abstractExpanded: false,
      summaryExpanded: false
    }))
    const currentPaperIds = new Set(papers.value.map(paper => paper.id))
    expandedAuthorPaperIds.value = expandedAuthorPaperIds.value.filter(paperId => currentPaperIds.has(paperId))
    expandedKeywordPaperIds.value = expandedKeywordPaperIds.value.filter(paperId => currentPaperIds.has(paperId))
    
    totalResults.value = result.totalResults
    totalPages.value = result.totalPages
    currentPage.value = result.currentPage
    pageSize.value = result.pageSize
  } catch (error) {
    console.error('Failed to fetch search results:', error)
  } finally {
    isLoading.value = false
  }
}

// 获取所有页面的论文ID列表
const getAllPaperIds = async (): Promise<string[]> => {
  const allPaperIds: string[] = []
  
  try {
    // 遍历所有页面获取论文ID
    for (let page = 1; page <= totalPages.value; page++) {
      const result = await apiService.searchPapers(
        taskId.value,
        page,
        pageSize.value,
        orderInfo.value
      )
      
      const pageIds = result.papers.map(paper => paper.id.toString())
      allPaperIds.push(...pageIds)
    }
  } catch (error) {
    console.error('获取所有论文ID失败:', error)
  }
  
  return allPaperIds
}

// 全局全选处理
const handleSelectAll = async () => {
  if (selectAll.value) {
    // 全选：选择所有页面的所有论文
    isGlobalSelectAll.value = true
    isLoading.value = true
    
    try {
      const allPaperIds = await getAllPaperIds()
      selectedPapers.value = [...new Set(allPaperIds)] // 去重
    } catch (error) {
      console.error('全选操作失败:', error)
      // 如果失败，至少选中当前页
      const currentPageIds = papers.value.map(paper => paper.id)
      selectedPapers.value = [...new Set([...selectedPapers.value, ...currentPageIds])]
    } finally {
      isLoading.value = false
    }
  } else {
    // 取消全选：清空所有选择
    isGlobalSelectAll.value = false
    selectedPapers.value = []
  }
}

// 分页处理
const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    fetchSearchResults()
  }
}

// 每页显示条数变更处理
const handlePageSizeChange = () => {
  // 不重置页码，保持当前页面
  fetchSearchResults()
}


const batchDownload = () => {
  const selectedCount = selectedPapers.value.length
  alert(`正在批量下载 ${selectedCount} 篇论文`)
}

const batchExport = () => {
  const selectedCount = selectedPapers.value.length
  alert(`正在导出 ${selectedCount} 条记录`)
}

const clearSelection = () => {
  selectedPapers.value = []
  selectAll.value = false
  isGlobalSelectAll.value = false
}

// 更新当前页全选状态
const updateSelectAllStatus = () => {
  if (papers.value.length === 0) {
    selectAll.value = false
    return
  }
  
  if (isGlobalSelectAll.value) {
    // 全局全选模式下，全选复选框始终选中
    selectAll.value = true
  } else {
    // 普通模式下，检查当前页是否全选
    const currentPageIds = papers.value.map(paper => paper.id)
    const allCurrentPageSelected = currentPageIds.every(id => selectedPapers.value.includes(id))
    selectAll.value = allCurrentPageSelected
  }
}

// 在全局全选模式下，切换页面时自动选中当前页所有论文
const handlePageChange = () => {
  if (isGlobalSelectAll.value && papers.value.length > 0) {
    const currentPageIds = papers.value.map(paper => paper.id)
    // 将当前页的论文添加到选择列表
    const newSelections = [...new Set([...selectedPapers.value, ...currentPageIds])]
    selectedPapers.value = newSelections
  }
  updateSelectAllStatus()
}

// 监听单个论文的选择变化
watch(selectedPapers, () => {
  // 如果有任何论文被取消选择，退出全局全选模式
  if (isGlobalSelectAll.value && selectedPapers.value.length < totalResults.value) {
    isGlobalSelectAll.value = false
  }
  updateSelectAllStatus()
})

// 监听 papers 变化（页面切换）
watch(papers, () => {
  handlePageChange()
}, { immediate: true })

// 组件挂载时获取数据
onMounted(async () => {
  await parseKeywords() // 解析关键词（等待异步获取完成）
  if (taskId.value) {
    fetchSearchResults()
  } else {
    router.push('/')
  }
})
</script>

<style scoped>
.search-results-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
}

/* 动态背景装饰 */
.background-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 0;
  pointer-events: none;
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

.search-results-container {
  width: 100%;
  max-width: 1920px;
  margin: 0 auto;
  padding: 30px;
  min-height: 100vh;
  position: relative;
  z-index: 1;
  /* background-color: #f5f5f5; */
}

.page-header {
  margin-bottom: 24px;
  border-bottom: 1px solid #e5e5e5;
  padding-bottom: 16px;
}

.page-title {
  font-size: 38px;
  font-weight: 600;
  line-height: 1.2; 
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-align: center;
  margin: 0 0 18px 0;
  letter-spacing: 4px; 
}

.search-info {
  display: flex;
  gap: 24px;
  font-size: 14px;
  color: #666666;
  align-items: center;
  flex-wrap: wrap;
}

.search-keywords {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.keywords-label {
  font-weight: 700;
  color: #333333;
}

.keyword-tag1 {
  display: inline-block;
  padding: 4px 8px;
  background-color: #e3f2fd;
  color: #1565c0;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 172, 193, 0.3);
  transition: all 0.3s ease;
}

.search-keyword {
  font-weight: 500;
}

  .result-count {
    color: #00838f;
    font-weight: 600;
  }

.table-container {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 24px;
  backdrop-filter: blur(10px);
}

.table-wrapper {
  overflow-x: auto;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.results-table {
  table-layout: auto;
}

.results-table th {
  background-color: #f8f9fa;
  padding: 12px 8px;
  text-align: center;
  font-weight: 600;
  color: #333333;
  border-bottom: 2px solid #e5e5e5;
  white-space: nowrap;
  font-size: 13px;
}

.results-table td {
  padding: 12px 8px;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: top;
  word-wrap: break-word;
}

.col-select { 
  width: 52px; 
  min-width: 52px; 
  text-align: center;
}

.results-table th.col-select,
.results-table td.col-select {
  padding-left: 4px;
  padding-right: 4px;
}

.select-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
}
.col-title { 
  width: auto; 
  min-width: 200px; 
  text-align: left;
}
.col-recommendation {
  width: auto;
  min-width: 170px;
  text-align: center;
}
.col-authors { 
  width: auto; 
  min-width: 120px; 
  text-align: left;
}
.col-year { 
  width: auto; 
  min-width: 80px; 
  text-align: center;
}
.col-journal { 
  width: auto; 
  min-width: 150px; 
  text-align: left;
}
.col-venue-type { 
  width: auto; 
  min-width: 60px; 
  text-align: center;
}
.col-tags { 
  width: auto; 
  min-width: 180px; 
  text-align: center;
}
.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  align-items: center;
}
.col-keywords { 
  width: auto; 
  min-width: 120px;
  text-align: center;
}
.col-abstract, .col-summary { 
  width: auto; 
  min-width: 200px; 
  text-align: left;
}
.col-citations { 
  width: auto; 
  min-width: 80px; 
  text-align: center;
}
.col-link { 
  width: auto; 
  min-width: 140px; 
  text-align: center;
}

.results-table tr:hover {
  background-color: #f8f9fa;
}

.results-table tr.selected {
  background-color: #e8f4fd;
}


.checkbox {
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.title-content {
  max-width: 100%;
}

.paper-title {
  font-size: 16px;
  font-weight: 600;
  color: #333333;
  margin: 0 0 8px 0;
  line-height: 1.4;
  word-wrap: break-word;
  white-space: normal;
}

.recommendation-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.star-rating {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  white-space: nowrap;
}

.star-icon {
  color: #cbd5e1;
  font-size: 15px;
  line-height: 1;
}

.star-icon.active {
  color: #f59e0b;
  text-shadow: 0 1px 3px rgba(245, 158, 11, 0.25);
}

.star-score {
  margin-left: 5px;
  color: #92400e;
  font-size: 12px;
  font-weight: 700;
}

.recommendation-actions {
  display: flex;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}

.recommendation-btn {
  padding: 4px 8px;
  border: 1px solid #f59e0b;
  border-radius: 999px;
  background: #fffbeb;
  color: #92400e;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.recommendation-btn:hover:not(:disabled) {
  background: #f59e0b;
  color: #ffffff;
  box-shadow: 0 3px 8px rgba(245, 158, 11, 0.25);
}

.recommendation-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.recommendation-btn.reason-btn {
  border-color: #38bdf8;
  background: #f0f9ff;
  color: #0369a1;
}

.recommendation-btn.reason-btn:hover:not(:disabled) {
  background: #0ea5e9;
  color: #ffffff;
  box-shadow: 0 3px 8px rgba(14, 165, 233, 0.25);
}

.paper-abstract {
  font-size: 13px;
  color: #666666;
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}


.btn {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-primary {
  background-color: #0088ff;
  color: #ffffff;
  border-color: #0088ff;
}

.btn-primary:hover {
  background-color: #0066cc;
  border-color: #0066cc;
}

.btn-secondary {
  background-color: #6c757d;
  color: #ffffff;
  border-color: #6c757d;
}

.btn-secondary:hover {
  background-color: #545b62;
  border-color: #545b62;
}

.btn-outline {
  background-color: transparent;
  color: #6b6767;
  border-color: #476581;
}

.btn-outline:hover {
  background-color: #f6f8fa;
  border-color: #d0d7de;
}

.btn-outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-page {
  background-color: transparent;
  color: #666666;
  border-color: #d0d7de;
  min-width: 36px;
}

.btn-page:hover {
  background-color: #f6f8fa;
}

.btn-page.active {
  background-color: #0088ff;
  color: #ffffff;
  border-color: #0088ff;
}

.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.pagination-info {
  font-size: 14px;
  color: #666666;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-size-selector {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-size-selector label {
  font-size: 14px;
  color: #666666;
  white-space: nowrap;
}

.page-size-select {
  padding: 4px 8px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  font-size: 14px;
  color: #333333;
  background-color: #ffffff;
  cursor: pointer;
  min-width: 70px;
}

.page-size-select:hover {
  border-color: #0088ff;
}

.page-size-select:focus {
  outline: none;
  border-color: #0088ff;
  box-shadow: 0 0 0 2px rgba(0, 136, 255, 0.1);
}

.page-numbers {
  display: flex;
  gap: 4px;
}

.batch-actions {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #ffffff;
  padding: 16px 24px;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 1000;
}

.selected-info {
  font-size: 14px;
  color: #333333;
  font-weight: 500;
}

.batch-buttons {
  display: flex;
  gap: 8px;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #0088ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .search-results-container {
    padding: 16px;
  }
  
  .col-title {
    min-width: 180px;
  }
  
  .col-authors,
  .col-journal {
    min-width: 120px;
  }
  
  .col-venue-type {
    min-width: 50px;
  }
  
  .col-tags {
    min-width: 150px;
  }
  
  .col-abstract,
  .col-summary {
    min-width: 150px;
  }
  
  .pagination-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .pagination-controls {
    flex-wrap: wrap;
    gap: 8px;
  }
}

@media (max-width: 768px) {
  .search-info {
    flex-direction: column;
    gap: 8px;
  }
  
  .pagination-container {
    flex-direction: column;
    align-items: stretch;
  }
  
  .pagination-controls {
    justify-content: center;
  }
  
  .batch-actions {
    position: static;
    transform: none;
    margin-top: 16px;
    flex-direction: column;
    align-items: stretch;
  }
  
  .batch-buttons {
    justify-content: center;
  }
  
  .results-table {
    font-size: 12px;
  }
  
  .results-table th,
  .results-table td {
    padding: 8px 6px;
  }
  
  .paper-title {
    font-size: 14px;
  }
  
  .paper-abstract {
    font-size: 12px;
  }
}

/* 新增样式 */
/* 作者标签 */
.authors-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.author-tag {
  background-color: #e3f2fd;
  color: #1976d2;
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.tag-more {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border: none;
  border-radius: 12px;
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s ease, color 0.2s ease;
}

.tag-more:hover {
  background: rgba(37, 99, 235, 0.14);
  color: #1d4ed8;
}

.tag-more.keyword-more {
  background: rgba(124, 58, 237, 0.1);
  color: #7c3aed;
}

.tag-more.keyword-more:hover {
  background: rgba(124, 58, 237, 0.16);
  color: #5b21b6;
}

/* 级别标签 */
.level-tag {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  min-width: 30px;
}

/* CCF级别标签 */
.ccf-tag.ccf-a {
  background-color: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #4caf50;
}

.ccf-tag.ccf-b {
  background-color: #fff3e0;
  color: #ef6c00;
  border: 1px solid #ff9800;
}

.ccf-tag.ccf-c {
  background-color: #fce4ec;
  color: #c2185b;
  border: 1px solid #e91e63;
}

/* SCI级别标签 */
.sci-tag.sci-q1 {
  background-color: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #4caf50;
}

.sci-tag.sci-q2 {
  background-color: #e3f2fd;
  color: #1976d2;
  border: 1px solid #2196f3;
}

.sci-tag.sci-q3 {
  background-color: #fff3e0;
  color: #ef6c00;
  border: 1px solid #ff9800;
}

.sci-tag.sci-q4 {
  background-color: #fce4ec;
  color: #c2185b;
  border: 1px solid #e91e63;
}

/* CORE等级标签 */
/* A* 和 A 级别 - 绿色 (最高级别) */
.core-tag.core-a\*,
.core-tag.core-a {
  background-color: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #4caf50;
  font-weight: 600;
}

/* B 级别 - 蓝色 */
.core-tag.core-b {
  background-color: #e3f2fd;
  color: #1976d2;
  border: 1px solid #2196f3;
  font-weight: 600;
}

/* C 级别 - 橙色 */
.core-tag.core-c {
  background-color: #fff3e0;
  color: #ef6c00;
  border: 1px solid #ff9800;
  font-weight: 600;
}

/* 未分级 - 灰色 */
.core-tag.core-unranked,
.core-tag.core-none {
  background-color: #f5f5f5;
  color: #757575;
  border: 1px solid #e0e0e0;
  font-weight: 600;
}

/* 中科院分区标签 */
.jcr-tag.jcr-1区,
.jcr-tag.jcr-1区top,
.jcr-tag.jcr-q1 {
  background-color: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #4caf50;
  font-weight: 600;
}

.jcr-tag.jcr-2区,
.jcr-tag.jcr-q2 {
  background-color: #e3f2fd;
  color: #1976d2;
  border: 1px solid #2196f3;
  font-weight: 600;
}

.jcr-tag.jcr-3区,
.jcr-tag.jcr-q3 {
  background-color: #fff3e0;
  color: #ef6c00;
  border: 1px solid #ff9800;
  font-weight: 600;
}

.jcr-tag.jcr-4区,
.jcr-tag.jcr-q4 {
  background-color: #fce4ec;
  color: #c2185b;
  border: 1px solid #e91e63;
  font-weight: 600;
}

/* 关键词标签 */
.keywords-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  align-items: center;
}

.keyword-tag {
  background-color: #f3e5f5;
  color: #7b1fa2;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
}

/* 摘要和总结内容 */
.abstract-content,
.summary-content {
  max-width: 200px;
}

.abstract-text,
.summary-text {
  font-size: 12px;
  line-height: 1.4;
  color: #666;
  margin: 0 0 4px 0;
  word-wrap: break-word;
}

.abstract-text.expanded,
.summary-text.expanded {
  display: block;
}

.expand-dots {
  color: #1890ff;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  margin-left: 2px;
  padding: 2px 4px;
  border-radius: 2px;
  transition: all 0.2s;
  display: inline-block;
}

.expand-dots:hover {
  background-color: #f0f8ff;
  color: #0056b3;
}

/* 作者列表展开/收起按钮 */
.expand-authors {
  color: #1890ff;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  margin-left: 4px;
  padding: 2px 6px;
  border-radius: 2px;
  transition: all 0.2s;
  display: inline-block;
}

.expand-authors:hover {
  background-color: #f0f8ff;
  color: #0056b3;
}

.collapse-authors {
  color: #1890ff;
  cursor: pointer;
  font-size: 11px;
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 2px;
  transition: all 0.2s;
  display: inline-block;
  border: 1px solid #d9d9d9;
  background-color: #fafafa;
}

.collapse-authors:hover {
  background-color: #e6f7ff;
  border-color: #1890ff;
  color: #0056b3;
}

.collapse-btn {
  color: #1890ff;
  cursor: pointer;
  font-size: 11px;
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 2px;
  transition: all 0.2s;
  display: inline-block;
  border: 1px solid #d9d9d9;
  background-color: #fafafa;
}

.collapse-btn:hover {
  background-color: #e6f7ff;
  border-color: #1890ff;
  color: #0056b3;
}

/* 类型标签 */
.venue-type-tag {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  min-width: 40px;
}

.journal-tag {
  background-color: #e8f5e8;
  color: #2e7d32;
}

.conference-tag {
  background-color: #e3f2fd;
  color: #1565c0;
}

/* 影响因子标签基础样式 */
.impact-factor-tag {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  min-width: 45px;
  border: 1px solid;
}

/* 影响因子等级颜色 */
/* 顶级：≥ 10，Very High Impact */
.impact-factor-tag.if-top-level {
  background-color: #e8f5e8;
  color: #1b5e20;
  border-color: #4caf50;
}

/* Q1：5 ≤ IF < 10，High Impact */
.impact-factor-tag.if-q1 {
  background-color: #e3f2fd;
  color: #0d47a1;
  border-color: #2196f3;
}

/* Q2：3 ≤ IF < 5，Medium */
.impact-factor-tag.if-q2 {
  background-color: #fff3e0;
  color: #e65100;
  border-color: #ff9800;
}

/* Q3：1 ≤ IF < 3，Low */
.impact-factor-tag.if-q3 {
  background-color: #fce4ec;
  color: #ad1457;
  border-color: #e91e63;
}

/* Q4：< 1，Very Low */
.impact-factor-tag.if-q4 {
  background-color: #f3e5f5;
  color: #4a148c;
  border-color: #9c27b0;
}

/* 引用次数 */
.citations-count {
  text-align: center;
}

.citation-number {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

/* 论文链接 */
.resource-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  justify-content: center;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid #1976d2;
  background: #eff6ff;
  color: #1976d2;
  text-decoration: none;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  transition: all 0.2s;
}

.link-btn:hover {
  background: #dbeafe;
  color: #1d4ed8;
  border-color: #1d4ed8;
}

.action-buttons {
  display: flex;
  gap: 6px;
}

.action-btn {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid;
  text-decoration: none;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1.2;
}

.compact-link-btn {
  min-width: auto;
  border-radius: 999px;
}

.pdf-btn {
  color: #1976d2;
  background: #e3f2fd;
  border-color: #1976d2;
}

.pdf-btn:hover {
  background-color: #bbdefb;
  color: #0d47a1;
  border-color: #0d47a1;
}

/* 无数据显示 */
.no-data {
  color: #999;
  font-size: 12px;
}

/* 模态窗口样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;
}

/* 可调整大小的模态窗口 */
.resizable-modal {
  position: fixed;
  min-width: 400px;
  min-height: 300px;
  max-width: 90vw;
  max-height: 90vh;
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e8e8e8;
}

/* 可拖拽的标题栏 */
.draggable-header {
  cursor: move;
  user-select: none;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 20px;
}

.modal-close {
  background: none;
  border: none;
  font-size: 28px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.modal-close:hover {
  background-color: #f5f5f5;
  color: #333;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.modal-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  text-align: left;
}

/* Markdown 样式适配 */
.markdown-body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}

.markdown-body p {
  margin-bottom: 16px;
}

.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-body ul, .markdown-body ol {
  padding-left: 2em;
  margin-bottom: 16px;
}

.markdown-body code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: #f6f8fa;
  border-radius: 6px;
}

.markdown-body pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 6px;
  margin-bottom: 16px;
}

.markdown-body blockquote {
  padding: 0 1em;
  color: #656d76;
  border-left: 0.25em solid #d0d7de;
  margin-bottom: 16px;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e8e8e8;
  display: flex;
  justify-content: flex-end;
}

.modal-footer .btn {
  min-width: 80px;
}

/* 调整大小手柄 */
.resize-handle {
  position: absolute;
  background: transparent;
  z-index: 10;
}

.resize-right {
  right: 0;
  top: 0;
  width: 8px;
  height: 100%;
  cursor: ew-resize;
}

.resize-bottom {
  bottom: 0;
  left: 0;
  width: 100%;
  height: 8px;
  cursor: ns-resize;
}

.resize-corner {
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
}

.resize-corner::after {
  content: '';
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 8px;
  height: 8px;
  border-right: 2px solid #ccc;
  border-bottom: 2px solid #ccc;
}

/* 错误提示样式 */
.error-notification {
  position: fixed;
  top: 80px;
  right: 24px;
  z-index: 3000;
  animation: slideInRight 0.3s ease-out;
  cursor: pointer;
}

@keyframes slideInRight {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.error-content {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  color: white;
  padding: 16px 20px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(255, 107, 107, 0.3);
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 320px;
  max-width: 480px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.error-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.error-text {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
}

.error-close {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.error-close:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    max-height: 90vh;
  }
  
  .modal-header h3 {
    font-size: 16px;
  }
  
  .modal-text {
    font-size: 13px;
  }
}

/* 排序相关样式 */
.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
}

.sortable:hover {
  background-color: #f8f9fa;
}

.sort-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
}

.sort-icon {
  display: flex;
  align-items: center;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.sortable:hover .sort-icon {
  opacity: 1;
}

/* 双箭头容器 */
.sort-arrows {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

/* 箭头基础样式 */
.sort-arrow {
  width: 0;
  height: 0;
  border-left: 3px solid transparent;
  border-right: 3px solid transparent;
  transition: all 0.2s ease;
  opacity: 0.3;
}

/* 上箭头 */
.sort-arrow.sort-up {
  border-bottom: 4px solid #666;
  border-top: none;
}

/* 下箭头 */
.sort-arrow.sort-down {
  border-top: 4px solid #666;
  border-bottom: none;
}

/* 激活状态 */
.sort-arrow.active {
  opacity: 1;
}

.sort-arrow.sort-up.active {
  border-bottom-color: #0088ff;
}

.sort-arrow.sort-down.active {
  border-top-color: #0088ff;
}

/* 悬停效果 */
.sortable:hover .sort-arrow {
  opacity: 0.7;
}

.sortable:hover .sort-arrow.active {
  opacity: 1;
}

/* 兼容旧样式 */
.sort-arrow.sort-desc {
  border-bottom: 6px solid #0088ff;
  border-top: none;
  opacity: 1;
}

.sort-arrow.sort-asc {
  border-top: 6px solid #0088ff;
  border-bottom: none;
  opacity: 1;
}

.sort-arrow.sort-none {
  border-bottom: 6px solid #ccc;
  opacity: 0.4;
}

/* 排序激活状态 */
.sortable.sort-active {
  background-color: #e3f2fd;
  color: #1976d2;
}

.sortable.sort-active .sort-icon {
  opacity: 1;
}

/* 标签列表头居中 */
.col-tags.sortable {
  text-align: center;
}

.col-tags .sort-header {
  justify-content: center;
  gap: 8px;
}
</style>
