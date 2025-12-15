
import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import BaziForm from './components/BaziForm';
import { UserInput, LifeDestinyResult } from './types';
import { generateLifeAnalysis } from './services/geminiService';
import { API_STATUS } from './constants';
import { Sparkles, AlertCircle, Download, Twitter, Printer, Trophy, Loader2, User, Coins, LogOut, X, UserPlus } from 'lucide-react';

// 懒加载重型组件
const LifeKLineChart = lazy(() => import('./components/LifeKLineChart'));
const AnalysisResult = lazy(() => import('./components/AnalysisResult'));
const HelpGuide = lazy(() => import('./components/HelpGuide'));
const HistoryList = lazy(() => import('./components/HistoryList'));

// 加载中占位组件
const LoadingFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
  </div>
);

// 本地历史存储
const HISTORY_STORAGE_KEY = 'lifekline_history';
const MAX_LOCAL_HISTORY = 10;

const saveLocalHistory = (input: UserInput, result: LifeDestinyResult) => {
  try {
    const data = localStorage.getItem(HISTORY_STORAGE_KEY);
    const history = data ? JSON.parse(data) : [];
    const newItem = {
      id: `local_${Date.now()}`,
      createdAt: new Date().toISOString(),
      cost: 0,
      input,
      result,
    };
    const updated = [newItem, ...history].slice(0, MAX_LOCAL_HISTORY);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('保存历史失败:', e);
  }
};

// 注册弹窗组件
const RegisterModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('请填写邮箱和密码');
      return;
    }
    if (password.length < 6) {
      setError('密码至少6位');
      return;
    }

    setLoading(true);
    try {
      // 先尝试登录
      let response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        // 登录失败，尝试注册
        response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'EMAIL_EXISTS') {
          setError('该邮箱已注册，请检查密码是否正确');
        } else if (data.error === 'INVALID_CREDENTIALS') {
          setError('密码错误');
        } else {
          setError(data.error || '注册失败，请重试');
        }
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fade-in">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <UserPlus className="w-5 h-5" />
            <h3 className="font-bold text-lg">注册/登录以保存结果</h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-gray-600 text-sm">
            注册后可以：保存分析结果、查看历史记录、获得更多测算次数
          </p>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少6位"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                注册/登录
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 text-center">
            已有账号会自动登录，新邮箱会自动注册
          </p>
        </form>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  console.log('[App] 组件渲染');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LifeDestinyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentInput, setCurrentInput] = useState<UserInput | null>(null);
  const [userInfo, setUserInfo] = useState<{ email: string; points: number } | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // 检查登录状态
  useEffect(() => {
    console.log('[App] 组件挂载 - 检查登录状态');
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            console.log('[App] 用户已登录:', data.user.email);
            setIsLoggedIn(true);
            setUserInfo({ email: data.user.email, points: data.user.points });
          } else {
            console.log('[App] 用户未登录');
            setIsLoggedIn(false);
            setUserInfo(null);
          }
        } else {
          console.log('[App] 登录检查失败');
          setIsLoggedIn(false);
          setUserInfo(null);
        }
      } catch {
        console.log('[App] 登录检查异常');
        setIsLoggedIn(false);
        setUserInfo(null);
      }
    };
    checkAuth();
  }, []);

  // 刷新用户信息
  const refreshUserInfo = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setUserInfo({ email: data.user.email, points: data.user.points });
        }
      }
    } catch {
      // 忽略错误
    }
  };

  // 从历史记录加载结果
  const handleHistorySelect = (historyResult: LifeDestinyResult, historyInput: UserInput) => {
    setResult(historyResult);
    setUserName(historyInput.name || '');
    setCurrentInput(historyInput);
    setError(null);
  };

  const handleFormSubmit = async (data: UserInput) => {
    // 检查系统状态
    if (API_STATUS === 0) {
      setError("当前服务器正在维护，请择时再来");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setUserName(data.name || '');
    setCurrentInput(data);

    try {
      const response = await generateLifeAnalysis(data);
      setResult(response.result);
      setIsGuest(response.isGuest);

      // 更新用户状态
      if (response.user) {
        setIsLoggedIn(true);
        setUserInfo({ email: response.user.email, points: response.user.points });
      }

      // 保存到本地历史
      saveLocalHistory(data, response.result);

      // 如果不是游客，刷新用户信息
      if (!response.isGuest) {
        refreshUserInfo();
      }
    } catch (err: any) {
      setError(err.message || "命理测算过程中发生了意外错误，请重试。");
    } finally {
      setLoading(false);
    }
  };

  // 注册成功后的处理
  const handleRegisterSuccess = () => {
    setIsLoggedIn(true);
    setIsGuest(false);
    refreshUserInfo();
  };

  // 检查是否需要登录（游客模式下）
  const requireLogin = (action: () => void) => {
    if (isGuest && !isLoggedIn) {
      setShowRegisterModal(true);
    } else {
      action();
    }
  };

  const handlePrint = () => {
    requireLogin(() => window.print());
  };

  const handleSaveHtml = () => {
    if (!result) return;

    // 游客需要登录才能保存
    if (isGuest && !isLoggedIn) {
      setShowRegisterModal(true);
      return;
    }

    // 获取当前精确时间 (到秒)
    const now = new Date();
    const timeString = now.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });

    // 1. 获取图表 SVG (Recharts 生成的是 SVG)
    const chartContainer = document.querySelector('.recharts-surface');
    // 如果找不到 chart，给一个提示文本
    const chartSvg = chartContainer ? chartContainer.outerHTML : '<div style="padding:20px;text-align:center;">图表导出失败，请截图保存</div>';

    // 2. 获取命理分析部分的 HTML
    const analysisContainer = document.getElementById('analysis-result-container');
    const analysisHtml = analysisContainer ? analysisContainer.innerHTML : '';

    // 3. 生成流年详批表格 (替代交互式的 Tooltip)
    // 根据分数判断颜色
    const tableRows = result.chartData.map(item => {
      const scoreColor = item.close >= item.open ? 'text-green-600' : 'text-red-600';
      const trendIcon = item.close >= item.open ? '▲' : '▼';
      return `
        <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
          <td class="p-3 border-r border-gray-100 text-center font-mono">${item.age}岁</td>
          <td class="p-3 border-r border-gray-100 text-center font-bold">${item.year} ${item.ganZhi}</td>
          <td class="p-3 border-r border-gray-100 text-center text-sm">${item.daYun || '-'}</td>
          <td class="p-3 border-r border-gray-100 text-center font-bold ${scoreColor}">
            ${item.score} <span class="text-xs">${trendIcon}</span>
          </td>
          <td class="p-3 text-sm text-gray-700 text-justify leading-relaxed">${item.reason}</td>
        </tr>
      `;
    }).join('');

    const detailedTableHtml = `
      <div class="mt-12 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="p-6 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
           <div class="w-1 h-5 bg-indigo-600 rounded-full"></div>
           <h3 class="text-xl font-bold text-gray-800 font-serif-sc">流年详批全表</h3>
           <span class="text-xs text-gray-500 ml-2">(由于离线网页无法交互，特此列出所有年份详情)</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-100 text-gray-600 text-sm font-bold uppercase tracking-wider">
                <th class="p-3 border-r border-gray-200 text-center w-20">年龄</th>
                <th class="p-3 border-r border-gray-200 text-center w-28">流年</th>
                <th class="p-3 border-r border-gray-200 text-center w-28">大运</th>
                <th class="p-3 border-r border-gray-200 text-center w-20">评分</th>
                <th class="p-3">运势批断与建议</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // 4. 组装完整的 HTML 文件
    const fullHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${userName || '用户'} - 人生K线命理报告</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&family=Inter:wght@400;600&display=swap');
    body { font-family: 'Inter', sans-serif; background-color: #f8f9fa; }
    .font-serif-sc { font-family: 'Noto Serif SC', serif; }
    /* Ensure SVG fits */
    svg { width: 100% !important; height: auto !important; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen p-4 md:p-12">
  <div class="max-w-6xl mx-auto space-y-10">
    
    <!-- Header -->
    <div class="text-center border-b border-gray-200 pb-8 relative">
      <h1 class="text-4xl font-bold font-serif-sc text-gray-900 mb-2">${userName ? userName + '的' : ''}人生K线命理报告</h1>
      <p class="text-gray-500 text-sm">生成时间：${timeString} | 来源：人生K线 lifekline.0xsakura.me</p>
      <a href="https://x.com/laoshiline" target="_blank" class="absolute top-0 right-0 flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-sm font-medium">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-twitter"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
        @laoshiline
      </a>
    </div>

    <!-- Chart Section -->
    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div class="flex items-center gap-2 mb-6">
        <div class="w-1 h-6 bg-indigo-600 rounded-full"></div>
        <h3 class="text-xl font-bold text-gray-800 font-serif-sc">流年大运走势图</h3>
      </div>
      <!-- Injected SVG Container -->
      <div class="w-full overflow-hidden flex justify-center py-4">
        ${chartSvg}
      </div>
      <p class="text-center text-xs text-gray-400 mt-2">注：图表K线颜色根据运势涨跌绘制，数值越高代表运势越强。</p>
    </div>

    <!-- Analysis Cards -->
    <div class="space-y-8">
       ${analysisHtml}
    </div>

    <!-- Detailed Table -->
    ${detailedTableHtml}

    <!-- Footer -->
    <div class="text-center text-gray-400 text-sm py-12 border-t border-gray-200 mt-12 flex flex-col items-center gap-2">
      <p>&copy; ${now.getFullYear()} 人生K线项目 | 仅供娱乐与文化研究，请勿迷信</p>
      <a href="https://x.com/laoshiline" target="_blank" class="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
        关注作者推特 @laoshiline 获取更新
      </a>
    </div>

  </div>
</body>
</html>
    `;

    // 5. 触发下载
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${userName || 'User'}_Life_Kline_Report_${now.getTime()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 计算人生巅峰
  const peakYearItem = useMemo(() => {
    if (!result || !result.chartData.length) return null;
    return result.chartData.reduce((prev, current) => (prev.high > current.high) ? prev : current);
  }, [result]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      {/* 注册弹窗 */}
      <RegisterModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSuccess={handleRegisterSuccess}
      />

      {/* 游客横幅 */}
      {isGuest && result && !isLoggedIn && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 px-4 text-center text-sm font-medium no-print">
          <span>🎁 您正在免费体验模式 - </span>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="underline font-bold hover:text-yellow-200"
          >
            注册账号
          </button>
          <span> 以保存结果并获得更多测算次数</span>
        </div>
      )}

      {/* Header */}
      <header className={`w-full bg-white border-b border-gray-200 py-6 sticky z-50 no-print ${isGuest && result && !isLoggedIn ? 'top-10' : 'top-0'}`}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-black text-white p-2 rounded-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-serif-sc font-bold text-gray-900 tracking-wide">人生K线</h1>
              <p className="text-xs text-gray-500 uppercase tracking-widest">Life Destiny K-Line</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* 用户状态显示 */}
            {isLoggedIn && userInfo ? (
              <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-2 rounded-full border border-indigo-100">
                <div className="flex items-center gap-1.5 text-indigo-700">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium truncate max-w-[120px]">{userInfo.email}</span>
                </div>
                <div className="w-px h-4 bg-indigo-200"></div>
                <div className="flex items-center gap-1.5 text-amber-600">
                  <Coins className="w-4 h-4" />
                  <span className="text-sm font-bold">{userInfo.points}</span>
                  <span className="text-xs text-amber-500">点</span>
                </div>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">
                <User className="w-4 h-4" />
                <span>未登录</span>
              </div>
            )}

            {/* Twitter 链接 */}
            <a
              href="https://x.com/laoshiline"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-2 text-sm text-gray-500 font-medium bg-gray-100 hover:bg-gray-200 hover:text-indigo-600 px-3 py-1.5 rounded-full transition-all"
            >
               <Twitter className="w-4 h-4" />
               @laoshiline
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-7xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-12">
        
        {/* If no result, show intro and form */}
        {!result && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-fade-in">
            <div className="text-center max-w-2xl flex flex-col items-center">
              <h2 className="text-4xl md:text-5xl font-serif-sc font-bold text-gray-900 mb-6">
                洞悉命运起伏 <br/>
                <span className="text-indigo-600">预见人生轨迹</span>
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed mb-8">
                结合<strong>传统八字命理</strong>与<strong>金融可视化技术</strong>
                将您的一生运势绘制成类似股票行情的K线图。
                助您发现人生牛市，规避风险熊市，把握关键转折点。
              </p>
            </div>

            {/* 主表单 */}
            <BaziForm onSubmit={handleFormSubmit} isLoading={loading} isLoggedIn={isLoggedIn} />

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-100 max-w-md w-full animate-bounce-short">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-bold">{error}</p>
              </div>
            )}

            {/* 帮助指南 */}
            <Suspense fallback={<LoadingFallback />}>
              <HelpGuide />
            </Suspense>

            {/* 历史记录 */}
            <Suspense fallback={<LoadingFallback />}>
              <HistoryList onSelect={handleHistorySelect} isLoggedIn={isLoggedIn} />
            </Suspense>
          </div>
        )}

        {/* Results View */}
        {result && (
          <div className="animate-fade-in space-y-12">
            
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center border-b border-gray-200 pb-4 gap-4">
               <h2 className="text-2xl font-bold font-serif-sc text-gray-800">
                 {userName ? `${userName}的` : ''}命盘分析报告
               </h2>
               
               <div className="flex gap-3 no-print">
                 <button
                   onClick={handlePrint}
                   className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white border border-indigo-600 rounded-lg hover:bg-indigo-700 transition-all font-medium text-sm shadow-sm"
                 >
                   <Printer className="w-4 h-4" />
                   保存PDF
                 </button>
                 <button
                   onClick={handleSaveHtml}
                   className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white border border-indigo-600 rounded-lg hover:bg-indigo-700 transition-all font-medium text-sm shadow-sm"
                 >
                   <Download className="w-4 h-4" />
                   保存网页
                 </button>
                 <button 
                   onClick={() => setResult(null)}
                   className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all font-medium text-sm"
                 >
                   ← 重新排盘
                 </button>
               </div>
            </div>

            {/* The Chart */}
            <section className="space-y-4 break-inside-avoid">
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                   <span className="w-1 h-6 bg-indigo-600 rounded-full"></span>
                   流年大运走势图 (100年)
                </h3>
                {peakYearItem && (
                   <p className="text-sm font-bold text-indigo-800 bg-indigo-50 border border-indigo-100 rounded px-2 py-1 inline-flex items-center gap-2 self-start mt-1">
                     <Trophy className="w-3 h-3 text-amber-500" />
                     人生巅峰年份：{peakYearItem.year}年 ({peakYearItem.ganZhi}) - {peakYearItem.age}岁，评分 <span className="text-amber-600 text-lg">{peakYearItem.high}</span>
                   </p>
                )}
              </div>
              
              <p className="text-sm text-gray-500 mb-2 no-print">
                <span className="text-green-600 font-bold">绿色K线</span> 代表运势上涨（吉），
                <span className="text-red-600 font-bold">红色K线</span> 代表运势下跌（凶）。
                <span className="text-red-500 font-bold">★</span> 标记为全盘最高运势点。
              </p>
              <Suspense fallback={<LoadingFallback />}>
                <LifeKLineChart data={result.chartData} />
              </Suspense>
            </section>

            {/* The Text Report */}
            {/* Added ID for HTML extraction */}
            <section id="analysis-result-container">
              <Suspense fallback={<LoadingFallback />}>
                <AnalysisResult analysis={result.analysis} />
              </Suspense>
            </section>
            
            {/* Print Only: Detailed Table to substitute interactive tooltips */}
            <div className="hidden print:block mt-8 break-before-page">
               <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-indigo-600 rounded-full"></div>
                  <h3 className="text-xl font-bold text-gray-800 font-serif-sc">流年详批全表</h3>
               </div>
               <table className="w-full text-left border-collapse text-sm">
                 <thead>
                   <tr className="bg-gray-100 text-gray-600 font-bold uppercase tracking-wider">
                     <th className="p-2 border border-gray-200 text-center w-16">年龄</th>
                     <th className="p-2 border border-gray-200 text-center w-24">流年</th>
                     <th className="p-2 border border-gray-200 text-center w-24">大运</th>
                     <th className="p-2 border border-gray-200 text-center w-16">评分</th>
                     <th className="p-2 border border-gray-200">运势批断</th>
                   </tr>
                 </thead>
                 <tbody>
                   {result.chartData.map((item) => (
                     <tr key={item.age} className="border-b border-gray-100 break-inside-avoid">
                       <td className="p-2 border border-gray-100 text-center font-mono">{item.age}</td>
                       <td className="p-2 border border-gray-100 text-center font-bold">{item.year} {item.ganZhi}</td>
                       <td className="p-2 border border-gray-100 text-center">{item.daYun || '-'}</td>
                       <td className={`p-2 border border-gray-100 text-center font-bold ${item.close >= item.open ? 'text-green-600' : 'text-red-600'}`}>
                         {item.score}
                       </td>
                       <td className="p-2 border border-gray-100 text-gray-700 text-justify text-xs leading-relaxed">
                         {item.reason}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
               
               <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
                  <span>生成时间：{new Date().toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Twitter className="w-3 h-3"/> @laoshiline</span>
               </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full bg-gray-900 text-gray-400 py-8 mt-auto no-print">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm flex flex-col items-center gap-2">
          <p>&copy; {new Date().getFullYear()} 人生K线项目 | 仅供娱乐与文化研究，请勿迷信</p>
          <a href="https://x.com/laoshiline" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-white transition-colors">
            <Twitter className="w-3 h-3" />
            @laoshiline
          </a>
        </div>
      </footer>
    </div>
  );
};

export default App;
