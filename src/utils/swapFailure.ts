import { CowApiError } from '@/utils/cowApi';

/** Why CoW cannot give a route right now, in the terms the buyer acts on. */
export type SwapFailure =
  | 'noLiquidity'
  | 'tooSmall'
  | 'unsupported'
  | 'unavailable';

// CoW order-book `errorType`s. A Map, so an unlisted type never hits Object.prototype.
const BY_ERROR_TYPE = new Map<string, SwapFailure>([
  ['NoLiquidity', 'noLiquidity'],
  ['InsufficientLiquidity', 'noLiquidity'],
  ['SellAmountDoesNotCoverFee', 'tooSmall'],
  ['ZeroAmount', 'tooSmall'],
  ['UnsupportedToken', 'unsupported'],
]);

/** Timeouts, network errors, HTTP 5xx and unlisted types all read as `unavailable`. */
export const classifySwapFailure = (cause: unknown): SwapFailure =>
  (cause instanceof CowApiError && BY_ERROR_TYPE.get(cause.errorType)) ||
  'unavailable';

/** pt-BR reason for a quote that found no route; never the raw API text. */
export const swapFailureText = (failure: SwapFailure, token: string): string =>
  ({
    noLiquidity: `Sem liquidez para trocar ${token} agora.`,
    tooSmall: `Valor baixo demais para trocar ${token}.`,
    unsupported: `${token} não pode ser trocado nesta rede.`,
    unavailable: 'Troca indisponível no momento. Tente de novo em instantes.',
  })[failure];
