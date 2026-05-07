export const postProcessKey = (pixKey: string): string => {
  pixKey = pixKey.replace(/[-.()/]/g, '');
  return pixKey;
};
