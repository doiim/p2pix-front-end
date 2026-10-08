import { describe, expect, it } from 'vitest';
import {
  amountInputText,
  castAddrToKey,
  castCommands,
  floorCents,
  formatBrl,
  formatBrlFixed,
  formatTokens,
  groupThousands,
  parseAmountInput,
  shortContract,
  shortWallet,
} from '@/utils/reputation';
import type { ReputationSnapshot } from '@/utils/reputation';

// Main.dc.html `parse`, `group`, `fmt` and `brl`, verbatim (spec §3), as the reference.
const mainParse = (t: string) => {
  const trimmed = String(t || '')
    .trim()
    .replace(/\s/g, '');
  if (!trimmed) return 0;
  const v =
    trimmed.indexOf(',') >= 0
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : /^\d{1,3}(\.\d{3})+$/.test(trimmed)
        ? trimmed.replace(/\./g, '')
        : trimmed;
  const n = Number(v);
  return isFinite(n) && n > 0 ? n : 0;
};
const mainGroup = (i: number) =>
  i < 10000 ? String(i) : String(i).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const mainFmt = (n: number) => {
  const cents = Math.round(n * 100);
  const i = Math.floor(cents / 100);
  const f = cents % 100;
  if (!f) return mainGroup(i);
  const fs = (f < 10 ? '0' : '') + f;
  return mainGroup(i) + ',' + (fs.charAt(1) === '0' ? fs.charAt(0) : fs);
};
const mainBrl = (n: number) => {
  const cents = Math.round(n * 100);
  const i = Math.floor(cents / 100);
  const f = cents % 100;
  return mainGroup(i) + ',' + (f < 10 ? '0' : '') + f;
};

const sampleCents = [
  ...Array.from({ length: 2500 }, (_, i) => BigInt(i)),
  ...Array.from({ length: 2000 }, (_, i) => BigInt((i * 7_919_993) % 2e11)),
  225_600n,
  225_601n,
  225_605n,
  225_650n,
  999_999n,
  1_000_000n,
  100_000_000n,
  2_209_200_000n,
];

describe('groupThousands', () => {
  it('groups with dots only from 10000 on', () => {
    expect(
      [0n, 2256n, 9999n, 10_000n, 200_000n, 1_000_000n, 22_092_000n].map(
        groupThousands,
      ),
    ).toEqual([
      '0',
      '2256',
      '9999',
      '10.000',
      '200.000',
      '1.000.000',
      '22.092.000',
    ]);
  });
});

describe('formatBrl (Main `fmt`)', () => {
  it('drops a trailing zero and whole cents', () => {
    expect(formatBrl(225_600n)).toBe('2256');
    expect(formatBrl(225_650n)).toBe('2256,5');
    expect(formatBrl(225_605n)).toBe('2256,05');
    expect(formatBrl(225_601n)).toBe('2256,01');
    expect(formatBrl(1n)).toBe('0,01');
    expect(formatBrl(0n)).toBe('0');
    expect(formatBrl(100_000_000n)).toBe('1.000.000');
    expect(formatBrl(74_400n)).toBe('744');
    expect(formatBrl(2_000_000_000n)).toBe('20.000.000');
  });

  it('agrees with Main on every sampled amount', () => {
    sampleCents.forEach((cents) =>
      expect(formatBrl(cents), String(cents)).toBe(
        mainFmt(Number(cents) / 100),
      ),
    );
  });

  it('keeps the sign apart from the digits', () => {
    expect(formatBrl(-150n)).toBe('-1,5');
  });

  it('formats whole tokens', () => {
    expect(formatTokens(2256n)).toBe('2256');
    expect(formatTokens(1_000_000n)).toBe('1.000.000');
    expect(formatTokens(22_092_000n)).toBe('22.092.000');
  });
});

describe('formatBrlFixed (Main `brl`, the "~ R$" row)', () => {
  it('always shows two decimals', () => {
    expect(formatBrlFixed(0n)).toBe('0,00');
    expect(formatBrlFixed(300_000n)).toBe('3000,00');
    expect(formatBrlFixed(150_000n)).toBe('1500,00');
    expect(formatBrlFixed(40_000n)).toBe('400,00');
    expect(formatBrlFixed(120_000_000n)).toBe('1.200.000,00');
    expect(formatBrlFixed(225_601n)).toBe('2256,01');
    expect(formatBrlFixed(5n)).toBe('0,05');
  });

  it('agrees with Main on every sampled amount', () => {
    sampleCents.forEach((cents) =>
      expect(formatBrlFixed(cents), String(cents)).toBe(
        mainBrl(Number(cents) / 100),
      ),
    );
  });
});

describe('parseAmountInput', () => {
  const cents = (text: string) => {
    const parsed = parseAmountInput(text);
    return parsed.status === 'ok' ? parsed.cents : parsed.status;
  };

  it('reads the spec §3 examples', () => {
    expect(cents('3000')).toBe(300_000n);
    expect(cents('3000,5')).toBe(300_050n);
    expect(cents('3.000,50')).toBe(300_050n);
    expect(cents('3000.5')).toBe(300_050n);
    expect(cents('2.256,01')).toBe(225_601n);
    expect(cents('1,5')).toBe(150n);
    expect(cents('1.500')).toBe(150_000n);
    expect(cents('1.000.000')).toBe(100_000_000n);
    expect(cents('2.256')).toBe(225_600n);
    expect(cents('1500.50')).toBe(150_050n);
    expect(cents('1.5')).toBe(150n);
  });

  it('treats empty, zero and garbage as empty', () => {
    [
      '',
      '   ',
      '0',
      '0,00',
      '000',
      '0.',
      '.',
      ',',
      '2,5,6',
      'abc',
      '-5',
      '1e3',
      '0x10',
      'Infinity',
      '1.2.3',
      // Past Number's range Main's parse answers 0; value would be Infinity.
      '9'.repeat(400),
      `${'9'.repeat(400)},5`,
    ].forEach((text) =>
      expect(parseAmountInput(text), JSON.stringify(text)).toEqual({
        status: 'empty',
      }),
    );
  });

  it('strips whitespace anywhere', () => {
    expect(cents(' 1 500 ')).toBe(150_000n);
    expect(cents('\t2.256,01\n')).toBe(225_601n);
  });

  it('reads "0.500" as 0,5, not 500 (spec A6)', () => {
    expect(cents('0.500')).toBe(50n);
    expect(mainParse('0.500')).toBe(500);
  });

  it('ignores trailing zeros when counting decimals', () => {
    expect(cents('2256.010')).toBe(225_601n);
    expect(cents('2256,0100')).toBe(225_601n);
    expect(cents('.5')).toBe(50n);
    expect(cents('5.')).toBe(500n);
  });

  it('flags more than two decimals and rounds the display half-up', () => {
    expect(parseAmountInput('1.2345')).toEqual({
      status: 'tooManyDecimals',
      displayCents: 123n,
    });
    expect(parseAmountInput('1,235')).toEqual({
      status: 'tooManyDecimals',
      displayCents: 124n,
    });
    expect(parseAmountInput('0.001')).toEqual({
      status: 'tooManyDecimals',
      displayCents: 0n,
    });
    expect(parseAmountInput('0,005')).toEqual({
      status: 'tooManyDecimals',
      displayCents: 1n,
    });
    expect(parseAmountInput('2256,999')).toEqual({
      status: 'tooManyDecimals',
      displayCents: 225_700n,
    });
  });

  it('returns the value, cents and wei of a valid amount', () => {
    expect(parseAmountInput('2.256,01')).toEqual({
      status: 'ok',
      cents: 225_601n,
      wei: 2_256_010_000_000_000_000_000n,
      value: 2256.01,
    });
  });

  it('agrees with Main on every input both accept', () => {
    [
      '3000',
      '3000,5',
      '3.000,50',
      '3000.5',
      '2.256,01',
      '1,5',
      '1.500',
      '1.000.000',
      '2.256',
      '1500.50',
      '1.5',
      '2256.010',
      ' 1 500 ',
      '.5',
      '5.',
      '0,01',
      '999.999,99',
      '12.345.678,9',
    ].forEach((text) => {
      const parsed = parseAmountInput(text);
      expect(parsed.status === 'ok' ? parsed.value : 0, text).toBe(
        mainParse(text),
      );
    });
  });
});

describe('amountInputText (what Máx writes into the input)', () => {
  it('writes plain digits with a comma decimal and no grouping', () => {
    expect(amountInputText(225_600n)).toBe('2256');
    expect(amountInputText(225_601n)).toBe('2256,01');
    expect(amountInputText(150_050n)).toBe('1500,5');
    expect(amountInputText(100_000_000n)).toBe('1000000');
    expect(amountInputText(5n)).toBe('0,05');
    expect(amountInputText(0n)).toBe('0');
  });

  it('round-trips through parseAmountInput', () => {
    sampleCents
      .filter((c) => c > 0n)
      .forEach((c) =>
        expect(parseAmountInput(amountInputText(c))).toMatchObject({
          status: 'ok',
          cents: c,
        }),
      );
  });
});

describe('floorCents', () => {
  it('truncates past two decimals using the shortest decimal form', () => {
    expect(floorCents(1500.29)).toBe(150_029n);
    expect(floorCents(1500.2999999)).toBe(150_029n);
    expect(floorCents(1500)).toBe(150_000n);
    expect(floorCents(0.1)).toBe(10n);
    expect(floorCents(0.005)).toBe(0n);
    expect(floorCents(123_456.789)).toBe(12_345_678n);
    expect(floorCents(0.000001)).toBe(0n);
  });

  it('handles the exponent forms of String(value)', () => {
    expect(floorCents(1e-7)).toBe(0n);
    expect(floorCents(1e21)).toBe(10n ** 23n);
    expect(floorCents(1.5e22)).toBe(15n * 10n ** 23n);
  });

  it('never throws and returns 0 for non-amounts', () => {
    [Number.NaN, -1, -0, 0, Infinity, -Infinity].forEach((value) =>
      expect(floorCents(value)).toBe(0n),
    );
  });

  it('round-trips the amount HomeView hands back after a refusal', () => {
    [2256.01, 3000, 1500.5, 999_999.99, 100.01].forEach((value) =>
      expect(amountInputText(floorCents(value))).toBe(
        String(value).replace('.', ','),
      ),
    );
  });
});

describe('short addresses', () => {
  it('shortens wallets top-bar style and contracts with an ellipsis', () => {
    expect(shortWallet('0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9f3e')).toBe(
      '0x1a2...9f3e',
    );
    expect(shortContract('0xB9dE24aB263c812A080488Edab0382701C754BBc')).toBe(
      '0xB9dE…4BBc',
    );
    expect(shortContract('0xC40356e14842e951A2A1F156d5be28cC6E4C2697')).toBe(
      '0xC403…2697',
    );
  });
});

describe('castCommands', () => {
  it('builds the four verification commands pinned to the snapshot block', () => {
    const account = '0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9f3e';
    const snapshot: ReputationSnapshot = {
      chainId: 42161,
      p2pix: '0xB9dE24aB263c812A080488Edab0382701C754BBc',
      account,
      blockNumber: 123_456_789n,
      key: castAddrToKey(account),
      reputation: '0xC40356e14842e951A2A1F156d5be28cC6E4C2697',
      creditTokens: 1000n,
      limiterValue: 2256n,
      limitTokens: 2256n,
      baseValue: 256n,
      newWalletLimitTokens: 256n,
      nextLimitTokens: 6767n,
      curve: null,
    };
    expect(castCommands(snapshot).split('\n')).toEqual([
      'cast call 0xB9dE24aB263c812A080488Edab0382701C754BBc "_castAddrToKey(address)(uint256)" 0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9f3e --rpc-url <SEU_RPC>',
      `cast call 0xB9dE24aB263c812A080488Edab0382701C754BBc "userRecord(uint256)(uint256)" ${BigInt(account) * 4096n} --block 123456789 --rpc-url <SEU_RPC>`,
      'cast call 0xB9dE24aB263c812A080488Edab0382701C754BBc "reputation()(address)" --block 123456789 --rpc-url <SEU_RPC>',
      'cast call 0xC40356e14842e951A2A1F156d5be28cC6E4C2697 "limiter(uint256)(uint256)" 1000 --block 123456789 --rpc-url <SEU_RPC>',
    ]);
  });
});
