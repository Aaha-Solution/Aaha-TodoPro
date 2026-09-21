export const validateAuth = (data) => {
  if (!data.email) return { error: 'Email is required' };
  return { error: null };
};
