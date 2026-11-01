/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/context/AuthContext.jsx
 * Author: Team ResolveIT
 * Description: Authentication Context & Provider for managing JWT tokens,
 *              user profile, roles (citizen, worker, dept_officer, admin),
 *              and automatic FCM token registration upon login.
 * ==============================================================================
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { requestFCMPermission } from '../firebase';

export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Return safe fallback if used outside AuthProvider
    return {
      user: null,
      token: localStorage.getItem('access_token') || null,
      role: localStorage.getItem('user_role') || null,
      isAuthenticated: Boolean(localStorage.getItem('access_token')),
      login: () => {},
      logout: () => {}
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('access_token') || 'local-citizen-token');
  const [role, setRole] = useState(() => localStorage.getItem('user_role') || 'citizen');
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user_data');
      if (savedUser) return JSON.parse(savedUser);
    } catch {}
    return {
      id: 'u-faizan-1',
      name: 'Faizan Rayeen',
      mobile: '8767972843',
      ward: 'Ward 4 (Mangalwari / North Nagpur)',
      role: 'citizen',
      account_status: 'Active'
    };
  });

  const isAuthenticated = Boolean(token);

  /**
   * Save authentication payload from login/register APIs
   */
  const login = useCallback(async (authData) => {
    const accessToken = authData.access || authData.token || authData.access_token;
    const refreshToken = authData.refresh || authData.refresh_token;
    const userData = authData.user || authData;
    const userRole = userData.role || authData.role || 'citizen';

    if (accessToken) {
      localStorage.setItem('access_token', accessToken);
      setToken(accessToken);
    }
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }
    if (userRole) {
      localStorage.setItem('user_role', userRole);
      setRole(userRole);
    }
    if (userData) {
      localStorage.setItem('user_data', JSON.stringify(userData));
      setUser(userData);
    }

    // Trigger FCM notification permission on login (Day 1 Integration)
    try {
      console.log('[Auth] User logged in. Requesting FCM push permission...');
      await requestFCMPermission();
    } catch (fcmErr) {
      console.warn('[Auth] FCM permission request skipped/failed:', fcmErr);
    }

    return { token: accessToken, role: userRole, user: userData };
  }, []);

  /**
   * Update user details in state and localStorage
   */
  const updateUser = useCallback((updatedFields) => {
    setUser((prev) => {
      const merged = { ...(prev || {}), ...updatedFields };
      try {
        localStorage.setItem('user_data', JSON.stringify(merged));
      } catch (e) {
        console.warn('[AuthContext] Error caching user_data:', e);
      }
      return merged;
    });
  }, []);

  /**
   * Logout user and clear all stored credentials
   */
  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_data');
    localStorage.removeItem('fcm_token');
    setToken(null);
    setRole(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  const value = {
    token,
    role,
    user,
    isAuthenticated,
    login,
    logout,
    updateUser,
    setUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
