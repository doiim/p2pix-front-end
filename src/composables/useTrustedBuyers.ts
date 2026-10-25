import { computed, ref, watch } from 'vue';
import { zeroHash, type Address, type Hex } from 'viem';
import { isPasskeyCancelled } from '@doiim/passkeys';
import { useUser } from '@/composables/useUser';
import { readAllowlistRoot, writeAllowlistRoot } from '@/blockchain/allowlist';
import { addressError, allowlistRoot, sameAddress } from '@/utils/allowlist';
import {
  addressesOf,
  allowlistFileName,
  downloadAllowlistFile,
  parseAllowlistFile,
  readOwnAllowlist,
  toAllowlistFile,
  writeOwnAllowlist,
  type AllowlistEntry,
} from '@/utils/allowlistStorage';

/** A file the seller tried to restore whose root is not the one on-chain. */
export type FileMismatch = { fileName: string; root: Hex; count: number };

const hasAddress = (entries: readonly AllowlistEntry[], address: string) =>
  entries.some((entry) => sameAddress(entry.address, address));

/**
 * State of the "Compradores confiáveis" page: the seller's list saved in this
 * browser, the edits not yet written, and the root the contract holds.
 */
export function useTrustedBuyers() {
  const user = useUser();

  /** `null` while reading, or when the read failed. */
  const onChainRoot = ref<Hex | null>(null);
  const saved = ref<AllowlistEntry[]>([]);
  const added = ref<AllowlistEntry[]>([]);
  const removed = ref<Address[]>([]);
  /** The seller chose to replace an on-chain list this browser cannot open. */
  const startedFresh = ref(false);
  const reviewing = ref(false);
  const busy = ref(false);
  const justSaved = ref(false);
  const mismatch = ref<FileMismatch | null>(null);
  const readFailed = ref(false);
  /** Bumped per load, so a read that finishes after a switch is dropped. */
  let loadId = 0;

  const isRemoved = (address: string) =>
    removed.value.some((item) => sameAddress(item, address));
  const draft = computed(() => [
    ...saved.value.filter((entry) => !isRemoved(entry.address)),
    ...added.value,
  ]);

  const savedRoot = computed(() => allowlistRoot(addressesOf(saved.value)));
  const draftRoot = computed(() => allowlistRoot(addressesOf(draft.value)));
  const isActive = computed(
    () => onChainRoot.value !== null && onChainRoot.value !== zeroHash,
  );
  /** The browser's list is the one on-chain, so its cards are "Na rede". */
  const savedOnChain = computed(
    () => isActive.value && savedRoot.value === onChainRoot.value,
  );
  /** 2F6: a list is active but this browser does not have its addresses. */
  const isForeign = computed(
    () => isActive.value && !savedOnChain.value && !startedFresh.value,
  );
  /** Emptying an active list is a change too: it writes a zero root. */
  const hasPending = computed(
    () =>
      onChainRoot.value !== null &&
      !isForeign.value &&
      (draft.value.length > 0 || isActive.value) &&
      draftRoot.value !== onChainRoot.value,
  );
  const changeCount = computed(() => added.value.length + removed.value.length);
  const leaving = computed(() =>
    saved.value.filter((entry) => isRemoved(entry.address)),
  );

  const resetEdits = () => {
    added.value = [];
    removed.value = [];
    reviewing.value = false;
    mismatch.value = null;
  };

  const load = async () => {
    const id = ++loadId;
    const owner = user.walletAddress.value;
    onChainRoot.value = null;
    readFailed.value = false;
    startedFresh.value = false;
    justSaved.value = false;
    resetEdits();
    if (!owner) return;
    saved.value = readOwnAllowlist(user.network.value.id, owner);
    const root = await readAllowlistRoot(owner).catch((error) => {
      console.error('[allowlist] sellerAllowList read failed', error);
      return null;
    });
    if (id !== loadId) return;
    onChainRoot.value = root;
    readFailed.value = root === null;
  };

  watch([user.walletAddress, () => user.network.value.id], () => void load(), {
    immediate: true,
  });

  /** Returns the pt-BR reason the buyer was not added, if any. */
  const add = (text: string, nickname: string): string | undefined => {
    const address = text.trim();
    const error = addressError(address);
    if (error) return error;
    if (
      user.walletAddress.value &&
      sameAddress(address, user.walletAddress.value)
    ) {
      return 'Esse é o seu próprio endereço.';
    }
    const label = nickname.trim();
    const entry: AllowlistEntry = label
      ? { address: address as Address, nickname: label }
      : { address: address as Address };
    if (isRemoved(address)) {
      undo(entry.address);
      return undefined;
    }
    if (hasAddress(draft.value, address))
      return 'Este endereço já está na lista.';
    added.value = [...added.value, entry];
    justSaved.value = false;
    return undefined;
  };

  const remove = (address: Address) => {
    if (hasAddress(added.value, address)) {
      added.value = added.value.filter((e) => !sameAddress(e.address, address));
      return;
    }
    removed.value = [...removed.value, address];
    justSaved.value = false;
  };

  const undo = (address: Address) => {
    removed.value = removed.value.filter((item) => !sameAddress(item, address));
  };

  const commitRoot = async (root: Hex): Promise<boolean> => {
    busy.value = true;
    try {
      await writeAllowlistRoot(root);
      onChainRoot.value = root;
      return true;
    } catch (error) {
      console.error('[allowlist] setRoot failed', error);
      user.showToast(
        'error',
        isPasskeyCancelled(error)
          ? 'Assinatura cancelada.'
          : 'A lista não foi gravada. Tente de novo.',
      );
      return false;
    } finally {
      busy.value = false;
    }
  };

  const save = async () => {
    const owner = user.walletAddress.value;
    if (!owner) return;
    const entries = draft.value;
    if (!(await commitRoot(allowlistRoot(addressesOf(entries))))) return;
    writeOwnAllowlist(user.network.value.id, owner, entries);
    saved.value = entries;
    startedFresh.value = false;
    resetEdits();
    justSaved.value = true;
  };

  /** Root goes to zero; the addresses stay in this browser. */
  const deactivate = async (): Promise<boolean> => {
    if (!(await commitRoot(zeroHash))) return false;
    resetEdits();
    justSaved.value = false;
    user.showToast('success', 'Lista desativada');
    return true;
  };

  const startFresh = () => {
    saved.value = [];
    startedFresh.value = true;
    resetEdits();
  };

  /** Restores the file when it is the on-chain list, else loads it as edits. */
  const importFile = (text: string, fileName: string): string | undefined => {
    const owner = user.walletAddress.value;
    const file = parseAllowlistFile(text);
    if (!owner) return undefined;
    if (!file) return 'Arquivo inválido. Use o .json baixado nesta página.';
    if (!sameAddress(file.seller, owner))
      return 'Este arquivo é de outra conta.';
    if (file.chainId !== user.network.value.id) {
      return 'Este arquivo é de outra rede.';
    }
    mismatch.value = null;
    if (file.root === onChainRoot.value) {
      writeOwnAllowlist(file.chainId, owner, file.entries);
      saved.value = file.entries;
      resetEdits();
      return undefined;
    }
    if (isForeign.value) {
      mismatch.value = {
        fileName,
        root: file.root,
        count: file.entries.length,
      };
      return undefined;
    }
    removed.value = addressesOf(saved.value).filter(
      (address) => !hasAddress(file.entries, address),
    );
    added.value = file.entries.filter(
      (entry) => !hasAddress(saved.value, entry.address),
    );
    return undefined;
  };

  /** Prefers the list that is on-chain, since that is the one buyers need. */
  const download = () => {
    const owner = user.walletAddress.value;
    if (!owner) return;
    const entries = savedOnChain.value ? saved.value : draft.value;
    downloadAllowlistFile(
      toAllowlistFile(user.network.value.id, owner, entries),
      allowlistFileName(user.network.value.name, owner),
    );
  };

  return {
    onChainRoot,
    readFailed,
    reload: load,
    saved,
    added,
    removed,
    leaving,
    reviewing,
    busy,
    justSaved,
    mismatch,
    draft,
    savedRoot,
    draftRoot,
    isActive,
    savedOnChain,
    isForeign,
    hasPending,
    changeCount,
    isRemoved,
    add,
    remove,
    undo,
    save,
    deactivate,
    startFresh,
    importFile,
    download,
  };
}

export type TrustedBuyers = ReturnType<typeof useTrustedBuyers>;
