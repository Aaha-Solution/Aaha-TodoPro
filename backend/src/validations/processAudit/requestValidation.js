export const validateRequest = (data) => {
  if (!data.quantity || !data.line) return { error: 'Quantity and Line are required' };
  return { error: null };
};
