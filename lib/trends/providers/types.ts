import type { RawTrendItem, TrendScanPayload } from '@/lib/trends/types';

export interface TrendProviderResult {
  provider: string;
  items: RawTrendItem[];
  errors: string[];
}

export interface TrendDataProvider {
  isConfigured(): boolean;
  fetchItems(payload: TrendScanPayload): Promise<TrendProviderResult>;
}
