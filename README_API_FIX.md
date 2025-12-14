# API 错误修复说明

## 问题
用户看到错误：`SERVER_DEFAULT_KEY_NOT_SET`

## 原因
1. 服务器端没有设置默认的 API 密钥
2. 用户未登录且未使用自定义 API
3. 服务器拒绝了没有密钥的请求

## 修复方案

### 1. 服务器端修复
```javascript
// server/index.js
// 提供默认密钥示例
const DEFAULT_API_KEY = process.env.API_KEY || 'sk-example-key';

// 改进错误消息
if (!openAiKey || !openAiUrl || !model) {
  res.status(500).json({
    error: 'SERVER_DEFAULT_KEY_NOT_SET',
    message: 'API configuration not complete. Please use custom API.'
  });
  return;
}
```

### 2. 客户端改进
- 在提交前尝试自动注册/登录
- 提供更清晰的错误提示
- 优化用户流程

## 使用建议

### 对于开发者
1. 设置环境变量：
```bash
export API_KEY="your-api-key-here"
export API_BASE_URL="https://api.openai.com/v1"
```

### 对于普通用户
1. **免费模式**：输入邮箱密码自动注册（需要服务器配置）
2. **自定义 API**：使用自己的 API 密钥
   - 模型：gemini-1.5-flash 或 gemini-1.5-pro
   - Base URL：https://ttkk.inping.com/v1
   - API Key：从相应平台获取

## 测试
1. 使用智能输入模式填写八字
2. 点击"生成人生K线"
3. 如果看到错误，请：
   - 检查网络连接
   - 尝试使用自定义 API
   - 或联系管理员配置服务端 API 密钥
