import React, { createContext, useContext, useState } from 'react';
import { formatDeptName } from '../utils/chartHelpers';

const AuthContext = createContext(null);

const normalizeRole = (value) => {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();
  const roleMap = {
    citizen: 'citizen',
    user: 'citizen',
    worker: 'worker',
    field_worker: 'worker',
    'field worker': 'worker',
    officer: 'officer',
    department_officer: 'officer',
    municipal_officer: 'officer',
    dept_officer: 'officer',
    admin: 'admin',
    administrator: 'admin',
    superadmin: 'admin',
  };

  if (roleMap[normalized]) return roleMap[normalized];
  if (normalized.includes('pwd') || normalized.includes('public works') || normalized.includes('road')) return 'officer';
  if (normalized.includes('swm') || normalized.includes('waste') || normalized.includes('garbage')) return 'officer';
  if (normalized.includes('wsd') || normalized.includes('water') || normalized.includes('drain')) return 'officer';
  if (normalized.includes('elec') || normalized.includes('light') || normalized.includes('electr')) return 'officer';

  return null;
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem('janmitra_token');
    if (!saved || saved === '[object Object]' || saved === 'null' || saved === 'undefined') {
      return null;
    }
    return saved;
  });

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('janmitra_user');
    if (!savedUser) return null;
    try {
      const parsed = JSON.parse(savedUser);
      if (parsed && typeof parsed === 'object') {
        const resolvedDept = formatDeptName(parsed.department_name || parsed.department || parsed.dept || parsed.dept_code);
        return {
          ...parsed,
          department_name: resolvedDept,
          department: resolvedDept,
          dept: resolvedDept,
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  const [role, setRole] = useState(() => {
    const savedRole = localStorage.getItem('janmitra_role');
    return normalizeRole(savedRole);
  });

  const login = (firstArg, secondArg) => {
    let newToken = null;
    let userData = {};
    let rawRole = null;

    if (firstArg && typeof firstArg === 'object') {
      // Called with single object: data from backend or mock object
      newToken = firstArg.access || firstArg.token || firstArg.tokens?.access || null;
      userData = firstArg.user || firstArg;
      rawRole = firstArg.role || userData?.role || userData?.portal || userData?.user_type || userData?.department || userData?.dept;
    } else {
      // Called with login(token, userData)
      newToken = firstArg;
      userData = secondArg || {};
      rawRole = userData?.role || userData?.portal || userData?.user_type || userData?.department || userData?.dept;
    }

    const userRole = normalizeRole(rawRole);
    const resolvedDept = formatDeptName(userData?.department_name || userData?.department || userData?.dept || userData?.dept_code);
    const normalizedUser = {
      ...userData,
      role: userRole,
      department_name: resolvedDept,
      department: resolvedDept,
      dept: resolvedDept,
    };

    const tokenStr = typeof newToken === 'string' ? newToken : (newToken ? JSON.stringify(newToken) : null);

    setToken(tokenStr);
    setUser(normalizedUser);
    setRole(userRole);

    if (tokenStr) {
      localStorage.setItem('janmitra_token', tokenStr);
    }
    if (normalizedUser) {
      localStorage.setItem('janmitra_user', JSON.stringify(normalizedUser));
    }
    if (userRole) {
      localStorage.setItem('janmitra_role', userRole);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setRole(null);

    localStorage.removeItem('janmitra_token');
    localStorage.removeItem('janmitra_refresh_token');
    localStorage.removeItem('janmitra_user');
    localStorage.removeItem('janmitra_role');

    // Force redirection to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const isAuthenticated = Boolean(token && token !== '[object Object]' && token !== 'null');

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        role,
        isAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
