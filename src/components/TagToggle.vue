<template>
  <button 
    @click="handleToggle"
    :class="['tag-toggle', { active }]"
    :data-variant="variant"
    type="button"
  >
    <span class="tag-title">{{ title }}</span>
  </button>
</template>

<script setup lang="ts">
// Props
interface Props {
  title: string
  active?: boolean
  count?: number
  variant?: 'default' | 'search-history'
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  count: 0,
  variant: 'default'
})

// Emits
const emit = defineEmits<{
  toggle: []
}>()

// 处理切换
const handleToggle = () => {
  emit('toggle')
}
</script>

<style scoped>
.tag-toggle {
  height: 40px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  min-width: 95px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tag-title {
  flex-shrink: 0;
}

.tag-toggle:not(.active) {
  background-color: #f5f5f5;
  color: #757575;
}

.tag-toggle:not(.active):hover {
  background-color: #eeeeee;
  color: #666666;
}

.tag-toggle.active {
  background-color: #0088ff;
  color: #ffffff;
}

.tag-toggle.active:hover {
  background-color: #0066cc;
}

.tag-toggle:focus {
  outline: 2px solid rgba(0, 136, 255, 0.3);
  outline-offset: 2px;
}

.tag-toggle:active {
  transform: translateY(1px);
}

/* 搜索历史变体样式 */
.tag-toggle[data-variant="search-history"] {
  background-color: #e8f4fd;
  color: #0088ff;
  border: 1px solid #b3d9ff;
}

.tag-toggle[data-variant="search-history"]:hover {
  background-color: #d1e9fc;
  border-color: #80c7ff;
}

.tag-toggle[data-variant="search-history"].active {
  background-color: #0088ff;
  color: #ffffff;
  border-color: #0088ff;
}
</style>
