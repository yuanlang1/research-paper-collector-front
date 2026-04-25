<template>
  <div class="document-view-wrapper">
    <!-- 动态背景装饰 -->
    <div class="background-decoration">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>

    <div class="document-view-container">
      <!-- 顶部导航栏 - 标题和下载按钮 -->
      <div class="top-navbar">
        <div class="paper-info">
          <h1 class="paper-title">{{ paperTitle }}</h1>
        </div>
        
        <button 
          class="download-btn"
          @click="downloadFile('md')"
          title="下载"
        >
          <span class="download-icon">⬇️</span>
          <span>下载</span>
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="content-area">
        <!-- Markdown 标签页 -->
        <div class="tab-pane md-pane">
          <div v-if="isLoading" class="loading-state">
            <div class="spinner"></div>
            <p>加载 Markdown 中...</p>
          </div>
          <div 
            v-else-if="mdContent"
            class="markdown-content markdown-body"
            v-html="renderedMarkdown"
          ></div>
          <div v-else class="empty-state">
            <div class="empty-icon">📝</div>
            <p>暂无 Markdown 文件</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { marked } from 'marked'
import { ossService } from '@/services/ossService'

const router = useRouter()
const route = useRoute()

const isLoading = ref(false)
const mdContent = ref('')

const paperTitle = computed(() => route.query.title as string || '文档查看')
const mdFileNameParam = computed(() => route.query.mdFileName as string || '')

const getObjectPath = (objectPath: string) => objectPath.trim().replace(/^\/+/, '')

const getFileName = (objectPath: string) => {
  const parts = getObjectPath(objectPath).split('/')
  return parts[parts.length - 1] || objectPath
}

const renderedMarkdown = computed(() => {
  if (!mdContent.value) return ''
  return marked.parse(mdContent.value)
})

// 加载 Markdown
const loadMarkdown = async () => {
  if (!mdFileNameParam.value) return
  
  try {
    isLoading.value = true
    const client = await ossService.getOSSClient()
    
    const objectPath = getObjectPath(mdFileNameParam.value)
    
    console.log('加载 Markdown 文件:', objectPath)
    
    const result = await client.get(objectPath)
    mdContent.value = result.content.toString()
    
    console.log('Markdown 文件加载成功')
  } catch (error) {
    console.error('加载 Markdown 失败:', error)
    mdContent.value = '无法加载 Markdown 文件'
  } finally {
    isLoading.value = false
  }
}

// 下载文件
const downloadFile = async (type: 'md') => {
  try {
    if (type === 'md' && mdFileNameParam.value) {
      const client = await ossService.getOSSClient()
      
      const objectPath = getObjectPath(mdFileNameParam.value)
      const fileName = getFileName(objectPath)
      
      console.log('下载 Markdown 文件:', objectPath)
      
      const signedUrl = client.signatureUrl(objectPath, {
        expires: 3600,
        response: {
          'content-disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
        }
      })
      
      const link = document.createElement('a')
      link.href = signedUrl
      link.download = fileName
      link.style.display = 'none'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      console.log('Markdown 下载已触发:', fileName)
    }
  } catch (error) {
    console.error('下载文件失败:', error)
  }
}

// 返回上一页
const goBack = () => {
  router.back()
}

// 组件挂载时加载数据
onMounted(async () => {
  await loadMarkdown()
})
</script>

<style scoped>
.document-view-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  position: relative;
  overflow: hidden;
}

/* 动态背景装饰 */
.background-decoration {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 0;
  pointer-events: none;
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

.document-view-container {
  position: relative;
  z-index: 1;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}

/* 顶部导航栏 */
.top-navbar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 249, 251, 0.95) 100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  flex-wrap: wrap;
}

.paper-info {
  flex: 1;
  min-width: 200px;
}

.paper-title {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 内容区域 */
.content-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #fafbfc 0%, #f5f7fa 100%);
}

.tab-pane {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.md-pane {
  background: linear-gradient(180deg, #fafbfc 0%, #f5f7fa 100%);
  padding: 40px;
  overflow-y: auto;
}

.md-pane::-webkit-scrollbar {
  width: 8px;
}

.md-pane::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.md-pane::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.md-pane::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.markdown-content {
  font-size: 15px;
  line-height: 1.8;
  color: #2c3e50;
  max-width: 900px;
  margin: 0 auto;
}

.markdown-body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}

.markdown-body p {
  margin-bottom: 20px;
  color: #34495e;
}

.markdown-body h1 {
  font-size: 32px;
  margin-top: 32px;
  margin-bottom: 20px;
  font-weight: 700;
  line-height: 1.3;
  color: #1a202c;
  border-bottom: 3px solid #667eea;
  padding-bottom: 12px;
}

.markdown-body h2 {
  font-size: 26px;
  margin-top: 28px;
  margin-bottom: 18px;
  font-weight: 600;
  line-height: 1.3;
  color: #2d3748;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 10px;
}

.markdown-body h3 {
  font-size: 22px;
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.3;
  color: #4a5568;
}

.markdown-body h4 {
  font-size: 18px;
  margin-top: 20px;
  margin-bottom: 14px;
  font-weight: 600;
  line-height: 1.3;
  color: #718096;
}

.markdown-body ul, .markdown-body ol {
  padding-left: 2em;
  margin-bottom: 20px;
  color: #34495e;
}

.markdown-body li {
  margin-bottom: 8px;
}

.markdown-body code {
  padding: 3px 6px;
  margin: 0 2px;
  font-size: 90%;
  background: linear-gradient(135deg, #f6f8fa 0%, #eef1f6 100%);
  border: 1px solid #e1e4e8;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  color: #e83e8c;
}

.markdown-body pre {
  padding: 20px;
  overflow: auto;
  font-size: 14px;
  line-height: 1.6;
  background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #4a5568;
}

.markdown-body pre code {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  color: #e2e8f0;
  font-size: 13px;
}

.markdown-body blockquote {
  padding: 12px 20px;
  color: #5a6c7d;
  border-left: 4px solid #667eea;
  margin-bottom: 20px;
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.05) 0%, rgba(255, 255, 255, 0) 100%);
  border-radius: 0 4px 4px 0;
  font-style: italic;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 20px;
  color: #667eea;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(102, 126, 234, 0.1);
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-state p {
  font-size: 15px;
  font-weight: 500;
  color: #667eea;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #a0aec0;
  font-size: 15px;
  gap: 12px;
}

.empty-icon {
  font-size: 64px;
  opacity: 0.5;
}

.download-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  white-space: nowrap;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.download-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.download-btn:hover::before {
  width: 300px;
  height: 300px;
}

.download-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.download-icon {
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .top-navbar {
    padding: 12px 16px;
    gap: 12px;
    flex-direction: column;
    align-items: flex-start;
  }
  
  .paper-title {
    font-size: 16px;
  }
  
  .download-btn {
    padding: 6px 12px;
    font-size: 11px;
  }
  
  .content-area {
    padding: 0;
  }
  
  .md-pane {
    padding: 20px 16px;
  }
  
  .markdown-content {
    font-size: 14px;
  }
}
</style>
