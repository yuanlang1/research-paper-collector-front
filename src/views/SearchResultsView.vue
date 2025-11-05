<template>
  <div class="search-results-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">检索信息页</h1>
        <div class="search-info">
          <div class="search-keywords">
            <span class="keywords-label">搜索关键词:</span>
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
                <input 
                  type="checkbox" 
                  v-model="selectAll" 
                  @change="handleSelectAll"
                  class="checkbox"
                />
                选择
              </th>
              <th class="col-title">论文标题</th>
              <th class="col-authors">作者列表</th>
              <th class="col-year">发表年份</th>
              <th class="col-journal">期刊或会议名称</th>
              <th class="col-venue-type">类型</th>
              <th class="col-ccf">CCF级别</th>
              <th class="col-sci">SCI级别</th>
              <th class="col-jcr">JCR级别</th>
              <th class="col-impact-factor">影响因子</th>
              <th class="col-keywords">关键词</th>
              <th class="col-abstract">原文摘要</th>
              <th class="col-summary">整理后摘要</th>
              <th class="col-citations">引用次数</th>
          <th class="col-link">论文链接</th>
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
              <td class="col-authors">
                <div class="authors-tags">
                  <span 
                    v-for="(author, index) in paper.authors" 
                    :key="index"
                    class="author-tag"
                  >
                    {{ author }}
                  </span>
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
              <td class="col-ccf">
                <span v-if="paper.ccfLevel" class="level-tag ccf-tag" :class="'ccf-' + paper.ccfLevel.toLowerCase()">
                  {{ paper.ccfLevel }}
                </span>
                <span v-else class="no-data">-</span>
              </td>
              <td class="col-sci">
                <span v-if="paper.sciLevel" class="level-tag sci-tag" :class="'sci-' + paper.sciLevel.toLowerCase()">
                  {{ paper.sciLevel }}
                </span>
                <span v-else class="no-data">-</span>
              </td>
              <td class="col-jcr">
                <span v-if="paper.jcrLevel" class="level-tag jcr-tag" :class="'jcr-' + paper.jcrLevel.toLowerCase()">
                  {{ paper.jcrLevel }}
                </span>
                <span v-else class="no-data">-</span>
              </td>
              <td class="col-impact-factor">
                <span 
                  v-if="paper.impactFactor" 
                  class="impact-factor-tag"
                  :class="getImpactFactorClass(paper.impactFactor)"
                >
                  {{ paper.impactFactor }}
                </span>
                <span v-else class="no-data">-</span>
              </td>
              <td class="col-keywords">
                <div class="keywords-tags">
                  <span 
                    v-for="(keyword, index) in paper.keywords" 
                    :key="index"
                    class="keyword-tag"
                  >
                    {{ keyword }}
                  </span>
                </div>
              </td>
              <td class="col-abstract">
                <div class="abstract-content">
                  <p class="abstract-text" :class="{ 'expanded': paper.abstractExpanded }">
                    <span v-if="!paper.abstractExpanded && paper.abstract && paper.abstract.length > 100">
                      {{ truncateText(paper.abstract, 80) }}
                      <span class="expand-dots" @click="toggleAbstract(paper.id)">...</span>
                    </span>
                    <span v-else>
                      {{ paper.abstract }}
                      <span 
                        v-if="paper.abstractExpanded && paper.abstract && paper.abstract.length > 100" 
                        class="collapse-btn" 
                        @click="toggleAbstract(paper.id)"
                      >
                        收起
                      </span>
                    </span>
                  </p>
                </div>
              </td>
              <td class="col-summary">
                <div class="summary-content">
                  <p class="summary-text" :class="{ 'expanded': paper.summaryExpanded }">
                    <span v-if="!paper.summaryExpanded && paper.summary && paper.summary.length > 100">
                      {{ truncateText(paper.summary, 80) }}
                      <span class="expand-dots" @click="toggleSummary(paper.id)">...</span>
                    </span>
                    <span v-else>
                      {{ paper.summary }}
                      <span 
                        v-if="paper.summaryExpanded && paper.summary && paper.summary.length > 100" 
                        class="collapse-btn" 
                        @click="toggleSummary(paper.id)"
                      >
                        收起
                      </span>
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
                <div class="paper-link">
                  <a 
                    v-if="paper.link" 
                    :href="paper.link" 
                    target="_blank" 
                    class="link-btn"
                    title="查看原文"
                  >
                    🔗 原文
                  </a>
                  <span v-else class="no-data">-</span>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiService, type Paper } from '@/services/api'

// 路由相关
const route = useRoute()
const router = useRouter()

// 搜索参数
const searchKeyword = ref(route.query.keyword as string || '')
const searchKeywords = ref<string[]>([])
const taskId = ref(parseInt(route.query.taskId as string) || 0)

// 解析URL参数中的关键词
const parseKeywords = () => {
  if (route.query.keywords) {
    // 从URL参数解析关键词数组
    searchKeywords.value = (route.query.keywords as string).split(',').filter(k => k.trim())
  } else if (searchKeyword.value) {
    // 如果没有关键词数组，使用搜索词作为关键词
    searchKeywords.value = [searchKeyword.value]
  }
}

// 数据状态
const papers = ref<Paper[]>([])
const isLoading = ref(false)
const totalResults = ref(0)
const totalPages = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

// 选择状态
const selectedPapers = ref<number[]>([])
const selectAll = ref(false)

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

// 切换摘要展开状态
const toggleAbstract = (paperId: number) => {
  const paper = papers.value.find(p => p.id === paperId)
  if (paper) {
    paper.abstractExpanded = !paper.abstractExpanded
  }
}

// 切换总结展开状态
const toggleSummary = (paperId: number) => {
  const paper = papers.value.find(p => p.id === paperId)
  if (paper) {
    paper.summaryExpanded = !paper.summaryExpanded
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
      pageSize.value
    )
    
    // 转换数据格式以匹配表格需求
    papers.value = result.papers.map(paper => ({
      ...paper,
      abstractExpanded: false,
      summaryExpanded: false
    }))
    
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

// 全选处理
const handleSelectAll = () => {
  if (selectAll.value) {
    selectedPapers.value = papers.value.map(paper => paper.id)
  } else {
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
}

// 组件挂载时获取数据
onMounted(() => {
  parseKeywords() // 解析关键词
  if (taskId.value) {
    fetchSearchResults()
  } else {
    router.push('/')
  }
})
</script>

<style scoped>
.search-results-container {
  width: 100%;
  max-width: 1920px;
  margin: 0 auto;
  padding: 30px;
  min-height: 100vh;
  background-color: #ffffff;
}

.page-header {
  margin-bottom: 24px;
  border-bottom: 1px solid #e5e5e5;
  padding-bottom: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #333333;
  margin: 0 0 12px 0;
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
  font-weight: 500;
  color: #333333;
}

.keyword-tag1 {
  display: inline-block;
  padding: 4px 8px;
  background-color: #e3f2fd;
  color: #1565c0;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid #bbdefb;
}

.search-keyword {
  font-weight: 500;
}

  .result-count {
    color: #0088ff;
  }

.table-container {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 24px;
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

/* 为文本内容列的表头设置左对齐 */
.results-table th.col-title,
.results-table th.col-authors,
.results-table th.col-journal,
.results-table th.col-abstract,
.results-table th.col-summary {
  text-align: left;
}

.results-table td {
  padding: 12px 8px;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: top;
  word-wrap: break-word;
}

/* 动态列宽设置 */
.col-select { 
  width: auto; 
  min-width: 60px; 
  text-align: center;
}
.col-title { 
  width: auto; 
  min-width: 200px; 
  text-align: left;
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
.col-ccf, .col-sci, .col-jcr { 
  width: auto; 
  min-width: 70px; 
  text-align: center;
}
.col-impact-factor { 
  width: auto; 
  min-width: 80px; 
  text-align: center;
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
  min-width: 100px; 
  text-align: center;
}

.results-table tr:hover {
  background-color: #f8f9fa;
}

.results-table tr.selected {
  background-color: #e8f4fd;
}


.checkbox {
  width: 16px;
  height: 16px;
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
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
  color: #666666;
  border-color: #d0d7de;
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
  
  .col-impact-factor {
    min-width: 60px;
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

/* JCR级别标签 */
.jcr-tag.jcr-q1 {
  background-color: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #4caf50;
}

.jcr-tag.jcr-q2 {
  background-color: #e3f2fd;
  color: #1976d2;
  border: 1px solid #2196f3;
}

.jcr-tag.jcr-q3 {
  background-color: #fff3e0;
  color: #ef6c00;
  border: 1px solid #ff9800;
}

.jcr-tag.jcr-q4 {
  background-color: #fce4ec;
  color: #c2185b;
  border: 1px solid #e91e63;
}

/* 关键词标签 */
.keywords-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
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
.link-btn {
  color: #1976d2;
  text-decoration: none;
  font-size: 12px;
  font-weight: 500;
}

.link-btn:hover {
  text-decoration: underline;
}

/* 无数据显示 */
.no-data {
  color: #999;
  font-size: 12px;
}
</style>
