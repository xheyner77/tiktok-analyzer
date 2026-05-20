import type { RawTrendItem, TrendScanPayload } from '@/lib/trends/types';

export interface TrendProviderResult {
  provider: string;
  items: RawTrendItem[];
  errors: string[];
  stats?: {
    actorsUsed: string[];
    itemsRetrieved: number;
    validItems: number;
    ignoredItems: number;
    ignoredReasons: Record<string, number>;
  };
}

export interface TrendDataProvider {
  isConfigured(): boolean;
  fetchItems(payload: TrendScanPayload): Promise<TrendProviderResult>;
}
