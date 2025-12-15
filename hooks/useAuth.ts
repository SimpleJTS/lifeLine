import { useState, useEffect } from 'react';

interface UserInfo {
  email: string;
  points: number;
}

export const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // 检查登录状态
  useEffect(() => {
    console.log('[useAuth] 检查登录状态');
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            console.log('[useAuth] 用户已登录:', data.user.email);
            setIsLoggedIn(true);
            setUserInfo({ email: data.user.email, points: data.user.points });
          } else {
            console.log('[useAuth] 用户未登录');
            setIsLoggedIn(false);
            setUserInfo(null);
          }
        } else {
          console.log('[useAuth] 登录检查失败');
          setIsLoggedIn(false);
          setUserInfo(null);
        }
      } catch {
        console.log('[useAuth] 登录检查异常');
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

  // 登录成功处理
  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    refreshUserInfo();
  };

  return {
    isLoggedIn,
    userInfo,
    refreshUserInfo,
    handleLoginSuccess,
  };
};
