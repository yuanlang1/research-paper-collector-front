<template>
  <section class="agent-chat-panel" :class="{ 'has-conversation': hasConversation }">
    <header class="chat-header">
      <div>
        <h2 v-if="!hasConversation">今天想研究什么？</h2>
      </div>
      <div class="chat-header-actions">
        <span v-if="hasConversation" class="chat-status" :class="`chat-status-${runStatus}`">{{
          statusLabel
        }}</span>
      </div>
    </header>

    <div ref="messageListRef" class="message-list" aria-live="polite" @scroll="updateMessageListScroll">
      <div v-if="!messages.length" class="chat-empty">
        <strong>告诉我你的研究需求</strong>
        <span>例如：帮我找近五年 RAG 幻觉检测论文，并推荐 20 篇。</span>
      </div>
      <article
        v-for="message in messages"
        :key="message.id"
        class="chat-message"
        :class="`chat-message-${message.role}`"
      >
        <span v-if="message.role === 'system'" class="message-role">系统</span>
        <div v-if="message.role === 'assistant' && (hasReasoning(message) || message.thinkingStartedAt)" class="thinking-reasoning">
          <button
            class="thinking-reasoning-header"
            :class="{ 'is-clickable': isThinkingComplete(message) }"
            type="button"
            :aria-expanded="isReasoningExpanded(message)"
            :aria-label="isReasoningExpanded(message) ? '收起推理过程' : '展开推理过程'"
            @click="toggleReasoning(message)"
          >
            <span v-if="!message.thinkingStartedAt" class="thinking-reasoning-label">思考过程</span>
            <span v-else-if="isThinkingComplete(message)" class="thinking-reasoning-label">
              思考了 {{ getThinkingSeconds(message) }} 秒
            </span>
            <span v-else class="thinking-reasoning-label thinking-reasoning-shimmer">思考中…</span>
            <svg
              v-if="isThinkingComplete(message)"
              class="thinking-reasoning-chevron"
              :class="{ 'is-expanded': isReasoningExpanded(message) }"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              aria-hidden="true"
            >
              <path d="m4.5 15.75 7.5-7.5 7.5 7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <Transition name="reasoning-collapse">
            <div v-if="isReasoningExpanded(message)" class="thinking-reasoning-body">
              <div class="thinking-reasoning-viewport">
                <p v-for="(line, index) in reasoningLines(reasoningText(message))" :key="`${message.id}-${index}`" class="thinking-reasoning-line">
                  {{ line }}
                </p>
              </div>
            </div>
          </Transition>
        </div>
        <div
          v-if="message.content && !message.executionCard"
          class="message-content markdown-body"
          :class="{ 'is-streaming': isMessageStreaming(message) }"
          v-html="renderMarkdown(message.content)"
        ></div>
        <div
          v-if="message.role === 'user' && canReuseMessage"
          class="message-user-actions"
        >
          <button
            class="message-copy-trigger"
            type="button"
            aria-label="复制此提问"
            title="复制此提问"
            @click="copyMessage(message)"
          >
            <span class="message-copy-icon" aria-hidden="true"></span>
          </button>
          <button
            class="message-reuse-trigger"
            type="button"
            aria-label="编辑此提问"
            title="编辑此提问"
            @click="reuseMessage(message)"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="m14.7 4.3 5 5M4.5 19.5l3.2-.8L19.4 7a2.1 2.1 0 0 0-3-3L4.7 15.7l-.2 3.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <section v-if="message.executionCard" class="execution-card">
          <header class="execution-card-header">
            <span class="execution-status" :class="`execution-status-${executionStatusTone(message.executionCard.status)}`">
              {{ executionStatusLabel(message.executionCard.status) }}
            </span>
          </header>

          <p v-if="message.executionCard.iterations || message.executionCard.latencyMs" class="execution-card-meta">
            <span v-if="message.executionCard.iterations">{{ message.executionCard.iterations }} 轮推理</span>
            <span v-if="message.executionCard.iterations && message.executionCard.latencyMs"> · </span>
            <span v-if="message.executionCard.latencyMs">{{ formatDuration(message.executionCard.latencyMs) }}</span>
          </p>
          <section
            v-if="message.executionCard.memory"
            class="memory-retrieval"
            :class="`memory-retrieval-${memoryRetrievalTone(message.executionCard.memory.status)}`"
          >
            <span class="memory-retrieval-indicator" aria-hidden="true"></span>
            <div>
              <p class="memory-retrieval-title">{{ memoryRetrievalLabel(message.executionCard.memory.status) }}</p>
              <p class="memory-retrieval-detail">{{ memoryRetrievalDetail(message.executionCard.memory) }}</p>
            </div>
          </section>
          <ol v-if="message.executionCard.activities.length" class="execution-activity-list">
            <li
              v-for="(activityItem, index) in message.executionCard.activities"
              :key="activityItem.id"
              class="execution-activity"
              :class="`execution-activity-${executionStatusTone(activityItem.status)}`"
            >
              <span class="execution-activity-rail" aria-hidden="true"></span>
              <div class="execution-activity-content">
                <p class="execution-activity-title">
                  <span class="execution-activity-index">#{{ index + 1 }}</span>
                  <span>{{ activityItem.kind === 'tool' ? '工具调用' : '子代理' }}</span>
                  <strong>{{ activityItem.name }}</strong>
                  <span class="execution-activity-status">{{ executionStatusLabel(activityItem.status) }}</span>
                </p>
                <p v-if="executionActivityDetail(activityItem)" class="execution-activity-detail">
                  {{ executionActivityDetail(activityItem) }}
                </p>
                <p v-if="activityItem.error" class="execution-activity-error">{{ activityItem.error }}</p>

                <template v-if="activityItem.kind === 'subagent'">
                  <div v-if="activityItem.summary || activityItem.warnings.length" class="execution-subagent-note">
                    <button
                      class="execution-section-toggle"
                      type="button"
                      :aria-expanded="isActivityDetailsExpanded(activityItem)"
                      @click="toggleActivityDetails(activityItem)"
                    >
                      <span>执行说明</span>
                      <svg class="execution-section-chevron" :class="{ 'is-expanded': isActivityDetailsExpanded(activityItem) }" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                        <path d="m6.75 9 5.25 5.25L17.25 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>
                    <div v-if="isActivityDetailsExpanded(activityItem)">
                      <p v-if="activityItem.summary">{{ activityItem.summary }}</p>
                      <p v-for="warning in activityItem.warnings" :key="warning" class="execution-subagent-warning">
                        {{ warning }}
                      </p>
                    </div>
                  </div>
                  <div v-if="activityItem.timeline.length" class="execution-workflow">
                    <button
                      class="execution-section-toggle"
                      type="button"
                      :aria-expanded="isTimelineExpanded(activityItem)"
                      @click="toggleTimeline(activityItem)"
                    >
                      <span>Workflow timeline</span>
                      <svg class="execution-section-chevron" :class="{ 'is-expanded': isTimelineExpanded(activityItem) }" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                        <path d="m6.75 9 5.25 5.25L17.25 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>
                    <ol v-if="isTimelineExpanded(activityItem)">
                      <li
                        v-for="step in activityItem.timeline"
                        :key="step.stepId"
                        :class="`execution-workflow-step-${step.state}`"
                      >
                        <span>{{ step.label }}</span>
                        <span
                          class="execution-workflow-step-status"
                          :class="`execution-workflow-step-status-${step.state}`"
                          role="img"
                          :aria-label="executionStepLabel(step.state)"
                          :title="executionStepLabel(step.state)"
                        >
                          <template v-if="step.state === 'started'">
                            <span
                              v-for="index in 8"
                              :key="index"
                              class="execution-workflow-orb-dot"
                              :style="workflowOrbDotStyle(index)"
                              aria-hidden="true"
                            ></span>
                          </template>
                          <span v-else aria-hidden="true">{{ executionStepMark(step.state) }}</span>
                        </span>
                        <p v-if="step.error">{{ step.error }}</p>
                      </li>
                    </ol>
                  </div>
                </template>

              </div>
            </li>
          </ol>

          <article v-if="message.executionCard?.pendingAction" class="confirmation-card execution-confirmation-card">
            <p class="confirmation-title">需要你的确认</p>
            <p>将执行：{{ message.executionCard.pendingAction.display_name || message.executionCard.pendingAction.name }}</p>
            <p v-if="message.executionCard.pendingAction.summary">内容：{{ message.executionCard.pendingAction.summary }}</p>
            <textarea
              v-model="confirmationComment"
              rows="2"
              :disabled="isRunning"
              placeholder="可选备注，例如：按当前筛选条件执行"
            ></textarea>
            <div class="confirmation-actions">
              <button type="button" class="reject-button" :disabled="isRunning" @click="resume('rejected')">暂不执行</button>
              <button type="button" class="approve-button" :disabled="isRunning" @click="resume('approved')">
                {{ isRunning ? '正在继续执行…' : '允许执行' }}
              </button>
            </div>
          </article>

          <section v-if="shouldShowExecutionResult(message.executionCard.status)" class="execution-final-result">
            <p>{{ executionResultTitle(message.executionCard.status) }}</p>
            <div v-if="message.content" class="message-content markdown-body" v-html="renderMarkdown(message.content)"></div>
            <p v-else-if="message.executionCard.error" class="execution-activity-error">{{ message.executionCard.error }}</p>
          </section>
        </section>
      </article>

      <button
        v-if="showScrollToBottom"
        class="scroll-to-bottom-button"
        type="button"
        aria-label="回到底部"
        title="回到底部"
        @click="scrollToBottom"
      >
        <ArrowDown :size="16" aria-hidden="true" />
      </button>
    </div>

    <div class="chat-composer">
      <div
        ref="llmProfileSelectorRef"
        class="llm-profile-selector"
        @focusout="closeLlmProfileMenuOnFocusOut"
        @keydown.esc.stop="closeLlmProfileMenu"
      >
        <span id="llm-profile-label" class="llm-profile-label">模型</span>
        <button
          id="llm-profile-select"
          type="button"
          class="llm-profile-trigger"
          :disabled="llmSelectorDisabled || !enabledLlmProfiles.length"
          aria-haspopup="menu"
          :aria-expanded="isLlmMenuOpen"
          aria-labelledby="llm-profile-label llm-profile-value"
          @click="toggleLlmProfileMenu"
        >
          <span id="llm-profile-value" class="llm-profile-value">{{ selectedLlmProfile?.name || '暂无可用模型' }}</span>
          <span class="llm-profile-chevron" aria-hidden="true"></span>
        </button>
        <div v-if="isLlmMenuOpen" class="llm-profile-menu" role="menu" aria-labelledby="llm-profile-label">
          <button
            v-for="profile in enabledLlmProfiles"
            :key="profile.id"
            type="button"
            class="llm-profile-option"
            :class="{ 'is-selected': profile.id === selectedLlmProfileId }"
            role="menuitemradio"
            :aria-checked="profile.id === selectedLlmProfileId"
            @click="selectLlmProfile(profile.id)"
          >
            {{ profile.name }}
          </button>
        </div>
      </div>
      <textarea
        ref="composerRef"
        v-model="draft"
        rows="1"
        :disabled="isRunning"
        placeholder="给论文研究助手发送消息…"
        @keydown.enter.exact.prevent="send"
        @keydown.enter.shift.exact.stop
      ></textarea>
      <button
        class="send-button"
        type="button"
        :disabled="isRunning || !draft.trim()"
        aria-label="发送"
        title="发送"
        @click="send"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 19V5m-7 7 7-7 7 7" />
        </svg>
      </button>
      <div class="composer-divider"></div>
      <div class="chat-filter-slot">
        <slot name="filters" />
      </div>
      <p>Enter 发送，Shift + Enter 换行。确认时会携带当前筛选条件。</p>
    </div>
  </section>
</template>

<script lang="ts">/*
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import type { PaperTagValue, SourceTag } from '@/constants/searchTagMappings'
import {
  agentService,
  type AgentInterrupt,
  type AgentConversationMessage,
  type AgentRunStatus,
  type AgentStreamController,
  type AgentStreamEvent
} from '@/services/agentService'

interface FilterSnapshot {
  yearTag: number
  paperTags: PaperTagValue[]
  sourceTags: SourceTag[]
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  filters?: FilterSnapshot
  reasoning?: string
  thinkingStartedAt?: number
  thinkingCompletedAt?: number
  reasoningExpanded?: boolean
  artifacts?: string[]
}
interface TimelineStep {
  stepId: string
  label: string
  state: 'started' | 'completed' | 'failed'
  error: string | null
}

interface TimelineGroup {
  id: string
  runId: string
  workflow: string
  steps: TimelineStep[]
  collapsed: boolean
}

interface Activity {
  title: string
  detail?: string
  level?: 'normal' | 'error'
}

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true })

function renderMarkdown(content: string): string {
  return markdown.render(content)
}

const emit = defineEmits<{
  completed: []
  'update:isRunning': [value: boolean]
  'message-sent': [message: string]
  'conversation-changed': [value: boolean]
  'conversation-updated': [conversationId: string]
  'restore-filters': [filters: FilterSnapshot]
}>()
const messages = ref<ChatMessage[]>([])
const draft = ref('')
const runStatus = ref<AgentRunStatus>('idle')
const conversationId = ref<string | null>(null)
const streamController = ref<AgentStreamController | null>(null)
const pendingConfirmation = ref<AgentInterrupt | null>(null)
const confirmationComment = ref('')
const activity = ref<Activity | null>(null)
const timelineGroups = ref<TimelineGroup[]>([])
const activeRunId = ref<string | null>(null)
const messageListRef = ref<HTMLElement | null>(null)
const composerRef = ref<HTMLTextAreaElement | null>(null)

const props = defineProps<{
  currentFilters: FilterSnapshot
}>()

const isRunning = computed(() => runStatus.value === 'streaming')
const canReuseMessage = computed(
  () => !isRunning.value && runStatus.value !== 'waiting_confirmation'
)
const visibleTimelineGroups = computed(() =>
  activeRunId.value
    ? timelineGroups.value.filter((group) => group.runId === activeRunId.value)
    : []
)
const hasConversation = computed(
  () =>
    messages.value.length > 0 ||
    Boolean(activity.value) ||
    Boolean(pendingConfirmation.value) ||
    visibleTimelineGroups.value.length > 0
)
const statusLabel = computed(
  () =>
    ({
      idle: '准备就绪',
      streaming: '正在执行',
      waiting_confirmation: '等待确认',
      completed: '本轮完成',
      failed: '执行失败'
    })[runStatus.value]
)

watch(isRunning, (value) => emit('update:isRunning', value), { immediate: true })
watch(hasConversation, (value) => emit('conversation-changed', value), { immediate: true })
watch(
  [messages, activity, pendingConfirmation, visibleTimelineGroups],
  () => nextTick(scrollToBottom),
  { deep: true }
)
function scrollToBottom() {
  if (messageListRef.value) messageListRef.value.scrollTop = messageListRef.value.scrollHeight
}
function addMessage(
  role: ChatMessage['role'],
  content: string,
  artifacts?: string[],
  filters?: FilterSnapshot
) {
  messages.value.push({
    id: crypto.randomUUID(),
    role,
    content,
    artifacts,
    filters: filters && {
      yearTag: filters.yearTag,
      paperTags: [...filters.paperTags],
      sourceTags: [...filters.sourceTags]
    }
  })
}
function clearStream() {
  streamController.value?.abort()
  streamController.value = null
}
function resetConversation() {
  clearStream()
  messages.value = []
  draft.value = ''
  conversationId.value = null
  pendingConfirmation.value = null
  confirmationComment.value = ''
  activity.value = null
  timelineGroups.value = []
  activeRunId.value = null
  runStatus.value = 'idle'
  nextTick(() => composerRef.value?.focus())
}

function loadConversation(historyMessages: AgentConversationMessage[]) {
  clearStream()
  messages.value = historyMessages.map((message) => ({
    id: `history-${message.id}`,
    role: message.role,
    content: message.content,
    artifacts: message.meta?.artifact_refs?.filter(String)
  }))
  conversationId.value = historyMessages[0]?.conversation_id || null
  draft.value = ''
  pendingConfirmation.value = null
  confirmationComment.value = ''
  activity.value = null
  timelineGroups.value = []
  activeRunId.value = null
  activeAssistantMessageId = null
  runStatus.value = 'idle'
  nextTick(scrollToBottom)
}
function stopStreaming() {
  finalizeActiveThinking()
  clearStream()
  runStatus.value = 'idle'
  activity.value = { title: '已停止本次执行', detail: '你可以继续输入新的需求。' }
}
let activeAssistantMessageId: string | null = null

function getActiveAssistantMessage(): ChatMessage | undefined {
  return messages.value.find((message) => message.id === activeAssistantMessageId)
}

function initializeAssistantMessage() {
  const message = getActiveAssistantMessage()
  if (message) return message

  const nextMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: '',
    thinkingStartedAt: Date.now(),
    reasoningExpanded: true
  }
  messages.value.push(nextMessage)
  activeAssistantMessageId = nextMessage.id
  return nextMessage
}

function isThinkingComplete(message: ChatMessage) {
  return Boolean(message.thinkingCompletedAt) ||
    (!message.thinkingStartedAt && Boolean(message.executionCard?.reasoning.length))
}

function isReasoningExpanded(message: ChatMessage) {
  return isThinkingComplete(message) ? Boolean(message.reasoningExpanded) : true
}

function getThinkingSeconds(message: ChatMessage) {
  const start = message.thinkingStartedAt
  const end = message.thinkingCompletedAt
  if (!start || !end) return 1
  return Math.max(1, Math.round((end - start) / 1000))
}

function reasoningLines(reasoning?: string) {
  return reasoning?.split(/\n+/).map((line) => line.trim()).filter(Boolean) || []
}

function reasoningText(message: ChatMessage) {
  return message.executionCard?.reasoning.join('\n') || message.reasoning || ''
}

function hasReasoning(message: ChatMessage) {
  return Boolean(reasoningText(message))
}

function toggleReasoning(message: ChatMessage) {
  if (!isThinkingComplete(message) || !message.reasoning) return
  message.reasoningExpanded = !message.reasoningExpanded
}

function isMessageStreaming(message: ChatMessage) {
  return message.id === activeAssistantMessageId && runStatus.value === 'streaming'
}

function appendDelta(field: 'reasoning' | 'content', delta: unknown) {
  if (typeof delta !== 'string' || !delta) return
  const message = initializeAssistantMessage()
  message[field] = `${message[field] || ''}${delta}`
}

function extractFinalContent(data: Record<string, unknown>): string | undefined {
  const response = data.response && typeof data.response === 'object' ? data.response : data
  const candidate = response as Record<string, unknown>
  return [candidate.reply, candidate.content, candidate.message]
    .find((value): value is string => typeof value === 'string' && Boolean(value))
}

function finalizeActiveThinking() {
  const message = getActiveAssistantMessage()
  if (message && !message.thinkingCompletedAt) {
    message.thinkingCompletedAt = Date.now()
    message.reasoningExpanded = false
  }
}

function markThinkingFailed() {
  finalizeActiveThinking()
}

function reuseMessage(message: ChatMessage) {
  if (message.role !== 'user' || !canReuseMessage.value) return
  draft.value = message.content
  if (message.filters) emit('restore-filters', message.filters)
  nextTick(() => {
    composerRef.value?.focus()
    composerRef.value?.select()
  })
}

function copyMessage(message: ChatMessage) {
  if (message.role !== 'user' || !message.content) return
  void navigator.clipboard?.writeText(message.content).catch(() => undefined)
}

function startStream(resumeRequest?: { decision: 'approved' | 'rejected'; comment: string }) {
  pendingConfirmation.value = null
  activity.value = { title: '正在连接研究 Agent…' }
  runStatus.value = 'streaming'
  const handlers = {
    onEvent: handleEvent,
    onError: (error: Error) => {
      markThinkingFailed()
      runStatus.value = 'failed'
      activity.value = { title: 'Agent 执行失败', detail: error.message, level: 'error' }
      addMessage('system', `执行失败：${error.message}`)
    }
  }
  streamController.value = resumeRequest
    ? agentService.resumeStream(
        {
          conversation_id: conversationId.value!,
          decision: resumeRequest.decision,
          comment: resumeRequest.comment || null
        },
        handlers
      )
    : agentService.streamChat(
        {
          message: draft.value.trim(),
          conversation_id: conversationId.value
        },
        handlers
      )
}
function send() {
  if (!draft.value.trim() || isRunning.value) return
  const message = draft.value.trim()
  addMessage('user', message, undefined, props.currentFilters)
  emit('message-sent', message)
  activeAssistantMessageId = null
  startStream()
  draft.value = ''
}
function resume(decision: 'approved' | 'rejected') {
  if (!conversationId.value || isRunning.value) return
  activeAssistantMessageId = null
  startStream({ decision, comment: confirmationComment.value.trim() })
}
function getCompletedStepCount(group: TimelineGroup) {
  return group.steps.filter((step) => step.state === 'completed').length
}

function getFailedStepCount(group: TimelineGroup) {
  return group.steps.filter((step) => step.state === 'failed').length
}

function getTimelineGroupStatus(group: TimelineGroup) {
  if (getFailedStepCount(group)) return 'failed'
  if (group.steps.some((step) => step.state === 'started')) return 'started'
  return 'completed'
}

function toggleTimelineGroup(group: TimelineGroup) {
  group.collapsed = !group.collapsed
}

function handleTimelineStep(event: AgentStreamEvent, data: Record<string, unknown>) {
  const runId = event.run_id
  if (!runId) return
  if (!activeRunId.value) activeRunId.value = runId
  if (runId !== activeRunId.value) return

  const stepId = typeof data.step_id === 'string' ? data.step_id : ''
  const state = data.state
  if (!stepId || (state !== 'started' && state !== 'completed' && state !== 'failed')) return

  const delegationId = typeof data.delegation_id === 'string' ? data.delegation_id : ''
  const childThreadId = typeof data.child_thread_id === 'string' ? data.child_thread_id : ''
  const groupId = delegationId || childThreadId
  if (!groupId) return

  const workflow = typeof data.workflow === 'string' ? data.workflow : 'Agent 任务'
  const label = typeof data.label === 'string' ? data.label : stepId
  const error = typeof data.error === 'string' && data.error ? data.error : null
  let group = timelineGroups.value.find((item) => item.id === groupId && item.runId === runId)
  if (!group) {
    group = { id: groupId, runId, workflow, steps: [], collapsed: false }
    timelineGroups.value.push(group)
  }

  const step = group.steps.find((item) => item.stepId === stepId)
  if (step) {
    step.state = state
    step.error = state === 'failed' ? error : null
  } else if (state === 'started') {
    group.steps.push({ stepId, label, state, error: null })
  }

  const status = getTimelineGroupStatus(group)
  group.collapsed = status === 'completed' && group.steps.length > 0
}

function handleEvent(event: AgentStreamEvent) {
  if (event.conversation_id) conversationId.value = event.conversation_id
  const data = event.data as Record<string, unknown>

  if (event.event === 'run_started') {
    if (event.run_id) activeRunId.value = event.run_id
    initializeAssistantMessage()
    activity.value = { title: 'Agent 已开始处理', detail: '正在分析你的研究需求。' }
  }
  if (event.event === 'reasoning_delta') appendDelta('reasoning', data.delta)
  if (event.event === 'content_delta') appendDelta('content', data.delta)
  if (event.event === 'timeline_step') handleTimelineStep(event, data)
  if (event.event === 'subagent_progress') {
    const progress = typeof data.progress_percent === 'number' ? `${data.progress_percent}%` : ''
    const iteration = typeof data.iteration === 'number' ? `第 ${data.iteration} 轮` : ''
    const warnings = Array.isArray(data.warnings) ? data.warnings.filter(String).join(' · ') : ''
    activity.value = {
      title: data.phase_label ? String(data.phase_label) : `正在执行 ${String(data.subagent || '子 Agent')}`,
      detail: [data.subagent, data.phase, iteration, progress, data.status, warnings]
        .filter(Boolean)
        .join(' · '),
      level: data.error ? 'error' : 'normal'
    }
  }
  if (event.event === 'confirmation_required') {
    const interrupt = data.interrupt as AgentInterrupt | undefined
    if (!interrupt) {
      runStatus.value = 'failed'
      activity.value = { title: '确认请求格式错误', level: 'error' }
      return
    }
    pendingConfirmation.value = interrupt
    finalizeActiveThinking()
    runStatus.value = 'waiting_confirmation'
    activity.value = null
    clearStream()
  }
  if (event.event === 'action_result') {
    activity.value = {
      title: '执行结果',
      detail: String(data.summary || data.message || data.result || '已收到执行结果'),
      level: data.error ? 'error' : 'normal'
    }
  }
  if (event.event === 'node_error') {
    activity.value = {
      title: `阶段出现异常${data.node ? `：${String(data.node)}` : ''}`,
      detail: String(data.error || data.message || '未知错误'),
      level: 'error'
    }
  }
  if (event.event === 'run_completed') {
    const reply = extractFinalContent(data)
    const message = initializeAssistantMessage()
    if (reply && !message.content) message.content = reply
    if (Array.isArray(data.artifact_refs)) message.artifacts = data.artifact_refs.filter(String) as string[]
    finalizeActiveThinking()
    runStatus.value = 'completed'
    activity.value = null
    emit('completed')
    if (conversationId.value) emit('conversation-updated', conversationId.value)
    clearStream()
  }
  if (event.event === 'run_failed') {
    finalizeActiveThinking()
    runStatus.value = 'failed'
    activity.value = {
      title: 'Agent 执行失败',
      detail: String(data.error || data.message || '未知错误'),
      level: 'error'
    }
    clearStream()
  }
}
onBeforeUnmount(clearStream)

defineExpose({
  resetConversation,
  loadConversation
})
*/</script>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import MarkdownIt from 'markdown-it'
import { ArrowDown } from 'lucide-vue-next'
import type { LlmProfile } from '@/services/llmProfileService'
import {
  useAgentChatStore,
  type ChatMessage,
  type FilterSnapshot,
  type HistoricalExecutionActivity,
  type HistoricalMemoryRetrieval
} from '@/stores/agentChat'

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true })
const chatStore = useAgentChatStore()
const {
  messages,
  runStatus,
  pendingConfirmation,
  confirmationComment,
  hasConversation,
  selectedLlmProfileId,
  isRunning
} = storeToRefs(chatStore)
const draft = ref('')
const messageListRef = ref<HTMLElement | null>(null)
const composerRef = ref<HTMLTextAreaElement | null>(null)
const llmProfileSelectorRef = ref<HTMLElement | null>(null)
const isLlmMenuOpen = ref(false)
const isMessageListAtBottom = ref(true)
let skipNextAutoScroll = false

const props = defineProps<{
  currentFilters: FilterSnapshot
  llmProfiles?: LlmProfile[]
}>()
const emit = defineEmits<{
  completed: []
  'update:isRunning': [value: boolean]
  'message-sent': [message: string]
  'conversation-changed': [value: boolean]
  'conversation-updated': [conversationId: string]
  'restore-filters': [filters: FilterSnapshot]
}>()

const canReuseMessage = computed(() => !isRunning.value && runStatus.value !== 'waiting_confirmation')
const enabledLlmProfiles = computed(() => (props.llmProfiles || []).filter((profile) => profile.enabled))
const llmSelectorDisabled = computed(() => isRunning.value || runStatus.value === 'waiting_confirmation')
const selectedLlmProfile = computed(() => enabledLlmProfiles.value.find((profile) => profile.id === selectedLlmProfileId.value))
const showScrollToBottom = computed(() => hasConversation.value && !isMessageListAtBottom.value)
const statusLabel = computed(() => ({
  idle: '准备就绪', streaming: '正在执行', detached: '后台执行中（实时连接已断开）', waiting_confirmation: '等待确认', completed: '本轮完成', failed: '执行失败'
})[runStatus.value])

function executionStatusTone(status: string) {
  if (['completed', 'success', 'accepted'].includes(status)) return 'completed'
  if (['failed', 'error', 'rejected', 'blocked', 'interrupted', 'partial', 'partial_failed'].includes(status)) return 'failed'
  return 'started'
}

function executionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    completed: '已完成',
    success: '已完成',
    accepted: '已接受',
    running: '进行中',
    detached: '后台执行中',
    confirmation_required: '等待确认',
    failed: '失败',
    error: '失败',
    rejected: '已拒绝',
    blocked: '已阻塞',
    interrupted: '已中断',
    partial: '部分完成',
    partial_failed: '部分失败'
  }
  return labels[status] || status
}

function executionStepLabel(state: string) {
  if (state === 'completed') return '完成'
  if (state === 'failed') return '失败'
  return '进行中'
}

function executionStepMark(state: string) {
  if (state === 'completed') return '✓'
  if (state === 'failed') return '×'
  return ''
}

function workflowOrbDotStyle(index: number) {
  return {
    '--workflow-orb-angle': `${(index - 1) * 45}deg`,
    '--workflow-orb-delay': `${-((8 - index) / 8) * 1600}ms`
  }
}

function memoryRetrievalTone(status: string) {
  if (status === 'completed') return 'completed'
  if (status === 'failed') return 'failed'
  if (status === 'empty' || status === 'skipped') return 'empty'
  return 'running'
}

function memoryRetrievalLabel(status: string) {
  const labels: Record<string, string> = {
    running: '正在检索会话记忆',
    completed: '已加载会话记忆',
    empty: '未找到匹配的会话记忆',
    failed: '会话记忆暂不可用',
    skipped: '已跳过会话记忆检索'
  }
  return labels[status] || '正在处理会话记忆'
}

function memoryRetrievalDetail(memory: HistoricalMemoryRetrieval) {
  if (memory.status === 'running') return '正在匹配长期偏好与会话摘要'
  if (memory.status === 'empty') return '未匹配到长期记忆或会话摘要'
  if (memory.status === 'failed') return '已跳过记忆上下文，继续执行'
  if (memory.status === 'skipped') return '本轮无需调用记忆'
  return `长期记忆 ${memory.factsCount} 条 · 会话摘要 ${memory.episodesCount} 条`
}

function isActivityDetailsExpanded(activityItem: HistoricalExecutionActivity) {
  return activityItem.detailsExpanded ?? activityItem.status === 'running'
}

function toggleActivityDetails(activityItem: HistoricalExecutionActivity) {
  skipNextAutoScroll = true
  activityItem.detailsExpanded = !isActivityDetailsExpanded(activityItem)
}

function isTimelineExpanded(activityItem: HistoricalExecutionActivity) {
  return activityItem.timelineExpanded ?? activityItem.status === 'running'
}

function toggleTimeline(activityItem: HistoricalExecutionActivity) {
  skipNextAutoScroll = true
  activityItem.timelineExpanded = !isTimelineExpanded(activityItem)
}

function shouldShowExecutionResult(status: string) {
  return status !== 'running' && status !== 'detached'
}

function executionResultTitle(status: string) {
  return status === 'confirmation_required' ? '等待确认' : '最终结果'
}

function formatDuration(latencyMs: number) {
  return latencyMs < 1000 ? `${latencyMs} ms` : `${(latencyMs / 1000).toFixed(1)} 秒`
}

function executionActivityDetail(activityItem: HistoricalExecutionActivity) {
  const parts: string[] = []
  if (activityItem.kind === 'tool' && activityItem.summary) parts.push(activityItem.summary)
  if (activityItem.phaseLabel) parts.push(activityItem.phaseLabel)
  if (activityItem.progressPercent !== null) parts.push(`${activityItem.progressPercent}%`)
  if (activityItem.taskId !== null) parts.push(`任务 #${activityItem.taskId}`)
  return parts.join(' · ')
}

function renderMarkdown(content: string) {
  return markdown.render(content)
}

function scrollToBottom() {
  if (!messageListRef.value) return
  messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  isMessageListAtBottom.value = true
}

function updateMessageListScroll() {
  const messageList = messageListRef.value
  if (!messageList) return
  isMessageListAtBottom.value = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight <= 24
}

function isThinkingComplete(message: ChatMessage) {
  return Boolean(message.thinkingCompletedAt) ||
    (!message.thinkingStartedAt && Boolean(message.executionCard?.reasoning.length))
}

function isReasoningExpanded(message: ChatMessage) {
  return isThinkingComplete(message) ? Boolean(message.reasoningExpanded) : true
}

function getThinkingSeconds(message: ChatMessage) {
  if (!message.thinkingStartedAt || !message.thinkingCompletedAt) return 1
  return Math.max(1, Math.round((message.thinkingCompletedAt - message.thinkingStartedAt) / 1000))
}

function reasoningLines(reasoning?: string) {
  return reasoning?.split(/\n+/).map((line) => line.trim()).filter(Boolean) || []
}

function reasoningText(message: ChatMessage) {
  return message.executionCard?.reasoning.join('\n') || message.reasoning || ''
}

function hasReasoning(message: ChatMessage) {
  return Boolean(reasoningText(message))
}

function toggleReasoning(message: ChatMessage) {
  if (!isThinkingComplete(message) || !hasReasoning(message)) return
  skipNextAutoScroll = true
  message.reasoningExpanded = !message.reasoningExpanded
}

function isMessageStreaming(message: ChatMessage) {
  return Boolean(message.thinkingStartedAt) && !message.thinkingCompletedAt && isRunning.value
}

function reuseMessage(message: ChatMessage) {
  if (message.role !== 'user' || !canReuseMessage.value) return
  draft.value = message.content
  if (message.filters) emit('restore-filters', message.filters)
  nextTick(() => {
    composerRef.value?.focus()
    composerRef.value?.select()
  })
}

function send() {
  const message = draft.value.trim()
  if (!message || isRunning.value) return
  isMessageListAtBottom.value = true
  chatStore.send(message, props.currentFilters)
  emit('message-sent', message)
  draft.value = ''
  nextTick(scrollToBottom)
}

function resume(decision: 'approved' | 'rejected') {
  isMessageListAtBottom.value = true
  chatStore.resume(decision)
  nextTick(scrollToBottom)
}

function toggleLlmProfileMenu() {
  if (llmSelectorDisabled.value || !enabledLlmProfiles.value.length) return
  isLlmMenuOpen.value = !isLlmMenuOpen.value
}

function closeLlmProfileMenu() {
  isLlmMenuOpen.value = false
}

function closeLlmProfileMenuOnFocusOut(event: FocusEvent) {
  const nextFocusedElement = event.relatedTarget as Node | null
  if (!llmProfileSelectorRef.value?.contains(nextFocusedElement)) closeLlmProfileMenu()
}

function selectLlmProfile(profileId: number) {
  if (llmSelectorDisabled.value) return
  chatStore.setLlmProfile(profileId)
  closeLlmProfileMenu()
}

watch(isRunning, (value) => emit('update:isRunning', value), { immediate: true })
watch(hasConversation, (value) => emit('conversation-changed', value), { immediate: true })
watch(enabledLlmProfiles, (profiles) => {
  const selectedProfileExists = profiles.some((profile) => profile.id === selectedLlmProfileId.value)
  if (selectedProfileExists) return

  chatStore.setLlmProfile(profiles.find((profile) => profile.is_default)?.id ?? profiles[0]?.id ?? null)
}, { immediate: true })
watch(llmSelectorDisabled, (disabled) => {
  if (disabled) closeLlmProfileMenu()
})
watch([messages, pendingConfirmation], () => {
  if (skipNextAutoScroll) {
    skipNextAutoScroll = false
    return
  }
  nextTick(() => {
    if (isMessageListAtBottom.value) scrollToBottom()
  })
}, { deep: true })
watch(runStatus, (status) => {
  if (status !== 'completed') return
  emit('completed')
  if (chatStore.conversationId) emit('conversation-updated', chatStore.conversationId)
})
</script>

<style scoped>
.agent-chat-panel {
  width: min(940px, calc(100vw - 72px));
  margin: 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 22px 55px rgba(74, 85, 140, 0.17);
  backdrop-filter: blur(18px);
  overflow: hidden;
}
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 26px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}
.chat-header h2 {
  margin: 0;
  color: #27334e;
  font-size: 24px;
}
.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.chat-status {
  padding: 6px 10px;
  border-radius: 999px;
  color: #64748b;
  background: #f1f5f9;
  font-size: 12px;
  font-weight: 700;
}
.chat-status-streaming {
  color: #1d4ed8;
  background: #dbeafe;
}
.chat-status-waiting_confirmation {
  color: #b45309;
  background: #fef3c7;
}
.chat-status-failed {
  color: #b91c1c;
  background: #fee2e2;
}
.send-button,
.approve-button,
.reject-button {
  border: 0;
  border-radius: 10px;
  padding: 9px 13px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.reject-button {
  color: #475569;
  background: #e2e8f0;
}
.chat-filter-slot {
  padding: 14px 24px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.38);
}
.message-list {
  height: min(48vh, 500px);
  min-height: 300px;
  overflow: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.chat-empty {
  margin: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #64748b;
  text-align: center;
}
.chat-empty strong {
  color: #334155;
  font-size: 18px;
}
.chat-message {
  max-width: 82%;
  padding: 12px 15px;
  border-radius: 16px;
  color: #334155;
  background: #f1f5f9;
}
.chat-message-user {
  align-self: flex-end;
  color: #fff;
  background: linear-gradient(135deg, #667eea, #1890ff);
}
.chat-message-system {
  align-self: center;
  max-width: 90%;
  color: #b45309;
  background: #fffbeb;
}
.message-role {
  display: block;
  margin-bottom: 5px;
  font-size: 11px;
  font-weight: 800;
  opacity: 0.75;
}
.thinking-reasoning {
  margin: 2px 0 12px;
  color: #64748b;
  font-size: 13px;
}
.thinking-reasoning-header {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  line-height: 1.5;
}
.thinking-reasoning-header.is-clickable {
  cursor: pointer;
}
.thinking-reasoning-label {
  font-weight: 600;
}
.thinking-reasoning-shimmer {
  color: transparent;
  background: linear-gradient(100deg, #64748b 20%, #a5b4fc 45%, #64748b 70%);
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  animation: thinking-shimmer 1.45s linear infinite;
}
.thinking-reasoning-chevron {
  flex: none;
  transition: transform 0.2s ease;
}
.thinking-reasoning-chevron.is-expanded {
  transform: rotate(180deg);
}
.thinking-reasoning-body {
  overflow: hidden;
}
.thinking-reasoning-viewport {
  max-height: 180px;
  margin-top: 7px;
  overflow-y: auto;
  padding: 7px 11px;
  border-left: 2px solid #c7d2fe;
  background: linear-gradient(90deg, rgba(238, 242, 255, 0.68), transparent);
  mask-image: linear-gradient(to bottom, transparent, #000 10px, #000 calc(100% - 10px), transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 10px, #000 calc(100% - 10px), transparent);
}
.thinking-reasoning-line {
  margin: 0;
  padding: 3px 0;
  line-height: 1.65;
  white-space: pre-wrap;
}
.reasoning-collapse-enter-active,
.reasoning-collapse-leave-active {
  transition: all 0.2s ease;
}
.reasoning-collapse-enter-from,
.reasoning-collapse-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
}
@keyframes thinking-shimmer {
  to {
    background-position: -200% 0;
  }
}
.message-user-actions {
  position: absolute;
  right: 0;
  bottom: -30px;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.18s ease;
}
.message-reuse-trigger,
.message-copy-trigger {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #5c70c5;
  background: transparent;
  box-shadow: none;
  cursor: pointer;
  transition: color 0.18s ease, transform 0.18s ease;
}
.message-reuse-trigger svg {
  width: 13px;
  height: 13px;
  stroke-width: 2;
}
.message-copy-icon {
  position: relative;
  display: block;
  width: 12px;
  height: 12px;
}
.message-copy-icon::before,
.message-copy-icon::after {
  position: absolute;
  width: 7px;
  height: 7px;
  border: 1.5px solid currentColor;
  border-radius: 2px;
  content: '';
}
.message-copy-icon::before {
  top: 0;
  right: 0;
}
.message-copy-icon::after {
  bottom: 0;
  left: 0;
  background: #edf3ff;
}
.chat-message-user {
  position: relative;
  padding: 10px 14px 11px;
  margin-bottom: 30px;
}
.chat-message-user:hover .message-user-actions,
.message-user-actions:focus-within {
  opacity: 1;
}
.message-reuse-trigger:hover,
.message-copy-trigger:hover {
  color: #3f5ed4;
  transform: translateY(-1px);
}
.message-reuse-trigger:active,
.message-copy-trigger:active {
  transform: scale(0.96);
}
.message-reuse-trigger:focus-visible,
.message-copy-trigger:focus-visible {
  outline: 3px solid rgba(79, 111, 232, 0.28);
  outline-offset: 2px;
}
.chat-message p,
.activity-card p,
.confirmation-card p {
  margin: 0;
  line-height: 1.6;
  white-space: pre-wrap;
}
.execution-card {
  margin-top: 12px;
  overflow: hidden;
  border: 1px solid #dbe4f0;
  border-radius: 14px;
  background: linear-gradient(145deg, #fbfdff, #f5f8fc);
}
.execution-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 14px;
  border-bottom: 1px solid #e5ebf3;
}
.execution-card-meta,
.execution-final-result > p {
  margin: 0;
}
.execution-status,
.execution-activity-status {
  flex: none;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.execution-status {
  padding: 4px 8px;
  color: #4f6fe8;
  background: #e8edff;
}
.execution-status-completed {
  color: #15803d;
  background: #dcfce7;
}
.execution-status-failed {
  color: #b91c1c;
  background: #fee2e2;
}
.execution-card-meta {
  padding: 9px 14px 0;
  color: #7a879d;
  font-size: 12px;
}
.memory-retrieval {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 10px 14px 0;
  padding: 9px 10px;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  color: #5d6b82;
  background: rgba(255, 255, 255, 0.72);
}
.memory-retrieval-indicator {
  width: 8px;
  height: 8px;
  flex: none;
  margin-top: 5px;
  border-radius: 50%;
  background: #7c91d8;
}
.memory-retrieval-title,
.memory-retrieval-detail {
  margin: 0;
}
.memory-retrieval-title {
  color: #465775;
  font-size: 12px;
  font-weight: 750;
}
.memory-retrieval-detail {
  margin-top: 2px;
  color: #7a879d;
  font-size: 11px;
  line-height: 1.5;
}
.memory-retrieval-running .memory-retrieval-indicator {
  animation: pulse 1.2s infinite;
}
.memory-retrieval-completed {
  border-color: #bbf7d0;
  background: #f0fdf4;
}
.memory-retrieval-completed .memory-retrieval-indicator {
  background: #16a34a;
}
.memory-retrieval-completed .memory-retrieval-title {
  color: #166534;
}
.memory-retrieval-empty {
  border-color: #e2e8f0;
  background: #f8fafc;
}
.memory-retrieval-empty .memory-retrieval-indicator {
  background: #94a3b8;
}
.memory-retrieval-failed {
  border-color: #fecaca;
  background: #fef2f2;
}
.memory-retrieval-failed .memory-retrieval-indicator {
  background: #dc2626;
}
.memory-retrieval-failed .memory-retrieval-title,
.memory-retrieval-failed .memory-retrieval-detail {
  color: #b91c1c;
}
.execution-activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 14px;
  list-style: none;
}
.execution-activity {
  position: relative;
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 9px;
}
.execution-activity:not(:last-child)::after {
  position: absolute;
  top: 16px;
  bottom: -12px;
  left: 6px;
  width: 1px;
  background: #d7dfeb;
  content: '';
}
.execution-activity-rail {
  z-index: 1;
  width: 11px;
  height: 11px;
  margin-top: 5px;
  border: 2px solid #7c91d8;
  border-radius: 50%;
  background: #fff;
}
.execution-activity-completed .execution-activity-rail {
  border-color: #22a35a;
  background: #dcfce7;
}
.execution-activity-failed .execution-activity-rail {
  border-color: #dc2626;
  background: #fee2e2;
}
.execution-activity-content {
  min-width: 0;
}
.execution-activity-title,
.execution-activity-detail,
.execution-activity-error,
.execution-subagent-note p,
.execution-workflow p {
  margin: 0;
}
.execution-activity-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  color: #56657e;
  font-size: 12px;
}
.execution-activity-title strong {
  color: #334155;
  font-size: 13px;
}
.execution-activity-index {
  color: #7080a0;
  font-variant-numeric: tabular-nums;
}
.execution-activity-status {
  padding: 2px 6px;
  color: #64748b;
  background: #eef2f7;
}
.execution-activity-completed .execution-activity-status {
  color: #15803d;
  background: #dcfce7;
}
.execution-activity-failed .execution-activity-status {
  color: #b91c1c;
  background: #fee2e2;
}
.execution-activity-detail {
  margin-top: 4px;
  color: #7a879d;
  font-size: 12px;
  line-height: 1.55;
}
.execution-activity-error,
.execution-subagent-warning {
  margin-top: 5px !important;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.55;
}
.execution-subagent-note,
.execution-workflow {
  margin-top: 9px;
  padding: 9px 10px;
  border: 1px solid #e1e7f0;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.72);
}
.execution-section-toggle {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: 5px;
  padding: 0;
  border: 0;
  color: #64748b;
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  text-align: left;
}
.execution-section-chevron {
  margin-left: auto;
  transition: transform 0.18s ease;
}
.execution-section-chevron.is-expanded {
  transform: rotate(180deg);
}
.execution-subagent-note p {
  color: #5d6b82;
  font-size: 12px;
  line-height: 1.55;
}
.execution-workflow ol {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.execution-workflow li {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  gap: 8px;
  color: #64748b;
  font-size: 12px;
}
.execution-workflow li::before {
  grid-column: 1;
  grid-row: 1 / span 2;
  width: 7px;
  height: 7px;
  margin: 5px 0 0 1px;
  border-radius: 50%;
  background: #7c91d8;
  content: '';
}
.execution-workflow li > span:first-child {
  grid-column: 2;
}
.execution-workflow-step-status {
  grid-column: 3;
  position: relative;
  display: grid;
  width: 16px;
  height: 16px;
  place-items: center;
  margin-top: -1px;
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
}
.execution-workflow-step-status-completed {
  color: #22a35a;
}
.execution-workflow-step-status-failed {
  color: #dc2626;
}
.execution-workflow-step-status-started {
  color: #6f84cf;
}
.execution-workflow-orb-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  transform: rotate(var(--workflow-orb-angle));
}
.execution-workflow-orb-dot::before {
  position: absolute;
  width: 2.5px;
  height: 2.5px;
  border-radius: 50%;
  background: currentColor;
  content: '';
  opacity: 0.14;
  transform: translate(-50%, -6px) scale(1);
  animation: execution-workflow-orb-c1 1.6s cubic-bezier(0.66, 0, 0.34, 1) infinite both;
  animation-delay: var(--workflow-orb-delay);
}
@keyframes execution-workflow-orb-c1 {
  0% {
    opacity: 0.14;
    transform: translate(-50%, -6px) scale(1);
  }
  28% {
    opacity: 1;
    transform: translate(-50%, -6px) scale(1.35);
  }
  56%,
  100% {
    opacity: 0.14;
    transform: translate(-50%, -6px) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .execution-workflow-orb-dot::before {
    animation: none;
    opacity: 0.72;
  }
}
.execution-workflow li p {
  grid-column: 2 / -1;
  color: #b91c1c;
  font-size: 11px;
}
.execution-workflow-step-completed::before {
  background: #22a35a !important;
}
.execution-workflow-step-failed::before {
  background: #dc2626 !important;
}
.execution-final-result {
  padding: 12px 14px 14px 37px;
  border-top: 1px solid #e5ebf3;
  background: rgba(255, 255, 255, 0.6);
}
.execution-final-result > p {
  margin-bottom: 7px;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
}
.execution-final-result .message-content {
  color: #334155;
}
.activity-card {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border: 1px solid #bfdbfe;
  border-radius: 14px;
  color: #1d4ed8;
  background: #eff6ff;
}
.activity-card.error {
  border-color: #fecaca;
  color: #b91c1c;
  background: #fef2f2;
}
.activity-dot {
  width: 8px;
  height: 8px;
  flex: none;
  margin-top: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1.2s infinite;
}
.todo-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.todo-group {
  overflow: hidden;
  border: 1px solid #dbe1ea;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
}
.todo-header {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
  padding: 11px 12px;
  border: 0;
  color: #475569;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.todo-header:hover {
  background: rgba(248, 250, 252, 0.85);
}
.todo-header-icon,
.todo-step-icon {
  display: grid;
  place-items: center;
  flex: none;
}
.todo-header-icon {
  color: #64748b;
}
.todo-header-icon.started {
  color: #4f6fe8;
  animation: todo-spin 2.4s linear infinite;
}
.todo-header-icon.completed {
  color: #16a34a;
}
.todo-header-icon.failed {
  color: #dc2626;
}
.todo-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.todo-count,
.todo-failed-count {
  flex: none;
  color: #94a3b8;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.todo-failed-count {
  color: #dc2626;
}
.todo-chevron {
  flex: none;
  color: #94a3b8;
  transition: transform 0.18s ease;
}
.todo-chevron.is-collapsed {
  transform: rotate(-90deg);
}
.todo-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0 12px 12px;
  list-style: none;
}
.todo-step {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.5;
}
.todo-step-icon {
  margin-top: 1px;
}
.todo-step-started {
  color: #4f6fe8;
}
.todo-step-started .todo-step-icon {
  animation: todo-pulse 1.2s ease-in-out infinite;
}
.todo-step-completed {
  color: #64748b;
}
.todo-step-completed .todo-step-icon {
  color: #16a34a;
}
.todo-step-completed .todo-step-label {
  color: #64748b;
}
.todo-step-failed {
  color: #dc2626;
}
.todo-step-content {
  min-width: 0;
}
.todo-step-label {
  overflow-wrap: anywhere;
}
.todo-step-error {
  margin: 3px 0 0;
  color: #b91c1c;
  overflow-wrap: anywhere;
  font-size: 12px;
}
.todo-collapse-enter-active,
.todo-collapse-leave-active {
  overflow: hidden;
  transition: max-height 0.2s ease, opacity 0.18s ease;
}
.todo-collapse-enter-from,
.todo-collapse-leave-to {
  max-height: 0;
  opacity: 0;
}
@keyframes todo-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes todo-pulse {
  50% {
    opacity: 0.42;
  }
}
.confirmation-card {
  padding: 16px;
  border: 1px solid #fcd34d;
  border-radius: 16px;
  background: #fffbeb;
  color: #78350f;
}
.confirmation-title {
  font-weight: 800;
}
.confirmation-card textarea {
  box-sizing: border-box;
  width: 100%;
  margin: 12px 0 10px;
  padding: 9px;
  border: 1px solid #fcd34d;
  border-radius: 9px;
  resize: vertical;
  font: inherit;
}
.confirmation-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}
.approve-button,
.send-button {
  color: #fff;
  background: linear-gradient(135deg, #667eea, #1890ff);
}
.chat-composer {
  padding: 15px 24px 17px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(248, 250, 252, 0.75);
}
.chat-composer textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 54px;
  padding: 14px 80px 14px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  outline: none;
  resize: vertical;
  font: inherit;
}
.chat-composer textarea:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}
.send-button {
  float: right;
  margin: -46px 8px 0 0;
}
.send-button:disabled {
  cursor: not-allowed;
}
.chat-composer p {
  clear: both;
  margin: 9px 0 0;
  color: #94a3b8;
  font-size: 12px;
}
@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
@media (max-width: 640px) {
  .agent-chat-panel {
    width: calc(100vw - 32px);
    border-radius: 20px;
  }
  .chat-header {
    padding: 18px;
  }
  .chat-header h2 {
    font-size: 20px;
  }
  .message-list {
    height: 46vh;
    padding: 16px;
  }
  .chat-message {
    max-width: 92%;
  }
  .chat-composer {
    padding: 13px 16px;
  }
  .chat-header-actions {
    gap: 7px;
  }
}
.agent-chat-panel {
  display: flex;
  flex-direction: column;
  width: min(100%, 960px);
  min-height: 0;
  margin: 0 auto;
  color: #1f2937;
  border: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  overflow: visible;
}
.chat-header {
  min-height: 42px;
  padding: 0 8px;
  border: 0;
}
.chat-header h2 {
  margin: 10px 0 0;
  color: #1f2937;
  font-size: 32px;
  letter-spacing: -0.04em;
}
.chat-filter-slot {
  order: 4;
  padding: 8px 10px 0;
}
.message-list {
  order: 2;
  flex: 1;
  height: auto;
  min-height: 0;
  padding: 28px max(8px, calc((100% - 780px) / 2));
  gap: 16px;
}
.chat-message {
  max-width: min(78%, 680px);
  color: #263447;
  background: #f6f7f9;
}
.chat-message-user {
  align-self: flex-end;
  color: #1f2937;
  background: #edf3ff;
  border-bottom-right-radius: 5px;
}
.chat-message-assistant {
  align-self: flex-start;
  border-bottom-left-radius: 5px;
}
.message-role {
  color: #94a3b8;
}
.chat-message-user .message-role {
  text-align: right;
}
.chat-composer {
  order: 3;
  box-sizing: border-box;
  width: 100%;
  padding: 13px 14px 11px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
}
.chat-composer textarea {
  min-height: 64px;
  padding: 4px;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.chat-composer textarea:focus {
  box-shadow: none;
}
.chat-composer > p {
  font-size: 11px;
  color: #a8b2c1;
}
.has-conversation {
  min-height: calc(100vh - 96px);
}
.has-conversation .chat-header {
  padding-bottom: 8px;
}
.has-conversation .chat-composer {
  position: sticky;
  bottom: 0;
  margin-top: auto;
}
.agent-chat-panel:not(.has-conversation) .chat-header {
  justify-content: center;
  text-align: center;
  margin: 0 0 12px;
}
.agent-chat-panel:not(.has-conversation) .chat-header-actions {
  display: none;
}
.agent-chat-panel:not(.has-conversation) .chat-header h2::after {
  content: '用自然语言描述你的研究需求，我会帮你检索、筛选并推荐论文。';
  display: block;
  margin-top: 13px;
  color: #94a3b8;
  font-size: 15px;
  font-weight: 400;
  letter-spacing: 0;
}
.agent-chat-panel:not(.has-conversation) .chat-filter-slot :deep(.search-toolbar) {
  padding: 2px 0;
  min-height: 36px;
}
.agent-chat-panel:not(.has-conversation) .message-list {
  flex: 0;
  min-height: 0;
  height: 0;
  padding: 0;
  overflow: visible;
}
.agent-chat-panel:not(.has-conversation) .chat-empty {
  display: none;
}
.agent-chat-panel:not(.has-conversation) .chat-composer {
  width: min(820px, 100%);
  margin: 0 auto;
}
@media (max-width: 720px) {
  .agent-chat-panel,
  .has-conversation {
    min-height: calc(100vh - 40px);
  }
  .chat-header h2 {
    font-size: 27px;
  }
  .message-list {
    padding: 20px 0;
  }
  .chat-message {
    max-width: 88%;
  }
  .chat-filter-slot :deep(.search-toolbar) {
    align-items: flex-start;
    flex-direction: column;
  }
  .chat-filter-slot :deep(.search-toolbar-actions) {
    width: 100%;
  }
  .chat-filter-slot :deep(.source-dropdown),
  .chat-filter-slot :deep(.source-trigger) {
    width: 100%;
    box-sizing: border-box;
  }
  .chat-composer {
    border-radius: 16px;
  }
}
.has-conversation {
  height: calc(100vh - 96px);
  min-height: 0;
  max-height: calc(100vh - 96px);
}
.has-conversation .message-list {
  flex: 1 1 auto;
  min-height: 0;
  height: auto;
  padding-bottom: 68px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
.scroll-to-bottom-button {
  position: sticky;
  bottom: 12px;
  z-index: 1;
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: none;
  align-self: center;
  align-items: center;
  justify-content: center;
  margin: -42px 0 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #a1a1a1;
  box-shadow: none;
  cursor: pointer;
}
.scroll-to-bottom-button::before {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: rgba(26, 26, 26, 0.06);
  content: '';
  transition:
    background 150ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.scroll-to-bottom-button > :deep(svg) {
  position: relative;
  z-index: 1;
  stroke-width: 1.5px;
}
.scroll-to-bottom-button:focus-visible {
  outline: 3px solid rgba(26, 26, 26, 0.2);
  outline-offset: 2px;
}
.has-conversation .chat-composer {
  flex: none;
  position: relative;
  bottom: auto;
  margin-top: 0;
}
.chat-message,
.chat-message-user,
.chat-message-assistant,
.chat-message-system,
.chat-message p,
.message-role {
  text-align: left;
}
.chat-message-user .message-role {
  text-align: left;
}
.message-list::-webkit-scrollbar {
  width: 8px;
}
.message-list::-webkit-scrollbar-track {
  background: transparent;
}
.message-list::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.5);
  background-clip: padding-box;
}
.message-list::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.72);
  background-clip: padding-box;
}
@media (max-width: 720px) {
  .has-conversation {
    height: calc(100vh - 40px);
    max-height: calc(100vh - 40px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .scroll-to-bottom-button {
    transition: none;
  }
}
.markdown-body {
  overflow-wrap: anywhere;
  text-align: left;
}
.markdown-body.is-streaming::after {
  display: inline-block;
  width: 0.58em;
  height: 1.15em;
  margin-left: 0.14em;
  border-radius: 1px;
  vertical-align: -0.2em;
  background: #64748b;
  content: '';
  animation: streaming-caret 0.92s steps(1, end) infinite;
}
@keyframes streaming-caret {
  50% {
    opacity: 0;
  }
}
.markdown-body :deep(p) {
  margin: 0 0 10px;
  line-height: 1.75;
}
.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 16px 0 8px;
  color: #172033;
  line-height: 1.35;
}
.markdown-body :deep(h1) {
  font-size: 1.35em;
}
.markdown-body :deep(h2) {
  font-size: 1.22em;
}
.markdown-body :deep(h3) {
  font-size: 1.1em;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 8px 0;
  padding-left: 22px;
}
.markdown-body :deep(li) {
  margin: 4px 0;
  line-height: 1.65;
}
.markdown-body :deep(a) {
  color: #3b5ccc;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.markdown-body :deep(code) {
  padding: 2px 5px;
  border-radius: 5px;
  color: #334155;
  background: rgba(148, 163, 184, 0.18);
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.88em;
}
.markdown-body :deep(pre) {
  max-width: 100%;
  margin: 10px 0;
  overflow: auto;
  padding: 12px;
  border-radius: 10px;
  background: #1e293b;
}
.markdown-body :deep(pre code) {
  padding: 0;
  color: #e2e8f0;
  background: transparent;
  line-height: 1.6;
}
.markdown-body :deep(blockquote) {
  margin: 10px 0;
  padding-left: 12px;
  border-left: 3px solid #93a6ef;
  color: #64748b;
}
.markdown-body :deep(table) {
  display: block;
  max-width: 100%;
  margin: 10px 0;
  overflow-x: auto;
  border-collapse: collapse;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 7px 9px;
  border: 1px solid #dbe1ea;
  text-align: left;
  white-space: nowrap;
}
.markdown-body :deep(th) {
  background: #eef2ff;
  font-weight: 700;
}
.send-button {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: 31px;
  height: 31px;
  margin: 0;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: #fff;
  background: #4f6fe8;
  box-shadow: 0 3px 8px rgba(79, 111, 232, 0.28);
  transition: transform 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
}
.send-button svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.send-button:hover:not(:disabled) {
  transform: translateY(-1px);
  background: #3f5ed4;
  box-shadow: 0 5px 12px rgba(79, 111, 232, 0.34);
}
.send-button:active:not(:disabled) {
  transform: translateY(0);
}
.send-button:focus-visible {
  outline: 3px solid rgba(79, 111, 232, 0.25);
  outline-offset: 2px;
}
.send-button:disabled {
  opacity: 1;
  color: #f8fafc;
  background: #cbd5e1;
  box-shadow: none;
  cursor: not-allowed;
}
.chat-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(130px, 170px) auto;
  column-gap: 8px;
  align-items: end;
  padding: 16px 18px 13px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.78), rgba(238, 242, 255, 0.64));
  box-shadow:
    0 18px 42px rgba(74, 85, 140, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(135%);
  -webkit-backdrop-filter: blur(20px) saturate(135%);
}
.chat-composer > textarea {
  grid-column: 1;
  grid-row: 1;
}
.llm-profile-selector {
  grid-column: 2;
  grid-row: 1;
  position: relative;
  min-width: 0;
  margin: 0;
}
.llm-profile-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.llm-profile-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 31px;
  padding: 0 10px 0 11px;
  border: 1px solid rgba(122, 143, 179, 0.32);
  border-radius: 10px;
  color: #354867;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}
.llm-profile-trigger:hover:not(:disabled),
.llm-profile-trigger[aria-expanded='true'] {
  border-color: rgba(79, 111, 232, 0.64);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(79, 111, 232, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.92);
}
.llm-profile-trigger:active:not(:disabled) {
  transform: scale(0.985);
}
.llm-profile-trigger:focus-visible,
.llm-profile-option:focus-visible {
  outline: 3px solid rgba(79, 111, 232, 0.25);
  outline-offset: 2px;
}
.llm-profile-trigger:disabled {
  color: #8795a9;
  background: rgba(241, 245, 249, 0.74);
  box-shadow: none;
  cursor: not-allowed;
}
.llm-profile-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.llm-profile-chevron {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  margin: -3px 2px 0 0;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  color: #6b7a99;
  transform: rotate(45deg);
  transition: transform 0.18s ease, color 0.18s ease;
}
.llm-profile-trigger[aria-expanded='true'] .llm-profile-chevron {
  color: #4f6fe8;
  transform: rotate(225deg) translate(-2px, -2px);
}
.llm-profile-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 2;
  display: grid;
  width: max-content;
  min-width: 100%;
  max-width: min(320px, calc(100vw - 32px));
  max-height: min(220px, 35vh);
  gap: 2px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid rgba(122, 143, 179, 0.24);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 28px rgba(74, 85, 140, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
.llm-profile-option {
  width: 100%;
  min-height: 30px;
  padding: 0 9px;
  border: 0;
  border-radius: 7px;
  color: #4b5b78;
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.llm-profile-option:hover,
.llm-profile-option:focus-visible {
  color: #3f5ed4;
  background: #f4f6ff;
}
.llm-profile-option.is-selected {
  color: #3f5ed4;
  background: #e9eeff;
  font-weight: 700;
}
.chat-filter-slot {
  grid-column: 1 / -1;
  padding: 0;
  background: transparent;
  border: 0;
}
.composer-divider {
  grid-column: 1 / -1;
  height: 1px;
  margin: 8px 0 9px;
  background: linear-gradient(90deg, transparent, rgba(129, 140, 190, 0.25), transparent);
}
.chat-filter-slot :deep(.search-toolbar) {
  min-height: 36px;
  padding: 0 2px;
}
.chat-filter-slot :deep(.filter-tag) {
  padding: 7px 12px;
  border-color: rgba(129, 140, 190, 0.2);
  color: #53617d;
  background: rgba(255, 255, 255, 0.62);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  font-weight: 650;
}
.chat-filter-slot :deep(.filter-tag:hover),
.chat-filter-slot :deep(.filter-tag-active) {
  border-color: rgba(102, 126, 234, 0.58);
  color: #465dc4;
  background: rgba(232, 237, 255, 0.8);
  box-shadow:
    0 5px 13px rgba(102, 126, 234, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
}
.chat-filter-slot :deep(.add-btn) {
  width: 30px;
  height: 30px;
  justify-content: center;
  padding: 0;
  color: #5c70ce;
  background: rgba(238, 242, 255, 0.76);
  font-size: 20px;
  line-height: 1;
}
.chat-filter-slot :deep(.source-trigger) {
  border: 1px solid rgba(129, 140, 190, 0.2);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.62);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
.chat-composer > p {
  grid-column: 1 / -1;
  margin-top: 8px;
}
.search-agent-button {
  float: right;
  margin: -47px 50px 0 0;
  padding: 8px 12px;
  border: 1px solid rgba(102, 126, 234, 0.32);
  border-radius: 999px;
  color: #465dc4;
  background: rgba(238, 242, 255, 0.86);
  box-shadow: 0 5px 13px rgba(102, 126, 234, 0.12);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.search-agent-button:hover:not(:disabled) {
  transform: translateY(-1px);
  background: rgba(224, 231, 255, 0.96);
  box-shadow: 0 8px 18px rgba(102, 126, 234, 0.2);
}

.search-agent-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.chat-composer > .send-button {
  grid-column: 3;
  grid-row: 1;
  align-self: end;
  float: none;
  margin: 0;
}
@media (max-width: 560px) {
  .chat-composer {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 8px;
  }
  .chat-composer textarea {
    grid-column: 1 / -1;
    grid-row: 1;
  }
  .llm-profile-selector {
    grid-column: 1;
    grid-row: 2;
  }
  .chat-composer > .send-button {
    grid-column: 2;
    grid-row: 2;
  }
}
</style>
