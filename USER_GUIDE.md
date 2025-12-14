# 用户使用指南 - 解决 API 错误

## 看到的错误信息
```
Gemini/OpenAI API Error: Error: SERVER_DEFAULT_KEY_NOT_SET
```

## 解决方案

### 方案 1：使用自定义 API（推荐）

1. **填写表单**：
   - 姓名选填
   - 性别：选择乾造(男)或坤造(女)
   - 使用"智能输入"模式填写出生信息（最简单）

2. **配置 API**：
   - 选择"使用自定义 API"
   - 模型名称：`gemini-1.5-flash`（推荐）或 `gemini-1.5-pro`
   - API Base URL：`https://ttkk.inping.com/v1`
   - API Key：从相关平台获取密钥

3. **获取 API 密钥**：
   - 联系开发者或查看文档获取
   - 其他可用平台：OpenAI、Claude 等

### 方案 2：免费模式（需要服务器配置）

如果服务器配置了默认密钥：
1. 选择"免费模式"
2. 输入邮箱和密码（会自动注册）
3. 系统会分配免费额度

### 方案 3：本地部署

开发者可以：
1. 克隆代码
2. 设置环境变量：
   ```bash
   export API_KEY="your-api-key-here"
   export API_BASE_URL="https://api.openai.com/v1"
   ```
3. 运行服务

## 测试步骤

1. 打开应用：https://www.life-kline.com
2. 点击"智能输入"模式
3. 填写：
   - 性别：例如选择"乾造(男)"
   - 出生日期：例如 1990-01-01
   - 出生时间：例如 12:00
   - 出生城市：北京
4. 配置 API：
   - ✅ 使用自定义 API
   - 模型：`gemini-1.5-flash`
   - Base URL：`https://ttkk.inping.com/v1`
   - API Key：填写你的密钥
5. 点击"生成人生K线"

## 常见问题

### Q: 为什么会出现 SERVER_DEFAULT_KEY_NOT_SET？
A: 服务器没有配置默认的 API 密钥，需要使用自己的 API 密钥。

### Q: 哪里可以获取 API 密钥？
A: 联系项目作者或查看相关文档获取测试密钥。

### Q: 可以使用其他 AI 服务吗？
A: 支持 OpenAI、Claude、Gemini 等兼容 OpenAI 格式的 API。

## 技术细节

- 前端已优化加载速度（70KB 首屏）
- 八字计算完全本地（lunar-javascript）
- API 密钥安全存储（仅传输到服务器）
- 支持加密连接（HTTPS）
