import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  users: [
    { id: 1, name: 'iyyu', email: 'iyyu@inel.co.in', role: 'SUPER_ADMIN', department: 'Quality', status: 'Active' },
    { id: 2, name: 'Ramesh Kumar', email: 'ramesh@inel.co.in', role: 'AUDITOR', department: 'Operations', status: 'Active' },
    { id: 3, name: 'Kavitha R', email: 'kavitha@inel.co.in', role: 'ENGINEER', department: 'Maintenance', status: 'Active' },
  ],
  selectedUser: null,
  loading: false,
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUsers: (state, action) => {
      state.users = action.payload;
    },
    setSelectedUser: (state, action) => {
      state.selectedUser = action.payload;
    },
    addUser: (state, action) => {
      state.users.push(action.payload);
    },
    updateUser: (state, action) => {
      const index = state.users.findIndex(u => u.id === action.payload.id);
      if (index !== -1) {
        state.users[index] = action.payload;
      }
    },
    deleteUser: (state, action) => {
      state.users = state.users.filter(u => u.id !== action.payload);
    },
  },
});

export const { setUsers, setSelectedUser, addUser, updateUser, deleteUser } = userSlice.actions;
export default userSlice.reducer;
