# 免费API配置完成 ✅

## 已配置的免费API信息

- **API Base URL**: `https://ttkk.inping.com/v1`
- **API Key**: `sk-xl7wmNBKET4xcCdXC47xNlA4I7bPm6NB4SBNQzp8eeJDhLap`
- **默认模型**: `gemini-1.5-flash`
- **格式**: OpenAI 兼容格式

## 用户使用方法

### 方案1：免费模式（无需配置）

1. 打开 https://www.life-kline.com
2. 选择"免费模式"
3. 输入邮箱密码（自动注册）
4. 系统自动使用免费API

### 方案2：使用默认配置

1. 选择"使用自定义API"
2. 模型名称：`gemini-1.5-flash`（已默认）
3. API Base URL：`https://ttkk.inping.com/v1`（已默认）
4. API Key：留空或填写免费密钥

## 服务端配置

```javascript
// server/index.js
const DEFAULT_API_KEY = 'sk-xl7wmNBKET4xcCdXC47xNlA4I7bPm6NB4SBNQzp8eeJDhLap';
const DEFAULT_API_BASE_URL = 'https://ttkk.inping.com/v1';
const DEFAULT_MODEL = 'gemini-1.5-flash';
```

## NewAPI 服务端说明

这是一个基于 NewAPI 搭建的代理服务：
- 支持多种AI模型（OpenAI、Gemini、Claude等）
- OpenAI 兼容格式
- 统一管理多个API密钥
- 流式输出支持

## 测试步骤

1. 使用智能输入模式填写八字信息
2. 点击"生成人生K线"
3. 选择免费模式
4. 输入邮箱密码注册
5. 享受免费分析！

## 注意事项

- 免费额度有限，请合理使用
- 推荐使用 `gemini-1.5-flash`（速度快）
- 复杂分析可选 `gemini-1.5-pro`

现在所有用户都可以免费使用了！🎉