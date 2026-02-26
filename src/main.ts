import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { apiService } from './services/api'
import { errorHandler } from './utils/errorHandler'
import './style.css'

const app = createApp(App)

// 初始化错误处理器
errorHandler.init(router)

app.use(createPinia())
app.use(router)

// 注入路由到 API 服务，实现全局错误拦截跳转
apiService.setRouter(router)

// Vue 全局错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue错误:', err, info)
  // 可以在这里添加错误上报逻辑
}

// Vue 警告处理（仅开发环境）
if (import.meta.env.DEV) {
  app.config.warnHandler = (msg, instance, trace) => {
    console.warn('Vue警告:', msg, trace)
  }
}

app.mount('#app')
