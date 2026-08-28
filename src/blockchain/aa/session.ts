import { ConstantsUtil as ReownConstantsUtil } from '@doiim/reown-appkit-common';

import type { AaOwnerKind } from './types';

/**
 * The active passkey session, owned and parsed by `@doiim/passkeys` (the
 * library validates the stored shape, so callers never touch the storage
 * key). Re-exported under the app's name to keep call sites stable.
 */
export { readStoredSession as readPasskeySession } from '@doiim/passkeys/storage';

export const PASSKEY_CONNECTOR_ID = 'doiim-passkey';
// Canonical id for the Reown "AUTH" connector, sourced from the fork itself
// (@doiim/reown-appkit-common) instead of a hardcoded literal, so a rename
// upstream surfaces as a type/build error here rather than a silent no-op.
export const REOWN_AUTH_CONNECTOR_ID = ReownConstantsUtil.CONNECTOR_ID.AUTH;

export const getAaOwnerKind = (connectorId?: string): AaOwnerKind | null => {
  if (connectorId === PASSKEY_CONNECTOR_ID) return 'passkey';
  if (connectorId === REOWN_AUTH_CONNECTOR_ID) return 'reown';
  return null;
};
