# 阿里云 OSS 集成使用说明

## 功能概述

本项目已集成阿里云 OSS，实现了 PDF 文件的**浏览器预览**功能。点击 PDF 链接后，会在新窗口打开 PDF 预览。

## 核心特性

✅ **自动凭证管理** - 自动获取和刷新 OSS 临时凭证  
✅ **智能刷新** - 提前 5 分钟自动刷新凭证，避免过期  
✅ **浏览器预览** - 在新窗口打开 PDF，支持浏览器内置预览  
✅ **文件名提取** - 从 `pdfUrl` 最后一个 `/` 后提取文件名  
✅ **并发控制** - 防止多个请求同时刷新凭证  

## 配置步骤

### 1. 修改 OSS 配置

编辑 `src/config/oss.config.ts`：

```typescript
export const OSS_CONFIG = {
  // 修改为你的 OSS 区域
  region: 'oss-cn-hangzhou',  // 例如: oss-cn-beijing, oss-cn-shanghai
  
  // 修改为你的 Bucket 名称
  bucket: 'your-bucket-name',
  
  // 签名 URL 有效期（秒）
  signatureExpires: 3600  // 1小时
}
```

### 2. 后端接口

确保后端实现了 `GET /oss/get` 接口：

**响应格式：**
```json
{
  "code": 0,
  "success": true,
  "message": "Success",
  "other": null,
  "data": {
    "AccessKeyId": "STS.xxx",
    "AccessKeySecret": "xxx",
    "SecurityToken": "xxx",
    "Expiration": "2024-12-31T23:59:59Z"
  }
}
```

## 使用方式

### 在页面中使用

PDF 链接会自动转换为预览按钮：

```vue
<button @click="previewPDF(paper.pdfUrl)">
  📄 预览PDF
</button>
```

点击后会：
1. 自动获取/刷新 OSS 凭证
2. 从 `pdfUrl` 提取文件名
3. 生成签名 URL
4. 在新窗口打开 PDF 预览

### pdfUrl 格式支持

支持两种格式：

**1. 完整 URL**
```
https://your-bucket.oss-cn-hangzhou.aliyuncs.com/papers/2024/paper123.pdf
```
系统会自动提取路径：`papers/2024/paper123.pdf`  
文件名：`paper123.pdf`

**2. 对象路径**
```
papers/2024/paper123.pdf
```
直接使用该路径  
文件名：`paper123.pdf`

## 工作流程

```
用户点击 [📄 预览PDF]
    ↓
检查凭证是否即将过期（提前5分钟）
    ↓
如需要，调用 GET /oss/get 刷新凭证
    ↓
创建 OSS 客户端（使用临时凭证）
    ↓
从 pdfUrl 提取对象路径和文件名
    ↓
生成签名 URL（inline 模式，用于预览）
    ↓
window.open() 在新窗口打开
    ↓
浏览器显示 PDF 预览
```

## 文件结构

```
src/
├── config/
│   └── oss.config.ts          # OSS 配置（region, bucket）
├── services/
│   ├── api.ts                 # API 接口（含 getOSSCredentials）
│   └── ossService.ts          # OSS 服务（凭证管理、预览、下载）
└── views/
    └── SearchResultsView.vue  # 使用 PDF 预览功能
```

## API 说明

### ossService.previewPDF(pdfUrl)

在新窗口预览 PDF

```typescript
import { ossService } from '@/services/ossService'

await ossService.previewPDF('papers/2024/paper123.pdf')
```

### ossService.downloadPDF(pdfUrl)

下载 PDF 文件

```typescript
await ossService.downloadPDF('papers/2024/paper123.pdf')
```

### ossService.setConfig(region, bucket)

动态修改 OSS 配置

```typescript
ossService.setConfig('oss-cn-beijing', 'new-bucket-name')
```

### ossService.clearCredentials()

清除凭证缓存

```typescript
ossService.clearCredentials()
```

## 凭证刷新机制

### 自动刷新时机
- ✅ 首次调用（凭证为空）
- ✅ 距离过期时间少于 5 分钟

### 并发控制
使用 Promise 锁，确保同时只有一个刷新请求：

```typescript
if (this.refreshPromise) {
  return this.refreshPromise  // 等待现有请求完成
}
```

### 刷新流程
```
检查凭证过期时间
    ↓
调用 GET /oss/get
    ↓
解析响应数据
    ↓
创建新的 OSS 客户端
    ↓
更新凭证和过期时间
```

## 安全性

1. **临时凭证** - 使用 STS 临时凭证，非永久密钥
2. **自动过期** - 凭证有时效性，过期后自动刷新
3. **签名 URL** - 生成的 URL 包含签名，有效期 1 小时
4. **HTTPS** - 所有请求使用 HTTPS 加密

## 常见问题

### Q: 如何修改签名 URL 有效期？
A: 编辑 `src/config/oss.config.ts` 中的 `signatureExpires`

### Q: 预览失败怎么办？
A: 检查：
1. OSS 配置（region, bucket）是否正确
2. 后端接口是否正常返回凭证
3. pdfUrl 格式是否正确
4. 浏览器控制台是否有错误信息

### Q: 如何支持其他文件类型？
A: 修改 `ossService.ts` 中的 `content-type`：
```typescript
response: {
  'content-type': 'image/jpeg',  // 或其他类型
  'content-disposition': `inline; filename="${fileName}"`
}
```

### Q: 如何改为下载而非预览？
A: 使用 `downloadPDF` 方法，或将 `inline` 改为 `attachment`

## 开发环境

如果后端不可用，会使用 Mock 数据：

```typescript
{
  AccessKeyId: 'MOCK_ACCESS_KEY_ID',
  AccessKeySecret: 'MOCK_ACCESS_KEY_SECRET',
  SecurityToken: 'MOCK_SECURITY_TOKEN',
  Expiration: '2024-12-31T23:59:59Z'
}
```

## 依赖包

```json
{
  "dependencies": {
    "ali-oss": "^6.x.x"
  },
  "devDependencies": {
    "@types/ali-oss": "^6.x.x"
  }
}
```

已自动安装，无需手动操作。

## 示例代码

### 完整使用示例

```vue
<template>
  <button @click="handlePreview">预览 PDF</button>
  <button @click="handleDownload">下载 PDF</button>
</template>

<script setup lang="ts">
import { ossService } from '@/services/ossService'

const pdfUrl = 'papers/2024/research-paper.pdf'

const handlePreview = async () => {
  try {
    await ossService.previewPDF(pdfUrl)
  } catch (error) {
    console.error('预览失败:', error)
    alert('预览失败，请稍后重试')
  }
}

const handleDownload = async () => {
  try {
    await ossService.downloadPDF(pdfUrl)
  } catch (error) {
    console.error('下载失败:', error)
    alert('下载失败，请稍后重试')
  }
}
</script>
```

## 技术栈

- **Vue 3** - 前端框架
- **TypeScript** - 类型安全
- **ali-oss** - 阿里云 OSS SDK
- **STS** - 临时访问凭证

## 更新日志

### v1.0.0 (2024-11-28)
- ✅ 实现 OSS 凭证自动管理
- ✅ 实现 PDF 浏览器预览功能
- ✅ 支持文件名自动提取
- ✅ 添加凭证自动刷新机制
- ✅ 添加并发控制
