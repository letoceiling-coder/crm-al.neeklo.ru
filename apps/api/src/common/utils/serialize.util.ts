/** JSON.stringify cannot serialize BigInt — convert for API responses */
export function serializeBigInts<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, val) =>
      typeof val === 'bigint' ? val.toString() : val,
    ),
  ) as T;
}

/** Не отдавать hash/encrypted в списках и карточках ключа */
export function stripApiKeySecrets<T extends Record<string, unknown>>(row: T): Omit<T, 'keyHash' | 'keyEncrypted'> {
  const { keyHash: _h, keyEncrypted: _e, ...rest } = row;
  return rest as Omit<T, 'keyHash' | 'keyEncrypted'>;
}
