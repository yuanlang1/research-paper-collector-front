<template>
  <div class="home-wrapper">
    <!-- 动态背景装饰 -->
    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>

    <div class="home-container">
      <h1 v-if="!hasConversation" class="main-title">论文检索器</h1>

      <!-- AI 对话区域 -->
      <div class="agent-chat-shell">
        <AgentChatPanel
          :current-filters="{
            yearTag: filterYear,
            paperTags: selectedPaperTags,
            sourceTags: selectedSources
          }"
          @message-sent="handleAgentMessage"
          @restore-filters="restoreAgentFilters"
          @conversation-changed="hasConversation = $event"
          @conversation-updated="handleConversationUpdated"
          @update:is-running="isAgentRunning = $event"
          @completed="handleAgentCompleted"
        >
          <template #filters>
            <div class="search-toolbar">
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
                  :class="{ 'filter-tag-active': selectedPaperTags.includes(tag.value) }"
                  @click="togglePaperTag(tag.value)"
                >
                  {{ tag.label }}
                  <span class="tag-close" @click.stop="removePaperTag(tag.value)">×</span>
                </span>

                <!-- 添加按钮 -->
                <div class="add-tag-wrapper" ref="addTagWrapperRef">
                  <span
                    class="filter-tag add-btn"
                    :class="{ active: showAddMenu }"
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

              <div class="search-toolbar-actions">
                <div class="source-dropdown" ref="sourceDropdownRef">
                  <div
                    class="source-trigger"
                    @click="toggleSourceMenu"
                    :style="{ minWidth: sourceSelectWidth }"
                  >
                    {{ sourceTriggerLabel }}
                  </div>
                  <transition name="fade">
                    <div v-if="showSourceMenu" class="source-options source-options-multi">
                      <div
                        class="source-option source-option-multi source-option-all"
                        :class="{ active: allSourcesSelected, partial: hasPartialSourceSelection }"
                        @click.stop="selectAllSources"
                      >
                        <span>全部来源</span>
                        <span class="source-check">{{
                          allSourcesSelected ? '✓' : hasPartialSourceSelection ? '−' : ''
                        }}</span>
                      </div>
                      <div class="source-options-divider"></div>
                      <div
                        v-for="opt in sourceOptions"
                        :key="opt.value"
                        class="source-option source-option-multi"
                        :class="{ active: isSourceSelected(opt.value) }"
                        @click.stop="toggleSource(opt.value)"
                      >
                        <span>{{ opt.label }}</span>
                        <span class="source-check">{{
                          isSourceSelected(opt.value) ? '✓' : ''
                        }}</span>
                      </div>
                    </div>
                  </transition>
                </div>
              </div>
            </div>
          </template>
        </AgentChatPanel>
      </div>
    </div>

    <button
      class="conversation-sidebar-trigger"
      type="button"
      :aria-expanded="isConversationSidebarOpen"
      @click="isConversationSidebarOpen = !isConversationSidebarOpen"
    >
      历史会话
    </button>

    <aside
      class="conversation-sidebar"
      :class="{
        'conversation-sidebar-mobile-open': isConversationSidebarOpen,
        'conversation-sidebar-resizing': isConversationSidebarResizing
      }"
      :style="conversationSidebarStyle"
      aria-label="历史会话"
    >
      <div
        class="conversation-sidebar-resize-handle"
        :class="{ 'conversation-sidebar-resize-handle-active': isConversationSidebarResizing }"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整历史会话侧边栏宽度"
        @pointerdown="startConversationSidebarResize"
      ></div>
      <div class="conversation-sidebar-brand">Paper Research</div>
      <button
        class="new-conversation-button"
        type="button"
        :disabled="isAgentRunning"
        @click="startNewConversation"
      >
        <span aria-hidden="true">＋</span>
        开启新对话
      </button>

      <div class="conversation-sidebar-heading">历史会话</div>
      <div class="conversation-sidebar-list">
        <div v-if="isConversationsLoading" class="conversation-loading-list" aria-label="正在加载历史会话">
          <span v-for="index in 5" :key="index" class="conversation-loading-row"></span>
        </div>
        <p v-else-if="conversationLoadError" class="conversation-load-error">
          {{ conversationLoadError }}
          <button type="button" @click="fetchConversations">重试</button>
        </p>
        <p v-else-if="!conversations.length" class="conversation-empty-state">你的历史对话会显示在这里。</p>
        <button
          v-for="conversation in conversations"
          :key="conversation.conversation_id"
          class="conversation-row"
          :class="{ 'conversation-row-active': selectedConversationId === conversation.conversation_id }"
          type="button"
          :disabled="isAgentRunning || isConversationLoading"
          :title="conversation.title"
          @click="openConversation(conversation.conversation_id)"
        >
          <span class="conversation-row-title">{{ conversation.title || '未命名对话' }}</span>
          <span class="conversation-row-preview">{{ conversation.last_message_preview }}</span>
        </button>
      </div>
    </aside>

    <button class="settings-trigger" type="button" @click="openSettingsModal">设置</button>

    <div class="task-entry-actions">
      <button class="tasks-trigger" type="button" @click="openTasksView">检索任务</button>
      <button class="review-tasks-trigger" type="button" @click="openReviewTasksView">综述任务</button>
    </div>

    <transition name="settings-fade">
      <div v-if="isSettingsOpen" class="settings-overlay" @click="closeSettingsModal"></div>
    </transition>

    <transition name="settings-pop">
      <section v-if="isSettingsOpen" class="settings-modal" @click.stop>
        <header class="settings-header">
          <div>
            <p class="settings-eyebrow">Configuration</p>
            <h2>系统设置</h2>
          </div>
          <button
            class="settings-close"
            type="button"
            aria-label="关闭设置"
            @click="closeSettingsModal"
          >
            ×
          </button>
        </header>

        <div class="settings-tabs">
          <button
            class="settings-tab"
            :class="{ active: activeSettingsTab === 'strategy' }"
            type="button"
            @click="activeSettingsTab = 'strategy'"
          >
            检索源
          </button>
          <button
            class="settings-tab"
            :class="{ active: activeSettingsTab === 'ai' }"
            type="button"
            @click="activeSettingsTab = 'ai'"
          >
            旧检索 AI 设置
          </button>
        </div>

        <div
          v-if="settingsMessage"
          class="settings-message"
          :class="`settings-message-${settingsMessageType}`"
        >
          {{ settingsMessage }}
        </div>

        <div class="settings-body">
          <div v-if="activeSettingsTab === 'strategy'" class="settings-panel">
            <div class="settings-panel-title">
              <h3>检索源策略</h3>
              <button
                class="settings-secondary-btn"
                type="button"
                :disabled="isStrategyLoading"
                @click="loadStrategyConfig"
              >
                刷新
              </button>
            </div>

            <div v-if="isStrategyLoading" class="settings-loading">正在加载检索源配置...</div>
            <div v-else-if="!strategyConfigs.length" class="settings-empty">暂无检索源配置</div>
            <div v-else class="strategy-table-wrapper">
              <table class="strategy-table">
                <thead>
                  <tr>
                    <th>来源</th>
                    <th>名称</th>
                    <th>总数量</th>
                    <th>启用</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="config in strategyConfigs" :key="config.source">
                    <td class="strategy-source">{{ config.source }}</td>
                    <td class="strategy-name">{{ config.name }}</td>
                    <td>
                      <input
                        v-model.number="config.totalCount"
                        class="settings-input small"
                        type="number"
                        min="1"
                        max="2000"
                      />
                    </td>
                    <td>
                      <label class="settings-switch">
                        <input v-model="config.enabled" type="checkbox" />
                        <span></span>
                      </label>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="settings-actions">
              <button
                class="settings-primary-btn"
                type="button"
                :disabled="isStrategySaving"
                @click="saveStrategyConfig"
              >
                {{ isStrategySaving ? '保存中...' : '整体保存' }}
              </button>
            </div>
          </div>

          <div v-else class="settings-panel">
            <div class="settings-panel-title">
              <h3>旧检索 AI 配置</h3>
              <button
                class="settings-secondary-btn"
                type="button"
                :disabled="isAiLoading"
                @click="loadAiConfig"
              >
                刷新
              </button>
            </div>

            <div v-if="isAiLoading" class="settings-loading">正在加载 AI 配置...</div>
            <div v-else class="ai-settings-grid">
              <label class="settings-field">
                <span>Provider</span>
                <select v-model="aiConfig.provider" class="settings-input">
                  <option value="DASHSCOPE">DASHSCOPE</option>
                  <option value="OPENAI_COMPATIBLE">OPENAI_COMPATIBLE</option>
                </select>
              </label>
              <label class="settings-field">
                <span>Base URL</span>
                <input
                  v-model="aiConfig.baseUrl"
                  class="settings-input"
                  type="text"
                  placeholder="https://api.deepseek.com"
                />
              </label>
              <label class="settings-field">
                <span>模型</span>
                <input
                  v-model="aiConfig.model"
                  class="settings-input"
                  type="text"
                  placeholder="deepseek-chat"
                />
              </label>
              <label class="settings-field settings-field-full">
                <span>API Key</span>
                <input
                  v-model="aiApiKeyInput"
                  class="settings-input"
                  type="password"
                  placeholder="sk-xxxx"
                  autocomplete="off"
                />
              </label>
              <label class="settings-field">
                <span>Temperature</span>
                <input
                  v-model.number="aiConfig.temperature"
                  class="settings-input"
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                />
              </label>
              <label class="settings-field">
                <span>Max Tokens</span>
                <input
                  v-model.number="aiConfig.maxTokens"
                  class="settings-input"
                  type="number"
                  min="1"
                />
              </label>
              <label class="settings-field">
                <span>Timeout(ms)</span>
                <input
                  v-model.number="aiConfig.timeoutMs"
                  class="settings-input"
                  type="number"
                  min="1000"
                />
              </label>
            </div>

            <div class="settings-actions">
              <button
                class="settings-primary-btn"
                type="button"
                :disabled="isAiSaving"
                @click="saveAiConfig"
              >
                {{ isAiSaving ? '保存中...' : '保存 AI 设置' }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </transition>

    <button
      v-if="hasSearchHistory && !isRecentDrawerOpen"
      class="recent-drawer-trigger"
      type="button"
      @click="openRecentDrawer"
    >
      最近任务
    </button>

    <transition name="drawer-fade">
      <div v-if="isRecentDrawerOpen" class="recent-drawer-overlay" @click="closeRecentDrawer"></div>
    </transition>

    <transition name="drawer-slide">
      <aside
        v-if="isRecentDrawerOpen"
        class="recent-drawer"
        :class="{ 'recent-drawer-resizing': isRecentDrawerResizing }"
        :style="recentDrawerStyle"
        @click.stop
      >
        <div
          class="recent-drawer-resize-handle"
          :class="{ 'recent-drawer-resize-handle-active': isRecentDrawerResizing }"
          @pointerdown="startRecentDrawerResize"
        ></div>
        <div class="recent-drawer-header">
          <div>
            <p class="recent-drawer-eyebrow">History</p>
            <h3>历史检索任务</h3>
            <p class="recent-drawer-summary">共 {{ totalRecords }} 条历史记录</p>
          </div>
          <button
            class="recent-drawer-close"
            type="button"
            aria-label="关闭最近搜索侧栏"
            @click="closeRecentDrawer"
          >
            ×
          </button>
        </div>

        <div class="recent-search-panel">
          <div v-if="isRecentSearchesLoading" class="recent-search-empty-state">
            正在加载最近搜索...
          </div>
          <div v-else class="recent-search-list">
            <button
              v-for="search in recentSearches"
              :key="search.id"
              class="recent-search-row"
              :class="{ 'recent-search-row-active': selectedHistoryId === search.id }"
              type="button"
              @click="handleRecentSearchClick(search)"
            >
              <span class="recent-search-prompt">{{ search.prompt }}</span>
              <span class="recent-search-time">{{ search.searchTime }}</span>
            </button>
          </div>
          <div
            v-if="!isRecentSearchesLoading && !recentSearches.length"
            class="recent-search-empty-state"
          >
            暂无最近搜索记录
          </div>
        </div>
      </aside>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import AgentChatPanel from '@/components/AgentChatPanel.vue'
import { agentService, type AgentConversationSummary } from '@/services/agentService'
import {
  apiService,
  type AiConfig,
  type QueryUnderstanding,
  type SearchStrategyConfig
} from '@/services/api'
import {
  DEFAULT_VISIBLE_PAPER_TAGS,
  PAPER_TAG_POOL,
  SOURCE_OPTIONS,
  type PaperTagItem,
  type PaperTagValue,
  type SourceTag
} from '@/constants/searchTagMappings'
import { useAgentChatStore } from '@/stores/agentChat'

// 路由
const router = useRouter()

const agentChatStore = useAgentChatStore()
const conversations = ref<AgentConversationSummary[]>([])
const selectedConversationId = ref<string | null>(null)
const isConversationsLoading = ref(false)
const isConversationLoading = ref(false)
const conversationLoadError = ref('')
const isAgentRunning = ref(false)
const isConversationSidebarOpen = ref(false)
const isConversationSidebarResizing = ref(false)
const CONVERSATION_SIDEBAR_DEFAULT_WIDTH = 248
const CONVERSATION_SIDEBAR_MIN_WIDTH = 220
const CONVERSATION_SIDEBAR_MAX_WIDTH = 420
const CONVERSATION_SIDEBAR_OUTER_GAP = 36
const conversationSidebarWidth = ref(CONVERSATION_SIDEBAR_DEFAULT_WIDTH)

const getConversationSidebarBounds = () => {
  const viewportMaxWidth = Math.max(280, viewportWidth.value - CONVERSATION_SIDEBAR_OUTER_GAP)
  const maxWidth = Math.min(CONVERSATION_SIDEBAR_MAX_WIDTH, viewportMaxWidth)
  const minWidth = Math.min(CONVERSATION_SIDEBAR_MIN_WIDTH, maxWidth)

  return { minWidth, maxWidth }
}

const clampConversationSidebarWidth = (width: number) => {
  const { minWidth, maxWidth } = getConversationSidebarBounds()
  return Math.min(maxWidth, Math.max(minWidth, width))
}

const conversationSidebarStyle = computed(() => ({
  width: `${clampConversationSidebarWidth(conversationSidebarWidth.value)}px`
}))

const fetchConversations = async () => {
  try {
    isConversationsLoading.value = true
    conversationLoadError.value = ''
    const response = await agentService.getConversations(30)
    if (response.code !== 0 || !response.success) {
      throw new Error(response.message || '加载历史会话失败')
    }
    conversations.value = response.data.items
  } catch (error) {
    console.error('加载历史会话失败:', error)
    conversationLoadError.value = error instanceof Error ? error.message : '加载历史会话失败'
  } finally {
    isConversationsLoading.value = false
  }
}

const startNewConversation = () => {
  if (isAgentRunning.value) return
  agentChatStore.resetConversation()
  selectedConversationId.value = null
  isConversationSidebarOpen.value = false
}

const startConversationSidebarResize = (event: PointerEvent) => {
  if (window.innerWidth <= 1100) return
  isConversationSidebarResizing.value = true
  conversationSidebarWidth.value = clampConversationSidebarWidth(event.clientX - 18)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  event.preventDefault()
}

const handleConversationSidebarResize = (event: PointerEvent) => {
  if (!isConversationSidebarResizing.value) return
  conversationSidebarWidth.value = clampConversationSidebarWidth(event.clientX - 18)
}

const stopConversationSidebarResize = () => {
  if (!isConversationSidebarResizing.value) return
  isConversationSidebarResizing.value = false
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

const openConversation = async (conversationId: string) => {
  if (isAgentRunning.value || isConversationLoading.value) return

  try {
    isConversationLoading.value = true
    conversationLoadError.value = ''
    const response = await agentService.getConversationMessages(conversationId)
    if (response.code !== 0 || !response.success) {
      throw new Error(response.message || '加载历史消息失败')
    }
    agentChatStore.loadConversation(response.data.items)
    selectedConversationId.value = response.data.conversation_id
    isConversationSidebarOpen.value = false
  } catch (error) {
    console.error('加载历史消息失败:', error)
    conversationLoadError.value = error instanceof Error ? error.message : '加载历史消息失败'
  } finally {
    isConversationLoading.value = false
  }
}

const handleConversationUpdated = async (conversationId: string) => {
  selectedConversationId.value = conversationId
  await fetchConversations()
}

const handleAgentCompleted = async () => {
  await fetchRecentSearches()
}

// 设置弹窗状态
const hasConversation = ref(false)

const isSettingsOpen = ref(false)
const activeSettingsTab = ref<'strategy' | 'ai'>('strategy')
const strategyConfigs = ref<SearchStrategyConfig[]>([])
const isStrategyLoading = ref(false)
const isStrategySaving = ref(false)
const isAiLoading = ref(false)
const isAiSaving = ref(false)
const settingsMessage = ref('')
const settingsMessageType = ref<'success' | 'error'>('success')
const aiConfig = ref<AiConfig>({
  provider: 'DASHSCOPE',
  baseUrl: '',
  model: '',
  apiKey: '',
  temperature: 0.3,
  maxTokens: 2048,
  timeoutMs: 60000
})

const aiApiKeyInput = computed({
  get: () => aiConfig.value.apiKey,
  set: (value: string) => {
    aiConfig.value.apiKey = value
  }
})

const showSettingsMessage = (message: string, type: 'success' | 'error' = 'success') => {
  settingsMessage.value = message
  settingsMessageType.value = type
}

const normalizeStrategyTotalCount = (value: number) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 1
  return Math.min(2000, Math.max(1, Math.trunc(numericValue)))
}

const normalizeStrategyConfig = (item: SearchStrategyConfig): SearchStrategyConfig => ({
  source: item.source,
  name: item.name,
  totalCount: normalizeStrategyTotalCount(item.totalCount),
  enabled: item.enabled
})

const normalizeAiConfig = (config: Partial<AiConfig>): AiConfig => ({
  provider: config.provider ?? 'DASHSCOPE',
  baseUrl: config.baseUrl ?? '',
  model: config.model ?? '',
  apiKey: config.apiKey ?? '',
  temperature: config.temperature ?? 0.3,
  maxTokens: config.maxTokens ?? 2048,
  timeoutMs: config.timeoutMs ?? 60000
})

const loadStrategyConfig = async () => {
  try {
    isStrategyLoading.value = true
    const response = await apiService.getSearchStrategyConfig()
    if (response.code === 0 && response.success) {
      strategyConfigs.value = response.data.map((item) => normalizeStrategyConfig(item))
    } else {
      showSettingsMessage(response.message || '检索源配置加载失败', 'error')
    }
  } catch (error) {
    console.error('加载检索源配置失败:', error)
    showSettingsMessage('检索源配置加载失败', 'error')
  } finally {
    isStrategyLoading.value = false
  }
}

const loadAiConfig = async () => {
  try {
    isAiLoading.value = true
    const response = await apiService.getAiConfig()
    if (response.code === 0 && response.data) {
      aiConfig.value = normalizeAiConfig(response.data)
    } else {
      showSettingsMessage(response.message || 'AI 配置加载失败', 'error')
    }
  } catch (error) {
    console.error('加载 AI 配置失败:', error)
    showSettingsMessage('AI 配置加载失败', 'error')
  } finally {
    isAiLoading.value = false
  }
}

const openTasksView = () => {
  router.push({ name: 'tasks' })
}

const openReviewTasksView = () => {
  router.push({ name: 'review-tasks' })
}

const openSettingsModal = async () => {
  isSettingsOpen.value = true
  settingsMessage.value = ''

  if (!strategyConfigs.value.length) {
    await loadStrategyConfig()
  }
  if (!aiConfig.value.baseUrl && !aiConfig.value.model) {
    await loadAiConfig()
  }
}

const closeSettingsModal = () => {
  isSettingsOpen.value = false
}

const saveStrategyConfig = async () => {
  try {
    isStrategySaving.value = true
    settingsMessage.value = ''
    const response = await apiService.saveSearchStrategyConfig(
      strategyConfigs.value.map((item) => normalizeStrategyConfig(item))
    )
    if (response.code === 0 && response.data === true) {
      showSettingsMessage('检索源配置保存成功')
    } else {
      showSettingsMessage(response.message || '检索源配置保存失败', 'error')
    }
  } catch (error) {
    console.error('保存检索源配置失败:', error)
    showSettingsMessage('检索源配置保存失败', 'error')
  } finally {
    isStrategySaving.value = false
  }
}

const saveAiConfig = async () => {
  try {
    isAiSaving.value = true
    settingsMessage.value = ''
    const response = await apiService.saveAiConfig(normalizeAiConfig(aiConfig.value))
    if (response.code === 0 && response.data === true) {
      showSettingsMessage('AI 配置保存成功')
    } else {
      showSettingsMessage(response.message || 'AI 配置保存失败', 'error')
    }
  } catch (error) {
    console.error('保存 AI 配置失败:', error)
    showSettingsMessage('AI 配置保存失败', 'error')
  } finally {
    isAiSaving.value = false
  }
}

// 最近搜索状态
interface RecentSearchListItem {
  id: number
  prompt: string
  searchTime: string
}

const recentSearches = ref<RecentSearchListItem[]>([])
const totalRecords = ref(0)
const selectedHistoryId = ref<number | null>(null)
const isRecentDrawerOpen = ref(false)
const isRecentDrawerResizing = ref(false)
const isRecentSearchesLoading = ref(false)
const recentSearchPageSize = 10
const RECENT_DRAWER_DEFAULT_WIDTH = 420
const RECENT_DRAWER_MIN_WIDTH = 360
const RECENT_DRAWER_MAX_WIDTH = 760
const RECENT_DRAWER_OUTER_GAP = 20
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1440)
const recentDrawerWidth = ref(RECENT_DRAWER_DEFAULT_WIDTH)

const getRecentDrawerBounds = () => {
  const viewportMaxWidth = Math.max(320, viewportWidth.value - RECENT_DRAWER_OUTER_GAP)
  const maxWidth = Math.min(RECENT_DRAWER_MAX_WIDTH, viewportMaxWidth)
  const minWidth = Math.min(RECENT_DRAWER_MIN_WIDTH, maxWidth)

  return { minWidth, maxWidth }
}

const clampRecentDrawerWidth = (width: number) => {
  const { minWidth, maxWidth } = getRecentDrawerBounds()
  return Math.min(maxWidth, Math.max(minWidth, width))
}

const recentDrawerRenderWidth = computed(() => clampRecentDrawerWidth(recentDrawerWidth.value))

const recentDrawerStyle = computed(() => ({
  width: `${recentDrawerRenderWidth.value}px`
}))

// 获取最近搜索并展开为连续列表
const fetchRecentSearches = async () => {
  try {
    isRecentSearchesLoading.value = true

    const mergedRecentSearches: RecentSearchListItem[] = []
    let pageNumber = 1
    let totalPages = 1
    let total = 0

    while (pageNumber <= totalPages) {
      const response = await apiService.getSearchHistoryWithPagination(
        pageNumber,
        recentSearchPageSize
      )

      mergedRecentSearches.push(
        ...response.data.list.map((item) => ({
          id: item.id,
          prompt: item.searchPrompt,
          searchTime: item.searchTime
        }))
      )

      totalPages = response.data.pages || 1
      total = response.data.total || mergedRecentSearches.length
      pageNumber += 1
    }

    recentSearches.value = mergedRecentSearches
    totalRecords.value = total
  } catch (error) {
    console.error('获取最近搜索失败:', error)
  } finally {
    isRecentSearchesLoading.value = false
  }
}

const openRecentDrawer = () => {
  isRecentDrawerOpen.value = !isRecentDrawerOpen.value
}

const closeRecentDrawer = () => {
  isRecentDrawerOpen.value = false
  stopRecentDrawerResize()
}

const startRecentDrawerResize = (event: PointerEvent) => {
  isRecentDrawerResizing.value = true
  recentDrawerWidth.value = clampRecentDrawerWidth(window.innerWidth - event.clientX)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  event.preventDefault()
}

const handleRecentDrawerResize = (event: PointerEvent) => {
  if (!isRecentDrawerResizing.value) return
  recentDrawerWidth.value = clampRecentDrawerWidth(window.innerWidth - event.clientX)
}

const stopRecentDrawerResize = () => {
  if (!isRecentDrawerResizing.value) return
  isRecentDrawerResizing.value = false
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

const handleViewportResize = () => {
  viewportWidth.value = window.innerWidth
  recentDrawerWidth.value = clampRecentDrawerWidth(recentDrawerWidth.value)
  conversationSidebarWidth.value = clampConversationSidebarWidth(conversationSidebarWidth.value)
}

// 搜索相关状态
const searchQuery = ref('')
const DEFAULT_EDIT_YEAR = 2026
const yearTags = ref<number[]>([3, 5])
const selectedYearIndex = ref<number | null>(null)
const filterYear = ref(0)

const getCurrentYear = () => DEFAULT_EDIT_YEAR

const updateYearTagSelectionOnly = (recentYears: number) => {
  if (!recentYears || recentYears <= 0) {
    selectedYearIndex.value = null
    filterYear.value = 0
    return
  }

  const index = yearTags.value.indexOf(recentYears)
  if (index === -1) {
    selectedYearIndex.value = null
    filterYear.value = 0
    return
  }

  selectedYearIndex.value = index
  filterYear.value = recentYears
}

const syncStructuredQueryYearRange = (recentYears: number) => {
  if (!structuredQuery.value) return

  if (!recentYears || recentYears <= 0) {
    structuredQuery.value.yearFrom = null
    structuredQuery.value.yearTo = null
    updateYearTagSelectionOnly(0)
    return
  }

  const currentYear = getCurrentYear()
  structuredQuery.value.yearFrom = currentYear - recentYears + 1
  structuredQuery.value.yearTo = currentYear
  updateYearTagSelectionOnly(recentYears)
}

const syncToolbarTagFromStructuredYears = () => {
  if (!structuredQuery.value) return

  const { yearFrom, yearTo } = structuredQuery.value
  if (yearFrom == null || yearTo == null) {
    updateYearTagSelectionOnly(0)
    return
  }

  const recentYears = yearTo - yearFrom + 1
  updateYearTagSelectionOnly(recentYears)
}

const initializeYearRangeOnEdit = () => {
  if (!structuredQuery.value) return

  if (structuredQuery.value.yearFrom == null) {
    structuredQuery.value.yearFrom = DEFAULT_EDIT_YEAR
  }

  if (structuredQuery.value.yearTo == null) {
    structuredQuery.value.yearTo = DEFAULT_EDIT_YEAR
  }

  if (structuredQuery.value.yearFrom > structuredQuery.value.yearTo) {
    structuredQuery.value.yearTo = structuredQuery.value.yearFrom
  }

  syncToolbarTagFromStructuredYears()
}

const selectYearTag = (index: number) => {
  if (selectedYearIndex.value === index) {
    selectedYearIndex.value = null
    filterYear.value = 0
    syncStructuredQueryYearRange(0)
  } else {
    selectedYearIndex.value = index
    filterYear.value = yearTags.value[index]
    syncStructuredQueryYearRange(filterYear.value)
  }
}

const removeYearTag = (index: number) => {
  yearTags.value.splice(index, 1)

  if (selectedYearIndex.value === index) {
    selectedYearIndex.value = null
    filterYear.value = 0
    syncStructuredQueryYearRange(0)
  } else if (selectedYearIndex.value !== null && selectedYearIndex.value > index) {
    selectedYearIndex.value--
  } else {
    syncToolbarTagFromStructuredYears()
  }
}

// 论文标签相关
const paperTagPool: PaperTagItem[] = PAPER_TAG_POOL

const visiblePaperTags = ref<PaperTagItem[]>([...DEFAULT_VISIBLE_PAPER_TAGS])

const selectedPaperTags = ref<PaperTagValue[]>([])

const togglePaperTag = (tagValue: PaperTagValue) => {
  selectedPaperTags.value = selectedPaperTags.value.includes(tagValue)
    ? selectedPaperTags.value.filter((value) => value !== tagValue)
    : [...selectedPaperTags.value, tagValue]
}

const removePaperTag = (tagValue: PaperTagValue) => {
  const index = visiblePaperTags.value.findIndex((t) => t.value === tagValue)
  if (index !== -1) {
    visiblePaperTags.value.splice(index, 1)
    selectedPaperTags.value = selectedPaperTags.value.filter((value) => value !== tagValue)
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
    syncStructuredQueryYearRange(year)
    showAddMenu.value = false
  }
}

const addPaperTagToBar = (tag: PaperTagItem) => {
  if (!visiblePaperTags.value.find((t) => t.value === tag.value)) {
    visiblePaperTags.value.push(tag)
  }
  // 选中该标签
  selectedPaperTags.value = [tag.value]
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

// 数据来源标签：sourceTag 多选（未选择表示全选）
const selectedSources = ref<SourceTag[]>([])
const sourceOptions = SOURCE_OPTIONS

const sourceTriggerLabel = computed(() => {
  if (selectedSources.value.length === 0) {
    return '全部来源'
  }

  return sourceOptions
    .filter((opt) => selectedSources.value.includes(opt.value))
    .map((opt) => opt.label)
    .join(', ')
})

const allSourcesSelected = computed(
  () => selectedSources.value.length === 0 || selectedSources.value.length === sourceOptions.length
)
const hasPartialSourceSelection = computed(
  () => selectedSources.value.length > 0 && selectedSources.value.length < sourceOptions.length
)

const handleAgentMessage = (message: string) => {
  searchQuery.value = message
}

const restoreAgentFilters = (filters: {
  yearTag: number
  paperTags: PaperTagValue[]
  sourceTags: SourceTag[]
}) => {
  if (filters.yearTag > 0) {
    if (!yearTags.value.includes(filters.yearTag)) {
      yearTags.value.push(filters.yearTag)
      yearTags.value.sort((left, right) => left - right)
    }
    selectedYearIndex.value = yearTags.value.indexOf(filters.yearTag)
    filterYear.value = filters.yearTag
    syncStructuredQueryYearRange(filters.yearTag)
  } else {
    selectedYearIndex.value = null
    filterYear.value = 0
    syncStructuredQueryYearRange(0)
  }

  filters.paperTags.forEach((tagValue) => {
    const tag = paperTagPool.find((item) => item.value === tagValue)
    if (tag && !visiblePaperTags.value.some((item) => item.value === tagValue)) {
      visiblePaperTags.value.push(tag)
    }
  })
  selectedPaperTags.value = [...filters.paperTags]
  selectedSources.value = [...filters.sourceTags]
}

// source 下拉逻辑
const showSourceMenu = ref(false)
const sourceDropdownRef = ref<HTMLElement | null>(null)
const sourceSelectWidth = ref('auto')

const toggleSourceMenu = () => {
  showSourceMenu.value = !showSourceMenu.value
}

const isSourceSelected = (value: SourceTag) => selectedSources.value.includes(value)

const selectAllSources = () => {
  selectedSources.value = []
}

const toggleSource = (value: SourceTag) => {
  const currentSources =
    selectedSources.value.length === 0
      ? sourceOptions.map((option) => option.value)
      : selectedSources.value
  const nextSources = currentSources.includes(value)
    ? currentSources.filter((item) => item !== value)
    : [...currentSources, value]

  selectedSources.value = nextSources.length === sourceOptions.length ? [] : nextSources
}

const updateSourceSelectWidth = () => {
  const text = sourceTriggerLabel.value
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

watch(
  selectedSources,
  () => {
    updateSourceSelectWidth()
  },
  { deep: true }
)

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', handleViewportResize)
  window.addEventListener('pointermove', handleRecentDrawerResize)
  window.addEventListener('pointermove', handleConversationSidebarResize)
  window.addEventListener('pointerup', stopRecentDrawerResize)
  window.addEventListener('pointerup', stopConversationSidebarResize)
  window.addEventListener('pointercancel', stopRecentDrawerResize)
  window.addEventListener('pointercancel', stopConversationSidebarResize)
  nextTick(() => {
    handleViewportResize()
    updateSourceSelectWidth()
  })
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', handleViewportResize)
  window.removeEventListener('pointermove', handleRecentDrawerResize)
  window.removeEventListener('pointermove', handleConversationSidebarResize)
  window.removeEventListener('pointerup', stopRecentDrawerResize)
  window.removeEventListener('pointerup', stopConversationSidebarResize)
  window.removeEventListener('pointercancel', stopRecentDrawerResize)
  window.removeEventListener('pointercancel', stopConversationSidebarResize)
  stopRecentDrawerResize()
  stopConversationSidebarResize()
  if (extractTimer) {
    clearTimeout(extractTimer)
  }
})

// 查询理解相关状态
const structuredQuery = ref<QueryUnderstanding | null>(null)
let latestUnderstandRequestId = 0

const syncStructuredQueryYearRangeOnly = (recentYears: number) => {
  if (!structuredQuery.value) return

  if (!recentYears || recentYears <= 0) {
    structuredQuery.value.yearFrom = null
    structuredQuery.value.yearTo = null
    return
  }

  const currentYear = getCurrentYear()
  structuredQuery.value.yearFrom = currentYear - recentYears + 1
  structuredQuery.value.yearTo = currentYear
}

// 计算属性：是否有搜索历史
const hasSearchHistory = computed(() => {
  return recentSearches.value.length > 0
})

const understandQuery = (query: string) => {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    structuredQuery.value = null
    return
  }

  structuredQuery.value = buildDefaultStructuredQuery(trimmedQuery)
  syncStructuredQueryYearRangeOnly(filterYear.value)
}

// 监听对话输入，自动生成供 Agent 确认恢复使用的查询理解上下文
let extractTimer: ReturnType<typeof setTimeout>
watch(searchQuery, (newQuery) => {
  if (extractTimer) {
    clearTimeout(extractTimer)
  }

  if (!newQuery.trim()) {
    latestUnderstandRequestId += 1
    structuredQuery.value = null
    return
  }

  const requestId = ++latestUnderstandRequestId
  extractTimer = setTimeout(() => {
    if (requestId === latestUnderstandRequestId) {
      understandQuery(newQuery)
    }
  }, 300)
})

const buildDefaultStructuredQuery = (
  topic: string = searchQuery.value.trim()
): QueryUnderstanding => ({
  topic,
  subfields: [],
  intent: 'mixed',
  yearFrom: null,
  yearTo: null,
  keywords: [],
  synonyms: [],
  includeTerms: [],
  excludeTerms: [],
  requiresCode: false,
  reasoning: ''
})

const resetStructuredQuery = () => {
  structuredQuery.value = null
  updateYearTagSelectionOnly(0)
}

// 最近搜索点击处理 - 直接跳转到SearchResult页面
const handleRecentSearchClick = (search: RecentSearchListItem) => {
  selectedHistoryId.value = search.id
  closeRecentDrawer()

  router.push({
    name: 'search-results',
    query: {
      taskId: search.id.toString()
    }
  })
}

// 组件挂载时获取最近搜索
onMounted(() => {
  fetchRecentSearches()
  fetchConversations()
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

.settings-trigger,
.tasks-trigger,
.review-tasks-trigger {
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 999px;
  padding: 10px 18px;
  color: #4f5f82;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 14px 34px rgba(101, 119, 187, 0.18);
  backdrop-filter: blur(16px);
  transition: all 0.2s ease;
}

.settings-trigger {
  position: fixed;
  top: 24px;
  z-index: 30;
  right: 28px;
}

.task-entry-actions {
  position: fixed;
  top: 24px;
  z-index: 30;
  right: 110px;
  display: flex;
  gap: 10px;
}

.settings-trigger:hover,
.tasks-trigger:hover,
.review-tasks-trigger:hover {
  color: #1890ff;
  transform: translateY(-1px);
  box-shadow: 0 18px 42px rgba(101, 119, 187, 0.24);
}

.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(15, 23, 42, 0.32);
  backdrop-filter: blur(4px);
}

.settings-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 90;
  width: min(980px, calc(100vw - 36px));
  max-height: min(760px, calc(100vh - 36px));
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 30px 90px rgba(15, 23, 42, 0.28);
  backdrop-filter: blur(20px);
}

.settings-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 28px 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.settings-eyebrow {
  margin: 0 0 5px;
  color: #8b95aa;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.settings-header h2 {
  margin: 0;
  color: #1f2937;
  font-size: 26px;
  line-height: 1.2;
}

.settings-close {
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 50%;
  background: rgba(241, 245, 249, 0.86);
  color: #64748b;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings-close:hover {
  background: #e2e8f0;
  color: #ef4444;
}

.settings-tabs {
  display: flex;
  gap: 10px;
  padding: 16px 28px 0;
}

.settings-tab {
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 999px;
  padding: 9px 18px;
  background: rgba(255, 255, 255, 0.72);
  color: #64748b;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings-tab.active,
.settings-tab:hover {
  border-color: #1890ff;
  background: #1890ff;
  color: #ffffff;
}

.settings-message {
  margin: 14px 28px 0;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  text-align: left;
}

.settings-message-success {
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
}

.settings-message-error {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.12);
}

.settings-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 18px 28px 28px;
}

.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.settings-panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.settings-panel-title h3 {
  margin: 0;
  color: #334155;
  font-size: 18px;
}

.settings-secondary-btn,
.settings-primary-btn {
  border: none;
  border-radius: 999px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings-secondary-btn {
  padding: 8px 14px;
  color: #475569;
  background: rgba(226, 232, 240, 0.78);
}

.settings-primary-btn {
  padding: 11px 22px;
  color: #ffffff;
  background: linear-gradient(135deg, #667eea 0%, #1890ff 100%);
  box-shadow: 0 12px 28px rgba(24, 144, 255, 0.24);
}

.settings-secondary-btn:disabled,
.settings-primary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.settings-loading,
.settings-empty {
  padding: 42px 20px;
  border-radius: 18px;
  color: #64748b;
  background: rgba(248, 250, 252, 0.82);
  text-align: center;
}

.strategy-table-wrapper {
  overflow: auto;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
}

.strategy-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 820px;
}

.strategy-table th,
.strategy-table td {
  padding: 12px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  color: #334155;
  font-size: 13px;
  text-align: left;
  vertical-align: middle;
}

.strategy-table th {
  color: #64748b;
  font-weight: 800;
  background: rgba(248, 250, 252, 0.86);
}

.strategy-table tr:last-child td {
  border-bottom: none;
}

.strategy-source,
.strategy-name {
  font-weight: 700;
  white-space: nowrap;
}

.settings-input {
  width: 100%;
  height: 38px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 10px;
  padding: 0 12px;
  color: #1f2937;
  background: rgba(255, 255, 255, 0.92);
  outline: none;
  transition: all 0.2s ease;
}

.settings-input.small {
  width: 96px;
}

.settings-input:focus {
  border-color: #1890ff;
  box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.1);
}

.settings-switch {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.settings-switch input {
  display: none;
}

.settings-switch span {
  position: relative;
  width: 42px;
  height: 24px;
  border-radius: 999px;
  background: #cbd5e1;
  transition: all 0.2s ease;
}

.settings-switch span::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);
  transition: all 0.2s ease;
}

.settings-switch input:checked + span {
  background: #1890ff;
}

.settings-switch input:checked + span::after {
  transform: translateX(18px);
}

.ai-settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 800;
  text-align: left;
}

.settings-field-full {
  grid-column: 1 / -1;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
}

.settings-fade-enter-active,
.settings-fade-leave-active,
.settings-pop-enter-active,
.settings-pop-leave-active {
  transition: all 0.2s ease;
}

.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}

.settings-pop-enter-from,
.settings-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, -48%) scale(0.98);
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
  0%,
  100% {
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

.conversation-sidebar {
  position: fixed;
  isolation: isolate;
  z-index: 20;
  top: 18px;
  bottom: 18px;
  left: 18px;
  display: flex;
  width: 248px;
  flex-direction: column;
  padding: 16px 12px 12px;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 18px;
  background: rgba(246, 249, 255, 0.78);
  box-shadow: 0 18px 42px rgba(69, 86, 137, 0.14);
  backdrop-filter: blur(18px);
}

.conversation-sidebar-resize-handle {
  position: absolute;
  z-index: 1;
  top: 0;
  right: -7px;
  bottom: 0;
  width: 14px;
  cursor: col-resize;
}

.conversation-sidebar-resize-handle::after {
  position: absolute;
  top: 50%;
  left: 5px;
  width: 3px;
  height: 38px;
  border-radius: 999px;
  content: '';
  background: rgba(82, 104, 188, 0.46);
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity 0.16s ease;
}

.conversation-sidebar:hover .conversation-sidebar-resize-handle::after,
.conversation-sidebar-resize-handle-active::after {
  opacity: 1;
}

.conversation-sidebar-resizing {
  user-select: none;
}

.conversation-sidebar-trigger {
  display: none;
}

.conversation-sidebar-brand {
  padding: 2px 8px 14px;
  color: #394968;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.new-conversation-button {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(82, 104, 188, 0.34);
  border-radius: 12px;
  color: #3d5195;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.88);
  transition: transform 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
}

.new-conversation-button span {
  font-size: 18px;
  font-weight: 400;
  line-height: 1;
}

.new-conversation-button:hover:not(:disabled) {
  background: #eef2ff;
  box-shadow: 0 8px 18px rgba(82, 104, 188, 0.16);
  transform: translateY(-1px);
}

.new-conversation-button:active:not(:disabled) {
  transform: translateY(0);
}

.new-conversation-button:disabled,
.conversation-row:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.conversation-sidebar-heading {
  padding: 24px 8px 10px;
  color: #7b879e;
  font-size: 12px;
  font-weight: 700;
}

.conversation-sidebar-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 0 2px 4px;
}

.conversation-row {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 3px;
  padding: 10px 10px 9px;
  border: 0;
  border-radius: 10px;
  color: #4c5d7e;
  text-align: left;
  cursor: pointer;
  background: transparent;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.conversation-row:hover:not(:disabled) {
  background: rgba(224, 231, 255, 0.68);
}

.conversation-row-active {
  color: #31447f;
  background: rgba(211, 221, 255, 0.78);
}

.conversation-row-title,
.conversation-row-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-row-title {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
}

.conversation-row-preview {
  color: #8a96ab;
  font-size: 11px;
  line-height: 1.35;
}

.conversation-empty-state,
.conversation-load-error {
  margin: 8px 7px;
  color: #8a96ab;
  font-size: 12px;
  line-height: 1.65;
}

.conversation-load-error {
  color: #a34d62;
}

.conversation-load-error button {
  padding: 0;
  border: 0;
  color: #5268bc;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  background: transparent;
}

.conversation-loading-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 6px;
}

.conversation-loading-row {
  height: 46px;
  border-radius: 10px;
  background: linear-gradient(90deg, rgba(222, 228, 241, 0.5), rgba(244, 247, 253, 0.88), rgba(222, 228, 241, 0.5));
  background-size: 200% 100%;
  animation: conversation-loading 1.35s ease-in-out infinite;
}

@keyframes conversation-loading {
  to {
    background-position: -200% 0;
  }
}

@media (min-width: 1101px) {
  .home-container {
    transform: translateX(88px);
  }
}

@media (max-width: 1100px) {
  .conversation-sidebar {
    z-index: 90;
    transform: translateX(calc(-100% - 24px));
    transition: transform 0.2s ease;
  }

  .conversation-sidebar-mobile-open {
    transform: translateX(0);
  }

  .conversation-sidebar-resize-handle {
    display: none;
  }

  .conversation-sidebar-trigger {
    position: fixed;
    z-index: 100;
    top: 22px;
    left: 22px;
    display: block;
    padding: 9px 13px;
    border: 1px solid rgba(255, 255, 255, 0.72);
    border-radius: 999px;
    color: #4f5f82;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 12px 28px rgba(101, 119, 187, 0.16);
    backdrop-filter: blur(16px);
  }

  .conversation-sidebar-trigger:active {
    transform: translateY(1px);
  }
}

.main-title {
  font-size: 62px;
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 4px 0 8px;
  letter-spacing: 6px;
}

.agent-chat-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(860px, calc(100vw - 72px));
  margin: 0 auto;
  align-self: center;
  padding: 22px 20px 18px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.56);
  box-shadow: 0 20px 44px rgba(101, 119, 187, 0.14);
  backdrop-filter: blur(18px);
}

.search-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  min-height: 48px;
  padding: 4px 6px 2px;
  border-radius: 20px;
  background: transparent;
  border: none;
  box-shadow: none;
  backdrop-filter: none;
}

.search-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* 过滤器样式 */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.filter-tag {
  font-size: 13px;
  padding: 6px 10px 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background-color: rgba(255, 255, 255, 0.86);
  color: #556070;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.25;
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
  font-size: 16px;
  width: 18px;
  height: 18px;
  line-height: 16px;
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
  padding: 6px 12px;
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
  margin-top: 10px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
  padding: 10px;
  z-index: 100;
  min-width: 200px;
  border: 1px solid #eee;
}

.menu-item {
  padding: 10px 14px;
  cursor: pointer;
  border-radius: 8px;
  font-size: 14px;
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
  gap: 10px;
  padding: 6px;
}

.input-row {
  display: flex;
  gap: 8px;
}

.menu-input {
  flex: 1;
  width: 0; /* 让flex生效 */
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
}

.menu-input:focus {
  border-color: #1890ff;
}

.menu-confirm-btn {
  padding: 8px 12px;
  background: #1890ff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.paper-pool {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pool-item {
  padding: 8px 14px;
  cursor: pointer;
  border-radius: 8px;
  font-size: 14px;
  color: #333;
}

.pool-item:hover {
  background-color: #f5f7fa;
  color: #1890ff;
}

.search-agent-mode-button {
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 999px;
  color: #53617d;
  background: rgba(255, 255, 255, 0.62);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.search-agent-mode-button:hover,
.search-agent-mode-button.active {
  border-color: rgba(102, 126, 234, 0.58);
  color: #465dc4;
  background: rgba(232, 237, 255, 0.86);
  box-shadow: 0 5px 13px rgba(102, 126, 234, 0.12);
}

.source-dropdown {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
}

.source-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 32px 0 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #556070;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  position: relative;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
  transition: all 0.2s ease;
}

.source-trigger::after {
  content: '';
  position: absolute;
  right: 12px;
  top: 50%;
  width: 8px;
  height: 8px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: translateY(-65%) rotate(45deg);
  pointer-events: none;
}

.source-trigger:hover {
  color: #2563eb;
  border-color: rgba(37, 99, 235, 0.32);
  background-color: rgba(239, 246, 255, 0.95);
  box-shadow:
    0 6px 14px rgba(37, 99, 235, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.source-options {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  background: rgba(255, 255, 255, 0.97);
  border-radius: 14px;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.12);
  padding: 8px;
  z-index: 100;
  min-width: 220px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  backdrop-filter: blur(16px);
}

.source-option {
  padding: 10px 14px;
  font-size: 13px;
  color: #334155;
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.18s ease;
}

.source-option:hover {
  background-color: #f8fafc;
  color: #2563eb;
}

.source-options-multi {
  min-width: 220px;
}

.source-option-multi {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.source-option.active {
  color: #1890ff;
  background-color: #e6f7ff;
  font-weight: 500;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.understanding-section {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  align-self: center;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 10px 24px rgba(80, 102, 180, 0.12);
}

.understanding-header {
  display: flex;
  justify-content: center;
  text-align: center;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.understanding-header h3 {
  margin: 0;
  font-size: 18px;
  color: #334155;
}

.understanding-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.understanding-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.meta-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4c51bf;
  font-size: 12px;
  font-weight: 600;
}

.meta-badge.success {
  background: #dcfce7;
  color: #166534;
}

.understanding-reason {
  margin: 0;
  color: #475569;
  text-align: left;
  line-height: 1.7;
}

.structured-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.structured-grid-plain {
  gap: 8px 18px;
}

.structured-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.structured-field span {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.structured-inline-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  text-align: left;
}

.structured-inline-label {
  width: 72px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.structured-inline-input {
  min-width: 0;
  width: 100%;
  border: none;
  border-bottom: 1px solid #d8e0f0;
  border-radius: 0;
  padding: 4px 2px;
  font-size: 13px;
  color: #1e293b;
  background: transparent;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s ease;
}

.structured-inline-input:focus {
  border-bottom-color: #6366f1;
  box-shadow: none;
}

.structured-inline-input-year {
  max-width: 120px;
}

.structured-field-full {
  grid-column: 1 / -1;
}

.structured-input,
.structured-textarea {
  width: 100%;
  border: 1px solid #d8e0f0;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
  color: #1e293b;
  background: #fff;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  box-sizing: border-box;
}

.structured-input:focus,
.structured-textarea:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.structured-textarea {
  resize: vertical;
  min-height: 110px;
}

.checkbox-field {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid #d8e0f0;
  border-radius: 12px;
  background: #fff;
}

.structured-checkbox {
  width: 18px;
  height: 18px;
}

.structured-tags-row {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
}

.structured-tags-label {
  width: 72px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  line-height: 1.2;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.structured-tag-list {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.structured-tag-list-plain {
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  min-height: 34px;
  box-shadow: none;
}

.structured-tag-list-plain:focus-within {
  border: none;
  box-shadow: none;
}

.understanding-actions {
  justify-content: flex-end;
  margin-top: 4px;
}

.keywords-hint {
  font-size: 13px;
  color: #64748b;
  background: rgba(99, 102, 241, 0.08);
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid rgba(99, 102, 241, 0.12);
  font-weight: 500;
}

.loading-spinner {
  display: inline-block;
  animation: thinking 1.5s ease-in-out infinite;
  margin-left: 8px;
}

@keyframes thinking {
  0%,
  100% {
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

.recent-drawer-trigger {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;
  border: none;
  border-radius: 18px 0 0 18px;
  padding: 16px 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  cursor: pointer;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.24);
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    right 0.22s ease;
}

.recent-drawer-trigger:hover {
  transform: translateY(-50%) translateX(-4px);
  box-shadow: 0 20px 42px rgba(15, 23, 42, 0.3);
}

.recent-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 18;
  background: rgba(15, 23, 42, 0.26);
  backdrop-filter: blur(4px);
}

.recent-drawer {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 19;
  width: min(420px, calc(100vw - 20px));
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 28px 22px 24px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96) 0%, rgba(255, 255, 255, 0.98) 100%);
  border-left: 1px solid rgba(148, 163, 184, 0.24);
  box-shadow: -18px 0 40px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(22px);
  overflow-y: auto;
  transition: width 0.22s ease;
}

.recent-drawer-resizing {
  transition: none;
}

.recent-drawer-resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: 14px;
  height: 100%;
  transform: translateX(-50%);
  cursor: col-resize;
  z-index: 2;
}

.recent-drawer-resize-handle::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 4px;
  height: 96px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.6);
  box-shadow: 0 0 0 4px rgba(248, 250, 252, 0.92);
  transition: background-color 0.18s ease;
}

.recent-drawer-resize-handle:hover::before,
.recent-drawer-resize-handle-active::before {
  background: rgba(79, 70, 229, 0.72);
}

.recent-drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.recent-drawer-eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #64748b;
}

.recent-drawer-header h3 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
}

.recent-drawer-summary {
  margin: 8px 0 0;
  font-size: 13px;
  color: #64748b;
}

.recent-drawer-close {
  width: 38px;
  height: 38px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  color: #334155;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.22s ease;
}

.recent-drawer-close:hover {
  border-color: rgba(99, 102, 241, 0.42);
  color: #4f46e5;
  transform: translateY(-1px);
}

.recent-search-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
}

.recent-search-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
  overflow-y: auto;
  border-top: 1px solid rgba(203, 213, 225, 0.55);
}

.recent-search-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 6px 10px 4px;
  border: none;
  border-bottom: 1px solid rgba(203, 213, 225, 0.55);
  border-radius: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.recent-search-row:hover {
  background: rgba(99, 102, 241, 0.06);
}

.recent-search-row-active {
  background: rgba(79, 70, 229, 0.1);
}

.recent-search-prompt {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.35;
}

.recent-search-time {
  flex-shrink: 0;
  font-size: 11px;
  color: #64748b;
  text-align: right;
  min-width: 108px;
}

.recent-search-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  border-radius: 16px;
  background: rgba(241, 245, 249, 0.8);
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
}

.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.22s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition:
    transform 0.26s ease,
    opacity 0.26s ease;
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@media (max-width: 768px) {
  .conversation-sidebar-trigger {
    top: 12px;
    left: 12px;
    padding: 8px 11px;
    font-size: 12px;
  }

  .settings-trigger {
    top: 12px;
    right: 12px;
  }

  .task-entry-actions {
    top: 60px;
    right: 12px;
  }

  .tasks-trigger,
  .review-tasks-trigger {
    padding: 8px 12px;
    font-size: 12px;
  }

  .main-title {
    font-size: 28px;
    margin: 0 0 12px 0;
  }

  .agent-chat-shell {
    width: min(100%, calc(100vw - 28px));
    gap: 10px;
    padding: 14px 14px 12px;
    border-radius: 22px;
  }

  .search-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    min-height: auto;
    padding: 0;
  }

  .filter-bar {
    gap: 8px;
  }

  .filter-tag {
    font-size: 12px;
    padding: 5px 9px 5px 11px;
  }

  .search-toolbar-actions {
    width: 100%;
    justify-content: space-between;
    gap: 10px;
  }

  .source-dropdown {
    flex: 1;
  }

  .source-trigger {
    min-height: 36px;
    font-size: 13px;
  }

  .search-section {
    flex-direction: column;
    gap: 12px;
    align-items: center;
  }

  .recent-drawer-trigger {
    right: 12px;
    padding: 14px 11px;
    font-size: 12px;
    border-radius: 14px 0 0 14px;
  }

  .recent-drawer {
    padding: 22px 16px 18px;
  }

  .recent-drawer-resize-handle {
    display: none;
  }

  .recent-drawer-header h3 {
    font-size: 20px;
  }

  .recent-search-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 10px 2px;
  }

  .recent-search-prompt {
    width: 100%;
    white-space: normal;
    line-height: 1.5;
  }

  .recent-search-time {
    width: 100%;
    text-align: left;
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
}
.source-option-all {
  font-weight: 750;
}
.source-option-all.partial .source-check {
  color: #5c70ce;
  font-weight: 900;
}
.source-options-divider {
  height: 1px;
  margin: 5px 8px;
  background: rgba(129, 140, 190, 0.18);
}
</style>
