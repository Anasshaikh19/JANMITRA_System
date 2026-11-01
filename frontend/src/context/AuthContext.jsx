import React, { createContext, useContext, useState } from 'react';

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
  const [token, setToken] = useState(() => localStorage.getItem('janmitra_token') || null);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('janmitra_user');
    if (!savedUser) return null;
    try {
      return JSON.parse(savedUser);
    } catch {
      return null;
    }
  });
  const [role, setRole] = useState(() => {
    const savedRole = localStorage.getItem('janmitra_role');
    return normalizeRole(savedRole);
  });

  const login = (newToken, userData = {}) => {
    const normalizedUser = {
      ...userData,
      role: normalizeRole(userData?.role || userData?.portal || userData?.user_type || userData?.department || userData?.dept),
      dept: userData?.dept || userData?.department || null,
    };
    const userRole = normalizedUser.role;

    setToken(newToken);
    setUser(normalizedUser);
    setRole(userRole);

    if (newToken) {
      localStorage.setItem('janmitra_token', newToken);
    }
    if (userData) {
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
  };

  const isAuthenticated = Boolean(token);

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
