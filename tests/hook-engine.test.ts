import { describe, expect, it } from 'vitest';
import {
  generateFallbackHookPacks,
  generatedHooksToHookPacks,
  hookPacksToGeneratedHooks,
  normalizeGeneratedHooks,
  normalizeHookPacks,
} from '@/lib/hook-engine';

const baseInput = {
  context: 'Une vidéo business qui explique trop longtemps avant de montrer la preuve',
  scene: 'opening_3s',
  tone: 'direct',
  count: 8,
  format: 'facecam' as const,
  objective: 'watchtime' as const,
  niche: 'business',
  mode: 'opening_3s',
  intensity: 7,
};

describe('hook-engine HookPacks', () => {
  it('generates complete fallback HookPacks with no empty core fields', () => {
    const packs = generateFallbackHookPacks(baseInput);

    expect(packs.length).toBe(8);
    for (const pack of packs) {
      expect(pack.spokenHook || pack.onScreenText).toBeTruthy();
      expect(pack.onScreenText).toBeTruthy();
      expect(pack.firstFrame).toBeTruthy();
      expect(pack.visualAction).toBeTruthy();
      expect(pack.cutTiming).toBeTruthy();
      expect(pack.deliveryTone).toBeTruthy();
      expect(pack.scriptOpening.length).toBeGreaterThanOrEqual(3);
      expect(pack.scores.overall).toBeGreaterThan(0);
      expect(pack.scores.scrollStop).toBeGreaterThan(0);
    }
  });

  it('does not force a spoken hook for silent openings', () => {
    const packs = generateFallbackHookPacks({
      ...baseInput,
      format: 'sans_parole',
      mode: 'text_only',
    });

    expect(packs[0].spokenHook).toBe('');
    expect(packs[0].onScreenText).toBeTruthy();
    expect(packs[0].deliveryTone).toContain('Aucun besoin de parler');
  });

  it('keeps compatibility with legacy GeneratedHook arrays', () => {
    const richHooks = normalizeGeneratedHooks(['LE PROBLÈME ARRIVE TROP TARD'], baseInput);
    const packs = generatedHooksToHookPacks(richHooks, baseInput);
    const legacyAgain = hookPacksToGeneratedHooks(packs);

    expect(packs[0].spokenHook).toBeTruthy();
    expect(packs[0].onScreenText).toBeTruthy();
    expect(legacyAgain[0].hook).toBeTruthy();
    expect(legacyAgain[0].score).toBeGreaterThan(0);
  });

  it('normalizes malformed OpenAI output with fallback fields', () => {
    const packs = normalizeHookPacks([
      {
        spokenHook: 'Il pensait bien faire.',
        onScreenText: 'Ce détail change tout',
        firstFrame: 'Montre le moment fort.',
        visualAction: 'Zoom léger.',
        scores: { overall: 84 },
      },
    ], baseInput, 'openai');

    expect(packs).toHaveLength(1);
    expect(packs[0].spokenHook).toBe('Il pensait bien faire.');
    expect(packs[0].cameraDirection).toBeTruthy();
    expect(packs[0].scores.watchtime).toBeGreaterThan(0);
    expect(packs[0].source).toBe('openai');
  });
});
