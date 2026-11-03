import { ref, shallowRef } from 'vue';
import { classifySwapFailure, type SwapFailure } from '@/utils/swapFailure';

/**
 * Live CoW quote state for a form: only the latest request wins, and a failed
 * quote is a visible state (`reason`), not an exception.
 */
export const useSwapQuote = <T>() => {
  const result = shallowRef<T | null>(null);
  const quoting = ref(false);
  const reason = ref<SwapFailure | null>(null);
  let latest = 0;

  /** `null` clears the quote (e.g. BRZ selected, or no amount yet). */
  const run = async (request: (() => Promise<T>) | null): Promise<void> => {
    const mine = ++latest;
    result.value = null;
    reason.value = null;
    quoting.value = request !== null;
    if (!request) return;
    let value: T | null = null;
    let failure: SwapFailure | null = null;
    try {
      value = await request();
    } catch (cause) {
      console.error('[swap] quote failed', cause);
      failure = classifySwapFailure(cause);
    }
    // A slower, older quote must not overwrite the one for the current input.
    if (mine !== latest) return;
    quoting.value = false;
    reason.value = failure;
    result.value = value;
  };

  return { result, quoting, reason, run };
};
