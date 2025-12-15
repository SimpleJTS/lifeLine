import dotenv from 'dotenv';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import fetch from 'node-fetch';

// 使用新的 SQLite 数据库
import {
  createUser,
  getUserByEmail,
  getUserById,
  updateUserPoints,
  updateUserLogin,
  saveUserInput,
  saveAnalysis,
  getAnalysesByUserId,
  getAnalysisById,
  getAllUsers,
  getAllInputs,
  getAllAnalyses,
  getStats,
  logEvent,
  getSystemLogs,
  migrateFromJson,
  nowIso,
} from './database.js';
import { hashPassword, verifyPassword, signToken, requireAuth, getTokenFromReq, verifyToken } from './auth.js';
import { BAZI_SYSTEM_INSTRUCTION, buildUserPrompt } from './prompt.js';
import { handleAnalyzeStream } from './analyzeStream.js';

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || 'https://ttkk.inping.com/v1';
const DEFAULT_API_KEY = process.env.API_KEY || 'sk-xl7wmNBKET4xcCdXC47xNlA4I7bPm6NB4SBNQzp8eeJDhLap'; // 免费API密钥
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'grok-4-1-fast-non-reasoning'; // 优先使用已知可用模型

// 模型降级列表：当主模型失败时依次尝试
const FALLBACK_MODELS = [
  'grok-4-1-fast-non-reasoning',
  'gemini-3-pro-preview',
  'grok-4-mini-thinking-tahoe',
];

const FREE_INIT_POINTS = process.env.FREE_INIT_POINTS ? parseInt(process.env.FREE_INIT_POINTS, 10) : 1000;
const COST_PER_ANALYSIS = process.env.COST_PER_ANALYSIS ? parseInt(process.env.COST_PER_ANALYSIS, 10) : 50;

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const authCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const sanitizeEmail = (email) => String(email || '').trim().toLowerCase();

const getAuthedUser = (req) => {
  const token = getTokenFromReq(req);
  if (!token) return null;
  try {
    const decoded = verifyToken(token, JWT_SECRET);
    const user = getUserById(decoded.sub);
    if (!user) return null;
    return { user, decoded };
  } catch {
    return null;
  }
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/register', async (req, res) => {
  const email = sanitizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  if (!email || !password || password.length < 6) return res.status(400).json({ error: 'INVALID_INPUT' });

  // 检查邮箱是否已存在
  const existing = getUserByEmail(email);
  if (existing) return res.status(409).json({ error: 'EMAIL_EXISTS' });

  const passwordHash = await hashPassword(password);
  const user = createUser(nanoid(), email, passwordHash, FREE_INIT_POINTS);

  // 记录日志
  logEvent('info', '用户注册', { email }, user.id, req.ip);

  const token = signToken({ sub: user.id, email: user.email }, JWT_SECRET);
  res.cookie('token', token, authCookieOptions);
  return res.json({ user: { id: user.id, email: user.email, points: user.points } });
});

app.post('/api/auth/login', async (req, res) => {
  const email = sanitizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'INVALID_INPUT' });

  const user = getUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  // 更新登录信息
  updateUserLogin(user.id);
  logEvent('info', '用户登录', { email }, user.id, req.ip);

  const token = signToken({ sub: user.id, email: user.email }, JWT_SECRET);
  res.cookie('token', token, authCookieOptions);
  return res.json({ user: { id: user.id, email: user.email, points: user.points } });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('token');
  return res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const info = getAuthedUser(req);
  if (!info) return res.status(200).json({ user: null });
  return res.json({ user: { id: info.user.id, email: info.user.email, points: info.user.points } });
});

app.get('/api/history', requireAuth(JWT_SECRET), (req, res) => {
  const analyses = getAnalysesByUserId(req.auth.sub, 20, 0);
  const list = analyses.map((a) => ({
    id: a.id,
    createdAt: a.createdAt,
    cost: a.cost,
    summary: a.analysisData?.summary || ''
  }));
  return res.json({ items: list });
});

app.get('/api/history/:id', requireAuth(JWT_SECRET), (req, res) => {
  const analysis = getAnalysisById(req.params.id);
  if (!analysis || analysis.userId !== req.auth.sub) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  return res.json({
    item: {
      id: analysis.id,
      createdAt: analysis.createdAt,
      cost: analysis.cost,
      result: {
        chartData: analysis.chartData,
        analysis: analysis.analysisData,
      }
    }
  });
});

// 新增流式分析端点
app.post('/api/analyze-stream', async (req, res) => {
  const body = req.body || {};
  const useCustomApi = Boolean(body.useCustomApi);

  let authedInfo = null;

  if (!useCustomApi) {
    let info = getAuthedUser(req);

    if (info) {
      authedInfo = info;
      if (info.user.points < COST_PER_ANALYSIS) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: 'INSUFFICIENT_POINTS', points: info.user.points })}\n\n`);
        return res.end();
      }
    }
  }

  req.__authedInfo = authedInfo;
  return handleAnalyzeStream(req, res);
});

app.post('/api/analyze', async (req, res) => {
  const body = req.body || {};
  const useCustomApi = Boolean(body.useCustomApi);

  let authedInfo = null;

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
    let info = getAuthedUser(req);

    // 允许未登录用户免费体验（游客模式）
    if (info) {
      authedInfo = info;
      // 已登录用户检查积分
      if (info.user.points < COST_PER_ANALYSIS) {
        return res.status(402).json({ error: 'INSUFFICIENT_POINTS', points: info.user.points });
      }
    }
    // 未登录用户可以免费体验一次（游客模式，不扣点）

    apiBaseUrl = DEFAULT_API_BASE_URL;
    apiKey = DEFAULT_API_KEY;
    modelName = DEFAULT_MODEL;

    // 检查 API 配置
    if (!DEFAULT_API_KEY || DEFAULT_API_KEY === 'sk-example-key') {
      return res.status(500).json({
        error: 'SERVER_DEFAULT_KEY_NOT_SET',
        message: 'Please configure API key on server or use custom API with your own key'
      });
    }
  } else {
    if (!apiBaseUrl || !apiKey || !modelName) return res.status(400).json({ error: 'MISSING_CUSTOM_API_CONFIG' });
  }

  const userPrompt = String(body.userPrompt || '').trim() || buildUserPrompt({ ...input, gender: input.gender });

  // 构建要尝试的模型列表（主模型 + 降级模型）
  const modelsToTry = [modelName];
  // 只有使用默认模型时才启用降级机制
  if (!useCustomApi) {
    modelsToTry.push(...FALLBACK_MODELS);
  }

  // 单次请求函数
  const makeRequest = async (currentModel, currentApiBaseUrl, currentApiKey) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 180秒超时

    try {
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
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
        }),
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  };

  // 带重试的单模型请求
  const tryModelWithRetries = async (currentModel) => {
    let retryCount = 0;
    const maxRetries = 1; // 每个模型最多重试1次

    while (retryCount <= maxRetries) {
      try {
        console.log(`尝试模型: ${currentModel} (第${retryCount + 1}次)`);
        const response = await makeRequest(currentModel, apiBaseUrl, apiKey);

        if (response.ok) {
          return { success: true, response, model: currentModel };
        }

        // 检查是否是可重试的错误
        const errText = await response.text();
        console.warn(`模型 ${currentModel} 请求失败:`, response.status, errText.substring(0, 200));

        // 401/403 认证错误不重试
        if (response.status === 401 || response.status === 403) {
          return { success: false, error: 'AUTH_ERROR', status: response.status, errText };
        }

        retryCount++;
        if (retryCount <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒后重试
        }
      } catch (err) {
        console.warn(`模型 ${currentModel} 请求异常:`, err.message);
        retryCount++;
        if (retryCount <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    return { success: false, error: 'FAILED_AFTER_RETRIES' };
  };

  // 依次尝试所有模型
  let lastError = null;
  let successResponse = null;
  let usedModel = null;

  for (const currentModel of modelsToTry) {
    const result = await tryModelWithRetries(currentModel);

    if (result.success) {
      successResponse = result.response;
      usedModel = result.model;
      console.log(`✓ 模型 ${currentModel} 请求成功`);
      break;
    }

    lastError = result;
    console.warn(`✗ 模型 ${currentModel} 失败，尝试下一个...`);
  }

  if (!successResponse) {
    console.error('所有模型均失败:', lastError);

    if (lastError?.error === 'AUTH_ERROR') {
      return res.status(500).json({
        error: 'API_AUTH_FAILED',
        message: 'API密钥认证失败，请检查API配置'
      });
    }

    return res.status(502).json({
      error: 'ALL_MODELS_FAILED',
      message: '所有AI模型均无法响应，请稍后重试',
      triedModels: modelsToTry
    });
  }

  const response = successResponse;

  const responseText = await response.text();
  let jsonResult;
  try {
    jsonResult = JSON.parse(responseText);
  } catch (e) {
    console.error('API response parse error. Status:', response.status, 'Content type:', response.headers.get('content-type'));
    console.error('Body preview:', responseText.substring(0, 200));
    return res.status(502).json({ 
      error: 'INVALID_API_RESPONSE', 
      message: 'AI服务返回了非JSON格式数据',
      details: responseText.substring(0, 100)
    });
  }

  let content = jsonResult.choices?.[0]?.message?.content;
  if (!content) return res.status(502).json({ error: 'EMPTY_MODEL_RESPONSE' });

  // 清理可能的 markdown 代码块标记
  content = content.trim();
  
  // 移除 <think> 思考过程标签
  content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  if (content.startsWith('```json')) {
    content = content.slice(7);
  } else if (content.startsWith('```')) {
    content = content.slice(3);
  }
  if (content.endsWith('```')) {
    content = content.slice(0, -3);
  }
  content = content.trim();

  let data;
  try {
    data = JSON.parse(content);
  } catch (parseErr) {
    console.error('JSON parse error:', parseErr.message, 'Content:', content.substring(0, 200));
    return res.status(502).json({ error: 'INVALID_JSON_FORMAT', message: '模型返回的数据格式无效' });
  }
  if (!data.chartPoints || !Array.isArray(data.chartPoints)) return res.status(502).json({ error: 'INVALID_MODEL_JSON' });

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

  // 记录用户输入信息
  const inputId = nanoid();
  const startTime = Date.now();

  if (!useCustomApi) {
    const info = authedInfo;

    // 保存用户输入
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

    // 保存分析结果
    const analysisId = nanoid();

    if (info) {
      // 已登录用户：扣除积分并保存到账户
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
      // 游客模式：免费体验，不扣点，标记为游客
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
    // 自定义API模式，记录输入（无用户ID）
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

  return res.json({ result, user, cost, isGuest });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, '..', 'dist');

app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  process.stdout.write(`server listening on 0.0.0.0:${PORT}\n`);
});
