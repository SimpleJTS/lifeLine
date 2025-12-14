import React, { useState, useEffect } from 'react';
import { History, ChevronRight, Calendar, Coins, User, RefreshCw, Trash2 } from 'lucide-react';
import { LifeDestinyResult, UserInput } from '../types';

interface HistoryItem {
  id: string;
  createdAt: string;
  cost: number;
  input: UserInput;
  result: LifeDestinyResult;
}

interface HistoryListProps {
  onSelect: (result: LifeDestinyResult, input: UserInput) => void;
  isLoggedIn: boolean;
}

const HISTORY_STORAGE_KEY = 'lifekline_history';
const MAX_LOCAL_HISTORY = 10;

// 本地历史存储工具
const getLocalHistory = (): HistoryItem[] => {
  try {
    const data = localStorage.getItem(HISTORY_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveLocalHistory = (item: Omit<HistoryItem, 'id' | 'createdAt'>) => {
  try {
    const history = getLocalHistory();
    const newItem: HistoryItem = {
      id: `local_${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...item,
    };
    // 保持最多 MAX_LOCAL_HISTORY 条
    const updated = [newItem, ...history].slice(0, MAX_LOCAL_HISTORY);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return newItem;
  } catch (e) {
    console.error('保存历史失败:', e);
    return null;
  }
};

const clearLocalHistory = () => {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (e) {
    console.error('清除历史失败:', e);
  }
};

// Export for use in App.tsx
export { saveLocalHistory };

const HistoryList: React.FC<HistoryListProps> = ({ onSelect, isLoggedIn }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true); // 默认展开

  const fetchHistory = async () => {
    setLoading(true);
    try {
      if (isLoggedIn) {
        // 从服务器获取历史
        const response = await fetch('/api/history', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          // 服务器返回 items，需要获取详情
          const items = data.items || [];
          // 对于服务器历史，需要单独获取完整数据
          const fullHistory: HistoryItem[] = [];
          for (const item of items.slice(0, 10)) {
            try {
              const detailRes = await fetch(`/api/history/${item.id}`, { credentials: 'include' });
              if (detailRes.ok) {
                const detail = await detailRes.json();
                if (detail.item) {
                  fullHistory.push(detail.item);
                }
              }
            } catch {
              // 跳过失败的项
            }
          }
          // 合并本地历史
          const localHistory = getLocalHistory();
          const mergedHistory = [...fullHistory, ...localHistory]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 20);
          setHistory(mergedHistory);
        } else {
          // 回退到本地历史
          setHistory(getLocalHistory());
        }
      } else {
        // 使用本地历史
        setHistory(getLocalHistory());
      }
    } catch {
      // 回退到本地历史
      setHistory(getLocalHistory());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [isLoggedIn]);

  const handleClear = () => {
    if (confirm('确定要清除所有历史记录吗？')) {
      clearLocalHistory();
      setHistory([]);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (history.length === 0 && !loading) {
    return null; // 没有历史记录时不显示
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 text-white p-2 rounded-lg">
            <History className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-gray-800">测算历史</h3>
            <p className="text-xs text-gray-500">
              {history.length} 条记录 · 点击查看
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
          <ChevronRight
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </button>

      {/* Expandable List */}
      {expanded && (
        <div className="animate-fade-in">
          {/* Actions */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <button
              onClick={fetchHistory}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              刷新
            </button>
            <button
              onClick={handleClear}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              清空
            </button>
          </div>

          {/* History Items */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item.result, item.input)}
                className="w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left flex items-center gap-3 group"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 truncate">
                      {item.input?.name || '匿名用户'}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                    <span>
                      {item.input?.yearPillar} {item.input?.monthPillar} {item.input?.dayPillar} {item.input?.hourPillar}
                    </span>
                    {item.cost > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Coins className="w-3 h-3" />
                        {item.cost}点
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
              </button>
            ))}
          </div>

          {/* Empty State */}
          {history.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              暂无历史记录
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryList;
