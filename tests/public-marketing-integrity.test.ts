import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function filesBelow(relativeDirectory: string): string[] {
  return readdirSync(path.join(process.cwd(), relativeDirectory), { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.join(relativeDirectory, entry.name);
      return entry.isDirectory() ? filesBelow(relativePath) : [relativePath];
    })
    .filter((relativePath) => /\.(?:ts|tsx)$/.test(relativePath));
}

const publicSurfacePaths = [
  ...filesBelow('components/landing'),
  'app/pricing/page.tsx',
  'app/dashboard/billing/page.tsx',
  'app/api/trends/scan/route.ts',
  'components/GuestGate.tsx',
  'components/PremiumGate.tsx',
];

function source(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const publicMarketingSource = publicSurfacePaths.map(source).join('\n');

describe('public marketing integrity', () => {
  it('contains none of the prohibited social counters', () => {
    for (const claim of [
      'Rejoins +200 créateurs de contenu',
      '+1000 vidéos analysées',
      '+200 créateurs actifs',
      '4.9/5 note moyenne',
      '230+ utilisateurs actifs',
      '2 000+ analyses réalisées',
      'Choisi par 80% des créateurs Viralynz',
    ]) {
      expect(publicMarketingSource, claim).not.toContain(claim);
    }
  });

  it('contains none of the prohibited testimonial identities', () => {
    for (const identity of [
      'Julien B.', 'Sofia D.', 'Marc T.', 'Léa V.', 'Thomas K.', 'Amélie R.',
      'Romain S.', 'Clara M.', 'Kevin D.', 'Yasmine O.', 'Antoine P.', 'Inès L.',
    ]) {
      expect(publicMarketingSource, identity).not.toContain(identity);
    }
  });

  it('contains no obsolete public offer or legacy plan name', () => {
    for (const obsolete of [
      /9[,.]99/,
      /24[,.]99/,
      /\bElite\b/i,
      /plans?\s+(?:Pro\s+et\s+)?Scale\b/i,
      /\bname:\s*['"]Scale['"]/i,
      /50 analyses\s*\/\s*mois/i,
      /150 hooks/i,
      /200 analyses\s*\/\s*mois/i,
      /500 hooks/i,
      /8 comptes TikTok/i,
    ]) {
      expect(publicMarketingSource, obsolete.source).not.toMatch(obsolete);
    }
  });

  it('contains no undocumented performance result', () => {
    for (const result of [
      /\+40\s*%[^\n]*(?:rétention|retention)/i,
      /2 millions? de vues/i,
      /x3[^\n]*leads?/i,
      /\+30\s*%[^\n]*ROAS/i,
      /\+68\s*%[^\n]*reach/i,
      /500[ .]000 vues/i,
      /x4[^\n]*engagement/i,
      /23k/i,
      /99\+/,
      /\b\d{2,3}\/100\b/,
      /Diagnostic live/i,
      /\+18 pts/i,
      /\+32 points/i,
      /-42\s*%/,
    ]) {
      expect(publicMarketingSource, result.source).not.toMatch(result);
    }
  });

  it('replaces social proof with the honest use-case section', () => {
    const landing = source('components/landing/HomeLanding.tsx');
    expect(landing).toContain('Conçu pour améliorer');
    expect(landing).toContain('chaque nouvelle version');
    expect(landing).toContain('Les résultats dépendent toujours du contenu, de l’audience et de l’exécution.');
    for (const audience of ['Créateurs', 'Clippers', 'Agences', 'E-commerce']) {
      expect(landing).toContain(audience);
    }
    expect(landing).not.toContain('ReviewsSection');
    expect(landing).not.toContain('SocialProofBand');
  });

  it('labels the rendered diagnostic mockups as illustrative', () => {
    expect(source('components/landing/FeaturesSection.tsx'))
      .toContain('Exemple illustratif de diagnostic');
    expect(source('components/landing/HomeLanding.tsx'))
      .toContain('Exemple illustratif de diagnostic');
  });
});
