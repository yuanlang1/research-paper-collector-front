import { ref, computed, onMounted } from 'vue'
import { apiService, type SearchHistory } from '@/services/api'

export function useSearchHistory() {
  // 响应式状态
  const searchHistory = ref<SearchHistory[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性：获取最近的搜索词作为标签
  const recentSearchTags = computed(() => {
    return searchHistory.value
      .slice(0, 6) // 只显示最近6个
      .map(item => ({
        id: item.id,
        keyword: item.keyword,
        active: false
      }))
  })

  // 获取搜索历史
  const fetchSearchHistory = async () => {
    // 静默获取，不显示加载状态
    error.value = null
    
    try {
      const history = await apiService.getSearchHistory(10)
      searchHistory.value = history
    } catch (err) {
      console.warn('Failed to fetch search history from backend:', err)
      
      // 尝试从本地存储获取
      const localHistory = apiService.getLocalSearchHistory()
      if (localHistory.length > 0) {
        searchHistory.value = localHistory
      }
    }
  }

  // 添加搜索记录
  const addSearchRecord = async (keyword: string) => {
    if (!keyword.trim()) return

    try {
      // 保存到后端
      await apiService.saveSearchHistory(keyword.trim())
      
      // 更新本地状态
      const existingIndex = searchHistory.value.findIndex(
        item => item.keyword === keyword.trim()
      )
      
      if (existingIndex >= 0) {
        // 如果已存在，更新时间并移到最前面
        const existing = searchHistory.value[existingIndex]
        
        searchHistory.value.splice(existingIndex, 1)
        searchHistory.value.unshift(existing)
      } else {
        // 如果不存在，添加新记录
        const newRecord: SearchHistory = {
          id: Date.now(),
          keyword: keyword.trim(),
        }
        
        searchHistory.value.unshift(newRecord)
        
        // 只保留最近10条
        if (searchHistory.value.length > 10) {
          searchHistory.value = searchHistory.value.slice(0, 10)
        }
      }
    } catch (err) {
      console.error('Failed to add search record:', err)
    }
  }

  // 清除搜索历史
  const clearHistory = async () => {
    try {
      await apiService.clearSearchHistory()
      searchHistory.value = []
    } catch (err) {
      console.error('Failed to clear search history:', err)
    }
  }


  // 获取最近搜索词
  const getRecentKeywords = computed(() => {
    return searchHistory.value
      .slice(0, 5)
      .map(item => item.keyword)
  })

  // 组件挂载时获取搜索历史
  onMounted(() => {
    fetchSearchHistory()
  })

  return {
    // 状态
    searchHistory,
    isLoading,
    error,
    
    // 计算属性
    recentSearchTags,
    getRecentKeywords,
    
    // 方法
    fetchSearchHistory,
    addSearchRecord,
    clearHistory
  }
}
