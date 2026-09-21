import { useAuth } from './useAuth';
import { hasPermission, hasAnyRole } from '../utils/permissions';

export const usePermissions = () => {
  const { user } = useAuth();

  const can = (permission) => hasPermission(user, permission);
  const isRole = (...roles) => hasAnyRole(user, roles);

  return {
    can,
    isRole,
    role: user?.role || null,
  };
};
