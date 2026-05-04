export const decimalCount = (numStr: string): number => {
  if (numStr.includes('.')) {
    return numStr.split('.')[1].length;
  }
  return 0;
};
