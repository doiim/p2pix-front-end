// An address with its middle cut out: the first `head` characters, `gap`, then the last four.
export const shortAddress = (
  address: string,
  head: number,
  gap: '...' | '…',
): string => `${address.slice(0, head)}${gap}${address.slice(-4)}`;
