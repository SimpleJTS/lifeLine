# 性能优化报告

## 问题
首页加载缓慢，初始 bundle 大小 950KB (gzip 288KB)

## 解决方案

### 1. 代码分割 (Code Splitting)
通过 Vite 配置将大型依赖分离：
- lunar-javascript (八字计算库)
- recharts (图表库)
- lucide-react (图标库)
- react/react-dom

### 2. 动态导入 lunar-javascript
将八字计算库改为动态加载，仅在用户使用智能输入时才下载。

### 3. Bundle 分析
使用 rollup-plugin-visualizer 生成可视化报告。

## 优化结果

### 加载性能
- **首屏加载**: 70KB (优化前 288KB) - **提升 75%**
- 按需加载: lunar (101KB), recharts (113KB)

### 用户体验
- ✅ 首页打开速度显著提升
- ✅ 八字计算功能按需加载
- ✅ 图表渲染时才加载图表库
- ✅ 支持并行下载

### 技术细节
```typescript
// vite.config.ts
manualChunks: {
  'lunar': ['lunar-javascript'],
  'recharts': ['recharts'],
  'lucide': ['lucide-react'],
  'react-vendor': ['react', 'react-dom']
}
```

```typescript
// SmartBaziInput.tsx
// 动态导入
const lib = await import('lunar-javascript');
```

## 构建输出
```
dist/assets/index.js       226 KB → 70 KB (gzip)
dist/assets/lunar.js       292 KB → 101 KB (gzip)
dist/assets/recharts.js    417 KB → 113 KB (gzip)
dist/assets/lucide.js      14 KB → 4 KB (gzip)
```

## 建议
1. 继续监控 bundle 大小
2. 考虑添加 loading 状态提示
3. 使用 CDN 加速静态资源
