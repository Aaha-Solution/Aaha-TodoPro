const TOKEN_KEY = 'todo_token';
const USER_KEY = 'todo_user';

export const storage = {
  getToken: () => {
    try {
      return (
        sessionStorage.getItem(TOKEN_KEY) ||
        sessionStorage.getItem('4m_todo_token') ||
        sessionStorage.getItem('4m_cms_token') ||
        localStorage.getItem(TOKEN_KEY) ||
        localStorage.getItem('4m_todo_token') ||
        localStorage.getItem('4m_cms_token')
      );
    } catch {
      return null;
    }
  },

  setToken: (token) => {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem('4m_todo_token', token);
      // Clean up legacy localStorage tokens so login remains session-scoped
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('4m_todo_token');
      localStorage.removeItem('4m_cms_token');
    } catch (e) {
      console.warn('Failed to set token in sessionStorage:', e);
    }
  },

  removeToken: () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem('4m_todo_token');
      sessionStorage.removeItem('4m_cms_token');
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('4m_todo_token');
      localStorage.removeItem('4m_cms_token');
    } catch (e) {
      console.warn('Failed to remove token:', e);
    }
  },

  getUser: () => {
    try {
      const user =
        sessionStorage.getItem(USER_KEY) ||
        sessionStorage.getItem('4m_cms_user') ||
        localStorage.getItem(USER_KEY) ||
        localStorage.getItem('4m_cms_user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  setUser: (user) => {
    try {
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      // Remove from localStorage so user session is strictly in sessionStorage
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem('4m_cms_user');
    } catch (e) {
      console.warn('Failed to set user in sessionStorage:', e);
    }
  },

  removeUser: () => {
    try {
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem('4m_cms_user');
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem('4m_cms_user');
    } catch (e) {
      console.warn('Failed to remove user:', e);
    }
  },

  clear: () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem('4m_todo_token');
      sessionStorage.removeItem('4m_cms_token');
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem('4m_cms_user');
      sessionStorage.removeItem('4m_selected_system');

      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('4m_todo_token');
      localStorage.removeItem('4m_cms_token');
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem('4m_cms_user');
      localStorage.removeItem('4m_selected_system');
      clearIhlrDraft();
    } catch (e) {
      console.warn('Failed to clear storage:', e);
    }
  }
};

export const clearIhlrDraft = () => {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('ihlr_create_request_draft')) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('ihlr_create_request_draft')) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.warn('Error clearing IHLR draft:', e);
  }
};

