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

// 获取最近搜索
const fetchRecentSearches = async () => {
  try {
    const searchHistory = await apiService.getSearchHistory(5) 
    recentSearches.value = searchHistory.map(item => ({
      id: item.id,
      title: item.keyword
    }))
  } catch (error) {
    console.error('获取最近搜索失败:', error)
  }
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
    if (result && result.data && Array.isArray(result.data.keywords)) {
      extractedKeywords.value = result.data.keywords
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
  
  // 延迟400ms后提取关键词，避免频繁请求
  extractTimer = setTimeout(() => {
    extractKeywords(newQuery)
  }, 200)
})

// 搜索处理
const handleSearch = async () => {
  if (!searchQuery.value.trim()) return
  
  try {
    // 提交搜索任务
    const keywords = extractedKeywords.value.length > 0 ? extractedKeywords.value : []
    const response = await apiService.submitSearch(searchQuery.value.trim(), keywords)
    
    if (response.code === 0) {
      // 跳转到任务页面
      router.push({
        name: 'tasks',
        query: { taskId: response.data.taskId.toString() }
      })
      
      // 刷新最近搜索列表
      await fetchRecentSearches()
    } else {
      console.error('搜索任务创建失败:', response.msg)
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
    
    if (response.code === 0) {
      // 跳转到任务页面
      router.push({
        name: 'tasks',
        query: { taskId: response.data.taskId.toString() }
      })
      
      // 刷新最近搜索列表
      await fetchRecentSearches()
    } else {
      console.error('搜索任务创建失败:', response.msg)
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
    // 直接跳转到搜索结果页面
    router.push({
      name: 'search-results',
      query: {
        keyword: keyword,
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
  
  .tag-section-header {
    flex-direction: column;
    align-items: center;
    gap: 8px;
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
