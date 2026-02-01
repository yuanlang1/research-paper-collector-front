<template>
  <div class="home-wrapper">
    <!-- 动态背景装饰 -->
    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>
    
    <div class="home-container">
      <!-- 标题 -->
      <h1 class="main-title">科研论文收集器</h1>
    
    <!-- 搜索区域 -->
    <div class="search-section">
      <SearchInput 
        v-model="searchQuery" 
        @search="handleSearch"
        @clear="handleClear"
      >
        <template #right>
          <div class="source-dropdown" ref="sourceDropdownRef">
            <div 
              class="source-trigger" 
              @click="toggleSourceMenu"
              :style="{ width: sourceSelectWidth }"
            >
              {{ getSourceLabel(sourceTag) }}
            </div>
            <transition name="fade">
              <div v-if="showSourceMenu" class="source-options">
                <div 
                  v-for="opt in sourceOptions" 
                  :key="opt.value" 
                  class="source-option"
                  :class="{ active: sourceTag === opt.value }"
                  @click="selectSource(opt.value)"
                >
                  {{ opt.label }}
                </div>
              </div>
            </transition>
          </div>
        </template>

        <div class="filter-bar">
          <!-- 年份标签 -->
          <span
            v-for="(year, index) in yearTags"
            :key="`year-${index}`"
            class="filter-tag"
            :class="{ 'filter-tag-active': selectedYearIndex === index }"
            @click="selectYearTag(index)"
          >
            最近{{ year }}年
            <span class="tag-close" @click.stop="removeYearTag(index)">×</span>
          </span>

          <!-- 论文类型标签 -->
          <span
            v-for="tag in visiblePaperTags"
            :key="tag.value"
            class="filter-tag"
            :class="{ 'filter-tag-active': paperTag === tag.value }"
            @click="togglePaperTag(tag.value)"
          >
            {{ tag.label }}
            <span class="tag-close" @click.stop="removePaperTag(tag.value)">×</span>
          </span>

          <!-- 添加按钮 -->
          <div class="add-tag-wrapper" ref="addTagWrapperRef">
            <span 
              class="filter-tag add-btn" 
              :class="{ 'active': showAddMenu }"
              @click="toggleAddMenu"
            >
              +
            </span>

            <!-- 添加菜单 -->
            <div v-if="showAddMenu" class="add-menu">
              <!-- 主菜单 -->
              <div v-if="addMenuMode === 'main'" class="menu-options">
                <div class="menu-item" @click.stop="switchToTimeMode">
                  <span class="icon">🕒</span> 时间标签
                </div>
                <div class="menu-item" @click.stop="switchToPaperMode">
                  <span class="icon">📄</span> 论文标签
                </div>
              </div>

              <!-- 时间输入 -->
              <div v-else-if="addMenuMode === 'time'" class="time-input-wrapper">
                <div class="input-row">
                  <input
                    ref="yearInputRef"
                    v-model="newYearValue"
                    class="menu-input"
                    type="number"
                    min="1"
                    placeholder="最近年数"
                    @keyup.enter="confirmAddYear"
                  />
                  <button class="menu-confirm-btn" @click="confirmAddYear">确定</button>
                </div>
              </div>

              <!-- 论文标签池 -->
              <div v-else-if="addMenuMode === 'paper'" class="paper-pool">
                <div 
                  v-for="tag in paperTagPool" 
                  :key="tag.value"
                  class="pool-item"
                  @click="addPaperTagToBar(tag)"
                >
                  {{ tag.label }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SearchInput>
      <SearchButton class="home-search-btn" @click="handleSearch" />
    </div>
    
    <!-- AI关键词区域 -->
    <div class="keywords-section" v-if="extractedKeywords.length > 0 || isExtractingKeywords">
      <div class="keywords-header">
        <h3>
          AI提取的关键词
          <span v-if="isExtractingKeywords" class="loading-spinner">🤔</span>
        </h3>
        <span class="keywords-hint" v-if="!isExtractingKeywords">双击编辑，点击×删除</span>
        <span class="keywords-hint" v-else>AI正在分析中...</span>
      </div>
      <div class="keywords-list">
        <EditableTag
          v-for="(keyword, index) in extractedKeywords"
          :key="`keyword-${index}`"
          :keyword="keyword"
          @update="(newKeyword) => updateKeyword(index, newKeyword)"
          @remove="removeKeyword(index)"
        />
        <AddKeywordButton @add="addKeyword" />
      </div>
      <div class="keywords-actions">
        <button class="btn btn-primary" @click="searchWithKeywords">
          使用这些关键词搜索
        </button>
        <button class="btn btn-outline" @click="clearKeywords">
          清空关键词
        </button>
      </div>
    </div>

    <!-- 标签切换区域 -->
    <div class="tag-section" v-show="hasSearchHistory">
      <div class="tag-section-header">
        <h3>最近搜索</h3>
      </div>
      <div class="tag-list">
        <TagToggle 
          v-for="tag in allTags" 
          :key="tag.id"
          :title="tag.keyword"
          :active="tag.active"
          variant="search-history"
          @toggle="handleTagToggle(tag.keyword)"
        />
      </div>
      <div class="pagination-controls">
        <button 
          class="btn-pagination" 
          :disabled="currentPage === 1"
          @click="goToPreviousPage"
        >
          上一页
        </button>
        <div class="page-size-selector">
          <label for="pageSize">每页显示：</label>
          <select id="pageSize" v-model="pageSize" @change="handlePageSizeChange" class="page-size-select">
            <option :value="3">3 条</option>
            <option :value="5">5 条</option>
            <option :value="10">10 条</option>
          </select>
        </div>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
        <button 
          class="btn-pagination" 
          :disabled="currentPage === totalPages"
          @click="goToNextPage"
        >
          下一页
        </button>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import SearchInput from '@/components/SearchInput.vue'
import SearchButton from '@/components/SearchButton.vue'
import TagToggle from '@/components/TagToggle.vue'
import EditableTag from '@/components/EditableTag.vue'
import AddKeywordButton from '@/components/AddKeywordButton.vue'
import { apiService } from '@/services/api'

// 路由
const router = useRouter()

// 最近搜索状态
const recentSearches = ref<Array<{id: number, title: string}>>([])
const currentPage = ref(1)
const pageSize = ref(3)
const totalPages = ref(1)
const totalRecords = ref(0)

// 获取最近搜索（使用分页参数，一行显示多个）
const fetchRecentSearches = async (page: number = 1) => {
  try {
    // 获取带分页信息的完整响应
    const response = await apiService.getSearchHistoryWithPagination(page, pageSize.value)
    
    recentSearches.value = response.data.list.map(item => ({
      id: item.id,
      title: item.searchWord
    }))
    
    // 更新分页信息
    currentPage.value = response.data.pageNumber
    totalPages.value = response.data.pages
    totalRecords.value = response.data.total
  } catch (error) {
    console.error('获取最近搜索失败:', error)
  }
}

// 上一页
const goToPreviousPage = () => {
  if (currentPage.value > 1) {
    fetchRecentSearches(currentPage.value - 1)
  }
}

// 下一页
const goToNextPage = () => {
  if (currentPage.value < totalPages.value) {
    fetchRecentSearches(currentPage.value + 1)
  }
}

// 处理每页显示数量变化
const handlePageSizeChange = () => {
  // 重置到第一页
  fetchRecentSearches(1)
}

// 搜索相关状态
const searchQuery = ref('')
const selectedTag = ref<string>('')

// 年份过滤标签池：N 表示近 N 年，默认不选择（yearTag=0）
const yearTags = ref<number[]>([3, 5])
const selectedYearIndex = ref<number | null>(null)
const filterYear = ref(0)

const selectYearTag = (index: number) => {
  if (selectedYearIndex.value === index) {
    // 再次点击同一个标签：取消选择，yearTag 回到 0
    selectedYearIndex.value = null
    filterYear.value = 0
  } else {
    // 选择新的年份标签
    selectedYearIndex.value = index
    filterYear.value = yearTags.value[index]
  }
}

const removeYearTag = (index: number) => {
  yearTags.value.splice(index, 1)
  if (selectedYearIndex.value === index) {
    selectedYearIndex.value = null
    filterYear.value = 0
  } else if (selectedYearIndex.value !== null && selectedYearIndex.value > index) {
    selectedYearIndex.value--
  }
}

// 论文标签相关
type PaperTagValue = 'journal' | 'proceedings' | 'thesis'
interface PaperTagItem {
  label: string
  value: PaperTagValue
}

const paperTagPool: PaperTagItem[] = [
  { label: '会议', value: 'proceedings' },
  { label: '期刊', value: 'journal' },
  { label: '学位论文', value: 'thesis' }
]

const visiblePaperTags = ref<PaperTagItem[]>([
  { label: '会议', value: 'proceedings' },
  { label: '期刊', value: 'journal' }
])

const paperTag = ref<string>('')

const togglePaperTag = (tagValue: string) => {
  paperTag.value = paperTag.value === tagValue ? '' : tagValue
}

const removePaperTag = (tagValue: string) => {
  const index = visiblePaperTags.value.findIndex(t => t.value === tagValue)
  if (index !== -1) {
    visiblePaperTags.value.splice(index, 1)
    if (paperTag.value === tagValue) {
      paperTag.value = ''
    }
  }
}

// 添加菜单相关
const showAddMenu = ref(false)
const addMenuMode = ref<'main' | 'time' | 'paper'>('main')
const addTagWrapperRef = ref<HTMLElement | null>(null)
const newYearValue = ref('')
const yearInputRef = ref<HTMLInputElement | null>(null)

const toggleAddMenu = () => {
  showAddMenu.value = !showAddMenu.value
  if (showAddMenu.value) {
    addMenuMode.value = 'main'
  }
}

const switchToTimeMode = () => {
  addMenuMode.value = 'time'
  newYearValue.value = ''
  nextTick(() => {
    yearInputRef.value?.focus()
  })
}

const switchToPaperMode = () => {
  addMenuMode.value = 'paper'
}

const confirmAddYear = () => {
  const year = parseInt(newYearValue.value)
  if (year && year > 0) {
    if (!yearTags.value.includes(year)) {
      yearTags.value.push(year)
      yearTags.value.sort((a, b) => a - b)
    }
    // 选中该年份
    const index = yearTags.value.indexOf(year)
    selectedYearIndex.value = index
    filterYear.value = year
    showAddMenu.value = false
  }
}

const addPaperTagToBar = (tag: PaperTagItem) => {
  if (!visiblePaperTags.value.find(t => t.value === tag.value)) {
    visiblePaperTags.value.push(tag)
  }
  // 选中该标签
  paperTag.value = tag.value
  showAddMenu.value = false
}

// 点击外部关闭菜单
const handleClickOutside = (event: MouseEvent) => {
  if (addTagWrapperRef.value && !addTagWrapperRef.value.contains(event.target as Node)) {
    showAddMenu.value = false
  }
  if (sourceDropdownRef.value && !sourceDropdownRef.value.contains(event.target as Node)) {
    showSourceMenu.value = false
  }
}

// 数据来源标签：sourceTag 过滤（默认 ALL）
type SourceTag = 'ALL' | 'ARXIV' | 'DBLP' | 'GOOGLE_SCHOLAR'
const sourceTag = ref<SourceTag>('ALL')

const sourceOptions: { label: string, value: SourceTag }[] = [
  { label: 'ALL', value: 'ALL' },
  { label: 'ARXIV', value: 'ARXIV' },
  { label: 'DBLP', value: 'DBLP' },
  { label: 'Google Scholar', value: 'GOOGLE_SCHOLAR' }
]

const getSourceLabel = (value: SourceTag) => {
  return sourceOptions.find(opt => opt.value === value)?.label || value
}

// source 下拉逻辑
const showSourceMenu = ref(false)
const sourceDropdownRef = ref<HTMLElement | null>(null)
const sourceSelectWidth = ref('auto')

const toggleSourceMenu = () => {
  showSourceMenu.value = !showSourceMenu.value
}

const selectSource = (value: SourceTag) => {
  sourceTag.value = value
  showSourceMenu.value = false
}

const updateSourceSelectWidth = () => {
  const text = getSourceLabel(sourceTag.value)
  if (!text) {
    sourceSelectWidth.value = 'auto'
    return
  }

  const span = document.createElement('span')
  span.style.visibility = 'hidden'
  span.style.position = 'absolute'
  span.style.whiteSpace = 'nowrap'
  span.style.fontSize = '12px' // 对应 CSS font-size
  span.style.fontFamily = 'inherit'
  span.textContent = text
  document.body.appendChild(span)
  const width = span.getBoundingClientRect().width
  document.body.removeChild(span)

  const extraPadding = 32 // 预留左右内边距和下拉箭头空间
  sourceSelectWidth.value = `${Math.ceil(width + extraPadding)}px`
}

watch(sourceTag, () => {
  updateSourceSelectWidth()
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  nextTick(() => {
    updateSourceSelectWidth()
  })
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (extractTimer) {
    clearTimeout(extractTimer)
  }
})

// AI关键词相关状态
const extractedKeywords = ref<string[]>([])
const isExtractingKeywords = ref(false)
// 缓存AI提取结果
const keywordCache = new Map<string, string[]>()

// 计算属性：是否有搜索历史
const hasSearchHistory = computed(() => {
  return recentSearches.value.length > 0
})

// 计算属性：只显示搜索历史标签
const allTags = computed(() => {
  return recentSearches.value.map(search => ({
    id: `history-${search.id}`,
    keyword: search.title,
    searchId: search.id,
    active: selectedTag.value === search.title
  }))
})

// AI关键词提取（增加缓存和超时处理）
const extractKeywords = async (query: string) => {
  if (!query.trim() || isExtractingKeywords.value) return
  
  const trimmedQuery = query.trim().toLowerCase()
  
  // 检查缓存
  if (keywordCache.has(trimmedQuery)) {
    extractedKeywords.value = keywordCache.get(trimmedQuery)!
    return
  }
  
  isExtractingKeywords.value = true
  
  try {
    // 设置超时处理（3秒超时）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI服务响应超时')), 3000)
    })
    
    const extractPromise = apiService.extractKeywords(trimmedQuery)
    const result = await Promise.race([extractPromise, timeoutPromise])
    
    if (result && result.data && Array.isArray(result.data)) {
      extractedKeywords.value = result.data
      // 缓存结果
      keywordCache.set(trimmedQuery, result.data)
      // 限制缓存大小（保持50个最近的查询）
      if (keywordCache.size > 50) {
        const firstKey = keywordCache.keys().next().value
        if (firstKey) {
          keywordCache.delete(firstKey)
        }
      }
    } else {
      console.warn('Invalid keyword extraction response:', result)
      extractedKeywords.value = []
    }
  } catch (error) {
    console.error('Failed to extract keywords:', error)
    // 超时或失败时提供默认关键词
    const fallbackKeywords = generateFallbackKeywords(trimmedQuery)
    extractedKeywords.value = fallbackKeywords
    keywordCache.set(trimmedQuery, fallbackKeywords)
  } finally {
    isExtractingKeywords.value = false
  }
}

// 生成备用关键词（当AI服务不可用时）
const generateFallbackKeywords = (query: string): string[] => {
  // 简单的关键词提取逻辑
  const words = query.split(/[\s、。，；：“”‘’（）【】《》一-龥]+/)
    .filter(word => word.length > 1)
    .slice(0, 3)
  
  return words.length > 0 ? words : [query.substring(0, 10)]
}

// 监听搜索框变化，自动提取关键词
let extractTimer: NodeJS.Timeout
watch(searchQuery, (newQuery) => {
  // 清除之前的定时器
  if (extractTimer) {
    clearTimeout(extractTimer)
  }
  
  // 如果搜索框为空，清空关键词
  if (!newQuery.trim()) {
    extractedKeywords.value = []
    return
  }
  
  // 增加防抖延迟到600ms，减少不必要的AI请求
  extractTimer = setTimeout(() => {
    extractKeywords(newQuery)
  }, 600)
})

// 搜索处理
const handleSearch = async () => {
  if (!searchQuery.value.trim()) return
  
  try {
    // 提交搜索任务
    const keywords = extractedKeywords.value.length > 0 ? extractedKeywords.value : []
    const yearParam = filterYear.value
    const paperTagParam = paperTag.value || null
    const response = await apiService.submitSearch(searchQuery.value.trim(), keywords, yearParam, paperTagParam, sourceTag.value)
    
    if (response.code === 0 && response.success) {
      // 跳转到任务页面
      router.push({
        name: 'tasks',
        query: { taskId: response.data.toString() }
      })
      
      // 刷新最近搜索列表
      await fetchRecentSearches()
    } else {
      console.error('搜索任务创建失败:', response.message)
    }
  } catch (error) {
    console.error('搜索失败:', error)
  }
}

// 清空搜索
const handleClear = () => {
  searchQuery.value = ''
  selectedTag.value = ''
  extractedKeywords.value = []
}

// 关键词操作方法
const updateKeyword = (index: number, newKeyword: string) => {
  if (newKeyword.trim()) {
    extractedKeywords.value[index] = newKeyword.trim()
  }
}

const removeKeyword = (index: number) => {
  extractedKeywords.value.splice(index, 1)
}

const addKeyword = (keyword: string) => {
  if (keyword.trim() && !extractedKeywords.value.includes(keyword.trim())) {
    extractedKeywords.value.push(keyword.trim())
  }
}

const clearKeywords = () => {
  extractedKeywords.value = []
}

const searchWithKeywords = async () => {
  if (extractedKeywords.value.length === 0) return
  
  try {
    // 使用关键词作为搜索词
    const searchTerm = searchQuery.value.trim() || extractedKeywords.value[0]
    const yearParam = filterYear.value
    const paperTagParam = paperTag.value || null
    const response = await apiService.submitSearch(searchTerm, extractedKeywords.value, yearParam, paperTagParam, sourceTag.value)
    
    if (response.code === 0 && response.success) {
      // 跳转到任务页面
      router.push({
        name: 'tasks',
        query: { taskId: response.data.toString() }
      })
      
      // 刷新最近搜索列表
      await fetchRecentSearches()
    } else {
      console.error('搜索任务创建失败:', response.message)
    }
  } catch (error) {
    console.error('搜索失败:', error)
  }
}

// 标签切换处理 - 直接跳转到SearchResult页面
const handleTagToggle = (keyword: string) => {
  selectedTag.value = keyword
  
  // 找到对应的搜索ID
  const searchItem = recentSearches.value.find(search => search.title === keyword)
  if (searchItem) {
    // 直接跳转到搜索结果页面，只传递taskId，不传递keyword
    router.push({
      name: 'search-results',
      query: {
        taskId: searchItem.id.toString()
      }
    })
  }
}

// 组件挂载时获取最近搜索
onMounted(() => {
  fetchRecentSearches()
})

// 组件卸载时清理定时器
onUnmounted(() => {
  if (extractTimer) {
    clearTimeout(extractTimer)
  }
})
</script>

<style scoped>
.home-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  align-items: center;
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

.home-container {
  width: 100%;
  max-width: 1000px;
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  line-height: 1.2;
  position: relative;
  z-index: 1;
  gap: 25px;
}

.main-title {
  font-size: 58px;
  font-weight: 700;
  line-height: 1.15;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 28px 0; 
  letter-spacing: 8px; 
}


.search-section {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 10px;
  width: 100%;
  max-width: 700px;
}

.home-search-btn {
  margin-top: 2px; /* 垂直居中对齐 (46px输入框 - 42px按钮) / 2 */
}

/* 过滤器样式 */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.filter-tag {
  font-size: 12px;
  padding: 3px 6px 3px 8px; /* 进一步减少内边距 */
  border-radius: 999px;
  border: 1px solid #e0e0e0;
  background-color: #ffffff;
  color: #555555;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 2px; /* 减少文字和x号的间距 */
}

.filter-tag:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.filter-tag-active {
  border-color: #1890ff;
  background-color: #1890ff;
  color: #ffffff;
}

.tag-close {
  font-size: 14px;
  width: 14px;
  height: 14px;
  line-height: 12px;
  opacity: 0.5;
  margin-left: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.tag-close:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.1);
  color: #ff4d4f;
}

.add-tag-wrapper {
  position: relative;
}

.add-btn {
  padding: 4px 8px;
  font-weight: bold;
}

.add-btn.active {
  border-color: #1890ff;
  color: #1890ff;
}

/* 菜单样式 */
.add-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 8px;
  z-index: 100;
  min-width: 160px;
  border: 1px solid #eee;
}

.menu-item {
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-item:hover {
  background-color: #f5f7fa;
  color: #1890ff;
}

.time-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px;
}



.input-row {
  display: flex;
  gap: 4px;
}

.menu-input {
  flex: 1;
  width: 0; /* 让flex生效 */
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
}

.menu-input:focus {
  border-color: #1890ff;
}

.menu-confirm-btn {
  padding: 4px 8px;
  background: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.paper-pool {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pool-item {
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  color: #333;
}

.pool-item:hover {
  background-color: #f5f7fa;
  color: #1890ff;
}

.source-dropdown {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
}

.source-trigger {
  font-size: 12px;
  padding: 0 20px 0 12px;
  border-left: 1px solid #eee;
  color: #666;
  cursor: pointer;
  white-space: nowrap;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 4px center;
  background-size: 12px;
  transition: all 0.2s ease;
  height: 20px;
  line-height: 20px;
  margin-left: 4px;
  user-select: none;
}

.source-trigger:hover {
  color: #1890ff;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231890ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
}

.source-options {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 12px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px;
  z-index: 100;
  min-width: 140px;
  border: 1px solid #eee;
}

.source-option {
  padding: 8px 12px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.source-option:hover {
  background-color: #f5f7fa;
  color: #1890ff;
}

.source-option.active {
  color: #1890ff;
  background-color: #e6f7ff;
  font-weight: 500;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.tag-section {
  width: 100%;
  max-width: 800px;
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease;
}

.tag-section:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.tag-section-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  gap: 16px;
}

.tag-section-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333333;
}

.keywords-section {
  width: 100%;
  max-width: 800px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 28px;
  border: none;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.2);
  position: relative;
  overflow: hidden;
  animation: slideInUp 0.6s ease-out;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.keywords-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  pointer-events: none;
}

.keywords-section::after {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, #667eea, #764ba2, #667eea);
  border-radius: 18px;
  z-index: -1;
  animation: borderGlow 3s ease-in-out infinite;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translate3d(0, 30px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes borderGlow {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

.keywords-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.keywords-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 8px;
}

.keywords-header h3::before {
  content: '🤖';
  font-size: 22px;
  animation: pulse 2s ease-in-out infinite;
}

.keywords-hint {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 12px;
  border-radius: 20px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-weight: 500;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.loading-spinner {
  display: inline-block;
  animation: thinking 1.5s ease-in-out infinite;
  margin-left: 8px;
}

@keyframes thinking {
  0%, 100% {
    transform: rotate(0deg) scale(1);
  }
  25% {
    transform: rotate(-5deg) scale(1.1);
  }
  50% {
    transform: rotate(5deg) scale(1.2);
  }
  75% {
    transform: rotate(-5deg) scale(1.1);
  }
}

.keywords-list {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  align-items: center;
  position: relative;
  z-index: 1;
  min-height: 40px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.keywords-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
  position: relative;
  z-index: 1;
}

.btn {
  padding: 12px 24px;
  border-radius: 25px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.btn:hover::before {
  left: 100%;
}

.btn-primary {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
  color: #ffffff;
  border-color: transparent;
  box-shadow: 0 4px 15px rgba(238, 90, 36, 0.3);
}

.btn-primary:hover {
  background: linear-gradient(135deg, #ee5a24 0%, #ff6b6b 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(238, 90, 36, 0.4);
}

.btn-outline {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(255, 255, 255, 0.1);
}

.tag-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  min-height: 40px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
  padding: 14px 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  flex-wrap: wrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.page-size-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  transition: all 0.3s ease;
}

.page-size-selector:hover {
  border-color: #667eea;
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.1);
}

.page-size-selector label {
  font-weight: 500;
  color: #555555;
  font-size: 13px;
}

.page-size-select {
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 600;
  color: #667eea;
  background-color: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.page-size-select:hover {
  background-color: #f5f7ff;
}

.page-size-select:focus {
  background-color: #f5f7ff;
}

.page-info {
  font-weight: 600;
  font-size: 14px;
  color: #667eea;
  min-width: 90px;
  text-align: center;
  padding: 6px 14px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.btn-pagination {
  padding: 7px 18px;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 80px;
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.25);
}

.btn-pagination:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-pagination:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.25);
}

.btn-pagination:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%);
  box-shadow: none;
}

@media (max-width: 768px) {
  .main-title {
    font-size: 28px;
    margin: 0 0 12px 0;
  }
  
  .search-section {
    flex-direction: column;
    gap: 12px;
    align-items: center;
  }
  
  .tag-section {
    padding: 20px;
    margin: 0 10px;
  }

  .tag-section-header {
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .pagination-controls {
    gap: 10px;
    padding: 12px 16px;
  }

  .page-size-selector {
    width: auto;
    padding: 5px 10px;
  }

  .page-size-selector label {
    font-size: 12px;
  }

  .page-size-select {
    font-size: 12px;
    padding: 3px 8px;
  }

  .page-info {
    font-size: 12px;
    min-width: 75px;
    padding: 5px 12px;
  }

  .btn-pagination {
    padding: 6px 14px;
    font-size: 12px;
    min-width: 70px;
  }
  
  .keywords-section {
    padding: 20px;
    margin: 0 16px;
    border-radius: 12px;
  }
  
  .keywords-header {
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }
  
  .keywords-header h3 {
    font-size: 18px;
  }
  
  .keywords-list {
    padding: 8px;
    gap: 8px;
  }
  
  .keywords-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .btn {
    padding: 14px 20px;
    font-size: 14px;
  }
  
  .tag-list {
    gap: 8px;
    justify-content: center;
  }
  
}
</style>
