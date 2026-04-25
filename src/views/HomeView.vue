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
    <div class="search-shell">
      <SearchInput 
        v-model="searchQuery"
        :placeholder="searchInputPlaceholder"
        @search="handleSearch"
        @clear="handleClear"
      />

      <div class="search-shell-divider"></div>

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
                  v-for="opt in sourceOptions"
                  :key="opt.value"
                  class="source-option source-option-multi"
                  :class="{ active: selectedSources.includes(opt.value) }"
                  @click.stop="toggleSource(opt.value)"
                >
                  <span>{{ opt.label }}</span>
                  <span class="source-check">{{ selectedSources.includes(opt.value) ? '✓' : '' }}</span>
                </div>
              </div>
            </transition>
          </div>
          <SearchButton class="home-search-btn" @click="handleSearch" />
        </div>
      </div>
    </div>
    
    <!-- 查询理解区域 -->
    <div class="understanding-section" v-if="showStructuredQuery">
      <div class="understanding-header">
        <h3>查询理解</h3>
      </div>

      <div v-if="structuredQuery" class="understanding-card">
        <div class="structured-grid structured-grid-plain">
          <div class="structured-inline-field">
            <span class="structured-inline-label">主题：</span>
            <input v-model="structuredQuery.topic" type="text" class="structured-inline-input" />
          </div>

          <div class="structured-inline-field">
            <span class="structured-inline-label">意图：</span>
            <input v-model="structuredQuery.intent" type="text" class="structured-inline-input" />
          </div>

          <div class="structured-inline-field">
            <span class="structured-inline-label">起始年份：</span>
            <input
              v-model="yearFromInput"
              type="number"
              class="structured-inline-input structured-inline-input-year"
              placeholder="可为空"
              :max="structuredQuery?.yearTo ?? undefined"
              @focus="initializeYearRangeOnEdit"
            />
          </div>

          <div class="structured-inline-field">
            <span class="structured-inline-label">结束年份：</span>
            <input
              v-model="yearToInput"
              type="number"
              class="structured-inline-input structured-inline-input-year"
              placeholder="可为空"
              :min="structuredQuery?.yearFrom ?? undefined"
              @focus="initializeYearRangeOnEdit"
            />
          </div>

          <div class="structured-tags-row structured-field-full">
            <span class="structured-tags-label">子领域：</span>
            <div class="structured-tag-list structured-tag-list-plain">
              <EditableTag
                v-for="(item, index) in structuredQuery.subfields"
                :key="`subfield-${index}-${item}`"
                :keyword="item"
                @update="updateStructuredListField('subfields', index, $event)"
                @remove="removeStructuredListField('subfields', index)"
              />
              <AddKeywordButton @add="addStructuredListField('subfields', $event)" />
            </div>
          </div>

          <div class="structured-tags-row structured-field-full">
            <span class="structured-tags-label">关键词：</span>
            <div class="structured-tag-list structured-tag-list-plain">
              <EditableTag
                v-for="(item, index) in structuredQuery.keywords"
                :key="`keyword-${index}-${item}`"
                :keyword="item"
                @update="updateStructuredListField('keywords', index, $event)"
                @remove="removeStructuredListField('keywords', index)"
              />
              <AddKeywordButton @add="addStructuredListField('keywords', $event)" />
            </div>
          </div>

          <div class="structured-tags-row structured-field-full">
            <span class="structured-tags-label">同义表达：</span>
            <div class="structured-tag-list structured-tag-list-plain">
              <EditableTag
                v-for="(item, index) in structuredQuery.synonyms"
                :key="`synonym-${index}-${item}`"
                :keyword="item"
                @update="updateStructuredListField('synonyms', index, $event)"
                @remove="removeStructuredListField('synonyms', index)"
              />
              <AddKeywordButton @add="addStructuredListField('synonyms', $event)" />
            </div>
          </div>

          <div class="structured-tags-row structured-field-full">
            <span class="structured-tags-label">包含词：</span>
            <div class="structured-tag-list structured-tag-list-plain">
              <EditableTag
                v-for="(item, index) in structuredQuery.includeTerms"
                :key="`include-${index}-${item}`"
                :keyword="item"
                @update="updateStructuredListField('includeTerms', index, $event)"
                @remove="removeStructuredListField('includeTerms', index)"
              />
              <AddKeywordButton @add="addStructuredListField('includeTerms', $event)" />
            </div>
          </div>

          <div class="structured-tags-row structured-field-full">
            <span class="structured-tags-label">排除词：</span>
            <div class="structured-tag-list structured-tag-list-plain">
              <EditableTag
                v-for="(item, index) in structuredQuery.excludeTerms"
                :key="`exclude-${index}-${item}`"
                :keyword="item"
                @update="updateStructuredListField('excludeTerms', index, $event)"
                @remove="removeStructuredListField('excludeTerms', index)"
              />
              <AddKeywordButton @add="addStructuredListField('excludeTerms', $event)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    </div>

    <button
      v-if="hasSearchHistory && !isRecentDrawerOpen"
      class="recent-drawer-trigger"
      type="button"
      @click="openRecentDrawer"
    >
      最近搜索
    </button>

    <transition name="drawer-fade">
      <div
        v-if="isRecentDrawerOpen"
        class="recent-drawer-overlay"
        @click="closeRecentDrawer"
      ></div>
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
            <h3>最近搜索</h3>
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
          <div v-if="!isRecentSearchesLoading && !recentSearches.length" class="recent-search-empty-state">
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
import SearchInput from '@/components/SearchInput.vue'
import SearchButton from '@/components/SearchButton.vue'
import EditableTag from '@/components/EditableTag.vue'
import AddKeywordButton from '@/components/AddKeywordButton.vue'
import { apiService, type QueryUnderstanding } from '@/services/api'
import {
  buildSubmitPaperTags,
  buildSubmitSourceTags,
  DEFAULT_VISIBLE_PAPER_TAGS,
  PAPER_TAG_POOL,
  SOURCE_OPTIONS,
  type PaperTagItem,
  type PaperTagValue,
  type SourceTag
} from '@/constants/searchTagMappings'
import { isTimeoutError } from '@/utils/fetchWithTimeout'

// 路由
const router = useRouter()

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
      const response = await apiService.getSearchHistoryWithPagination(pageNumber, recentSearchPageSize)

      mergedRecentSearches.push(
        ...response.data.list.map(item => ({
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
}

// 搜索相关状态
const searchQuery = ref('')
const searchInputPlaceholder = ref('搜索论文相关词...')
const searchInputBackupValue = ref('')
let searchPromptTipTimer: ReturnType<typeof setTimeout> | null = null

// 年份过滤标签池：N 表示近 N 年，默认不选择（yearTag=0）
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

const paperTag = ref<PaperTagValue | ''>('')

const togglePaperTag = (tagValue: PaperTagValue) => {
  paperTag.value = paperTag.value === tagValue ? '' : tagValue
}

const removePaperTag = (tagValue: PaperTagValue) => {
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
    syncStructuredQueryYearRange(year)
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

// 数据来源标签：sourceTag 多选（未选择表示全选）
const selectedSources = ref<SourceTag[]>([])
const sourceOptions = SOURCE_OPTIONS

const sourceTriggerLabel = computed(() => {
  if (selectedSources.value.length === 0) {
    return '全部来源'
  }

  return sourceOptions
    .filter(opt => selectedSources.value.includes(opt.value))
    .map(opt => opt.label)
    .join(', ')
})

// source 下拉逻辑
const showSourceMenu = ref(false)
const sourceDropdownRef = ref<HTMLElement | null>(null)
const sourceSelectWidth = ref('auto')

const toggleSourceMenu = () => {
  showSourceMenu.value = !showSourceMenu.value
}

const toggleSource = (value: SourceTag) => {
  if (selectedSources.value.includes(value)) {
    selectedSources.value = selectedSources.value.filter(item => item !== value)
  } else {
    selectedSources.value = [...selectedSources.value, value]
  }
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

watch(selectedSources, () => {
  updateSourceSelectWidth()
}, { deep: true })

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', handleViewportResize)
  window.addEventListener('pointermove', handleRecentDrawerResize)
  window.addEventListener('pointerup', stopRecentDrawerResize)
  window.addEventListener('pointercancel', stopRecentDrawerResize)
  nextTick(() => {
    handleViewportResize()
    updateSourceSelectWidth()
  })
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', handleViewportResize)
  window.removeEventListener('pointermove', handleRecentDrawerResize)
  window.removeEventListener('pointerup', stopRecentDrawerResize)
  window.removeEventListener('pointercancel', stopRecentDrawerResize)
  stopRecentDrawerResize()
  if (extractTimer) {
    clearTimeout(extractTimer)
  }
  if (searchPromptTipTimer) {
    clearTimeout(searchPromptTipTimer)
  }
})

// 查询理解相关状态
const structuredQuery = ref<QueryUnderstanding | null>(null)
const isUnderstandingQuery = ref(false)
const queryMatched = ref(false)
const queryClassification = ref('')
const queryReason = ref('')
const consistencyValid = ref(false)
const understandingCache = new Map<string, {
  classification: string
  reason: string
  consistencyValid: boolean
  matched: boolean
  structuredQuery: QueryUnderstanding | null
}>()
let latestUnderstandRequestId = 0

const showStructuredQuery = computed(() => queryMatched.value)

const queryClassificationLabel = computed(() => {
  const classificationMap: Record<string, string> = {
    PAPER_SEARCH: '论文检索',
    GENERAL_SEARCH: '通用检索',
    UNKNOWN: '未分类'
  }

  return classificationMap[queryClassification.value] || queryClassification.value || '论文检索'
})

type StructuredListField = 'subfields' | 'keywords' | 'synonyms' | 'includeTerms' | 'excludeTerms'

const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isNaN(num) ? null : num
}

const cloneStructuredQuery = (query: QueryUnderstanding): QueryUnderstanding => ({
  ...query,
  subfields: [...query.subfields],
  keywords: [...query.keywords],
  synonyms: [...query.synonyms],
  includeTerms: [...query.includeTerms],
  excludeTerms: [...query.excludeTerms]
})

const addStructuredListField = (field: StructuredListField, value: string) => {
  if (!structuredQuery.value) return

  const trimmedValue = value.trim()
  if (!trimmedValue) return

  structuredQuery.value[field].push(trimmedValue)
}

const updateStructuredListField = (field: StructuredListField, index: number, value: string) => {
  if (!structuredQuery.value) return

  const trimmedValue = value.trim()
  if (!trimmedValue) return

  structuredQuery.value[field][index] = trimmedValue
}

const removeStructuredListField = (field: StructuredListField, index: number) => {
  if (!structuredQuery.value) return

  structuredQuery.value[field].splice(index, 1)
}

const yearFromInput = computed({
  get: () => structuredQuery.value?.yearFrom?.toString() || '',
  set: (value: string) => {
    if (!structuredQuery.value) return

    const parsedValue = parseOptionalNumber(value)
    if (parsedValue == null) {
      structuredQuery.value.yearFrom = null
      syncToolbarTagFromStructuredYears()
      return
    }

    if (structuredQuery.value.yearTo == null) {
      structuredQuery.value.yearTo = getCurrentYear()
    }

    const maxAllowedYear = structuredQuery.value.yearTo ?? parsedValue
    structuredQuery.value.yearFrom = Math.min(parsedValue, maxAllowedYear)
    syncToolbarTagFromStructuredYears()
  }
})

const yearToInput = computed({
  get: () => structuredQuery.value?.yearTo?.toString() || '',
  set: (value: string) => {
    if (!structuredQuery.value) return

    const parsedValue = parseOptionalNumber(value)
    if (parsedValue == null) {
      structuredQuery.value.yearTo = null
      syncToolbarTagFromStructuredYears()
      return
    }

    if (structuredQuery.value.yearFrom == null) {
      structuredQuery.value.yearFrom = getCurrentYear()
    }

    const minAllowedYear = structuredQuery.value.yearFrom ?? parsedValue
    structuredQuery.value.yearTo = Math.max(parsedValue, minAllowedYear)
    syncToolbarTagFromStructuredYears()
  }
})

watch(
  () => [structuredQuery.value?.yearFrom ?? null, structuredQuery.value?.yearTo ?? null],
  () => {
    syncToolbarTagFromStructuredYears()
  }
)

// 计算属性：是否有搜索历史
const hasSearchHistory = computed(() => {
  return recentSearches.value.length > 0
})

// 查询理解（增加缓存和超时处理）
const understandQuery = async (query: string) => {
  if (!query.trim()) return

  const trimmedQuery = query.trim()

  if (understandingCache.has(trimmedQuery)) {
    const cached = understandingCache.get(trimmedQuery)
    if (cached) {
      queryClassification.value = cached.classification
      queryReason.value = cached.reason
      consistencyValid.value = cached.consistencyValid
      queryMatched.value = cached.matched
      structuredQuery.value = cached.matched
        ? cloneStructuredQuery(cached.structuredQuery ?? buildDefaultStructuredQuery())
        : null

      if (filterYear.value > 0) {
        syncStructuredQueryYearRange(filterYear.value)
      } else {
        syncToolbarTagFromStructuredYears()
      }
    }
    return
  }

  const requestId = ++latestUnderstandRequestId
  isUnderstandingQuery.value = true

  try {
    const result = await apiService.queryUnderstanding(trimmedQuery)

    if (requestId !== latestUnderstandRequestId || trimmedQuery !== searchQuery.value.trim()) {
      return
    }

    queryClassification.value = result.data.classification || ''
    queryReason.value = result.data.reason || ''
    consistencyValid.value = result.data.consistencyValid
    queryMatched.value = result.data.matched

    if (result.data.matched && result.data.structuredQuery) {
      structuredQuery.value = cloneStructuredQuery(result.data.structuredQuery)

      if (filterYear.value > 0) {
        syncStructuredQueryYearRange(filterYear.value)
      } else {
        syncToolbarTagFromStructuredYears()
      }
      understandingCache.set(trimmedQuery, {
        classification: result.data.classification || '',
        reason: result.data.reason || '',
        consistencyValid: result.data.consistencyValid,
        matched: true,
        structuredQuery: cloneStructuredQuery(structuredQuery.value)
      })
    } else if (result.data.matched) {
      structuredQuery.value = buildDefaultStructuredQuery()

      if (filterYear.value > 0) {
        syncStructuredQueryYearRange(filterYear.value)
      } else {
        syncToolbarTagFromStructuredYears()
      }
      understandingCache.set(trimmedQuery, {
        classification: result.data.classification || '',
        reason: result.data.reason || '',
        consistencyValid: result.data.consistencyValid,
        matched: true,
        structuredQuery: cloneStructuredQuery(structuredQuery.value)
      })
    } else {
      structuredQuery.value = null
      updateYearTagSelectionOnly(0)
      understandingCache.set(trimmedQuery, {
        classification: result.data.classification || '',
        reason: result.data.reason || '',
        consistencyValid: result.data.consistencyValid,
        matched: false,
        structuredQuery: null
      })
    }
  } catch (error) {
    if (requestId !== latestUnderstandRequestId) {
      return
    }

    if (!isTimeoutError(error)) {
      console.error('Failed to understand query:', error)
    }
    structuredQuery.value = null
    updateYearTagSelectionOnly(0)
    queryMatched.value = false
    queryClassification.value = ''
    queryReason.value = ''
    consistencyValid.value = false
  } finally {
    if (requestId !== latestUnderstandRequestId) {
      return
    }
    isUnderstandingQuery.value = false
  }
}

// 监听搜索框变化，自动进行查询理解
let extractTimer: NodeJS.Timeout
watch(searchQuery, (newQuery) => {
  if (searchPromptTipTimer) {
    return
  }

  if (extractTimer) {
    clearTimeout(extractTimer)
  }

  if (!newQuery.trim()) {
    latestUnderstandRequestId += 1
    isUnderstandingQuery.value = false
    structuredQuery.value = null
    updateYearTagSelectionOnly(0)
    queryMatched.value = false
    queryClassification.value = ''
    queryReason.value = ''
    consistencyValid.value = false
    return
  }

  extractTimer = setTimeout(() => {
    understandQuery(newQuery)
  }, 600)
})

const buildDefaultStructuredQuery = (): QueryUnderstanding => ({
  topic: searchQuery.value.trim(),
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

const showSearchPromptTip = () => {
  if (searchPromptTipTimer) {
    clearTimeout(searchPromptTipTimer)
  }

  if (extractTimer) {
    clearTimeout(extractTimer)
  }

  searchInputBackupValue.value = searchQuery.value
  searchQuery.value = ''
  searchInputPlaceholder.value = '请输入论文检索prompt'

  searchPromptTipTimer = setTimeout(() => {
    searchQuery.value = searchInputBackupValue.value
    searchInputPlaceholder.value = '搜索论文相关词...'
    searchPromptTipTimer = null
  }, 1600)
}

const resetStructuredQuery = () => {
  structuredQuery.value = null
  queryMatched.value = false
  queryClassification.value = ''
  queryReason.value = ''
  consistencyValid.value = false
  updateYearTagSelectionOnly(0)
}

// 搜索处理
const handleSearch = async () => {
  if (!searchQuery.value.trim()) return

  if (!queryMatched.value || !structuredQuery.value) {
    showSearchPromptTip()
    return
  }
  
  try {
    const response = await apiService.submitSearch({
      prompt: searchQuery.value.trim(),
      searchTag: {
        yearTag: filterYear.value,
        paperTag: buildSubmitPaperTags(paperTag.value),
        sourceTag: buildSubmitSourceTags(selectedSources.value)
      },
      promptUnderstanding: {
        ...structuredQuery.value,
        subfields: [...structuredQuery.value.subfields],
        keywords: [...structuredQuery.value.keywords],
        synonyms: [...structuredQuery.value.synonyms],
        includeTerms: [...structuredQuery.value.includeTerms],
        excludeTerms: [...structuredQuery.value.excludeTerms]
      }
    })
    
    if (response.code === 0 && response.success) {
      router.push({
        name: 'tasks',
        query: { taskId: response.data.toString() }
      })
      
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
  searchInputBackupValue.value = ''
  searchInputPlaceholder.value = '搜索论文相关词...'
  if (searchPromptTipTimer) {
    clearTimeout(searchPromptTipTimer)
    searchPromptTipTimer = null
  }
  selectedHistoryId.value = null
  resetStructuredQuery()
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


.search-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(860px, calc(100vw - 72px));
  padding: 18px 18px 16px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(255, 255, 255, 0.68);
  box-shadow: 0 20px 44px rgba(101, 119, 187, 0.14);
  backdrop-filter: blur(18px);
}

.search-shell-divider {
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, rgba(148, 163, 184, 0), rgba(148, 163, 184, 0.22), rgba(148, 163, 184, 0));
}

.search-section {
  display: flex;
  justify-content: center;
  width: 100%;
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

.home-search-btn {
  margin-top: 0;
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
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 12px;
  transition: all 0.2s ease;
}

.source-trigger:hover {
  color: #2563eb;
  border-color: rgba(37, 99, 235, 0.32);
  background-color: rgba(239, 246, 255, 0.95);
  box-shadow: 0 6px 14px rgba(37, 99, 235, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.92);
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232563eb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
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
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.understanding-section {
  width: 100%;
  max-width: 800px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 10px 24px rgba(80, 102, 180, 0.12);
}

.understanding-header {
  display: flex;
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
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
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
  transition: transform 0.22s ease, box-shadow 0.22s ease, right 0.22s ease;
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
  transition: background-color 0.18s ease, color 0.18s ease;
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
  transition: transform 0.26s ease, opacity 0.26s ease;
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@media (max-width: 768px) {
  .main-title {
    font-size: 28px;
    margin: 0 0 12px 0;
  }

  .search-shell {
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
</style>
