// API 服务配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const AI_API_BASE_URL = import.meta.env.VITE_AI_API_BASE_URL || '/ai-service'

// 搜索历史接口
export interface SearchHistory {
  id: number
  keyword: string
}

// 最近搜索接口响应格式
export interface RecentSearchResponse {
  code: number  // 业务状态码：0或1，但使用HTTP状态码判断请求成功与否
  msg: string
  data: Array<{
    id: number
    searchWord: string
  }>
} 

// 论文数据接口
export interface Paper {
  id: number
  title: string
  abstract: string
  authors: string[]
  year: number
  journal: string
  venueType: 'journal' | 'conference' // 根据venue_state转换：0为期刊，1为会议
  ccfLevel?: string
  sciLevel?: string
  jcrLevel?: string
  impactFactor?: number // 影响因子，对应sciif
  keywords: string[]
  summary: string
  citations: number
  link?: string
  url?: string
  // 前端状态字段
  abstractExpanded?: boolean
  summaryExpanded?: boolean
}

// 后端返回的原始论文数据格式
export interface PaperRaw {
  title: string
  time: number
  authers: string
  abstract: string
  ai_abstract: string
  venue: string
  venue_state: number // 0为期刊，1为会议
  citations: number
  ccf_partition: string
  jcr_partition: string
  sci_partition: string
  sciif: number // 影响因子
  keywords: string
  url: string
}

// 后端搜索结果响应格式
export interface SearchResultResponse {
  code: number
  msg: string
  data: {
    total: number // 总页数
    current_page: number // 当前页号
    size: number // 行数
    papers: PaperRaw[]
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
  msg: string
  data: string[]  // 直接返回关键词字符串数组
}

// 搜索请求接口
export interface SearchRequest {
  search_inf: string
  keywords: string[]
}

// 后端返回的搜索任务原始数据
export interface SearchTaskRaw {
  id: number
  title: string
  keywords: string[]
  time: string
  state: number // 0: 正在检索, 1: 检索完成成功, 2: 检索失败
}

// 前端使用的搜索任务接口
export interface SearchTask {
  id: number
  taskName: string
  searchTerm: string
  keywords: string[]
  date: string  
  progress: string
  status: 'searching' | 'success' | 'failed'
}

// 任务列表分页请求参数
export interface TasksRequestParams {
  id?: string
  page: number
  size: number
}

// 任务列表响应接口
export interface TasksResponse {
  code: number
  msg: string
  data: {
    searchs: SearchTaskRaw[]
    total: number
    page: number
    pagesize: string
  }
}

// 任务状态查询响应接口
export interface TaskStatusResponse {
  code: number
  msg: string
  data: number // 直接返回状态数字: 0: 检索中, 1: 检索成功, 2: 检索失败
}

// 任务删除响应接口
export interface TaskDeleteResponse {
  code: number
  msg: string
  data: {}
}

// 搜索响应接口
export interface SearchResponse {
  code: number
  msg: string
  data: {
    taskId: number
    status: string
  }
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
  async getSearchHistory(limit: number = 2): Promise<SearchHistory[]> {
    try {
      const response = await this.request<RecentSearchResponse>(`/search/recentsearch?limitNum=${limit}`)
      
      return response.data.map(item => ({
        id: item.id,
        keyword: item.searchWord,
      }))
      
    } catch (error) {
      // 如果HTTP请求失败或后端不可用，返回模拟数据
      console.warn('Backend not available, using mock data')
      return this.getMockSearchHistory()
    }
  }

  // 生成模拟的最近搜索响应数据
  private getMockRecentSearchResponse(limit: number = 5): RecentSearchResponse {
    const mockData = [
      { id: 97, searchWord: '动作质量评估' },
      { id: 68, searchWord: '电网故障检测' },
      { id: 45, searchWord: '深度学习算法' },
      { id: 23, searchWord: '自然语言处理' },
      { id: 12, searchWord: '计算机视觉' },
      { id: 8, searchWord: '机器学习' },
      { id: 3, searchWord: '人工智能' }
    ]

    return {
      code: 0,
      msg: 'success',
      data: mockData.slice(0, limit)
    }
  }

  // 保存搜索记录（已移除后端保存，仅本地存储）
  async saveSearchHistory(keyword: string): Promise<void> {
    // 只保存到本地存储
    this.saveToLocalStorage(keyword)
  }

  // 测试最近搜索接口（返回完整响应数据）
  async testRecentSearchAPI(limit: number = 5): Promise<RecentSearchResponse> {
    try {
      const response = await this.request<RecentSearchResponse>(`/search/recentsearch?limitNum=${limit}`)
      console.log('✅ 最近搜索接口调用成功:', response)
      return response
    } catch (error) {
      console.warn('⚠️ 后端不可用，返回模拟数据:', error)
      const mockResponse = this.getMockRecentSearchResponse(limit)
      console.log('📝 模拟响应数据:', mockResponse)
      return mockResponse
    }
  }

  // 搜索论文
  async searchPapers(
    id: number,
    page: number = 1, 
    size: number = 10
  ): Promise<SearchResult> {
    try {
      const params = new URLSearchParams({
        id: id.toString(),
        page: page.toString(),
        size: size.toString()
      })
      
      const response = await this.request<SearchResultResponse>(`/papers/search?${params}`)
      
      // 转换后端响应格式为前端格式
      return {
        papers: response.data.papers.map((paper, index) => this.convertPaperData(paper, index)),
        totalPages: response.data.total,
        currentPage: response.data.current_page,
        pageSize: response.data.size,
        totalResults: response.data.total * response.data.size // 计算总结果数
      }
    } catch (error) {
      console.warn('Backend not available, using mock data')
      return this.getMockSearchResult(id, page, size)
    }
  }

  // AI关键词提取
  async extractKeywords(searchWord: string): Promise<KeywordExtractionResult> {
    try {
      const url = `${AI_API_BASE_URL}/ai/keywords?search_word=${encodeURIComponent(searchWord)}`
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
  async submitSearch(searchTerm: string, keywords: string[]): Promise<SearchResponse> {
    try {
      const searchRequest: SearchRequest = {
        search_inf: searchTerm,
        keywords: keywords
      }
      
      return await this.request<SearchResponse>('/search/search', {
        method: 'POST',
        body: JSON.stringify(searchRequest)
      })
    } catch (error) {
      console.warn('Backend not available, using mock response')
      return this.getMockSearchResponse(searchTerm, keywords)
    }
  }

  // 状态转换函数
  private convertTaskStatus(state: number): { status: 'searching' | 'success' | 'failed', progress: string } {
    switch (state) {
      case 0:
        return { status: 'searching', progress: '正在检索' }
      case 1:
        return { status: 'success', progress: '检索成功' }
      case 2:
        return { status: 'failed', progress: '检索失败' }
      default:
        return { status: 'searching', progress: '正在检索' }
    }
  }

  // 转换原始任务数据为前端格式
  private convertRawTask(rawTask: SearchTaskRaw): SearchTask {
    const { status, progress } = this.convertTaskStatus(rawTask.state)
    
    return {
      id: rawTask.id,
      taskName: `任务${rawTask.id.toString().padStart(3, '0')}`,
      searchTerm: rawTask.title,
      keywords: rawTask.keywords,
      date: rawTask.time, // 使用后端提供的时间字段
      progress,
      status
    }
  }

  // 获取搜索任务列表
  async getSearchTasks(params: TasksRequestParams): Promise<{ tasks: SearchTask[], total: number, page: number, pageSize: number }> {
    try {
      const queryParams = new URLSearchParams({
        page: params.page.toString(),
        size: params.size.toString()
      })
      
      if (params.id) {
        queryParams.append('id', params.id)
      }
      
      const response = await this.request<TasksResponse>(`/search/tasks?${queryParams}`)
      
      if (response.code === 0) {
        return {
          tasks: response.data.searchs.map(rawTask => this.convertRawTask(rawTask)),
          total: response.data.total,
          page: response.data.page,
          pageSize: parseInt(response.data.pagesize)
        }
      } else {
        throw new Error(`API error: ${response.msg}`)
      }
    } catch (error) {
      console.warn('Backend not available, using mock tasks')
      return this.getMockSearchTasks(params)
    }
  }

  // 查询任务状态
  async getTaskStatus(taskId: number): Promise<TaskStatusResponse> {
    try {
      return await this.request<TaskStatusResponse>(`/search/state?id=${taskId}`)
    } catch (error) {
      console.warn('Backend not available, using mock status')
      return this.getMockTaskStatus(taskId)
    }
  }

  // 删除任务
  async deleteTask(id: number): Promise<TaskDeleteResponse> {
    try {
      return await this.request<TaskDeleteResponse>(`/search/delete?id=${id}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.warn('Backend not available, using mock delete')
      return this.getMockTaskDelete(id)
    }
  }

  // 模拟搜索历史数据
  private getMockSearchHistory(): SearchHistory[] {
    const mockHistory = [
      { id: 25, keyword: '动作质量评估', searchTime: new Date('2026-02-04 01:13:37').toISOString() },
      { id: 68, keyword: '电网故障检测', searchTime: new Date('2026-01-09 12:41:25').toISOString() },
      { id: 15, keyword: '深度学习', searchTime: new Date('2025-12-15 09:30:00').toISOString() },
      { id: 12, keyword: '自然语言处理', searchTime: new Date('2025-12-10 14:20:00').toISOString() },
      { id: 8, keyword: '计算机视觉', searchTime: new Date('2025-12-05 16:45:00').toISOString() }
    ]
    
    return mockHistory
  }

  // 转换后端原始数据为前端格式
  // TODO: 当后端API返回新格式时使用此函数
  private convertPaperData(rawPaper: PaperRaw, index: number): Paper {
    return {
      id: index + 1,
      title: rawPaper.title,
      abstract: rawPaper.abstract,
      authors: rawPaper.authers ? rawPaper.authers.split(',').map(a => a.trim()) : [],
      year: rawPaper.time,
      journal: rawPaper.venue,
      venueType: rawPaper.venue_state === 0 ? 'journal' : 'conference',
      ccfLevel: rawPaper.ccf_partition,
      sciLevel: rawPaper.sci_partition,
      jcrLevel: rawPaper.jcr_partition,
      impactFactor: rawPaper.sciif > 0 ? rawPaper.sciif : undefined,
      keywords: rawPaper.keywords ? rawPaper.keywords.split(',').map(k => k.trim()) : [],
      summary: rawPaper.ai_abstract,
      citations: rawPaper.citations,
      url: rawPaper.url,
      link: rawPaper.url,
      abstractExpanded: false,
      summaryExpanded: false
    }
  }

  // 模拟搜索结果
  private getMockSearchResult(id: number, page: number = 1, pageSize: number = 10): SearchResult {
    const mockPapers: Paper[] = [
      {
        id: 1,
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
        id: 2,
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
        id: 3,
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
        id: 4,
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
      '人工智能': ['Artificial Intelligence', 'AI Applications', 'Intelligent Systems']
    }

    // 根据查询词返回对应的关键词，如果没有匹配则返回通用关键词
    const keywords = keywordMap[query] || [
      `${query} Research`,
      `${query} Applications`,
      `${query} Methods`
    ]

    return {
      code: 0,
      msg: "success",
      data: keywords  // 直接返回关键词数组
    }
  }

  // 模拟搜索响应
  private getMockSearchResponse(_searchTerm: string, _keywords: string[]): SearchResponse {
    return {
      code: 0,
      msg: '搜索任务创建成功',
      data: {
        taskId: Date.now(),
        status: 'pending'
      }
    }
  }

  // 模拟搜索任务数据
  private getMockSearchTasks(params: TasksRequestParams): { tasks: SearchTask[], total: number, page: number, pageSize: number } {
    // 模拟后端返回的原始数据
    const allMockRawTasks: SearchTaskRaw[] = [
      {
        id: 1,
        title: '动作质量评估',
        keywords: ['Action Quality Assessment', 'Self-attention Mechanism', 'Video Action Analysis'],
        time: '2024-11-01',
        state: 1 // 检索完成成功
      },
      {
        id: 2,
        title: '深度学习',
        keywords: ['Deep Learning', 'Neural Networks', 'Machine Learning'],
        time: '2024-10-30',
        state: 0 // 正在检索
      },
      {
        id: 3,
        title: '计算机视觉',
        keywords: ['Computer Vision', 'Image Processing', 'Object Detection'],
        time: '2024-10-28',
        state: 2 // 检索失败
      },
      {
        id: 4,
        title: '自然语言处理',
        keywords: ['NLP', 'Transformer', 'BERT'],
        time: '2024-10-25',
        state: 1 // 检索完成成功
      },
      {
        id: 5,
        title: '强化学习',
        keywords: ['Reinforcement Learning', 'Q-Learning', 'Policy Gradient'],
        time: '2024-10-20',
        state: 1 // 检索完成成功
      },
      {
        id: 6,
        title: '图神经网络',
        keywords: ['Graph Neural Network', 'GCN', 'Graph Attention'],
        time: '2024-10-18',
        state: 0 // 正在检索
      },
      {
        id: 7,
        title: '生成对抗网络',
        keywords: ['GAN', 'Generative Model', 'Adversarial Training'],
        time: '2024-10-15',
        state: 2 // 检索失败
      },
      {
        id: 8,
        title: '联邦学习',
        keywords: ['Federated Learning', 'Privacy Preserving', 'Distributed ML'],
        time: '2024-10-12',
        state: 1 // 检索完成成功
      }
    ]
    
    // 计算分页
    const total = allMockRawTasks.length
    const startIndex = (params.page - 1) * params.size
    const endIndex = startIndex + params.size
    const pagedTasks = allMockRawTasks.slice(startIndex, endIndex)
    
    // 转换为前端格式
    const tasks = pagedTasks.map(rawTask => this.convertRawTask(rawTask))
    
    return {
      tasks,
      total,
      page: params.page,
      pageSize: params.size
    }
  }

  // 模拟任务状态查询
  private getMockTaskStatus(taskId: number): TaskStatusResponse {
    // 模拟状态变化：检索中的任务可能会变成成功或失败
    const randomState = Math.random()
    let state = 0 // 默认正在检索
    
    if (taskId === 2) { // 任务002 - 正在检索的任务
      if (randomState < 0.3) {
        state = 1 // 30% 概率变成检索完成成功
      } else if (randomState < 0.1) {
        state = 2 // 10% 概率变成检索失败
      }
      // 否则保持正在检索
    } else if (taskId === 1) {
      state = 1 // 任务001检索完成成功
    } else if (taskId === 3) {
      state = 2 // 任务003检索失败
    }

    return {
      code: 0,
      msg: 'success',
      data: state  // 直接返回状态数字
    }
  }

  // 模拟删除任务响应
  private getMockTaskDelete(_id: number): TaskDeleteResponse {
    return {
      code: 0,
      msg: 'Task deleted successfully',
      data: {}
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
