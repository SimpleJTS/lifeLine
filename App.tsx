import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import BaziForm from './components/BaziForm';
import RegisterModal from './components/RegisterModal';
import { UserInput, LifeDestinyResult } from './types';
import { generateLifeAnalysis } from './services/geminiService';
import { API_STATUS } from './constants';
import { useAuth } from './hooks/useAuth';
import { useLocalHistory } from './hooks/useLocalHistory';
import { exportAsHtml } from './utils/exportUtils';
import { initDebugListeners } from './utils/debugUtils';
import { Sparkles, AlertCircle, Download, Twitter, Printer, Trophy, Loader2, User, Coins } from 'lucide-react';

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

const App: React.FC = () => {
  console.log('[App] 组件渲染');

  // 使用自定义 hooks
  const { isLoggedIn, userInfo, refreshUserInfo, handleLoginSuccess } = useAuth();
  const { saveToLocalHistory } = useLocalHistory();

  // 本地状态
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LifeDestinyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [currentInput, setCurrentInput] = useState<UserInput | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // 初始化调试监听器
  useEffect(() => {
    initDebugListeners();
  }, []);

  // 从历史记录加载结果
  const handleHistorySelect = (historyResult: LifeDestinyResult, historyInput: UserInput) => {
    setResult(historyResult);
    setUserName(historyInput.name || '');
    setCurrentInput(historyInput);
    setError(null);
  };

  // 处理表单提交
  const handleFormSubmit = async (data: UserInput) => {
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

      // 保存到本地历史
      saveToLocalHistory(data, response.result);

      // 如果不是游客，刷新用户信息
      if (!response.isGuest && response.user) {
        refreshUserInfo();
      }
    } catch (err: any) {
      setError(err.message || "命理测算过程中发生了意外错误，请重试。");
    } finally {
      setLoading(false);
    }
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

    exportAsHtml(result, userName);
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
        onSuccess={handleLoginSuccess}
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
            <section id="analysis-result-container">
              <Suspense fallback={<LoadingFallback />}>
                <AnalysisResult analysis={result.analysis} />
              </Suspense>
            </section>

            {/* Print Only: Detailed Table */}
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
