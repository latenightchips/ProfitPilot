import { describe, expect, it } from 'vitest';

import { findSensitiveField } from '@/services/shared/sensitiveFields';

/**
 * Sensitive Data Exclusion Rules — 06_TASKS.md M8-051. `findSensitiveField`
 * is the structural scanner every persisted/imported payload passes
 * through (`services/persistence/validate.ts`) before it can be stored
 * or later exported.
 */
describe('findSensitiveField', () => {
  it('returns null for primitives and empty structures', () => {
    expect(findSensitiveField('a string')).toBeNull();
    expect(findSensitiveField(42)).toBeNull();
    expect(findSensitiveField(null)).toBeNull();
    expect(findSensitiveField(undefined)).toBeNull();
    expect(findSensitiveField({})).toBeNull();
    expect(findSensitiveField([])).toBeNull();
  });

  it('returns null for a realistic, clean portfolio-shaped payload', () => {
    expect(
      findSensitiveField({
        id: 'p1',
        name: 'My Portfolio',
        collateral: { asset: 'BTC', quantity: 2 },
        debt: { asset: 'USDC', balance: 20000 },
        settings: { safetyTargets: { targetHealthFactor: 1.5 } },
      }),
    ).toBeNull();
  });

  it.each([
    ['privateKey'],
    ['private_key'],
    ['PRIVATE-KEY'],
    ['seedPhrase'],
    ['mnemonic'],
    ['mnemonicPhrase'],
    ['recoveryPhrase'],
    ['walletSecret'],
    ['signingKey'],
    ['signingSecret'],
    ['exchangeApiKey'],
    ['exchangeSecret'],
    ['exchangeCredentials'],
    ['serviceRoleKey'],
    ['service_role'],
    ['providerSecret'],
    ['apiSecret'],
    ['apiKey'],
    ['accessToken'],
    ['refreshToken'],
    ['authToken'],
    ['authorizationToken'],
    ['sessionToken'],
    ['password'],
  ])('detects a top-level "%s" field', (fieldName) => {
    expect(findSensitiveField({ [fieldName]: 'secret-value' })).toBe(fieldName);
  });

  it('finds a sensitive field nested inside a loose, unspecified nested object', () => {
    const payload = {
      id: 's1',
      name: 'Strategy',
      result: {
        steps: [{ stepNumber: 1 }],
        wallet: { privateKey: '0xabc123' },
      },
    };
    expect(findSensitiveField(payload)).toBe('result.wallet.privateKey');
  });

  it('finds a sensitive field inside an array element', () => {
    const payload = { records: [{ ok: true }, { accessToken: 'abc' }] };
    expect(findSensitiveField(payload)).toBe('records[1].accessToken');
  });

  it('is case- and separator-insensitive', () => {
    expect(findSensitiveField({ Service_Role_Key: 'x' })).toBe('Service_Role_Key');
  });

  it('does not false-positive on similarly-worded but distinct field names', () => {
    expect(
      findSensitiveField({
        tokenCount: 3,
        keyMetrics: { healthFactor: 1.5 },
        passwordless: true,
      }),
    ).toBeNull();
  });
});
