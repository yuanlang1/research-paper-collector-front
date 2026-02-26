<template>
  <div class="error-wrapper">
    <!-- 动态背景 -->
    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>

    <!-- 装饰性网格 -->
    <div class="grid-overlay"></div>

    <div class="error-container">
      <!-- 错误代码区域 -->
      <div class="error-icon-area">
        <div class="code-glow"></div>
        <div class="error-code-display">{{ errorCode }}</div>
      </div>

      <!-- 错误标题 -->
      <h1 class="error-title">
        <span class="title-text">{{ errorTitle }}</span>
      </h1>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// 从路由参数或 query 中获取错误信息
const errorCode = computed(() => {
  return (route.params.code as string) || (route.query.code as string) || '404'
})

const errorType = computed(() => {
  const code = errorCode.value
  if (code === '404') return 'not-found'
  if (code.startsWith('5')) return 'server-error'
  return 'generic'
})

const errorTitle = computed(() => {
  switch (errorCode.value) {
    case '404': return '页面未找到'
    case '500': return '服务器内部错误'
    case '502': return '网关错误'
    case '503': return '服务暂时不可用'
    case '504': return '网关超时'
    default: return '发生错误'
  }
})
</script>

<style scoped>
.error-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* 动态背景 */
.background-shapes {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}

.shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
  animation: float 20s ease-in-out infinite;
}

.shape-1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, #a78bfa, #7c3aed);
  top: -150px;
  left: -150px;
  animation-delay: 0s;
}

.shape-2 {
  width: 450px;
  height: 450px;
  background: radial-gradient(circle, #60a5fa, #2563eb);
  bottom: -120px;
  right: -120px;
  animation-delay: 7s;
}

.shape-3 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #f9a8d4, #ec4899);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: 14s;
}

@keyframes float {
  0%, 100% { 
    transform: translate(0, 0) scale(1);
    opacity: 0.35;
  }
  33% { 
    transform: translate(40px, -40px) scale(1.08);
    opacity: 0.4;
  }
  66% { 
    transform: translate(-30px, 30px) scale(0.92);
    opacity: 0.3;
  }
}

/* 装饰性网格 */
.grid-overlay {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 50px 50px;
  z-index: 0;
  animation: grid-move 20s linear infinite;
}

@keyframes grid-move {
  0% {
    transform: translate(0, 0);
  }
  100% {
    transform: translate(50px, 50px);
  }
}

/* 主容器 */
.error-container {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 50px;
  padding: 60px 40px;
  max-width: 600px;
  width: 100%;
  text-align: center;
  animation: fadeIn 0.8s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 错误代码区域 */
.error-icon-area {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 代码发光效果 */
.code-glow {
  position: absolute;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.2), transparent 70%);
  border-radius: 50%;
  animation: pulse-glow 3s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}

.error-code-display {
  font-size: 160px;
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(135deg, #ffffff 0%, #e0e7ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 8px 32px rgba(139, 92, 246, 0.3));
  letter-spacing: -6px;
  user-select: none;
  position: relative;
  z-index: 1;
  animation: float-code 4s ease-in-out infinite;
}

@keyframes float-code {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* 错误标题 */
.error-title {
  font-size: 36px;
  font-weight: 700;
  margin: 0;
  position: relative;
  z-index: 1;
  letter-spacing: 1px;
  animation: slideUp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s backwards;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.title-text {
  background: linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 4px 20px rgba(139, 92, 246, 0.4));
  animation: text-shimmer 3s ease-in-out infinite;
}

@keyframes text-shimmer {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .error-container {
    gap: 40px;
    padding: 40px 30px;
  }

  .error-code-display {
    font-size: 120px;
    letter-spacing: -4px;
  }

  .error-title {
    font-size: 28px;
  }
}

@media (max-width: 480px) {
  .error-container {
    padding: 30px 20px;
  }

  .error-code-display {
    font-size: 90px;
    letter-spacing: -3px;
  }

  .error-title {
    font-size: 24px;
  }
}
</style>
