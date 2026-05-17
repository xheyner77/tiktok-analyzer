import type { PlatformContentRecommendation } from './multi-platform-intelligence';

export interface PlatformStrategy {
  platform: string;
  crossPlatformStrategy: string;
  hookAdaptation: string;
  repostAdaptation: string;
}

export function platformStrategyEngine(platforms: PlatformContentRecommendation[]): PlatformStrategy[] {
  return platforms.map((platform) => ({
    platform: platform.platform,
    crossPlatformStrategy: `${platform.hookRule} ${platform.pacingRule}`,
    hookAdaptation: platform.hookRule,
    repostAdaptation: `${platform.structureRule} ${platform.ctaRule}`,
  }));
}
