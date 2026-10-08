import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LOCKAMOUNT_UPPERBOUND_TOKENS,
  REPUTATION_LOWERBOUND_TOKENS,
  WAD,
} from '@/utils/reputation';

// Whitespace collapsed so fragments survive the contracts' line wrapping.
const source = (path: string) =>
  readFileSync(
    resolve(import.meta.dirname, '../../p2pix-smart-contracts/contracts', path),
    'utf-8',
  ).replace(/\s+/g, ' ');

// Solidity number literal ("1e18", "2.5e11", "1e2 ether") → bigint.
const solidityValue = (literal: string): bigint => {
  const match = /^(\d+)(?:\.(\d+))?(?:e(\d+))?( ether)?$/.exec(literal);
  if (match === null) throw new Error(`unexpected literal ${literal}`);
  const decimals = match[2] ?? '';
  const exponent =
    BigInt(match[3] ?? '0') + (match[4] ? 18n : 0n) - BigInt(decimals.length);
  return BigInt(`${match[1]}${decimals}`) * 10n ** exponent;
};

const constantValue = (text: string, name: string): bigint => {
  const match = new RegExp(`constant ${name} = ([0-9.e]+(?: ether)?);`).exec(
    text,
  );
  if (match === null) throw new Error(`${name} not found`);
  return solidityValue(match[1]);
};

describe('mirrored contract constants', () => {
  const constants = source('core/Constants.sol');

  it('parses Solidity literals', () => {
    expect(solidityValue('1e18')).toBe(10n ** 18n);
    expect(solidityValue('2.5e11')).toBe(250_000_000_000n);
    expect(solidityValue('1e2 ether')).toBe(100n * 10n ** 18n);
  });

  it('WAD is 1e18', () => {
    expect(constantValue(constants, 'WAD')).toBe(WAD);
    expect(WAD).toBe(10n ** 18n);
  });

  it('REPUTATION_LOWERBOUND is 100 tokens', () => {
    expect(constantValue(constants, 'REPUTATION_LOWERBOUND')).toBe(
      REPUTATION_LOWERBOUND_TOKENS * WAD,
    );
  });

  it('LOCKAMOUNT_UPPERBOUND is 1,000,000 tokens', () => {
    expect(constantValue(constants, 'LOCKAMOUNT_UPPERBOUND')).toBe(
      LOCKAMOUNT_UPPERBOUND_TOKENS * WAD,
    );
  });
});

describe('lock() still enforces the mirrored rule', () => {
  const p2pix = source('p2pix.sol');

  it('skips the check at or below the lower bound', () => {
    expect(p2pix).toContain('amount > REPUTATION_LOWERBOUND &&');
  });

  it('floors the credit to whole tokens before calling the limiter', () => {
    expect(p2pix).toContain('_castAddrToKey(_msgSender())');
    expect(p2pix).toContain('(spendLimit) = _limiter(userCredit / WAD);');
  });

  it('reverts with AmountNotAllowed above the limit or the cap', () => {
    expect(p2pix).toContain(
      'if ( amount > (spendLimit * WAD) || amount > LOCKAMOUNT_UPPERBOUND ) revert AmountNotAllowed();',
    );
  });

  it('keys userRecord by the address shifted left 12 bits', () => {
    expect(source('core/BaseUtils.sol')).toContain('_key := shl(0xc, _addr)');
  });
});

describe('Reputation.sol still matches the replica', () => {
  const reputation = source('Reputation.sol');

  it('keeps the curve shape and its public constants', () => {
    expect(constantValue(reputation, 'maxLimit')).toBe(1_000_000n);
    expect(constantValue(reputation, 'magicValue')).toBe(250_000_000_000n);
    expect(reputation).toContain(
      '((maxLimit * _userCredit) / sqrt( magicValue + (_userCredit * _userCredit) ))',
    );
  });

  it('keeps the Solmate sqrt stages the port mirrors', () => {
    [
      'lt(y, 0x10000000000000000000000000000000000) ) { y := shr(128, y) z := shl(64, z) }',
      'lt(y, 0x1000000000000000000)) { y := shr(64, y) z := shl(32, z) }',
      'lt(y, 0x10000000000)) { y := shr(32, y) z := shl(16, z) }',
      'lt(y, 0x1000000)) { y := shr(16, y) z := shl(8, z) }',
      'z := 181',
      'z := shr(18, mul(z, add(y, 65536)))',
      'z := sub(z, lt(div(x, z), z))',
    ].forEach((fragment) => expect(reputation).toContain(fragment));
    expect(reputation.split('z := shr(1, add(z, div(x, z)))').length - 1).toBe(
      7,
    );
  });
});
