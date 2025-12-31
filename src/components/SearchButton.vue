<template>
  <button 
    @click="handleClick"
    class="search-button"
    type="button"
  >
    <svg width="29.25" height="29.25" viewBox="0 0 29.25 29.25" fill="none">
      <circle 
        cx="13" 
        cy="13" 
        r="9" 
        stroke="currentColor" 
        stroke-width="4"
        fill="none"
      />
      <path 
        d="m21 21 4.35 4.35" 
        stroke="currentColor" 
        stroke-width="4" 
        stroke-linecap="round"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
// Emits
const emit = defineEmits<{
  click: []
}>()

// 处理点击
const handleClick = () => {
  emit('click')
}
</script>

<style scoped>
.search-button {
  width: 42px;
  height: 42px;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #667eea 100%);
  background-size: 200% 100%;
  cursor: pointer;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 11px;
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-position 0.5s ease;
  box-shadow: 0 4px 6px rgba(118, 75, 162, 0.3);
}

.search-button svg {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.search-button:hover {
  box-shadow: 0 6px 12px rgba(118, 75, 162, 0.4);
  background-position: 100% 0;
}

.search-button:hover svg {
  transform: scale(1.2) rotate(-15deg);
}

.search-button:active {
  box-shadow: 0 2px 4px rgba(118, 75, 162, 0.3);
}

.search-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(118, 75, 162, 0.3);
}
</style>
