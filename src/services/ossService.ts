import OSS from 'ali-oss'
import { apiService } from './api'
import type { OSSCredentials } from './api'
import OSS_CONFIG from '@/config/oss.config'

/**
 * OSS 服务类
 * 负责管理阿里云 OSS 临时凭证和文件预览
 */
class OSSService {
  private credentials: OSSCredentials | null = null
  private credentialsExpireTime: number = 0
  private refreshPromise: Promise<void> | null = null
  private ossClient: OSS | null = null
  
  // OSS 配置 - 从配置文件读取
  private ossRegion = OSS_CONFIG.region
  private ossBucket = OSS_CONFIG.bucket
  
  // 提前5分钟刷新凭证
  private readonly REFRESH_BUFFER_MS = 5 * 60 * 1000

  /**
   * 检查凭证是否即将过期
   */
  private isCredentialsExpiringSoon(): boolean {
    if (!this.credentials || !this.credentialsExpireTime) {
      return true
    }
    const now = Date.now()
    return now >= this.credentialsExpireTime - this.REFRESH_BUFFER_MS
  }

  /**
   * 刷新 OSS 凭证
   */
  private async refreshCredentials(): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = (async () => {
      try {
        console.log('正在刷新 OSS 凭证...')
        const response = await apiService.getOSSCredentials()
        
        console.log('获取到的凭证响应:', response)
        
        if (response.code === 0 && response.success && response.data) {
          const { accessKeyId, accessKeySecret, securityToken, expiration } = response.data
          
          // 验证凭证字段
          if (!accessKeyId || !accessKeySecret || !securityToken) {
            throw new Error('OSS 凭证字段不完整: ' + JSON.stringify({
              hasAccessKeyId: !!accessKeyId,
              hasAccessKeySecret: !!accessKeySecret,
              hasSecurityToken: !!securityToken
            }))
          }
          
          this.credentials = response.data
          this.credentialsExpireTime = new Date(expiration).getTime()
          
          console.log('创建 OSS 客户端，配置:', {
            region: this.ossRegion,
            bucket: this.ossBucket,
            accessKeyId: accessKeyId.substring(0, 10) + '...',
            hasSecurityToken: !!securityToken
          })
          
          this.ossClient = new OSS({
            region: this.ossRegion,
            accessKeyId: accessKeyId,
            accessKeySecret: accessKeySecret,
            stsToken: securityToken,
            bucket: this.ossBucket
          })
          
          console.log('OSS 凭证刷新成功，过期时间:', expiration)
        } else {
          throw new Error(response.message || '获取 OSS 凭证失败')
        }
      } catch (error) {
        console.error('刷新 OSS 凭证失败:', error)
        throw error
      } finally {
        this.refreshPromise = null
      }
    })()

    return this.refreshPromise
  }

  /**
   * 获取有效的 OSS 客户端
   */
  private async getOSSClient(): Promise<OSS> {
    if (this.isCredentialsExpiringSoon()) {
      await this.refreshCredentials()
    }

    if (!this.ossClient) {
      throw new Error('无法获取 OSS 客户端')
    }

    return this.ossClient
  }

  /**
   * 从 pdfUrl 中提取文件名
   * @param pdfUrl PDF 文件的 URL
   * @returns 文件名（最后一个 / 后的内容）
   */
  private extractFileName(pdfUrl: string): string {
    const parts = pdfUrl.split('/')
    return parts[parts.length - 1] || 'document.pdf'
  }

  private extractObjectPath(pdfUrl: string): string {
    const parts = pdfUrl.split('/')
    return parts[parts.length - 1] || pdfUrl
  }

  /**
   * 预览 PDF 文件（在新窗口打开）
   * @param pdfUrl PDF 文件的 URL 或对象路径
   */
  async previewPDF(pdfUrl: string): Promise<void> {
    try {
      console.log('准备预览 PDF:', pdfUrl)
      
      // 获取 OSS 客户端
      const client = await this.getOSSClient()
      
      // 提取对象路径
      const objectPath = this.extractObjectPath(pdfUrl)
      const fileName = this.extractFileName(pdfUrl)
      
      console.log('对象路径:', objectPath)
      console.log('文件名:', fileName)
      
      // 生成签名 URL（有效期 1 小时，inline 模式用于预览）
      const signedUrl = client.signatureUrl(objectPath, {
        expires: OSS_CONFIG.signatureExpires,
        response: {
          'content-disposition': `inline; filename="${encodeURIComponent(fileName)}"`
        }
      })
      
      console.log('生成的签名 URL:', signedUrl)
      
      
      window.open(signedUrl, '_blank')
      
    } catch (error) {
      console.error('预览 PDF 失败:', error)
      throw error
    }
  }

  /**
   * 下载 PDF 文件
   * @param pdfUrl PDF 文件的 URL 或对象路径
   */
  async downloadPDF(pdfUrl: string): Promise<void> {
    try {
      console.log('准备下载 PDF:', pdfUrl)
      
      // 获取 OSS 客户端
      const client = await this.getOSSClient()
      
      // 提取对象路径和文件名
      const objectPath = this.extractObjectPath(pdfUrl)
      const fileName = this.extractFileName(pdfUrl)
      
      // 生成签名 URL（下载模式）
      const signedUrl = client.signatureUrl(objectPath, {
        expires: OSS_CONFIG.signatureExpires,
        response: {
          'content-disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
        }
      })
      
      // 创建隐藏的 a 标签触发下载
      const link = document.createElement('a')
      link.href = signedUrl
      link.download = fileName
      link.style.display = 'none'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      console.log('PDF 下载已触发:', fileName)
      
    } catch (error) {
      console.error('下载 PDF 失败:', error)
      throw error
    }
  }

  /**
   * 清除凭证缓存
   */
  clearCredentials(): void {
    this.credentials = null
    this.credentialsExpireTime = 0
    this.refreshPromise = null
    this.ossClient = null
  }

  /**
   * 设置 OSS 配置
   */
  setConfig(region: string, bucket: string): void {
    this.ossRegion = region
    this.ossBucket = bucket
    // 清除现有客户端，下次使用时会用新配置创建
    this.ossClient = null
  }
}

// 导出单例
export const ossService = new OSSService()
export default ossService
