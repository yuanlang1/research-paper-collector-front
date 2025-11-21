<template>
  <div class="home-container">
    <!-- 标题 -->
    <h1 class="main-title">科研论文收集器</h1>
    
    <!-- 搜索区域 -->
    <div class="search-section">
      <SearchInput 
        v-model="searchQuery" 
        @search="handleSearch"
        @clear="handleClear"
      />
      <SearchButton @click="handleSearch" />
    </div>
    
    <!-- AI关键词区域 -->
    <div class="keywords-section" v-if="extractedKeywords.length > 0">
      <div class="keywords-header">
        <h3>AI提取的关键词</h3>
        <span class="keywords-hint">双击编辑，点击×删除</span>
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
    <div class="tag-section" v-if="hasSearchHistory">
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
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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

// 计算当前页记录数
const currentRecordCount = computed(() => recentSearches.value.length)

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

// AI关键词相关状态
const extractedKeywords = ref<string[]>([])
const isExtractingKeywords = ref(false)

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

// AI关键词提取
const extractKeywords = async (query: string) => {
  if (!query.trim() || isExtractingKeywords.value) return
  
  isExtractingKeywords.value = true
  
  try {
    const result = await apiService.extractKeywords(query.trim())
    if (result && result.data && Array.isArray(result.data)) {
      extractedKeywords.value = result.data
    } else {
      console.warn('Invalid keyword extraction response:', result)
      extractedKeywords.value = []
    }
  } catch (error) {
    console.error('Failed to extract keywords:', error)
    extractedKeywords.value = []
  } finally {
    isExtractingKeywords.value = false
  }
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
  
  extractTimer = setTimeout(() => {
    extractKeywords(newQuery)
  }, 300)
})

// 搜索处理
const handleSearch = async () => {
  if (!searchQuery.value.trim()) return
  
  try {
    // 提交搜索任务
    const keywords = extractedKeywords.value.length > 0 ? extractedKeywords.value : []
    const response = await apiService.submitSearch(searchQuery.value.trim(), keywords)
    
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
    const response = await apiService.submitSearch(searchTerm, extractedKeywords.value)
    
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
.home-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
}

.main-title {
  font-size: 54px;
  font-weight: 600;
  color: #000000;
  margin: 60px 0 0 0;
  text-align: center;
  line-height: 1.2;
}

.search-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  width: 100%;
  max-width: 600px;
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
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
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
    font-size: 36px;
    margin: 40px 0 0 0;
  }
  
  .search-section {
    flex-direction: column;
    gap: 12px;
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
