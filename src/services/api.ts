// API 服务配置
import type { Router } from 'vue-router'
import { fetchWithTimeout, fetchWithRetry } from '@/utils/fetchWithTimeout'
import { errorHandler } from '@/utils/errorHandler'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'


// 搜索历史接口
export interface SearchHistory {
  id: number
  keyword: string
  searchTime?: string
}

// 最近搜索单条记录
export interface RecentSearchItem {
  id: number
  searchWord: string
  searchTime: string
}

// 最近搜索接口响应格式
export interface RecentSearchResponse {
  code: number
  success: boolean
  data: {
    total: number
    pageNumber: number
    pageSize: number
    pages: number
    list: RecentSearchItem[]
  }
  message: string
  other: null
}

// 论文数据接口
export interface Paper {
  id: string
  title: string
  abstract: string
  authors: string[]
  year: number
  journal: string
  venueType: 'journal' | 'conference' // 根据venue_state转换：0为期刊，1为会议
  ccfLevel?: string
  sciLevel?: string
  coreLevel?: string // CORE等级
  jcrLevel?: string // 提取的分区，用于样式（如"1区"）
  sciUpFull?: string // 完整的中科院分区信息（如"计算机科学1区"）
  impactFactor?: number // 影响因子，对应sciif
  keywords: string[]
  summary: string
  citations: number
  link?: string
  url?: string
  pdfUrl?: string
  // 前端状态字段
  abstractExpanded?: boolean
  summaryExpanded?: boolean
  authorsExpanded?: boolean
}

// 会议/期刊信息接口
export interface VenueInfo {
  standardName: string // 期刊/会议标准名称（驼峰命名匹配API）
  acronym: string
  type: number // 0为期刊，1为会议
  sciRank: string | null
  ccfRank: string | null
  sciIf: number | null
  sciUp: string | null // 中科院大区
  sciUpSmall: string | null // 中科院小区
  coreRank: string | null
}

// 后端返回的原始论文数据格式
export interface PaperRaw {
  id: number
  title: string
  publishedDate: string
  authors: string[] // 作者数组
  paperAbstract: string
  aiAbstract: string
  doi: string
  venueId: number
  venueInfo: VenueInfo
  citations: number
  keywords: string[] // 关键词数组
  abstractUrl: string
  pdfUrl: string
}

// 排序信息接口
export interface OrderInfo {
  orderWord: string // 排序字段
  orderId: number   // 排序方式: 0=asc, 1=desc
}

// 论文搜索请求参数
export interface PaperSearchParams {
  taskId: number
  pageIndex: number
  pageSize: number
  orderInfo: OrderInfo[] // 多字段排序数组
}

// 后端搜索结果响应格式
export interface SearchResultResponse {
  code: number
  success: boolean
  message: string
  other: string | null
  data: {
    total: number // 总记录数
    pageNumber: number // 当前页号
    pageSize: number // 每页大小
    pages: number // 总页数
    list: PaperRaw[]
  }
}

// 搜索结果接口
export interface SearchResult {
  papers: Paper[]
  totalPages: number // 总页数
  currentPage: number // 当前页号
  pageSize: number // 每页行数
  totalResults: number // 总结果数（计算得出）
}

// AI关键词提取结果接口
export interface KeywordExtractionResult {
  code: number
  success: boolean
  data: string[]  // 直接返回关键词字符串数组
  message: string
  other: null
}

// 搜索请求接口
export interface SearchRequest {
  searchWord: string
  keywords: string[]
  tags: {
    yearTag: number
    paperTag: string | null // 期刊/会议等标签过滤，未选择时为null
    sourceTag: string       // 数据来源过滤: ALL, ARXIV, DBLP, GOOGLE_SCHOLAR 等
  }
}

// 后端返回的搜索任务原始数据
export interface SearchTaskRaw {
  id: number
  searchWord: string
  tags: {
    yearTag: number
    paperTag: string | null
    sourceTag: string
  }
  keywords: string[] // 关键词数组
  taskState: string
  errorMessage: string | null // 错误信息，任务失败时显示
  searchTime: string
}

// 前端使用的搜索任务接口
export interface SearchTask {
  id: number
  taskName: string
  searchTerm: string
  tags: {
    yearTag: number
    paperTag: string | null
    sourceTag: string
  }
  keywords: string[]
  date: string
  progress: string
  status: 'searching' | 'success' | 'failed' | 'cancelled'
  errorMessage?: string | null // 错误信息
}

// 任务列表分页请求参数
export interface TasksRequestParams {
  pageIndex: number
  pageSize: number
  orderWord?: string  // 排序列名
  orderId?: number    // 排序方式: 0=asc, 1=desc
}

// 任务列表响应接口
export interface TasksResponse {
  code: number
  success: boolean
  message: string
  other: string | null
  data: {
    total: number
    pageNumber: number
    pageSize: number
    pages: number
    list: SearchTaskRaw[]
  }
}

// 任务状态查询响应接口
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

// 任务删除响应接口
export interface TaskDeleteResponse {
  code: number
  success: boolean
  data: boolean
  message: string
  other: string | null
}

// 任务取消响应接口
export interface TaskCancelResponse {
  code: number
  success: boolean
  data: boolean
  message: string
  other: string | null
}

// 任务重启响应接口
export interface TaskRestartResponse {
  code: number
  success: boolean
  data: boolean
  message: string
  other: string | null
}

// 任务关键词查询响应接口
export interface TaskKeywordsResponse {
  code: number
  success: boolean
  data: string[] // 关键词字符串数组
  message: string
  other: string | null
}

// OSS 凭证数据接口
export interface OSSCredentials {
  accessKeyId: string
  accessKeySecret: string
  securityToken: string
  expiration: string
}

// OSS 凭证响应接口
export interface OSSCredentialsResponse {
  code: number
  success: boolean
  message: string
  other: string | null
  data: OSSCredentials
}

// 搜索响应接口
export interface SearchResponse {
  code: number
  success: boolean
  data: number  // 直接返回任务ID
  message: string
  other: null
}

// API 请求封装
class ApiService {
  private router: Router | null = null

  /**
   * 注入路由实例以支持全局错误重定向
   * @param router Vue Router 实例
   */
  setRouter(router: Router): void {
    this.router = router
  }

  private async request<T>(endpoint: string, options?: RequestInit, useRetry: boolean = false): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`

    try {
      // 根据参数选择是否使用重试机制
      const response = useRetry 
        ? await fetchWithRetry(url, {
            headers: {
              'Content-Type': 'application/json',
              ...options?.headers,
            },
            timeout: 30000, // 30秒超时
            ...options,
          }, 2, 1000) // 重试2次，间隔1秒
        : await fetchWithTimeout(url, {
            headers: {
              'Content-Type': 'application/json',
              ...options?.headers,
            },
            timeout: 30000, // 30秒超时
            ...options,
          })

      if (!response.ok) {
        const errorStatus = response.status
        
        // 记录API错误
        errorHandler.handleApiError(
          new Error(`HTTP ${errorStatus}: ${endpoint}`),
          endpoint,
          errorStatus
        )

        throw new Error(`HTTP error! status: ${errorStatus}`)
      }

      return await response.json()
    } catch (error: any) {
      console.error('API request failed:', error)

      // 处理网络连接失败或超时错误
      if (error.message.includes('Failed to fetch') || error.message.includes('请求超时')) {
        errorHandler.handleNetworkError(endpoint)
      }

      throw error
    }
  }

  // 获取搜索历史
  async getSearchHistory(pageIndex: number = 1, pageSize: number = 10): Promise<SearchHistory[]> {
    const params = new URLSearchParams({
      pageIndex: pageIndex.toString(),
      pageSize: pageSize.toString()
    })
    const response = await this.request<RecentSearchResponse>(`/task/recent?${params}`, {}, true) // 使用重试
    return response.data.list.map(item => ({
      id: item.id,
      keyword: item.searchWord,
      searchTime: item.searchTime
    }))
  }

  // 获取搜索历史（带分页信息）
  async getSearchHistoryWithPagination(pageIndex: number = 1, pageSize: number = 10): Promise<RecentSearchResponse> {
    const params = new URLSearchParams({
      pageIndex: pageIndex.toString(),
      pageSize: pageSize.toString()
    })
    return await this.request<RecentSearchResponse>(`/task/recent?${params}`, {}, true) // 使用重试
  }

  // 保存搜索记录（已移除后端保存，仅本地存储）
  async saveSearchHistory(keyword: string): Promise<void> {
    this.saveToLocalStorage(keyword)
  }

  // 搜索论文
  async searchPapers(
    taskId: number,
    page: number = 1,
    size: number = 10,
    orderInfo: OrderInfo[] = [
      { orderWord: 'published_date', orderId: 1 },
      { orderWord: 'citations', orderId: 1 },
      { orderWord: 'tags', orderId: 1 }
    ]
  ): Promise<SearchResult> {
    const requestBody: PaperSearchParams = {
      taskId,
      pageIndex: page,
      pageSize: size,
      orderInfo
    }
    const response = await this.request<SearchResultResponse>('/paper/get', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    }, true) // 使用重试
    if (response.code === 0 && response.success) {
      return {
        papers: response.data.list.map((paper) => this.convertPaperData(paper)),
        totalPages: response.data.pages,
        currentPage: response.data.pageNumber,
        pageSize: response.data.pageSize,
        totalResults: response.data.total
      }
    } else {
      throw new Error(`API error: ${response.message}`)
    }
  }

  // AI关键词提取
  async extractKeywords(searchWord: string, wordNumber: number = 3): Promise<KeywordExtractionResult> {
    const params = new URLSearchParams({
      searchWord: searchWord,
      wordNumber: wordNumber.toString()
    })
    // 使用统一的request方法，不使用重试（AI服务响应较快）
    return await this.request<KeywordExtractionResult>(`/ai/keywords?${params}`)
  }

  // 提交搜索任务
  async submitSearch(
    searchTerm: string,
    keywords: string[],
    year: number = 0,
    paperTag: string | null = null,
    sourceTag: string = 'ALL'
  ): Promise<SearchResponse> {
    const tags: SearchRequest['tags'] = { yearTag: year, paperTag, sourceTag }
    const searchRequest: SearchRequest = {
      searchWord: searchTerm,
      keywords: keywords,
      tags
    }
    return await this.request<SearchResponse>('/task/submit', {
      method: 'POST',
      body: JSON.stringify(searchRequest)
    })
  }

  // 日期格式转换函数
  private formatDateTime(dateTimeStr: string): string {
    try {
      const date = new Date(dateTimeStr)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    } catch (error) {
      return dateTimeStr
    }
  }

  // 状态转换函数
  private convertTaskStatus(taskState: string): { status: 'searching' | 'success' | 'failed' | 'cancelled', progress: string } {
    switch (taskState) {
      case 'PENDING':
        return { status: 'searching', progress: '等待中' }
      case 'RUNNING':
        return { status: 'searching', progress: '正在检索' }
      case 'COMPLETED':
        return { status: 'success', progress: '检索成功' }
      case 'FAILED':
        return { status: 'failed', progress: '检索失败' }
      case 'CANCELLED':
        return { status: 'cancelled', progress: '已取消' }
      default:
        return { status: 'searching', progress: '等待中' }
    }
  }

  // 转换原始任务数据为前端格式
  private convertRawTask(rawTask: SearchTaskRaw): SearchTask {
    const { status, progress } = this.convertTaskStatus(rawTask.taskState)

    return {
      id: rawTask.id,
      taskName: `任务${rawTask.id.toString().padStart(3, '0')}`,
      searchTerm: rawTask.searchWord,
      tags: rawTask.tags,
      keywords: rawTask.keywords || [],
      date: this.formatDateTime(rawTask.searchTime),
      progress,
      status,
      errorMessage: rawTask.errorMessage
    }
  }

  // 获取搜索任务列表
  async getSearchTasks(params: TasksRequestParams): Promise<{ tasks: SearchTask[], total: number, page: number, pageSize: number }> {
    const requestBody: TasksRequestParams = {
      pageIndex: params.pageIndex,
      pageSize: params.pageSize
    }
    if (params.orderWord) requestBody.orderWord = params.orderWord
    if (params.orderId !== undefined) requestBody.orderId = params.orderId

    const response = await this.request<TasksResponse>('/task/tasks', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    }, true) // 使用重试
    if (response.code === 0 && response.success) {
      return {
        tasks: response.data.list.map(rawTask => this.convertRawTask(rawTask)),
        total: response.data.total,
        page: response.data.pageNumber,
        pageSize: response.data.pageSize
      }
    } else {
      throw new Error(`API error: ${response.message}`)
    }
  }

  // 查询任务状态
  async getTaskStatus(taskId: number): Promise<TaskStatusResponse> {
    return await this.request<TaskStatusResponse>(`/task/state?id=${taskId}`)
  }

  // 删除任务
  async deleteTask(id: number): Promise<TaskDeleteResponse> {
    return await this.request<TaskDeleteResponse>(`/task/delete?id=${id}`, {
      method: 'DELETE'
    })
  }

  // 取消任务
  async cancelTask(id: number): Promise<TaskCancelResponse> {
    return await this.request<TaskCancelResponse>(`/task/cancel?id=${id}`, {
      method: 'POST'
    })
  }

  // 重启任务
  async restartTask(id: number): Promise<TaskRestartResponse> {
    return await this.request<TaskRestartResponse>(`/task/restart?id=${id}`, {
      method: 'POST'
    })
  }

  // 获取任务关键词
  async getTaskKeywords(id: number): Promise<TaskKeywordsResponse> {
    return await this.request<TaskKeywordsResponse>(`/task/keywords?id=${id}`)
  }

  // 获取 OSS 临时凭证
  async getOSSCredentials(): Promise<OSSCredentialsResponse> {
    return await this.request<OSSCredentialsResponse>('/oss/get')
  }

  // 提取中科院分区信息（从"计算机科学1区"中提取"1区"）
  private extractSciZone(sciUp: string | undefined): string | undefined {
    if (!sciUp) return undefined
    const match = sciUp.match(/([1-4]区(?:Top)?)/i)
    return match ? match[1] : undefined
  }


  // 转换后端原始数据为前端格式
  private convertPaperData(rawPaper: PaperRaw): Paper {
    const uniqueId = rawPaper.id.toString()
    return {
      id: uniqueId,
      title: rawPaper.title,
      abstract: rawPaper.paperAbstract,
      authors: rawPaper.authors || [],
      year: rawPaper.publishedDate ? parseInt(rawPaper.publishedDate) : 0,
      journal: rawPaper.venueInfo?.standardName || '',
      venueType: rawPaper.venueInfo?.type === 0 ? 'journal' : 'conference',
      ccfLevel: rawPaper.venueInfo?.ccfRank || undefined,
      sciLevel: rawPaper.venueInfo?.sciRank || undefined,
      coreLevel: rawPaper.venueInfo?.coreRank || undefined,
      jcrLevel: this.extractSciZone(rawPaper.venueInfo?.sciUp || undefined),
      sciUpFull: rawPaper.venueInfo?.sciUp || undefined,
      impactFactor: (rawPaper.venueInfo?.sciIf && rawPaper.venueInfo.sciIf > 0) ? rawPaper.venueInfo.sciIf : undefined,
      keywords: rawPaper.keywords || [],
      summary: rawPaper.aiAbstract,
      citations: rawPaper.citations,
      url: rawPaper.abstractUrl || rawPaper.pdfUrl,
      link: rawPaper.abstractUrl || rawPaper.pdfUrl,
      pdfUrl: rawPaper.pdfUrl,
      abstractExpanded: false,
      summaryExpanded: false
    }
  }

  // 保存到本地存储
  private saveToLocalStorage(keyword: string): void {
    try {
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]')
      const existingIndex = history.findIndex((item: SearchHistory) => item.keyword === keyword)

      if (existingIndex >= 0) {
        history[existingIndex].searchTime = new Date().toISOString()
        const item = history.splice(existingIndex, 1)[0]
        history.unshift(item)
      } else {
        history.unshift({
          id: Date.now(),
          keyword,
          searchTime: new Date().toISOString()
        })
      }

      // 只保留最近的10条记录
      localStorage.setItem('searchHistory', JSON.stringify(history.slice(0, 10)))
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }
  }

  // 从本地存储获取搜索历史
  getLocalSearchHistory(): SearchHistory[] {
    try {
      return JSON.parse(localStorage.getItem('searchHistory') || '[]')
    } catch (error) {
      console.error('Failed to get from localStorage:', error)
      return []
    }
  }

  // 清除搜索历史（仅清除本地存储）
  async clearSearchHistory(): Promise<void> {
    localStorage.removeItem('searchHistory')
  }
}

// 导出单例实例
export const apiService = new ApiService()
