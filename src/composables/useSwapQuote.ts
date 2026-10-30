import { ref, shallowRef } from 'vue';

/**
 * Live CoW quote state for a form: only the latest request wins, and a failed
 * quote is a visible state (`failed`), not an exception.
 */
export const useSwapQuote = <T>() => {
  const result = shallowRef<T | null>(null);
  const quoting = ref(false);
  const failed = ref(false);
  let latest = 0;

  /** `null` clears the quote (e.g. BRZ selected, or no amount yet). */
  const run = async (request: (() => Promise<T>) | null): Promise<void> => {
    const mine = ++latest;
    result.value = null;
    failed.value = false;
    quoting.value = request !== null;
    if (!request) return;
    const value = await request().catch((cause) => {
      console.error('[swap] quote failed', cause);
      return null;
    });
    // A slower, older quote must not overwrite the one for the current input.
    if (mine !== latest) return;
    quoting.value = false;
    failed.value = value === null;
    result.value = value;
  };

  return { result, quoting, failed, run };
};
