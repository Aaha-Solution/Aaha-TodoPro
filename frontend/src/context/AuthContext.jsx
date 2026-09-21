import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../utils/storage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => storage.getUser());
  const [token, setToken] = useState(() => storage.getToken());
  const [selectedSystem, setSelectedSystem] = useState(() => localStorage.getItem('4m_selected_system') || 'processAudit');
  const [loading, setLoading] = useState(false);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    storage.setUser(userData);
    storage.setToken(authToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    storage.clear();
  };

  const switchSystem = (systemId) => {
    setSelectedSystem(systemId);
    localStorage.setItem('4m_selected_system', systemId);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        selectedSystem,
        login,
        logout,
        switchSystem,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
