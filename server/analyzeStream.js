import fetch from 'node-fetch';
import { nanoid } from 'nanoid';
import {
  updateUserPoints,
  saveUserInput,
  saveAnalysis,
  logEvent,
} from './database.js';
import { BAZI_SYSTEM_INSTRUCTION, buildUserPrompt } from './prompt.js';

const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || 'https://ttkk.inping.com/v1';
const DEFAULT_API_KEY = process.env.API_KEY || 'sk-xl7wmNBKET4xcCdXC47xNlA4I7bPm6NB4SBNQzp8eeJDhLap';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gemini-3-pro-preview';

const FALLBACK_MODELS = [
  'grok-4-1-fast-non-reasoning',
  'gemini-3-pro-preview',
  'grok-4-mini-thinking-tahoe',
];

const FREE_INIT_POINTS = process.env.FREE_INIT_POINTS ? parseInt(process.env.FREE_INIT_POINTS, 10) : 1000;
const COST_PER_ANALYSIS = process.env.COST_PER_ANALYSIS ? parseInt(process.env.COST_PER_ANALYSIS, 10) : 50;

/**
 * 发送SSE事件到客户端
 */
const sendSSE = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

/**
 * 单次API请求
 */
const makeRequest = async (currentModel, currentApiBaseUrl, currentApiKey, onProgress) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分钟超时

  try {
    if (onProgress) onProgress('请求AI模型中...');

    const response = await fetch(`${currentApiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentApiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: currentModel,
        messages: [
          { role: 'system', content: BAZI_SYSTEM_INSTRUCTION },
          { role: 'user', content: onProgress.__userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请重试');
    }
    throw error;
  }
};

/**
 * 带重试的单模型请求
 */
const tryModelWithRetries = async (currentModel, apiBaseUrl, apiKey, onProgress) => {
  let retryCount = 0;
  const maxRetries = 1;

  while (retryCount <= maxRetries) {
    try {
      const attemptMsg = retryCount === 0 ? `使用模型 ${currentModel}` : `重试第${retryCount}次...`;
      if (onProgress) onProgress(attemptMsg);

      const response = await makeRequest(currentModel, apiBaseUrl, apiKey, onProgress);

      if (response.ok) {
        return { success: true, response, model: currentModel };
      }

      const errText = await response.text();
      console.warn(`模型 ${currentModel} 请求失败:`, response.status, errText.substring(0, 200));

      if (response.status === 401 || response.status === 403) {
        return { success: false, error: 'AUTH_ERROR', status: response.status, errText };
      }

      retryCount++;
      if (retryCount <= maxRetries) {
        if (onProgress) onProgress('请求失败，2秒后重试...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (err) {
      console.warn(`模型 ${currentModel} 请求异常:`, err.message);
      retryCount++;
      if (retryCount <= maxRetries) {
        if (onProgress) onProgress(`网络异常，2秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  return { success: false, error: 'FAILED_AFTER_RETRIES' };
};

/**
 * 流式分析处理器
 */
export const handleAnalyzeStream = async (req, res) => {
  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用nginx缓冲

  const body = req.body || {};
  const useCustomApi = Boolean(body.useCustomApi);

  let authedInfo = req.__authedInfo || null;

  let apiBaseUrl = String(body.apiBaseUrl || '').trim().replace(/\/+$/, '');
  let apiKey = String(body.apiKey || '').trim();
  let modelName = String(body.modelName || '').trim();

  const input = {
    name: body.name || '',
    gender: body.gender,
    birthYear: body.birthYear,
    yearPillar: body.yearPillar,
    monthPillar: body.monthPillar,
    dayPillar: body.dayPillar,
    hourPillar: body.hourPillar,
    startAge: body.startAge,
    firstDaYun: body.firstDaYun,
  };

  if (!useCustomApi) {
    apiBaseUrl = DEFAULT_API_BASE_URL;
    apiKey = DEFAULT_API_KEY;
    modelName = DEFAULT_MODEL;

    if (!DEFAULT_API_KEY || DEFAULT_API_KEY === 'sk-example-key') {
      sendSSE(res, 'error', {
        error: 'SERVER_DEFAULT_KEY_NOT_SET',
        message: '服务器未配置API密钥，请使用自定义API或联系管理员'
      });
      return res.end();
    }
  } else {
    if (!apiBaseUrl || !apiKey || !modelName) {
      sendSSE(res, 'error', {
        error: 'MISSING_CUSTOM_API_CONFIG',
        message: '请完整填写自定义API配置'
      });
      return res.end();
    }
  }

  const userPrompt = String(body.userPrompt || '').trim() || buildUserPrompt({ ...input, gender: input.gender });

  // 构建模型列表
  const modelsToTry = [modelName];
  if (!useCustomApi) {
    modelsToTry.push(...FALLBACK_MODELS);
  }

  const inputId = nanoid();
  const startTime = Date.now();

  // 发送初始化进度
  sendSSE(res, 'progress', { message: '正在初始化...' });

  // 启动心跳保活 (防止 Cloudflare/Nginx 504 超时)
  // Cloudflare 等待 100s 无数据会断开，每 15s 发送一次注释行保活
  const keepAliveInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keep-alive\n\n');
    }
  }, 15000);

  // 确保请求结束时清除定时器
  const cleanup = () => clearInterval(keepAliveInterval);
  res.on('close', cleanup);
  res.on('finish', cleanup);

  // 进度回调
  const onProgress = (message) => {
    sendSSE(res, 'progress', { message });
  };
  onProgress.__userPrompt = userPrompt;

  // 依次尝试所有模型
  let lastError = null;
  let successResponse = null;
  let usedModel = null;

  for (const currentModel of modelsToTry) {
    const result = await tryModelWithRetries(currentModel, apiBaseUrl, apiKey, onProgress);

    if (result.success) {
      successResponse = result.response;
      usedModel = result.model;
      onProgress(`✓ 模型响应成功`);
      break;
    }

    lastError = result;
    onProgress(`✗ 模型 ${currentModel} 失败`);
  }

  if (!successResponse) {
    console.error('所有模型均失败:', lastError);

    if (lastError?.error === 'AUTH_ERROR') {
      sendSSE(res, 'error', {
        error: 'API_AUTH_FAILED',
        message: 'API密钥认证失败，请检查配置'
      });
      return res.end();
    }

    sendSSE(res, 'error', {
      error: 'ALL_MODELS_FAILED',
      message: '所有AI模型均无法响应，请稍后重试',
      triedModels: modelsToTry
    });
    return res.end();
  }

  onProgress('正在解析AI响应...');

  const responseText = await successResponse.text();
  let jsonResult;
  try {
    jsonResult = JSON.parse(responseText);
  } catch (e) {
    console.error('API response parse error. Status:', successResponse.status);
    console.error('Body preview:', responseText.substring(0, 200));
    sendSSE(res, 'error', {
      error: 'INVALID_API_RESPONSE',
      message: 'AI服务返回了无效格式的数据'
    });
    return res.end();
  }

  let content = jsonResult.choices?.[0]?.message?.content;

  if (!content) {
    sendSSE(res, 'error', {
      error: 'EMPTY_MODEL_RESPONSE',
      message: '模型未返回内容'
    });
    return res.end();
  }

  onProgress('正在处理命理数据...');

  // 清理markdown代码块
  content = content.trim();
  
  // 移除 <think> 思考过程标签
  content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  if (content.startsWith('```json')) content = content.slice(7);
  else if (content.startsWith('```')) content = content.slice(3);
  if (content.endsWith('```')) content = content.slice(0, -3);
  content = content.trim();

  let data;
  try {
    data = JSON.parse(content);
  } catch (parseErr) {
    console.error('JSON parse error:', parseErr.message);
    sendSSE(res, 'error', {
      error: 'INVALID_JSON_FORMAT',
      message: '模型返回数据格式无效'
    });
    return res.end();
  }

  if (!data.chartPoints || !Array.isArray(data.chartPoints)) {
    sendSSE(res, 'error', {
      error: 'INVALID_MODEL_JSON',
      message: '模型返回数据结构错误'
    });
    return res.end();
  }

  onProgress('生成人生K线图表...');

  const result = {
    chartData: data.chartPoints,
    analysis: {
      bazi: data.bazi || [],
      summary: data.summary || '无摘要',
      summaryScore: data.summaryScore || 5,
      personality: data.personality || '无性格分析',
      personalityScore: data.personalityScore || 5,
      industry: data.industry || '无',
      industryScore: data.industryScore || 5,
      fengShui: data.fengShui || '建议多亲近自然，保持心境平和。',
      fengShuiScore: data.fengShuiScore || 5,
      wealth: data.wealth || '无',
      wealthScore: data.wealthScore || 5,
      marriage: data.marriage || '无',
      marriageScore: data.marriageScore || 5,
      health: data.health || '无',
      healthScore: data.healthScore || 5,
      family: data.family || '无',
      familyScore: data.familyScore || 5,
      crypto: data.crypto || '暂无交易分析',
      cryptoScore: data.cryptoScore || 5,
      cryptoYear: data.cryptoYear || '待定',
      cryptoStyle: data.cryptoStyle || '现货定投',
    },
  };

  let user = null;
  let cost = 0;
  let isGuest = false;

  onProgress('保存分析结果...');

  // 保存数据
  if (!useCustomApi) {
    const info = authedInfo;

    saveUserInput({
      id: inputId,
      userId: info ? info.user.id : null,
      name: input.name,
      gender: input.gender,
      birthYear: input.birthYear,
      yearPillar: input.yearPillar,
      monthPillar: input.monthPillar,
      dayPillar: input.dayPillar,
      hourPillar: input.hourPillar,
      startAge: input.startAge,
      firstDaYun: input.firstDaYun,
      modelName: usedModel,
      apiBaseUrl: apiBaseUrl,
      useCustomApi: false,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    const analysisId = nanoid();

    if (info) {
      const newPoints = Math.max(0, info.user.points - COST_PER_ANALYSIS);
      updateUserPoints(info.user.id, newPoints);
      cost = COST_PER_ANALYSIS;

      saveAnalysis({
        id: analysisId,
        userId: info.user.id,
        inputId: inputId,
        cost,
        modelUsed: usedModel,
        chartData: result.chartData,
        analysisData: result.analysis,
        processingTimeMs: Date.now() - startTime,
        status: 'completed',
      });

      logEvent('info', '生成分析', { analysisId, cost, model: usedModel }, info.user.id, req.ip);
      user = { id: info.user.id, email: info.user.email, points: newPoints };
    } else {
      isGuest = true;

      saveAnalysis({
        id: analysisId,
        userId: null,
        inputId: inputId,
        cost: 0,
        modelUsed: usedModel,
        chartData: result.chartData,
        analysisData: result.analysis,
        processingTimeMs: Date.now() - startTime,
        status: 'completed',
      });

      logEvent('info', '游客体验', { analysisId, model: usedModel }, null, req.ip);
    }
  } else {
    saveUserInput({
      id: inputId,
      userId: null,
      name: input.name,
      gender: input.gender,
      birthYear: input.birthYear,
      yearPillar: input.yearPillar,
      monthPillar: input.monthPillar,
      dayPillar: input.dayPillar,
      hourPillar: input.hourPillar,
      startAge: input.startAge,
      firstDaYun: input.firstDaYun,
      modelName: modelName,
      apiBaseUrl: apiBaseUrl,
      useCustomApi: true,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  // 发送完成事件
  sendSSE(res, 'complete', { result, user, cost, isGuest });
  res.end();
};
