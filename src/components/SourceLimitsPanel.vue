<template>
  <section class="source-limits-panel" aria-label="来源上限">
    <header class="source-limits-toolbar">
      <div>
        <h3>来源上限</h3>
        <p>控制每次运行时，各来源最多纳入的论文数量。</p>
      </div>
      <button class="source-limit-button source-limit-button-secondary" type="button" :disabled="loading || saving" @click="refresh">
        刷新
      </button>
    </header>

    <p v-if="notice" class="source-limit-notice" :class="`source-limit-notice-${notice.type}`">{{ notice.text }}</p>

    <div v-if="loading" class="source-limit-skeleton-list" aria-label="正在加载来源上限">
      <span v-for="index in 3" :key="index" class="source-limit-skeleton-row"></span>
    </div>

    <div v-else-if="!configuration" class="source-limit-empty-state">
      <strong>无法加载来源上限</strong>
      <span>请确认 Agent 服务已启动后重试。</span>
      <button class="source-limit-button source-limit-button-secondary" type="button" @click="refresh">重新加载</button>
    </div>

    <form v-else @submit.prevent="save">
      <div class="source-limit-list">
        <label v-for="source in sources" :key="source.key" class="source-limit-row" :for="inputId(source.key)">
          <span class="source-limit-info">
            <strong>{{ source.name }}</strong>
            <small>每页 {{ configuration.page_sizes[source.key] }} 篇，最多 {{ configuration.maximum_limits[source.key] }} 篇</small>
          </span>
          <span class="source-limit-input-wrap">
            <input
              :id="inputId(source.key)"
              v-model.number="draft[source.key]"
              type="number"
              inputmode="numeric"
              min="1"
              :max="configuration.maximum_limits[source.key]"
              step="1"
              :disabled="saving"
            />
            <span>篇</span>
          </span>
        </label>
      </div>

      <p class="source-limit-summary">
        当前上限：<strong>{{ totalLimit }}</strong> 篇。去重和筛选后，实际结果数量可能更少。
      </p>
      <p class="source-limit-caveat">运行中的任务会保留启动时的设置快照。</p>

      <footer class="source-limit-actions">
        <span v-if="isDirty" class="source-limit-dirty">有未保存更改</span>
        <button class="source-limit-button source-limit-button-primary" type="submit" :disabled="saving || !isDirty">
          {{ saving ? '保存中…' : '保存上限' }}
        </button>
      </footer>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  sourceLimitService,
  type SourceLimitName,
  type SourceLimits,
  type SourceLimitsView
} from '@/services/sourceLimitService'

const sources: Array<{ key: SourceLimitName; name: string }> = [
  { key: 'arxiv', name: 'arXiv' },
  { key: 'dblp', name: 'DBLP' },
  { key: 'google_scholar', name: 'Google Scholar' }
]

const configuration = ref<SourceLimitsView | null>(null)
const initialLimits = ref<SourceLimits | null>(null)
const draft = ref<SourceLimits>({ arxiv: 1, dblp: 1, google_scholar: 1 })
const loading = ref(false)
const saving = ref(false)
const notice = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const totalLimit = computed(() => sources.reduce((total, source) => total + (Number(draft.value[source.key]) || 0), 0))
const isDirty = computed(() =>
  Boolean(initialLimits.value && sources.some((source) => draft.value[source.key] !== initialLimits.value?.[source.key]))
)

function copyLimits(limits: SourceLimits): SourceLimits {
  return { arxiv: limits.arxiv, dblp: limits.dblp, google_scholar: limits.google_scholar }
}

function inputId(source: SourceLimitName) {
  return `source-limit-${source}`
}

function validate(): string | null {
  if (!configuration.value) return '来源上限尚未加载完成。'

  for (const source of sources) {
    const value = Number(draft.value[source.key])
    const maximum = configuration.value.maximum_limits[source.key]
    if (!Number.isInteger(value) || value < 1 || value > maximum) {
      return `${source.name} 必须设置为 1 到 ${maximum} 之间的整数。`
    }
  }
  return null
}

function applyConfiguration(view: SourceLimitsView) {
  configuration.value = view
  initialLimits.value = copyLimits(view.limits)
  draft.value = copyLimits(view.limits)
}

async function refresh() {
  try {
    loading.value = true
    notice.value = null
    applyConfiguration(await sourceLimitService.get())
  } catch (error) {
    configuration.value = null
    notice.value = { type: 'error', text: error instanceof Error ? error.message : '来源上限加载失败。' }
  } finally {
    loading.value = false
  }
}

async function save() {
  const validationError = validate()
  if (validationError) {
    notice.value = { type: 'error', text: validationError }
    return
  }

  try {
    saving.value = true
    notice.value = null
    applyConfiguration(await sourceLimitService.update(copyLimits(draft.value)))
    notice.value = { type: 'success', text: '来源上限已保存，下次运行时生效。' }
  } catch (error) {
    notice.value = { type: 'error', text: error instanceof Error ? error.message : '来源上限保存失败。' }
  } finally {
    saving.value = false
  }
}

onMounted(refresh)
</script>

<style scoped>
.source-limits-panel,
.source-limits-toolbar,
.source-limit-list,
.source-limit-row,
.source-limit-actions,
.source-limit-empty-state {
  display: grid;
}
.source-limits-panel {
  gap: 18px;
}
.source-limits-toolbar {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: start;
}
.source-limits-toolbar h3 {
  margin: 0;
  color: #243552;
  font-size: 18px;
}
.source-limits-toolbar p {
  margin: 5px 0 0;
  color: #687891;
  font-size: 13px;
  line-height: 1.55;
}
.source-limit-button {
  min-height: 34px;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 0 13px;
  font: inherit;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}
.source-limit-button:active {
  transform: translateY(1px);
}
.source-limit-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
.source-limit-button-primary {
  color: #fff;
  background: #285ea8;
  box-shadow: 0 7px 16px rgba(40, 94, 168, 0.2);
}
.source-limit-button-primary:hover:not(:disabled) {
  background: #1f4f90;
}
.source-limit-button-secondary {
  border-color: #ccd8e6;
  color: #405774;
  background: #fff;
}
.source-limit-button-secondary:hover:not(:disabled) {
  border-color: #a9c4e6;
  color: #1f4f90;
  background: #f3f8ff;
}
.source-limit-notice {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
}
.source-limit-notice-success {
  color: #166534;
  background: #ecfdf3;
}
.source-limit-notice-error {
  color: #b42318;
  background: #fff2f0;
}
.source-limit-skeleton-list,
.source-limit-list {
  display: grid;
  gap: 9px;
}
.source-limit-skeleton-row {
  display: block;
  height: 72px;
  border-radius: 14px;
  background: linear-gradient(100deg, #edf2f7 25%, #f7f9fc 38%, #edf2f7 54%);
  background-size: 200% 100%;
  animation: source-limit-loading 1.3s linear infinite;
}
.source-limit-row {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 14px 15px;
  border: 1px solid #dbe5ef;
  border-radius: 14px;
  background: #fff;
}
.source-limit-info {
  min-width: 0;
}
.source-limit-info strong,
.source-limit-info small {
  display: block;
}
.source-limit-info strong {
  color: #263d5b;
  font-size: 14px;
}
.source-limit-info small {
  margin-top: 4px;
  color: #687891;
  font-size: 12px;
}
.source-limit-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #687891;
  font-size: 13px;
}
.source-limit-input-wrap input {
  width: 80px;
  height: 36px;
  border: 1px solid #ccd8e6;
  border-radius: 9px;
  padding: 0 9px;
  color: #243552;
  font: inherit;
  font-weight: 700;
  outline: none;
  text-align: right;
}
.source-limit-input-wrap input:focus {
  border-color: #5d8dcc;
  box-shadow: 0 0 0 3px rgba(77, 130, 191, 0.12);
}
.source-limit-input-wrap input:disabled {
  color: #8a9ab0;
  background: #f6f8fb;
}
.source-limit-summary,
.source-limit-caveat {
  margin: 0;
  color: #687891;
  font-size: 12px;
  line-height: 1.55;
}
.source-limit-summary {
  padding: 1px 1px 0;
}
.source-limit-summary strong {
  color: #285ea8;
}
.source-limit-caveat {
  color: #8a9ab0;
}
.source-limit-actions {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding-top: 2px;
}
.source-limit-dirty {
  color: #8a6218;
  font-size: 12px;
}
.source-limit-empty-state {
  justify-items: start;
  gap: 5px;
  padding: 28px;
  border: 1px dashed #bdccdd;
  border-radius: 14px;
  color: #687891;
  background: #f8fbff;
  font-size: 13px;
}
.source-limit-empty-state strong {
  color: #2f4664;
  font-size: 15px;
}
.source-limit-empty-state .source-limit-button {
  margin-top: 8px;
}
@keyframes source-limit-loading {
  to {
    background-position: -200% 0;
  }
}
@media (max-width: 560px) {
  .source-limits-toolbar,
  .source-limit-row,
  .source-limit-actions {
    grid-template-columns: 1fr;
  }
  .source-limits-toolbar .source-limit-button,
  .source-limit-actions .source-limit-button {
    justify-self: start;
  }
  .source-limit-input-wrap {
    justify-self: start;
  }
}
</style>
