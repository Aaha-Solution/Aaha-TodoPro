const TOKEN_KEY = 'todo_token';
const USER_KEY = 'todo_user';

export const storage = {
  getToken: () => localStorage.getItem(TOKEN_KEY) || localStorage.getItem('4m_todo_token') || localStorage.getItem('4m_cms_token'),
  setToken: (token) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('4m_todo_token', token);
  },
  removeToken: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('4m_todo_token');
    localStorage.removeItem('4m_cms_token');
  },

  getUser: () => {
    try {
      const user = localStorage.getItem(USER_KEY) || localStorage.getItem('4m_cms_user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  removeUser: () => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('4m_cms_user');
  },

  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('4m_todo_token');
    localStorage.removeItem('4m_cms_token');
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('4m_cms_user');
  }
};
