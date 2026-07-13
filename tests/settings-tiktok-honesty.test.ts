import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('état TikTok honnête dans les paramètres', () => {
  it('ne présente jamais un compte non connecté comme relié ou autorisé', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'components/dashboard-v2/settings/SettingsPageClient.tsx'),
      'utf8',
    );

    expect(source).toContain('description={tiktok.connected');
    expect(source).toContain('Aucun compte TikTok n’est relié');
    expect(source).toContain('Aucune permission TikTok active');
    expect(source).toContain('Aucune donnée de profil, vidéo ou performance TikTok n’est affichée dans cet état.');
    expect(source).not.toContain('description="TikTok est relié.');
  });
});
