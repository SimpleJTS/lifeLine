import { LifeDestinyResult } from '../types';

export const exportAsHtml = (result: LifeDestinyResult, userName: string) => {
  // 获取当前精确时间 (到秒)
  const now = new Date();
  const timeString = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // 1. 获取图表 SVG (Recharts 生成的是 SVG)
  const chartContainer = document.querySelector('.recharts-surface');
  const chartSvg = chartContainer
    ? chartContainer.outerHTML
    : '<div style="padding:20px;text-align:center;">图表导出失败，请截图保存</div>';

  // 2. 获取命理分析部分的 HTML
  const analysisContainer = document.getElementById('analysis-result-container');
  const analysisHtml = analysisContainer ? analysisContainer.innerHTML : '';

  // 3. 生成流年详批表格
  const tableRows = result.chartData
    .map((item) => {
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
    })
    .join('');

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
