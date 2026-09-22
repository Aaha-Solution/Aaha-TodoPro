import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  users: [],
  selectedUser: null,
  loading: false,
  error: null
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUsers: (state, action) => {
      state.users = action.payload || [];
    },
    setSelectedUser: (state, action) => {
      state.selectedUser = action.payload;
    },
    addUser: (state, action) => {
      state.users = [action.payload, ...state.users.filter((u) => u.id !== action.payload.id)];
    },
    updateUser: (state, action) => {
      const index = state.users.findIndex((u) => String(u.id) === String(action.payload.id));
      if (index !== -1) {
        state.users[index] = { ...state.users[index], ...action.payload };
      }
    },
    deleteUser: (state, action) => {
      state.users = state.users.filter((u) => String(u.id) !== String(action.payload));
    },
    toggleUserStatus: (state, action) => {
      const user = state.users.find((u) => String(u.id) === String(action.payload));
      if (user) {
        user.status = user.status === 'Active' || user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      }
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    }
  },
});

export const {
  setUsers,
  setSelectedUser,
  addUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  setLoading
} = userSlice.actions;

export default userSlice.reducer;
