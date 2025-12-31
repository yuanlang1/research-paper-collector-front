// API 服务配置
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
  authors: string // 作者用逗号分隔的字符串
  paperAbstract: string
  aiAbstract: string
  doi: string
  venueInfo: VenueInfo
  citations: number
  keywords: string // 关键词用逗号分隔的字符串
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
  keywords: string // 关键词字符串，逗号分隔
  taskState: string
  errorMessage: string | null // 错误信息，任务失败时显示
  searchTime: string
}

// 前端使用的搜索任务接口
export interface SearchTask {
  id: number
  taskName: string
  searchTerm: string
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
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  // 获取搜索历史
  async getSearchHistory(pageIndex: number = 1, pageSize: number = 10): Promise<SearchHistory[]> {
    try {
      const params = new URLSearchParams({
        pageIndex: pageIndex.toString(),
        pageSize: pageSize.toString()
      })
      const response = await this.request<RecentSearchResponse>(`/task/recent?${params}`)

      return response.data.list.map(item => ({
        id: item.id,
        keyword: item.searchWord,
        searchTime: item.searchTime
      }))

    } catch (error) {
      // 如果HTTP请求失败或后端不可用，返回模拟数据
      console.warn('Backend not available, using mock data')
      return this.getMockSearchHistory()
    }
  }

  // 获取搜索历史（带分页信息）
  async getSearchHistoryWithPagination(pageIndex: number = 1, pageSize: number = 10): Promise<RecentSearchResponse> {
    try {
      const params = new URLSearchParams({
        pageIndex: pageIndex.toString(),
        pageSize: pageSize.toString()
      })
      return await this.request<RecentSearchResponse>(`/task/recent?${params}`)
    } catch (error) {
      console.warn('Backend not available, using mock data')
      return this.getMockRecentSearchResponse(pageIndex, pageSize)
    }
  }

  // 生成模拟的最近搜索响应数据
  private getMockRecentSearchResponse(pageIndex: number = 1, pageSize: number = 10): RecentSearchResponse {
    const allMockData: RecentSearchItem[] = [
      { id: 108, searchWord: 'Action quality assessment', searchTime: '2025-11-17 21:49:47' },
      { id: 107, searchWord: 'Action quality assessment', searchTime: '2025-11-15 17:32:45' },
      { id: 106, searchWord: 'Action quality assessment', searchTime: '2025-11-15 13:13:19' },
      { id: 105, searchWord: 'Action quality assessment', searchTime: '2025-11-15 12:21:30' },
      { id: 104, searchWord: 'Action quality assessment', searchTime: '2025-11-15 12:18:38' },
      { id: 103, searchWord: 'Action quality assessment', searchTime: '2025-11-15 12:07:21' },
      { id: 102, searchWord: 'Action quality assessment', searchTime: '2025-11-15 12:04:03' },
      { id: 101, searchWord: 'Action quality assessment', searchTime: '2025-11-12 17:39:35' },
      { id: 100, searchWord: 'Action quality assessment', searchTime: '2025-11-12 17:35:16' },
      { id: 99, searchWord: 'Action quality assessment', searchTime: '2025-11-12 17:31:13' },
      { id: 97, searchWord: '动作质量评估', searchTime: '2025-11-10 15:20:30' },
      { id: 68, searchWord: '电网故障检测', searchTime: '2025-11-08 10:15:22' },
      { id: 45, searchWord: '深度学习算法', searchTime: '2025-11-05 14:30:18' },
      { id: 23, searchWord: '自然语言处理', searchTime: '2025-11-03 09:45:12' },
      { id: 12, searchWord: '计算机视觉', searchTime: '2025-11-01 16:20:05' },
      { id: 8, searchWord: '机器学习', searchTime: '2025-10-28 11:10:00' },
      { id: 3, searchWord: '人工智能', searchTime: '2025-10-25 13:05:45' }
    ]

    const total = allMockData.length
    const pages = Math.ceil(total / pageSize)
    const startIndex = (pageIndex - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, total)
    const list = allMockData.slice(startIndex, endIndex)

    return {
      code: 0,
      success: true,
      data: {
        total,
        pageNumber: pageIndex,
        pageSize,
        pages,
        list
      },
      message: '',
      other: null
    }
  }

  // 保存搜索记录（已移除后端保存，仅本地存储）
  async saveSearchHistory(keyword: string): Promise<void> {
    // 只保存到本地存储
    this.saveToLocalStorage(keyword)
  }

  // 测试最近搜索接口（返回完整响应数据）
  async testRecentSearchAPI(pageIndex: number = 1, pageSize: number = 10): Promise<RecentSearchResponse> {
    try {
      const params = new URLSearchParams({
        pageIndex: pageIndex.toString(),
        pageSize: pageSize.toString()
      })
      const response = await this.request<RecentSearchResponse>(`/task/recent?${params}`)
      console.log('✅ 最近搜索接口调用成功:', response)
      return response
    } catch (error) {
      console.warn('⚠️ 后端不可用，返回模拟数据:', error)
      const mockResponse = this.getMockRecentSearchResponse(pageIndex, pageSize)
      console.log('📝 模拟响应数据:', mockResponse)
      return mockResponse
    }
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
    try {
      const requestBody: PaperSearchParams = {
        taskId,
        pageIndex: page,
        pageSize: size,
        orderInfo
      }

      const response = await this.request<SearchResultResponse>('/paper/get', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      if (response.code === 0 && response.success) {
        // 转换后端响应格式为前端格式
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
    } catch (error) {
      console.warn('Backend not available, using mock data')
      return this.getMockSearchResult(taskId, page, size)
    }
  }

  // AI关键词提取
  async extractKeywords(searchWord: string, wordNumber: number = 3): Promise<KeywordExtractionResult> {
    try {
      const params = new URLSearchParams({
        searchWord: searchWord,
        wordNumber: wordNumber.toString()
      })
      const url = `${API_BASE_URL}/ai/keywords?${params}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.warn('AI service not available, using mock keywords')
      return this.getMockKeywords(searchWord)
    }
  }

  // 提交搜索任务
  async submitSearch(
    searchTerm: string,
    keywords: string[],
    year: number = 0,
    paperTag: string | null = null,
    sourceTag: string = 'ALL'
  ): Promise<SearchResponse> {
    try {
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
    } catch (error) {
      console.warn('Backend not available, using mock response')
      return this.getMockSearchResponse(searchTerm, keywords)
    }
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

    // 将逗号分隔的关键词字符串转换为数组
    const keywordsArray = rawTask.keywords
      ? rawTask.keywords.split(',').map(k => k.trim()).filter(k => k)
      : []

    return {
      id: rawTask.id,
      taskName: `任务${rawTask.id.toString().padStart(3, '0')}`,
      searchTerm: rawTask.searchWord,
      keywords: keywordsArray,
      date: this.formatDateTime(rawTask.searchTime),
      progress,
      status,
      errorMessage: rawTask.errorMessage
    }
  }

  // 获取搜索任务列表
  async getSearchTasks(params: TasksRequestParams): Promise<{ tasks: SearchTask[], total: number, page: number, pageSize: number }> {
    try {
      const requestBody: TasksRequestParams = {
        pageIndex: params.pageIndex,
        pageSize: params.pageSize
      }

      if (params.orderWord) {
        requestBody.orderWord = params.orderWord
      }

      if (params.orderId !== undefined) {
        requestBody.orderId = params.orderId
      }

      const response = await this.request<TasksResponse>('/task/tasks', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

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
    } catch (error) {
      console.warn('Backend not available, using mock tasks')
      return this.getMockSearchTasks(params)
    }
  }

  // 查询任务状态
  async getTaskStatus(taskId: number): Promise<TaskStatusResponse> {
    try {
      return await this.request<TaskStatusResponse>(`/task/state?id=${taskId}`)
    } catch (error) {
      console.warn('Backend not available, using mock status')
      return this.getMockTaskStatus(taskId)
    }
  }

  // 删除任务
  async deleteTask(id: number): Promise<TaskDeleteResponse> {
    try {
      return await this.request<TaskDeleteResponse>(`/task/delete?id=${id}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.warn('Backend not available, using mock delete')
      return this.getMockTaskDelete(id)
    }
  }

  // 取消任务
  async cancelTask(id: number): Promise<TaskCancelResponse> {
    try {
      return await this.request<TaskCancelResponse>(`/task/cancel?id=${id}`)
    } catch (error) {
      console.warn('Backend not available, using mock cancel')
      return {
        code: 0,
        success: true,
        data: true,
        message: 'Mock cancel success',
        other: null
      }
    }
  }

  // 重启任务
  async restartTask(id: number): Promise<TaskRestartResponse> {
    try {
      return await this.request<TaskRestartResponse>(`/task/restart?id=${id}`)
    } catch (error) {
      console.warn('Backend not available, using mock restart')
      return {
        code: 0,
        success: true,
        data: true,
        message: 'Mock restart success',
        other: null
      }
    }
  }

  // 获取任务关键词
  async getTaskKeywords(id: number): Promise<TaskKeywordsResponse> {
    try {
      return await this.request<TaskKeywordsResponse>(`/task/keywords?id=${id}`)
    } catch (error) {
      console.warn('Backend not available, using mock keywords')
      return this.getMockTaskKeywords(id)
    }
  }

  // 获取 OSS 临时凭证
  async getOSSCredentials(): Promise<OSSCredentialsResponse> {
    try {
      return await this.request<OSSCredentialsResponse>('/oss/get')
    } catch (error) {
      console.warn('Backend not available, using mock OSS credentials')
      return this.getMockOSSCredentials()
    }
  }

  // 提取中科院分区信息（从"计算机科学1区"中提取"1区"）
  private extractSciZone(sciUp: string | undefined): string | undefined {
    if (!sciUp) return undefined
    const match = sciUp.match(/([1-4]区(?:Top)?)/i)
    return match ? match[1] : undefined
  }


  // 模拟搜索历史数据
  private getMockSearchHistory(): SearchHistory[] {
    const mockHistory = [
      { id: 108, keyword: 'Action quality assessment', searchTime: '2025-11-17 21:49:47' },
      { id: 107, keyword: 'Action quality assessment', searchTime: '2025-11-15 17:32:45' },
      { id: 106, keyword: 'Action quality assessment', searchTime: '2025-11-15 13:13:19' },
      { id: 105, keyword: 'Action quality assessment', searchTime: '2025-11-15 12:21:30' },
      { id: 104, keyword: 'Action quality assessment', searchTime: '2025-11-15 12:18:38' },
      { id: 103, keyword: 'Action quality assessment', searchTime: '2025-11-15 12:07:21' },
      { id: 102, keyword: 'Action quality assessment', searchTime: '2025-11-15 12:04:03' },
      { id: 101, keyword: 'Action quality assessment', searchTime: '2025-11-12 17:39:35' },
      { id: 100, keyword: 'Action quality assessment', searchTime: '2025-11-12 17:35:16' },
      { id: 99, keyword: 'Action quality assessment', searchTime: '2025-11-12 17:31:13' }
    ]

    return mockHistory
  }

  // 转换后端原始数据为前端格式
  private convertPaperData(rawPaper: PaperRaw): Paper {
    // 现在使用后端提供的真实ID，转换为字符串格式以保持一致性
    const uniqueId = rawPaper.id.toString()
    return {
      id: uniqueId,
      title: rawPaper.title,
      abstract: rawPaper.paperAbstract,
      authors: rawPaper.authors ? rawPaper.authors.split(',').map(a => a.trim()) : [],
      year: rawPaper.publishedDate ? parseInt(rawPaper.publishedDate) : 0,
      journal: rawPaper.venueInfo?.standardName || '', // 修复字段名匹配API返回格式
      venueType: rawPaper.venueInfo?.type === 0 ? 'journal' : 'conference',
      ccfLevel: rawPaper.venueInfo?.ccfRank || undefined,
      sciLevel: rawPaper.venueInfo?.sciRank || undefined,
      coreLevel: rawPaper.venueInfo?.coreRank || undefined,
      jcrLevel: this.extractSciZone(rawPaper.venueInfo?.sciUp || undefined), // 提取分区用于样式
      sciUpFull: rawPaper.venueInfo?.sciUp || undefined, // 存储完整的中科院分区信息
      impactFactor: (rawPaper.venueInfo?.sciIf && rawPaper.venueInfo.sciIf > 0) ? rawPaper.venueInfo.sciIf : undefined,
      keywords: rawPaper.keywords ? rawPaper.keywords.split(',').map(k => k.trim()) : [],
      summary: rawPaper.aiAbstract,
      citations: rawPaper.citations,
      url: rawPaper.abstractUrl || rawPaper.pdfUrl,
      link: rawPaper.abstractUrl || rawPaper.pdfUrl,
      pdfUrl: rawPaper.pdfUrl,
      abstractExpanded: false,
      summaryExpanded: false
    }
  }

  // 模拟搜索结果
  private getMockSearchResult(id: number, page: number = 1, pageSize: number = 10): SearchResult {
    // 生成基于页面的全局唯一ID
    const baseId = (page - 1) * pageSize
    const mockPapers: Paper[] = [
      {
        id: (baseId + 1).toString(),
        title: `基于的深度学习方法研究与应用`,
        abstract: `本文综述了任务${id}相关领域的最新研究进展，分析了当前的技术挑战和未来发展趋势。通过对比分析不同算法的性能表现，提出了一种新的优化策略，实验结果表明该方法在准确率和效率方面都有显著提升。`,
        authors: ['张三', '李四', '王五'],
        year: 2024,
        journal: 'IEEE Transactions on Pattern Analysis and Machine Intelligence',
        venueType: 'journal' as const,
        ccfLevel: 'A',
        sciLevel: 'Q1',
        jcrLevel: 'Q1',
        impactFactor: 17.861,
        keywords: ['深度学习', '神经网络', '模式识别'],
        summary: `本研究提出了一种基于任务${id}的创新方法，通过深度学习技术实现了性能的显著提升。该方法具有良好的泛化能力和实用价值。`,
        citations: 156,
        link: 'https://ieeexplore.ieee.org/document/example1',
        url: 'https://example.com/paper1'
      },
      {
        id: (baseId + 2).toString(),
        title: `技术在智能系统中的应用与优化`,
        abstract: `通过分析多个实际案例，本文探讨了任务${id}技术在不同智能系统中的应用效果和实施策略。研究涵盖了算法设计、系统架构、性能评估等多个方面，为相关领域的研究提供了重要参考。`,
        authors: ['赵六', '钱七', '孙八', '周九'],
        year: 2024,
        journal: 'ICML 2024',
        venueType: 'conference' as const,
        ccfLevel: 'A',
        sciLevel: 'Q1',
        jcrLevel: 'Q1',
        impactFactor: 5.432,
        keywords: ['智能系统', '应用研究', '性能优化'],
        summary: `该研究通过实际案例验证了任务${id}技术的有效性，提出了系统化的应用框架和优化策略。`,
        citations: 89,
        link: 'https://jmlr.org/papers/example2',
        url: 'https://example.com/paper2'
      },
      {
        id: (baseId + 3).toString(),
        title: `多模态融合算法设计`,
        abstract: `针对传统单模态方法的局限性，本文提出了一种多模态融合的任务${id}算法。该算法能够有效整合不同模态的信息，提高了系统的鲁棒性和准确性。实验验证了算法的有效性和优越性。`,
        authors: ['吴十', '郑十一'],
        year: 2023,
        journal: 'Computer Vision and Image Understanding',
        venueType: 'journal' as const,
        ccfLevel: 'B',
        sciLevel: 'Q2',
        jcrLevel: 'Q2',
        impactFactor: 3.121,
        keywords: ['多模态融合', '算法设计', '计算机视觉'],
        summary: `提出了创新的多模态融合算法，有效提升了任务${id}的性能表现，具有重要的理论和实用价值。`,
        citations: 43,
        link: 'https://www.sciencedirect.com/science/article/example3',
        url: 'https://example.com/paper3'
      },
      {
        id: (baseId + 4).toString(),
        title: `领域的前沿技术综述`,
        abstract: `本文对任务${id}领域的前沿技术进行了全面综述，包括理论基础、关键技术、应用场景等方面。分析了当前研究的热点和难点，展望了未来的发展方向和潜在突破点。`,
        authors: ['冯十二', '陈十三', '褚十四', '卫十五', '蒋十六'],
        year: 2023,
        journal: 'ACM Computing Surveys',
        venueType: 'journal' as const,
        ccfLevel: 'A',
        sciLevel: 'Q1',
        jcrLevel: 'Q1',
        impactFactor: 14.324,
        keywords: ['技术综述', '前沿技术', '发展趋势'],
        summary: `全面梳理了任务${id}领域的技术发展脉络，为研究者提供了重要的参考和指导。`,
        citations: 234,
        link: 'https://dl.acm.org/doi/example4',
        url: 'https://example.com/paper4'
      }
    ]

    // 模拟分页数据
    const totalMockPapers = 4 // 模拟总数据量
    const totalPages = Math.ceil(totalMockPapers / pageSize)
    const startIndex = (page - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, mockPapers.length)
    const paginatedPapers = mockPapers.slice(startIndex, endIndex)

    return {
      papers: paginatedPapers,
      totalPages: totalPages,
      currentPage: page,
      pageSize: pageSize,
      totalResults: totalMockPapers
    }
  }

  // 模拟AI关键词提取
  private getMockKeywords(query: string): KeywordExtractionResult {
    const keywordMap: Record<string, string[]> = {
      '动作质量评估': ['Action Quality Assessment', 'Self-attention Mechanism', 'Video Action Analysis'],
      '深度学习': ['Deep Learning', 'Neural Networks', 'Machine Learning'],
      '自然语言处理': ['Natural Language Processing', 'Text Mining', 'Language Models'],
      '计算机视觉': ['Computer Vision', 'Image Processing', 'Object Detection'],
      '机器学习': ['Machine Learning', 'Supervised Learning', 'Feature Engineering'],
      '人工智能': ['Artificial Intelligence', 'AI Applications', 'Intelligent Systems'],
      '电网故障检测': ['Power System Fault Detection', 'Transient Stability Analysis', 'Protective Relay Coordination']
    }

    // 根据查询词返回对应的关键词，如果没有匹配则返回通用关键词
    const keywords = keywordMap[query] || [
      `${query} Research`,
      `${query} Applications`,
      `${query} Methods`
    ]

    return {
      code: 0,
      success: true,
      data: keywords,  // 直接返回关键词数组
      message: "",
      other: null
    }
  }

  // 模拟搜索响应
  private getMockSearchResponse(_searchTerm: string, _keywords: string[]): SearchResponse {
    return {
      code: 0,
      success: true,
      data: Date.now(),  // 直接返回任务ID
      message: '搜索任务创建成功',
      other: null
    }
  }

  // 模拟搜索任务数据
  private getMockSearchTasks(params: TasksRequestParams): { tasks: SearchTask[], total: number, page: number, pageSize: number } {
    // 模拟后端返回的原始数据
    const allMockRawTasks: SearchTaskRaw[] = [
      {
        id: 1,
        searchWord: '动作质量评估',
        keywords: 'Action Quality Assessment, Self-attention Mechanism, Video Action Analysis',
        searchTime: '2024-11-01',
        taskState: 'COMPLETED',
        errorMessage: null
      },
      {
        id: 2,
        searchWord: '深度学习',
        keywords: 'Deep Learning, Neural Networks, Machine Learning',
        searchTime: '2024-10-30',
        taskState: 'RUNNING',
        errorMessage: null
      },
      {
        id: 3,
        searchWord: '计算机视觉',
        keywords: 'Computer Vision, Image Processing, Object Detection',
        searchTime: '2024-10-28',
        taskState: 'FAILED',
        errorMessage: '搜索超时，请稍后重试'
      },
      {
        id: 4,
        searchWord: '自然语言处理',
        keywords: 'NLP, Transformer, BERT',
        searchTime: '2024-10-25',
        taskState: 'COMPLETED',
        errorMessage: null
      },
      {
        id: 5,
        searchWord: '强化学习',
        keywords: 'Reinforcement Learning, Q-Learning, Policy Gradient',
        searchTime: '2024-10-20',
        taskState: 'COMPLETED',
        errorMessage: null
      },
      {
        id: 6,
        searchWord: '图神经网络',
        keywords: 'Graph Neural Network, GCN, Graph Attention',
        searchTime: '2024-10-18',
        taskState: 'PENDING',
        errorMessage: null
      },
      {
        id: 7,
        searchWord: '生成对抗网络',
        keywords: 'GAN, Generative Model, Adversarial Training',
        searchTime: '2024-10-15',
        taskState: 'CANCELLED',
        errorMessage: null
      },
      {
        id: 8,
        searchWord: '联邦学习',
        keywords: 'Federated Learning, Privacy Preserving, Distributed ML',
        searchTime: '2024-10-12',
        taskState: 'COMPLETED',
        errorMessage: null
      }
    ]

    // 计算分页
    const total = allMockRawTasks.length
    const startIndex = (params.pageIndex - 1) * params.pageSize
    const endIndex = startIndex + params.pageSize
    const pagedTasks = allMockRawTasks.slice(startIndex, endIndex)

    // 转换为前端格式
    const tasks = pagedTasks.map(rawTask => this.convertRawTask(rawTask))

    return {
      tasks,
      total,
      page: params.pageIndex,
      pageSize: params.pageSize
    }
  }

  // 模拟任务状态查询
  private getMockTaskStatus(taskId: number): TaskStatusResponse {
    // 模拟状态变化：检索中的任务可能会变成成功或失败
    const randomState = Math.random()
    let state = 'RUNNING' // 默认正在检索
    let errorMessage: string | null = null

    if (taskId === 2) { // 任务002 - 正在检索的任务
      if (randomState < 0.3) {
        state = 'COMPLETED' // 30% 概率变成检索完成成功
      } else if (randomState < 0.1) {
        state = 'FAILED' // 10% 概率变成检索失败
        errorMessage = '搜索服务暂时不可用'
      }
      // 否则保持正在检索
    } else if (taskId === 1) {
      state = 'COMPLETED' // 任务001检索完成成功
    } else if (taskId === 3) {
      state = 'FAILED' // 任务003检索失败
      errorMessage = '搜索超时，请稍后重试'
    } else if (taskId === 6) {
      state = 'PENDING' // 任务006等待中
    } else if (taskId === 7) {
      state = 'CANCELLED' // 任务007已取消
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

  // 模拟删除任务响应
  private getMockTaskDelete(_id: number): TaskDeleteResponse {
    return {
      code: 0,
      success: true,
      data: true,
      message: '',
      other: null
    }
  }

  // 模拟任务关键词响应
  private getMockTaskKeywords(_id: number): TaskKeywordsResponse {
    return {
      code: 0,
      success: true,
      data: ['Machine Learning', 'Neural Networks', 'Natural Language Processing'],
      message: '',
      other: null
    }
  }

  // 模拟 OSS 凭证响应
  private getMockOSSCredentials(): OSSCredentialsResponse {
    const expiration = new Date(Date.now() + 3600 * 1000).toISOString()
    return {
      code: 0,
      success: true,
      message: 'Success',
      other: null,
      data: {
        accessKeyId: 'MOCK_ACCESS_KEY_ID',
        accessKeySecret: 'MOCK_ACCESS_KEY_SECRET',
        securityToken: 'MOCK_SECURITY_TOKEN',
        expiration: expiration
      }
    }
  }

  // 保存到本地存储
  private saveToLocalStorage(keyword: string): void {
    try {
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]')
      const existingIndex = history.findIndex((item: SearchHistory) => item.keyword === keyword)

      if (existingIndex >= 0) {
        history[existingIndex].searchTime = new Date().toISOString()
        // 移动到最前面
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

  // 清除搜索历史（已移除后端清除，仅清除本地存储）
  async clearSearchHistory(): Promise<void> {
    // 只清除本地存储
    localStorage.removeItem('searchHistory')
  }
}

// 导出单例实例
export const apiService = new ApiService()
