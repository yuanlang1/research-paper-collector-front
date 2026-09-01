// API 服务配置
import type { Router } from 'vue-router'
import {
  fetchWithTimeout,
  fetchWithRetry,
  isTimeoutError,
  type FetchWithTimeoutOptions
} from '@/utils/fetchWithTimeout'
import {
  normalizePaperTag,
  type SourceTag,
  type SubmitPaperTag
} from '@/constants/searchTagMappings'
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
  searchPrompt: string
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
  star: number
  recommendation: string
  reasons: string[]
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
  ossName?: string
  pdfFileName?: string
  mdFileName?: string
  // 前端状态字段
  abstractExpanded?: boolean
  summaryExpanded?: boolean
  authorsExpanded?: boolean
}

// 会议/期刊信息接口
export interface VenueInfo {
  id?: number
  standardName: string // 期刊/会议标准名称（驼峰命名匹配API）
  acronym: string
  type: number // 0为期刊，1为会议
  sciRank: string | null
  ccfRank: string | null
  sciIf: number | string | null
  sciUp: string | null // 中科院大区
  sciUpSmall: string | null // 中科院小区
  coreRank: string | null
}

// 后端返回的原始论文数据格式
export interface PaperRaw {
  id: number
  star: number
  recommendation: string
  reasons: string | string[] | null
  title: string
  publishedDate: string | null
  authors: string[] // 作者数组
  paperAbstract: string
  aiAbstract: string
  doi: string
  venueId?: number
  venueInfo: VenueInfo | null
  citations: number
  keywords: string[] // 关键词数组
  abstractUrl: string
  pdfUrl: string
  ossName: string
}

// 排序信息接口
export interface OrderInfo {
  orderWord: string // 排序字段
  orderId: number // 排序方式: 0=asc, 1=desc
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

// 查询理解结构化结果
export interface QueryUnderstanding {
  topic: string
  subfields: string[]
  intent: string
  yearFrom: number | null
  yearTo: number | null
  keywords: string[]
  synonyms: string[]
  includeTerms: string[]
  excludeTerms: string[]
  requiresCode: boolean
  reasoning: string
}

// 查询理解接口响应
export interface QueryUnderstandingResponse {
  code: number
  success: boolean
  data: {
    matched: boolean
    classification: string
    reason: string
    structuredQuery: QueryUnderstanding | null
    consistencyValid: boolean
  }
  message: string
  other: null
}

// 检索源策略配置
export interface SearchStrategyConfig {
  source: string
  name: string
  totalCount: number
  enabled: boolean
}

export interface SearchStrategyConfigResponse {
  code: number
  success: boolean
  message: string
  other: string | null
  data: SearchStrategyConfig[]
}

export interface ConfigSaveResponse {
  code: number
  success: boolean
  message?: string
  other?: string | null
  data: boolean
}

// AI 配置
export type AiProvider = 'DASHSCOPE' | 'OPENAI_COMPATIBLE'

export interface AiConfig {
  provider: AiProvider
  baseUrl: string
  model: string
  apiKey: string
  temperature: number
  maxTokens: number
  timeoutMs: number
}

export interface AiConfigResponse {
  code: number
  success?: boolean
  message?: string
  other?: string | null
  data: AiConfig
}

// 新建搜索任务请求接口
export interface NewTaskRequest {
  prompt: string
  searchTag: {
    yearTag: number
    paperTag: SubmitPaperTag[]
    sourceTag: SourceTag[]
  }
  promptUnderstanding: QueryUnderstanding
}

export type BackendTaskState =
  | 'SEARCH_PENDING'
  | 'SEARCH_RUNNING'
  | 'SEARCH_COMPLETED'
  | 'SEARCH_FAILED'
  | 'SEARCH_PARTIAL_COMPLETED'
  | 'CANCELLED'
  | 'RAG_RUNNING'
  | 'RAG_FAILED'
  | 'RAG_COMPLETED'

export type TaskDisplayStatus = 'searching' | 'success' | 'failed' | 'cancelled' | 'unknown'

export interface TaskStatePresentation {
  state: BackendTaskState | null
  status: TaskDisplayStatus
  progress: string
}

const taskStatesByCode: Record<number, BackendTaskState> = {
  0: 'SEARCH_PENDING',
  1: 'SEARCH_RUNNING',
  2: 'SEARCH_COMPLETED',
  3: 'SEARCH_FAILED',
  4: 'SEARCH_PARTIAL_COMPLETED',
  5: 'CANCELLED',
  6: 'RAG_RUNNING',
  7: 'RAG_FAILED',
  8: 'RAG_COMPLETED'
}

const taskStatePresentations: Record<BackendTaskState, Omit<TaskStatePresentation, 'state'>> = {
  SEARCH_PENDING: { status: 'searching', progress: '等待检索' },
  SEARCH_RUNNING: { status: 'searching', progress: '正在检索' },
  SEARCH_COMPLETED: { status: 'success', progress: '检索完成' },
  SEARCH_FAILED: { status: 'failed', progress: '检索失败' },
  SEARCH_PARTIAL_COMPLETED: { status: 'success', progress: '检索部分完成' },
  CANCELLED: { status: 'cancelled', progress: '已取消' },
  RAG_RUNNING: { status: 'searching', progress: '正在生成 RAG 结果' },
  RAG_FAILED: { status: 'failed', progress: 'RAG 生成失败' },
  RAG_COMPLETED: { status: 'success', progress: 'RAG 结果已完成' }
}

export function getTaskStatePresentation(state: string | number): TaskStatePresentation {
  const normalizedState = typeof state === 'number' ? taskStatesByCode[state] : state
  const presentation = taskStatePresentations[normalizedState as BackendTaskState]

  return presentation
    ? { state: normalizedState as BackendTaskState, ...presentation }
    : { state: null, status: 'unknown', progress: '未知状态' }
}

export function isTaskStateActive(state: BackendTaskState | null): boolean {
  return state === 'SEARCH_PENDING' || state === 'SEARCH_RUNNING' || state === 'RAG_RUNNING'
}

export function isTaskStateViewable(state: BackendTaskState | null): boolean {
  return state === 'SEARCH_COMPLETED' || state === 'SEARCH_PARTIAL_COMPLETED' || state === 'RAG_COMPLETED'
}

// 后端返回的搜索任务原始数据
export interface SearchTaskRaw {
  id: number
  searchPrompt: string
  promptUnderstanding: QueryUnderstanding | null
  tags: {
    yearTag: number
    paperTag: string[]
    sourceTag: string[]
  }
  state: BackendTaskState | number
  errorMessage: string | null // 错误信息，任务失败时显示
  searchTime: string
}

// 前端使用的搜索任务接口
export interface SearchTask {
  id: number
  searchPrompt: string
  promptUnderstanding: QueryUnderstanding | null
  tags: {
    yearTag: number
    paperTag: string[]
    sourceTag: string[]
  }
  searchTime: string
  state: BackendTaskState | null
  progress: string
  status: TaskDisplayStatus
  errorMessage?: string | null // 错误信息
}

// 任务列表分页请求参数
export interface TasksRequestParams {
  pageIndex: number
  pageSize: number
  orderWord?: string // 排序列名
  orderId?: number // 排序方式: 0=asc, 1=desc
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

export interface ReviewTask {
  id: number
  taskId: number
  topic: string
  title: string
  versionNumber: number
  language: string
  reviewTypeName: string
  citationStyleName: string
  creationTime: string
}

export interface ReviewTasksParams {
  pageIndex: number
  pageSize: number
  taskId?: number
  keyword?: string
}

export interface ReviewTasksResponse {
  code: number
  success: boolean
  message: string | null
  data: {
    total: number
    pages: number
    pageNumber: number
    pageSize: number
    list: ReviewTask[]
  }
}

export interface ReviewSection {
  section_id: string
  title: string
  description: string
  text: string
  summary: string
  used_claim_ids: string[]
  omitted_claim_ids: string[]
}

export interface ReviewReference {
  paper_id: string
  formatted: string
}

export interface ReviewDetail {
  id: number
  taskId: number
  versionNumber: number
  topic: string
  title: string
  language: string
  reviewType: number
  reviewTypeName: string
  citationStyle: number
  citationStyleName: string
  scope: string
  abstractContent: string
  bodyMarkdown: string
  conclusion: string
  markdown: string
  sections: ReviewSection[]
  paperIdsSnapshot: number[]
  citationPaperIds: number[]
  citationLabels: Record<string, string>
  references: ReviewReference[]
  frameworkHash: string
  creationTime: string
  modificationTime: string
}

export interface ReviewDetailResponse {
  code: number
  success: boolean
  message: string | null
  data: ReviewDetail
}

export type CitationStyle = 'harvard' | 'apa' | 'ieee' | 'chicago' | 'vancouver'

export interface ReviewRenderParams {
  citationStyle?: CitationStyle
}

export interface ReviewRender {
  html: string
  citationStyleName: string
  renderer: 'pandoc'
  sourceHash: string
}

export interface ReviewRenderResponse {
  code: number
  message: string | null
  data: ReviewRender | null
}

// 任务状态查询响应接口
export interface TaskStatusResponse {
  code: number
  success: boolean
  data: {
    state: BackendTaskState | number // 状态字符串: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
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
  data: number // 直接返回任务ID
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

  private async request<T>(
    endpoint: string,
    options?: FetchWithTimeoutOptions,
    useRetry: boolean = false
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`

    const requestHeaders = {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers
    }

    try {
      // 根据参数选择是否使用重试机制
      const response = useRetry
        ? await fetchWithRetry(
            url,
            {
              headers: requestHeaders,
              timeout: 60000, // 增加到60秒超时
              ...options
            },
            2,
            2000
          ) // 重试2次，间隔2秒
        : await fetchWithTimeout(url, {
            headers: requestHeaders,
            timeout: 60000, // 增加到60秒超时
            ...options
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
      const timedOut = isTimeoutError(error)
      const shouldSkipGlobalNetworkError = endpoint.startsWith('/ai/query-understanding')

      if (!timedOut) {
        console.error('API request failed:', error)
      }

      if (!shouldSkipGlobalNetworkError) {
        const failedToFetch = error instanceof Error && error.message.includes('Failed to fetch')
        if (failedToFetch || timedOut) {
          errorHandler.handleNetworkError(endpoint)
        }
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
    return response.data.list.map((item) => ({
      id: item.id,
      keyword: item.searchPrompt,
      searchTime: item.searchTime
    }))
  }

  // 获取搜索历史（带分页信息）
  async getSearchHistoryWithPagination(
    pageIndex: number = 1,
    pageSize: number = 10
  ): Promise<RecentSearchResponse> {
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
      { orderWord: 'star', orderId: 1 },
      { orderWord: 'publishedDate', orderId: 1 },
      { orderWord: 'citations', orderId: 1 }
    ]
  ): Promise<SearchResult> {
    const requestBody: PaperSearchParams = {
      taskId,
      pageIndex: page,
      pageSize: size,
      orderInfo
    }
    const response = await this.request<SearchResultResponse>(
      '/paper/get',
      {
        method: 'POST',
        body: JSON.stringify(requestBody)
      },
      true
    ) // 使用重试
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

  // 获取检索源策略配置
  async getSearchStrategyConfig(): Promise<SearchStrategyConfigResponse> {
    return await this.request<SearchStrategyConfigResponse>('/config/strategy')
  }

  // 保存检索源策略配置
  async saveSearchStrategyConfig(configs: SearchStrategyConfig[]): Promise<ConfigSaveResponse> {
    return await this.request<ConfigSaveResponse>('/config/strategy', {
      method: 'POST',
      body: JSON.stringify(configs)
    })
  }

  // 获取 AI 配置
  async getAiConfig(): Promise<AiConfigResponse> {
    return await this.request<AiConfigResponse>('/config/ai')
  }

  // 保存 AI 配置
  async saveAiConfig(config: AiConfig): Promise<ConfigSaveResponse> {
    return await this.request<ConfigSaveResponse>('/config/ai', {
      method: 'POST',
      body: JSON.stringify(config)
    })
  }

  // 提交搜索任务
  async submitSearch(payload: NewTaskRequest): Promise<SearchResponse> {
    return await this.request<SearchResponse>('/task/add-task', {
      method: 'POST',
      body: JSON.stringify(payload)
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

  // 转换后端任务状态为前端展示状态
  private convertTaskStatus(taskState: SearchTaskRaw['state']): TaskStatePresentation {
    return getTaskStatePresentation(taskState)
  }

  // 转换原始任务数据为前端格式
  private convertRawTask(rawTask: SearchTaskRaw): SearchTask {
    const { status, progress } = this.convertTaskStatus(rawTask.state)
    const normalizedPaperTags = (rawTask.tags.paperTag || [])
      .map((paperTag) => normalizePaperTag(paperTag))
      .filter((paperTag): paperTag is string => Boolean(paperTag))

    return {
      id: rawTask.id,
      searchPrompt: rawTask.searchPrompt,
      promptUnderstanding: rawTask.promptUnderstanding
        ? {
            ...rawTask.promptUnderstanding,
            subfields: [...rawTask.promptUnderstanding.subfields],
            keywords: [...rawTask.promptUnderstanding.keywords],
            synonyms: [...rawTask.promptUnderstanding.synonyms],
            includeTerms: [...rawTask.promptUnderstanding.includeTerms],
            excludeTerms: [...rawTask.promptUnderstanding.excludeTerms]
          }
        : null,
      tags: {
        yearTag: rawTask.tags.yearTag,
        paperTag: normalizedPaperTags,
        sourceTag: rawTask.tags.sourceTag || []
      },
      searchTime: this.formatDateTime(rawTask.searchTime),
      progress,
      status,
      errorMessage: rawTask.errorMessage
    }
  }

  // 获取搜索任务列表
  async getSearchTasks(
    params: TasksRequestParams
  ): Promise<{ tasks: SearchTask[]; total: number; page: number; pageSize: number }> {
    const requestBody: TasksRequestParams = {
      pageIndex: params.pageIndex,
      pageSize: params.pageSize
    }
    if (params.orderWord) requestBody.orderWord = params.orderWord
    if (params.orderId !== undefined) requestBody.orderId = params.orderId

    const response = await this.request<TasksResponse>(
      '/task/tasks',
      {
        method: 'POST',
        body: JSON.stringify(requestBody)
      },
      true
    ) // 使用重试
    if (response.code === 0 && response.success) {
      return {
        tasks: response.data.list.map((rawTask) => this.convertRawTask(rawTask)),
        total: response.data.total,
        page: response.data.pageNumber,
        pageSize: response.data.pageSize
      }
    } else {
      throw new Error(`API error: ${response.message}`)
    }
  }

  async getReviewTasks(params: ReviewTasksParams): Promise<ReviewTasksResponse> {
    const query = new URLSearchParams({
      pageIndex: params.pageIndex.toString(),
      pageSize: params.pageSize.toString()
    })
    const keyword = params.keyword?.trim()

    if (params.taskId && params.taskId > 0) query.set('taskId', params.taskId.toString())
    if (keyword) query.set('keyword', keyword)

    const response = await this.request<ReviewTasksResponse>(`/review/task?${query}`, {}, true)
    if (response.code !== 0 || !response.success) {
      throw new Error(response.message || '获取综述任务失败')
    }

    return {
      ...response,
      data: {
        ...response.data,
        list: response.data.list.map((review) => ({
          ...review,
          creationTime: this.formatDateTime(review.creationTime)
        }))
      }
    }
  }

  async getReviewDetail(id: number): Promise<ReviewDetailResponse> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('综述 ID 必须是大于 0 的整数')
    }

    const response = await this.request<ReviewDetailResponse>(`/review/${id}`, {}, true)
    if (response.code !== 0 || !response.success) {
      throw new Error(response.message || '获取综述详情失败')
    }

    return {
      ...response,
      data: {
        ...response.data,
        creationTime: this.formatDateTime(response.data.creationTime),
        modificationTime: this.formatDateTime(response.data.modificationTime)
      }
    }
  }

  async getReviewRender(id: number, params: ReviewRenderParams = {}): Promise<ReviewRender> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('综述 ID 必须是大于 0 的整数')
    }

    const query = new URLSearchParams()
    if (params.citationStyle) query.set('citationStyle', params.citationStyle)

    const suffix = query.toString() ? `?${query.toString()}` : ''
    const response = await this.request<ReviewRenderResponse>(`/review/${id}/render${suffix}`, {}, true)

    if (response.code !== 0 || !response.data) {
      throw new Error(response.message || '获取综述渲染内容失败')
    }

    return response.data
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

  private parsePaperReasons(reasons: PaperRaw['reasons']): string[] {
    if (!reasons) return []
    if (Array.isArray(reasons)) return reasons.map(String)

    try {
      const parsed = JSON.parse(reasons)
      return Array.isArray(parsed) ? parsed.map(String) : [reasons]
    } catch {
      return [reasons]
    }
  }

  // 转换后端原始数据为前端格式
  private convertPaperData(rawPaper: PaperRaw): Paper {
    const uniqueId = rawPaper.id.toString()
    const impactFactor = Number(rawPaper.venueInfo?.sciIf)
    const ossName = rawPaper.ossName || ''
    return {
      id: uniqueId,
      star: rawPaper.star ?? 0,
      recommendation: rawPaper.recommendation || '',
      reasons: this.parsePaperReasons(rawPaper.reasons),
      title: rawPaper.title,
      abstract: rawPaper.paperAbstract,
      authors: rawPaper.authors || [],
      year: rawPaper.publishedDate ? parseInt(rawPaper.publishedDate.slice(0, 4)) : 0,
      journal: rawPaper.venueInfo?.standardName || '',
      venueType: rawPaper.venueInfo?.type === 0 ? 'journal' : 'conference',
      ccfLevel: rawPaper.venueInfo?.ccfRank || undefined,
      sciLevel: rawPaper.venueInfo?.sciRank || undefined,
      coreLevel: rawPaper.venueInfo?.coreRank || undefined,
      jcrLevel: this.extractSciZone(rawPaper.venueInfo?.sciUp || undefined),
      sciUpFull: rawPaper.venueInfo?.sciUp || undefined,
      impactFactor: Number.isFinite(impactFactor) && impactFactor > 0 ? impactFactor : undefined,
      keywords: rawPaper.keywords || [],
      summary: rawPaper.aiAbstract,
      citations: rawPaper.citations,
      url: rawPaper.abstractUrl || rawPaper.pdfUrl,
      link: rawPaper.abstractUrl || rawPaper.pdfUrl,
      pdfUrl: rawPaper.pdfUrl,
      ossName,
      pdfFileName: ossName ? `pdf/${ossName}.pdf` : undefined,
      mdFileName: ossName ? `md/${ossName}.md` : undefined,
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
