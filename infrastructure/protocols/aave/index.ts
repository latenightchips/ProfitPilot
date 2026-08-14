import { createAaveV3Adapter } from './v3';

export type {
  AaveAdapter,
  AaveAdapterData,
  AaveAdapterError,
  AaveAdapterResult,
  AaveProtocolVersion,
  AaveSourceMetadata,
} from './types';
import type { AaveAdapter, AaveProtocolVersion } from './types';

export interface GetAaveAdapterParams {
  version: AaveProtocolVersion;
  rpcUrl: string;
}

/**
 * Version selector — the only place that chooses which protocol-version
 * adapter to construct. A future V4 adapter registers here without
 * changing any V3 code or call site.
 */
export function getAaveAdapter(params: GetAaveAdapterParams): AaveAdapter {
  switch (params.version) {
    case 'v3':
      return createAaveV3Adapter({ rpcUrl: params.rpcUrl });
    default: {
      const exhaustive: never = params.version;
      throw new Error(`Unsupported Aave protocol version: ${String(exhaustive)}`);
    }
  }
}
