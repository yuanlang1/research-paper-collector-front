<template>
  <div class="review-detail-wrapper">
    <div class="background-shapes" aria-hidden="true">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>

    <main class="review-detail-container" :aria-busy="isLoading">
      <div class="top-actions">
        <button class="btn btn-outline" type="button" @click="goBack">返回综述任务</button>
      </div>

      <section v-if="isLoading" class="state-card" aria-live="polite">
        <div class="loading-spinner" aria-hidden="true"></div>
        <p>正在加载综述详情...</p>
      </section>

      <section v-else-if="errorMessage" class="state-card error-state" role="alert">
        <h1>综述详情加载失败</h1>
        <p>{{ errorMessage }}</p>
        <button class="btn btn-primary" type="button" @click="loadReview">重新加载</button>
      </section>

      <template v-else-if="review">
        <header class="review-header">
          <div class="review-heading">
            <p class="review-topic">{{ review.topic }}</p>
            <h1>{{ review.title }}</h1>
          </div>

          <dl class="review-metadata">
            <div>
              <dt>关联检索任务</dt>
              <dd>任务 #{{ review.taskId }}</dd>
            </div>
            <div>
              <dt>版本</dt>
              <dd>v{{ review.versionNumber }}</dd>
            </div>
            <div>
              <dt>输出语言</dt>
              <dd>{{ review.language || '-' }}</dd>
            </div>
            <div>
              <dt>综述类型</dt>
              <dd>{{ review.reviewTypeName || '-' }}</dd>
            </div>
            <div>
              <dt>引用格式</dt>
              <dd class="citation-style">{{ review.citationStyleName || '-' }}</dd>
            </div>
            <div>
              <dt>创建时间</dt>
              <dd>{{ review.creationTime || '-' }}</dd>
            </div>
            <div>
              <dt>最后修改</dt>
              <dd>{{ review.modificationTime || '-' }}</dd>
            </div>
          </dl>

          <div v-if="review.scope" class="scope-panel">
            <h2>综述范围</h2>
            <p>{{ review.scope }}</p>
          </div>
        </header>

        <article class="document-card">
          <div
            v-if="sanitizedPandocHtml"
            class="review-markdown pandoc-content"
            v-html="sanitizedPandocHtml"
          ></div>
          <div v-else-if="renderedMarkdown" class="review-markdown" v-html="renderedMarkdown"></div>
          <div v-else class="document-empty">
            <h2>暂无综述正文</h2>
            <p>该综述尚未保存可展示的 Markdown 内容。</p>
          </div>
        </article>

        <section v-if="!sanitizedPandocHtml && formattedReferences.length" class="references-card">
          <div class="section-heading">
            <h2>参考文献</h2>
            <span>共 {{ formattedReferences.length }} 条</span>
          </div>
          <div class="reference-list">
            <p v-for="reference in formattedReferences" :key="reference.key">
              {{ reference.formatted }}
            </p>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import { apiService, type ReviewDetail, type ReviewRender } from '@/services/api'

const route = useRoute()
const router = useRouter()
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: false })

const review = ref<ReviewDetail | null>(null)
const reviewRender = ref<ReviewRender | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')

const splitReferenceEntries = (value: string) => {
  return value
    .replace(/\r\n?/g, '\n')
    .split(/(?=\[\d+\]\s)/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const formatReferenceSection = (content: string) => {
  const headingMatch = /^(#{1,6}\s*(?:参考文献|references)\s*)$/im.exec(content)
  if (!headingMatch || headingMatch.index === undefined) return content

  const headingEnd = headingMatch.index + headingMatch[0].length
  const contentAfterHeading = content.slice(headingEnd)
  const nextHeadingIndex = contentAfterHeading.search(/\n#{1,6}\s+/)
  const referenceContent = nextHeadingIndex === -1
    ? contentAfterHeading
    : contentAfterHeading.slice(0, nextHeadingIndex)
  const remainingContent = nextHeadingIndex === -1
    ? ''
    : contentAfterHeading.slice(nextHeadingIndex)
  const formattedReferences = referenceContent.replace(/([^\n])\s+(?=\[\d+\]\s)/g, '$1\n\n')

  return `${content.slice(0, headingEnd)}${formattedReferences}${remainingContent}`
}

const sourceMarkdown = computed(() => {
  if (!review.value) return ''
  if (review.value.markdown?.trim()) return formatReferenceSection(review.value.markdown)

  const fallbackMarkdown = [
    review.value.abstractContent?.trim()
      ? `## 摘要\n\n${review.value.abstractContent.trim()}`
      : '',
    review.value.bodyMarkdown?.trim() || '',
    review.value.conclusion?.trim()
      ? `## 结论\n\n${review.value.conclusion.trim()}`
      : ''
  ].filter(Boolean).join('\n\n')

  return formatReferenceSection(fallbackMarkdown)
})

const renderedMarkdown = computed(() => {
  return sourceMarkdown.value ? markdown.render(sourceMarkdown.value) : ''
})

const sanitizedPandocHtml = computed(() => {
  if (!reviewRender.value?.html) return ''

  return DOMPurify.sanitize(reviewRender.value.html, {
    USE_PROFILES: { html: true }
  })
})

const formattedReferences = computed(() => {
  return (review.value?.references || []).flatMap((reference, referenceIndex) => {
    return splitReferenceEntries(reference.formatted || '').map((formatted, entryIndex) => ({
      key: `${reference.paper_id || referenceIndex}-${entryIndex}`,
      formatted
    }))
  })
})

const loadReview = async () => {
  const id = Number(route.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    review.value = null
    reviewRender.value = null
    errorMessage.value = '综述 ID 必须是大于 0 的整数'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await apiService.getReviewDetail(id)
    review.value = response.data

    try {
      reviewRender.value = await apiService.getReviewRender(id)
    } catch (error) {
      reviewRender.value = null
      console.warn('Pandoc 渲染失败，已降级为 Markdown 展示：', error)
    }
  } catch (error) {
    review.value = null
    reviewRender.value = null
    errorMessage.value = error instanceof Error ? error.message : '无法获取综述详情，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

const goBack = () => {
  router.push({ name: 'review-tasks' })
}

watch(() => route.params.id, loadReview, { immediate: true })
</script>

<style scoped>
.review-detail-wrapper {
  min-height: 100vh;
  min-height: 100dvh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  position: relative;
  overflow-x: hidden;
}

.background-shapes {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.5;
  animation: float 20s ease-in-out infinite;
  will-change: transform;
}

.shape-1 {
  width: 400px;
  height: 400px;
  top: -100px;
  left: -100px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.shape-2 {
  width: 350px;
  height: 350px;
  top: 50%;
  right: -100px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  animation-delay: 7s;
}

.shape-3 {
  width: 300px;
  height: 300px;
  bottom: -100px;
  left: 50%;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  animation-delay: 14s;
}

@keyframes float {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  33% { transform: translate3d(50px, -50px, 0) scale(1.1); }
  66% { transform: translate3d(-50px, 50px, 0) scale(0.9); }
}

.review-detail-container {
  position: relative;
  z-index: 1;
  width: min(1400px, calc(100% - 48px));
  margin: 0 auto;
  padding: 28px 0 56px;
}

.top-actions {
  display: flex;
  margin-bottom: 16px;
}

.review-header,
.document-card,
.references-card,
.state-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.review-header {
  padding: 30px 34px;
  margin-bottom: 18px;
}

.review-heading {
  padding-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.review-topic {
  margin: 0 0 9px;
  color: #2563eb;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.6;
}

.review-heading h1 {
  margin: 0;
  color: #1f2937;
  font-size: clamp(25px, 4vw, 36px);
  font-weight: 700;
  line-height: 1.35;
}

.review-metadata {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px 26px;
  margin: 24px 0 0;
}

.review-metadata div { min-width: 0; }

.review-metadata dt {
  margin-bottom: 5px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
}

.review-metadata dd {
  margin: 0;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.citation-style { text-transform: uppercase; }

.scope-panel {
  margin-top: 24px;
  padding: 16px 18px;
  border-left: 3px solid #3b82f6;
  border-radius: 6px;
  background: #f8fafc;
}

.scope-panel h2 {
  margin: 0 0 6px;
  color: #374151;
  font-size: 14px;
}

.scope-panel p {
  margin: 0;
  color: #4b5563;
  font-size: 14px;
  line-height: 1.75;
}

.document-card {
  padding: 42px 52px;
}

.review-markdown {
  max-width: 1120px;
  margin: 0 auto;
  color: #34495e;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.85;
  overflow-wrap: anywhere;
}

.review-markdown :deep(h1),
.review-markdown :deep(h2),
.review-markdown :deep(h3),
.review-markdown :deep(h4) {
  color: #1f2937;
  line-height: 1.35;
}

.review-markdown :deep(h1) {
  margin: 0 0 28px;
  padding-bottom: 12px;
  border-bottom: 3px solid #667eea;
  font-size: 32px;
}

.review-markdown :deep(h2) {
  margin: 38px 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 24px;
}

.review-markdown :deep(h3) { margin: 28px 0 12px; font-size: 19px; }
.review-markdown :deep(h4) { margin: 22px 0 10px; font-size: 16px; }
.review-markdown :deep(p) { margin: 0 0 18px; }
.review-markdown :deep(ul),
.review-markdown :deep(ol) { margin: 0 0 18px; padding-left: 26px; }
.review-markdown :deep(li) { margin-bottom: 7px; }

.review-markdown :deep(blockquote) {
  margin: 22px 0;
  padding: 12px 18px;
  border-left: 3px solid #94a3b8;
  background: #f8fafc;
  color: #475569;
}

.review-markdown :deep(a) { color: #2563eb; text-underline-offset: 3px; }
.review-markdown :deep(a:hover) { color: #1d4ed8; }
.review-markdown :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #9f1239;
  font-size: 0.9em;
}

.review-markdown :deep(pre) {
  overflow-x: auto;
  padding: 16px;
  border-radius: 8px;
  background: #1e293b;
  color: #e2e8f0;
}

.review-markdown :deep(pre code) { padding: 0; background: transparent; color: inherit; }
.review-markdown :deep(table) { width: 100%; margin: 22px 0; border-collapse: collapse; }
.review-markdown :deep(th),
.review-markdown :deep(td) { padding: 10px 12px; border: 1px solid #dbe2ea; text-align: left; }
.review-markdown :deep(th) { background: #f8fafc; color: #374151; }

.pandoc-content :deep(#refs) {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid #dbe5f1;
}

.pandoc-content :deep(.csl-entry) {
  margin-bottom: 12px;
  padding-left: 2.5em;
  color: #475569;
  font-size: 14px;
  line-height: 1.8;
  text-indent: -2.5em;
}

.pandoc-content :deep(.citation) {
  color: #2563eb;
  font-weight: 600;
}

.document-empty {
  padding: 30px 0;
  color: #6b7280;
  text-align: center;
}

.document-empty h2 { margin: 0 0 8px; color: #374151; font-size: 18px; }
.document-empty p { margin: 0; font-size: 14px; }

.references-card {
  margin-top: 18px;
  padding: 26px 34px;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid #e5e7eb;
}

.section-heading h2 { margin: 0; color: #1f2937; font-size: 19px; }
.section-heading span { color: #6b7280; font-size: 13px; white-space: nowrap; }
.reference-list { margin-top: 18px; }
.reference-list p {
  margin: 0 0 12px;
  padding-left: 2.45em;
  color: #475569;
  font-size: 14px;
  line-height: 1.75;
  text-indent: -2.45em;
}

.reference-list p:last-child { margin-bottom: 0; }

.state-card {
  min-height: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6b7280;
  text-align: center;
}

.state-card h1 { margin: 0 0 8px; color: #374151; font-size: 22px; }
.state-card p { margin: 0 0 22px; }
.error-state p { color: #b91c1c; }

.loading-spinner {
  width: 32px;
  height: 32px;
  margin-bottom: 16px;
  border: 3px solid #f3f4f6;
  border-top-color: #0088ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.btn-primary { border-color: #0066cc; background: #0066cc; color: #ffffff; }
.btn-primary:hover { border-color: #0052a3; background: #0052a3; }
.btn-outline { border-color: #d0d7de; background: rgba(255, 255, 255, 0.88); color: #4b5563; }
.btn-outline:hover { background: #f6f8fa; }
.btn:focus-visible { outline: 3px solid rgba(59, 130, 246, 0.28); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  .shape,
  .loading-spinner { animation: none; }
}

@media (max-width: 768px) {
  .review-detail-container { width: min(100% - 24px, 1400px); padding: 18px 0 36px; }
  .review-header { padding: 22px 20px; }
  .review-metadata { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
  .document-card { padding: 28px 20px; }
  .review-markdown { font-size: 14px; }
  .review-markdown :deep(h1) { font-size: 25px; }
  .review-markdown :deep(h2) { font-size: 21px; }
  .references-card { padding: 22px 20px; }
}

@media (max-width: 480px) {
  .review-metadata { grid-template-columns: 1fr; }
  .section-heading { align-items: flex-start; flex-direction: column; gap: 5px; }
}
</style>
