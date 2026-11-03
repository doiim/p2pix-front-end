import { describe, expect, it } from 'vitest';
import { CowApiError } from '@/utils/cowApi';
import { classifySwapFailure, swapFailureText } from '@/utils/swapFailure';

describe('classifySwapFailure', () => {
  it.each([
    ['NoLiquidity', 'noLiquidity'],
    ['InsufficientLiquidity', 'noLiquidity'],
    ['SellAmountDoesNotCoverFee', 'tooSmall'],
    ['UnsupportedToken', 'unsupported'],
    ['HTTP503', 'unavailable'],
    ['constructor', 'unavailable'],
  ])('maps %s to %s', (errorType, expected) => {
    expect(classifySwapFailure(new CowApiError(errorType, ''))).toBe(expected);
  });

  it('reads a timeout or network error as unavailable', () => {
    expect(classifySwapFailure(new DOMException('t', 'TimeoutError'))).toBe(
      'unavailable',
    );
    expect(classifySwapFailure(new TypeError('Failed to fetch'))).toBe(
      'unavailable',
    );
  });
});

describe('swapFailureText', () => {
  it('names the token, in pt-BR', () => {
    expect(swapFailureText('noLiquidity', 'USDT')).toBe(
      'Sem liquidez para trocar USDT agora.',
    );
    expect(swapFailureText('unsupported', 'USDT')).toBe(
      'USDT não pode ser trocado nesta rede.',
    );
  });
});
