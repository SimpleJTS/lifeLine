// 调试工具：追踪页面刷新问题

export const initDebugListeners = () => {
  // 记录页面加载类型
  const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  console.log('[Debug] 页面加载类型:', perfData?.type);
  console.log('[Debug] 页面加载时间:', new Date().toLocaleTimeString());

  // 监听页面可见性变化
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('[Debug] ⚠️ 页面隐藏 -', new Date().toLocaleTimeString());
    } else {
      console.log('[Debug] ✅ 页面显示 -', new Date().toLocaleTimeString());
      console.log('[Debug] 页面是否被重新加载:', performance.getEntriesByType('navigation')[0]?.type);
    }
  });

  // 监听窗口焦点变化
  window.addEventListener('focus', () => {
    console.log('[Debug] 🎯 窗口获得焦点 -', new Date().toLocaleTimeString());
  });

  window.addEventListener('blur', () => {
    console.log('[Debug] 😴 窗口失去焦点 -', new Date().toLocaleTimeString());
  });

  // 监听页面卸载前
  window.addEventListener('beforeunload', (e) => {
    console.log('[Debug] ⚠️⚠️⚠️ 页面即将卸载！！！ -', new Date().toLocaleTimeString());
  });

  // 监听页面隐藏（比 beforeunload 更可靠）
  window.addEventListener('pagehide', (e) => {
    console.log('[Debug] 📦 页面隐藏事件 (pagehide) -', new Date().toLocaleTimeString());
    console.log('[Debug] 是否进入 BFCache:', e.persisted);
  });

  // 监听页面显示（从 BFCache 恢复）
  window.addEventListener('pageshow', (e) => {
    console.log('[Debug] 📂 页面显示事件 (pageshow) -', new Date().toLocaleTimeString());
    console.log('[Debug] 是否从 BFCache 恢复:', e.persisted);
    if (e.persisted) {
      console.log('[Debug] ⚠️ 页面从缓存恢复，可能需要重新初始化');
    }
  });

  console.log('[Debug] 🔍 调试监听器已初始化');
};
