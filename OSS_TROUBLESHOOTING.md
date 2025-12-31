# OSS 集成问题排查指南

## 当前错误

```
刷新 OSS 凭证失败: Error: require accessKeyId, accessKeySecret
```

## 问题原因

OSS SDK 在创建客户端时，要求必须提供有效的 `accessKeyId` 和 `accessKeySecret`，但从后端获取的凭证中这些字段为空或格式不正确。

## 排查步骤

### 1. 检查浏览器控制台日志

打开浏览器开发者工具（F12），查看 Console 标签页，应该能看到：

```javascript
正在刷新 OSS 凭证...
获取到的凭证响应: { code: 0, success: true, data: { ... } }
```

**重点检查 `data` 字段中的内容：**

```javascript
{
  accessKeyId: "STS.xxx...",      // 应该是以 STS. 开头的字符串
  accessKeySecret: "xxx...",       // 应该是一个长字符串
  securityToken: "xxx...",         // 应该是一个很长的字符串
  expiration: "2024-12-31T23:59:59Z"  // ISO 8601 格式的时间
}
```

### 2. 检查后端接口

#### 接口地址
```
GET /oss/get
```

#### 期望的响应格式
```json
{
  "code": 0,
  "success": true,
  "message": "Success",
  "other": null,
  "data": {
    "accessKeyId": "STS.NUxxx...",
    "accessKeySecret": "5Qxxx...",
    "securityToken": "CAISxxx...",
    "expiration": "2024-12-31T23:59:59Z"
  }
}
```

#### 使用 Postman 或 curl 测试

```bash
curl http://localhost:8080/oss/get
```

### 3. 常见问题

#### 问题 1: 后端接口未实现
**症状**: 控制台显示 404 或 500 错误

**解决方案**: 
- 确保后端已实现 `/oss/get` 接口
- 检查后端服务是否正常运行

#### 问题 2: 返回的是 Mock 数据
**症状**: 控制台显示 `MOCK_ACCESS_KEY_ID`

**原因**: 后端接口不可用，前端使用了 Mock 数据

**解决方案**:
- Mock 数据无法真正访问 OSS，需要实现真实的后端接口
- 后端需要调用阿里云 STS 服务获取临时凭证

#### 问题 3: 凭证字段名称不匹配
**症状**: 控制台显示 "OSS 凭证字段不完整"

**原因**: 后端返回的字段名称与前端期望的不一致

**检查**: 后端返回的字段名必须是（小写驼峰命名）：
- `accessKeyId`
- `accessKeySecret`
- `securityToken`
- `expiration`

#### 问题 4: 凭证为空字符串
**症状**: 凭证字段存在但值为空

**原因**: 后端 STS 调用失败或配置错误

**解决方案**: 检查后端日志，确认 STS 调用是否成功

### 4. 后端实现参考

#### Java (Spring Boot) 示例

```java
@RestController
@RequestMapping("/oss")
public class OSSController {
    
    @Autowired
    private STSClient stsClient;
    
    @GetMapping("/get")
    public ResponseEntity<OSSCredentialsResponse> getOSSCredentials() {
        try {
            // 调用阿里云 STS 获取临时凭证
            AssumeRoleRequest request = new AssumeRoleRequest();
            request.setRoleArn("acs:ram::xxx:role/xxx");
            request.setRoleSessionName("paper-service-session");
            request.setDurationSeconds(3600L);
            
            AssumeRoleResponse response = stsClient.assumeRole(request);
            Credentials credentials = response.getCredentials();
            
            // 注意：返回给前端的字段名使用小写驼峰命名
            Map<String, String> ossCredentials = new HashMap<>();
            ossCredentials.put("accessKeyId", credentials.getAccessKeyId());
            ossCredentials.put("accessKeySecret", credentials.getAccessKeySecret());
            ossCredentials.put("securityToken", credentials.getSecurityToken());
            ossCredentials.put("expiration", credentials.getExpiration());
            
            return ResponseEntity.ok(new OSSCredentialsResponse(
                0, true, "Success", null, ossCredentials
            ));
        } catch (Exception e) {
            log.error("获取 OSS 凭证失败", e);
            return ResponseEntity.status(500).body(
                new OSSCredentialsResponse(500, false, e.getMessage(), null, null)
            );
        }
    }
}
```

### 5. 配置检查

#### 前端配置 (src/config/oss.config.ts)

```typescript
export const OSS_CONFIG = {
  region: 'oss-cn-beijing',      // 确保与 OSS Bucket 区域一致
  bucket: 'paper-service',        // 确保 Bucket 名称正确
  signatureExpires: 3600
}
```

#### 后端配置

确保配置了以下环境变量或配置文件：

```yaml
aliyun:
  oss:
    endpoint: oss-cn-beijing.aliyuncs.com
    bucket: paper-service
  sts:
    access-key-id: ${ALIYUN_ACCESS_KEY_ID}
    access-key-secret: ${ALIYUN_ACCESS_KEY_SECRET}
    role-arn: acs:ram::xxx:role/xxx
```

### 6. 测试流程

1. **测试后端接口**
   ```bash
   curl http://localhost:8080/oss/get
   ```
   
2. **检查返回数据**
   - 确认 `code` 为 0
   - 确认 `success` 为 true
   - 确认 `data` 中所有字段都有值

3. **测试前端**
   - 打开浏览器控制台
   - 点击 PDF 预览按钮
   - 查看控制台日志

### 7. 临时解决方案

如果后端暂时无法提供真实凭证，可以：

1. **使用直接 URL 访问**（如果 PDF 是公开的）
   
   修改 `ossService.ts` 的 `previewPDF` 方法：
   
   ```typescript
   async previewPDF(pdfUrl: string): Promise<void> {
     // 如果 URL 已经是完整的可访问 URL，直接打开
     if (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) {
       window.open(pdfUrl, '_blank')
       return
     }
     
     // 否则使用 OSS SDK
     // ... 原有逻辑
   }
   ```

2. **配置 CORS**（如果 PDF 在 OSS 上且设置了公开读）
   
   在 OSS 控制台配置 CORS 规则，允许前端域名访问

## 联系支持

如果以上步骤都无法解决问题，请提供：

1. 浏览器控制台完整日志
2. 后端 `/oss/get` 接口的实际返回数据
3. OSS Bucket 配置截图
4. 后端日志（如果有）

## 相关文档

- [阿里云 OSS 文档](https://help.aliyun.com/product/31815.html)
- [阿里云 STS 文档](https://help.aliyun.com/document_detail/100624.html)
- [ali-oss SDK 文档](https://github.com/ali-sdk/ali-oss)
