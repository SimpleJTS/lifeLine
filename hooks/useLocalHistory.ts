import { UserInput, LifeDestinyResult } from '../types';

const HISTORY_STORAGE_KEY = 'lifekline_history';
const MAX_LOCAL_HISTORY = 10;

export const useLocalHistory = () => {
  const saveToLocalHistory = (input: UserInput, result: LifeDestinyResult) => {
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

  return {
    saveToLocalHistory,
  };
};
