
import { UserInput, LifeDestinyResult } from "../types";

export interface AnalysisResponse {
  result: LifeDestinyResult;
  isGuest: boolean;
  user: { id: string; email: string; points: number } | null;
  cost: number;
}

export interface ProgressCallback {
  (message: string): void;
}

/**
 * 使用SSE流式获取分析结果，提供实时进度反馈
 */
export const generateLifeAnalysisWithProgress = async (
  input: UserInput,
  onProgress?: ProgressCallback
): Promise<AnalysisResponse> => {
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource('/api/analyze-stream?' + new URLSearchParams({
      body: JSON.stringify(input)
    }));

    // 使用fetch + SSE手动处理
    fetch('/api/analyze-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    }).then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || '请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 处理SSE消息
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          const eventMatch = line.match(/^event: (.+)$/m);
          const dataMatch = line.match(/^data: (.+)$/m);

          if (eventMatch && dataMatch) {
            const event = eventMatch[1];
            const data = JSON.parse(dataMatch[1]);

            if (event === 'progress') {
              onProgress?.(data.message);
            } else if (event === 'complete') {
              resolve({
                result: data.result as LifeDestinyResult,
                isGuest: data.isGuest || false,
                user: data.user || null,
                cost: data.cost || 0,
              });
              return;
            } else if (event === 'error') {
              reject(new Error(data.message || data.error || '分析失败'));
              return;
            }
          }
        }
      }
    }).catch(error => {
      console.error("Stream Error:", error);
      reject(error);
    });
  });
};

/**
 * 兼容旧版本的非流式API（作为降级方案）
 */
export const generateLifeAnalysis = async (input: UserInput): Promise<AnalysisResponse> => {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (payload?.error === 'LOGIN_REQUIRED') {
        throw new Error('免费模式需要登录：请在表单里填写邮箱与密码（系统将自动注册/登录），或开启"自定义 API"。');
      }
      if (payload?.error === 'INVALID_CREDENTIALS') {
        throw new Error('邮箱或密码错误。');
      }
      if (payload?.error === 'INVALID_INPUT') {
        throw new Error('邮箱或密码不合法（密码至少 6 位）。');
      }
      if (payload?.error === 'INSUFFICIENT_POINTS') {
        throw new Error(`点数不足（当前剩余 ${payload?.points ?? 0} 点），请充值或使用自定义 API。`);
      }
      if (payload?.error === 'MISSING_CUSTOM_API_CONFIG') {
        throw new Error('请完整填写自定义 API 配置（Base URL / Key / 模型）。');
      }
      if (payload?.detail) {
        throw new Error(`API 请求失败: ${payload.detail}`);
      }
      throw new Error(payload?.error || '命理测算过程中发生了意外错误，请重试。');
    }

    if (!payload?.result) {
      throw new Error('模型未返回任何内容。');
    }

    return {
      result: payload.result as LifeDestinyResult,
      isGuest: payload.isGuest || false,
      user: payload.user || null,
      cost: payload.cost || 0,
    };
  } catch (error) {
    console.error("Gemini/OpenAI API Error:", error);
    throw error;
  }
};
