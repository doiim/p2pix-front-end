import { CowApiError } from '@/utils/cowApi';

/** Why CoW cannot give a route right now, in the terms the buyer acts on. */
export type SwapFailure =
  | 'noLiquidity'
  | 'tooSmall'
  | 'unsupported'
  | 'unavailable'
  /** The quote exists, but costs more than the BRZ the release delivers. */
  | 'priceMoved';

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
    priceMoved: `O preço de ${token} mudou e a troca não cabe no valor liberado.`,
  })[failure];

/** After the release: the swap did not happen, and what the buyer holds instead. */
export const brzOnlyText = (failure: SwapFailure, token: string): string => {
  const reason = {
    noLiquidity: `Sem liquidez para ${token}`,
    tooSmall: `Valor baixo demais para trocar ${token}`,
    unsupported: `${token} não pode ser trocado nesta rede`,
    unavailable: 'Troca indisponível no momento',
    priceMoved: `O preço de ${token} mudou`,
  }[failure];
  return `${reason}: você recebeu BRZ. Pode cotar de novo depois.`;
};
