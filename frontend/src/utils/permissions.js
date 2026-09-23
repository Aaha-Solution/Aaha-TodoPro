export const hasPermission = (user, requiredPermission) => {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (!user.permissions || !Array.isArray(user.permissions)) return false;
  return user.permissions.includes(requiredPermission);
};

export const hasAnyRole = (user, allowedRoles = []) => {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return allowedRoles.includes(user.role);
};
