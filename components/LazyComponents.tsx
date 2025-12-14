// 懒加载组件 - 减少首次加载时间
import { lazy } from 'react';

export const SmartBaziInput = lazy(() => import('./SmartBaziInput'));
export const AnalysisResult = lazy(() => import('./AnalysisResult'));
export const LifeKLineChart = lazy(() => import('./LifeKLineChart'));
