import { useAuthContext } from '../context/AuthContext';
import { useSelector } from 'react-redux';

export const useAuth = () => {
  const context = useAuthContext();
  const reduxAuth = useSelector((state) => state.auth);

  return {
    ...context,
    user: context.user || reduxAuth.user,
    token: context.token || reduxAuth.token,
    isAuthenticated: context.isAuthenticated || reduxAuth.isAuthenticated,
    loading: context.loading || reduxAuth.loading,
  };
};
