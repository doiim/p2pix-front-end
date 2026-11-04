import { onScopeDispose, watch, type Ref } from 'vue';

const confirmLeave = (event: BeforeUnloadEvent) => {
  // Browsers show their own generic text; this only asks for the prompt.
  event.preventDefault();
};

/** Asks the browser to confirm closing or reloading the page while `active`. */
export const useLeaveGuard = (active: Ref<boolean>) => {
  const stop = watch(
    active,
    (on) =>
      on
        ? window.addEventListener('beforeunload', confirmLeave)
        : window.removeEventListener('beforeunload', confirmLeave),
    { immediate: true },
  );
  onScopeDispose(() => {
    stop();
    window.removeEventListener('beforeunload', confirmLeave);
  });
};
