import { formatUnits } from 'viem';

/** `1.234,5678` — pt-BR grouping, 2..4 fraction digits, exact for any bigint. */
export const formatTokenAmount = (
  value: bigint,
  decimals: number,
  maxFractionDigits = 4,
): string => {
  const [whole = '0', fraction = ''] = formatUnits(value, decimals).split('.');
  const digits = fraction.slice(0, maxFractionDigits).replace(/0+$/, '');
  return `${BigInt(whole).toLocaleString('pt-BR')},${digits.padEnd(2, '0')}`;
};
