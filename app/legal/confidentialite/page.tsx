import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Politique de Confidentialité – Viralynz',
  description: 'Politique de confidentialité et traitement des données personnelles de Viralynz.',
};

const LAST_UPDATE = '2 avril 2026';

export default function ConfidentialitePage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-20 sm:py-28">

        <div className="mb-12 pb-8 border-b border-white/[0.08]">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[12px] text-gray-600 hover:text-gray-400 transition-colors mb-8">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M10 4l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Retour
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-vn-fuchsia mb-4">Légal</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
            Politique de<br />
            <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">confidentialité</span>
          </h1>
          <p className="text-[13px] text-gray-600">Dernière mise à jour : {LAST_UPDATE}</p>
        </div>

        <div className="prose-legal">

          <Section title="1. Responsable du traitement">
            <p>Le responsable du traitement des données personnelles collectées sur viralynz.com est <strong className="text-white">Viralynz</strong>, joignable à <a href="mailto:contact@viralynz.com" className="text-vn-fuchsia hover:underline">contact@viralynz.com</a>.</p>
          </Section>

          <Section title="2. Données collectées">
            <p>Nous collectons uniquement les données nécessaires au fonctionnement du service :</p>
            <ul>
              <li><strong className="text-white">Données de compte</strong> — adresse email, mot de passe hashé (via Supabase Auth), date d&apos;inscription</li>
              <li><strong className="text-white">Données d&apos;utilisation</strong> — nombre d&apos;analyses effectuées, historique des analyses (scores, résultats), historique des hooks générés</li>
              <li><strong className="text-white">Données de paiement</strong> — gérées exclusivement par Stripe. Viralynz ne stocke aucune donnée bancaire.</li>
              <li><strong className="text-white">Données de navigation</strong> — logs techniques (adresse IP, navigateur, pages visitées) à des fins de sécurité et d&apos;amélioration du service</li>
              <li><strong className="text-white">Contenus uploadés</strong> — vidéos soumises à analyse, traitées temporairement et non conservées au-delà de la durée de traitement</li>
            </ul>
          </Section>

          <Section title="3. Finalités du traitement">
            <p>Vos données sont utilisées pour :</p>
            <ul>
              <li>Gérer votre compte et votre authentification</li>
              <li>Fournir les analyses IA et le hook generator</li>
              <li>Gérer votre abonnement et la facturation via Stripe</li>
              <li>Améliorer la qualité du service (statistiques agrégées anonymisées)</li>
              <li>Vous envoyer des communications liées au service (mises à jour, changements de conditions)</li>
              <li>Assurer la sécurité et prévenir les abus</li>
            </ul>
          </Section>

          <Section title="4. Base légale">
            <p>Le traitement de vos données repose sur :</p>
            <ul>
              <li>L&apos;<strong className="text-white">exécution du contrat</strong> (gestion du compte, fourniture du service, facturation)</li>
              <li>Notre <strong className="text-white">intérêt légitime</strong> (sécurité, prévention des fraudes, amélioration du service)</li>
              <li>Votre <strong className="text-white">consentement</strong> (communications marketing, si applicable)</li>
            </ul>
          </Section>

          <Section title="5. Sous-traitants et transferts">
            <p>Viralynz fait appel aux sous-traitants suivants, liés par des garanties contractuelles appropriées :</p>
            <ul>
              <li><strong className="text-white">Supabase</strong> — stockage des données utilisateurs et historiques (UE / USA, Privacy Shield)</li>
              <li><strong className="text-white">Stripe</strong> — traitement des paiements (USA, Privacy Shield)</li>
              <li><strong className="text-white">OpenAI</strong> — traitement des vidéos pour l&apos;analyse IA (USA). Les vidéos sont transmises pour traitement et ne sont pas utilisées pour entraîner les modèles OpenAI (API usage policy)</li>
              <li><strong className="text-white">Vercel</strong> — hébergement de l&apos;application (USA, Privacy Shield)</li>
            </ul>
          </Section>

          <Section title="6. Durée de conservation">
            <ul>
              <li><strong className="text-white">Données de compte</strong> — conservées pendant toute la durée de votre abonnement, puis supprimées 3 ans après la dernière activité</li>
              <li><strong className="text-white">Historique des analyses</strong> — conservé selon les limites de votre plan, puis supprimé automatiquement</li>
              <li><strong className="text-white">Vidéos uploadées</strong> — supprimées immédiatement après traitement (max. 10 minutes)</li>
              <li><strong className="text-white">Données de facturation</strong> — conservées 10 ans conformément aux obligations légales comptables</li>
            </ul>
          </Section>

          <Section title="7. Vos droits (RGPD)">
            <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
            <ul>
              <li><strong className="text-white">Droit d&apos;accès</strong> — obtenir une copie de vos données personnelles</li>
              <li><strong className="text-white">Droit de rectification</strong> — corriger des données inexactes</li>
              <li><strong className="text-white">Droit à l&apos;effacement</strong> — demander la suppression de vos données</li>
              <li><strong className="text-white">Droit à la portabilité</strong> — recevoir vos données dans un format structuré</li>
              <li><strong className="text-white">Droit d&apos;opposition</strong> — vous opposer à certains traitements</li>
              <li><strong className="text-white">Droit à la limitation</strong> — restreindre le traitement de vos données</li>
            </ul>
            <p>Pour exercer ces droits, contactez-nous à <a href="mailto:contact@viralynz.com" className="text-vn-fuchsia hover:underline">contact@viralynz.com</a>. Nous nous engageons à répondre dans un délai d&apos;un mois.</p>
            <p>Vous pouvez également introduire une réclamation auprès de la <strong className="text-white">CNIL</strong> (Commission Nationale de l&apos;Informatique et des Libertés) — <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-vn-fuchsia hover:underline">www.cnil.fr</a></p>
          </Section>

          <Section title="8. Cookies">
            <p>Viralynz utilise uniquement des cookies strictement nécessaires au fonctionnement du service (session, authentification). Aucun cookie de tracking publicitaire tiers n&apos;est utilisé.</p>
          </Section>

          <Section title="9. Sécurité">
            <p>Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données : chiffrement HTTPS, hashage des mots de passe, accès restreint aux données en production.</p>
          </Section>

          <Section title="10. Modifications">
            <p>Cette politique peut être mise à jour. En cas de modification substantielle, vous serez informé par email ou par une notification sur le service.</p>
          </Section>

        </div>

        <LegalNav current="/legal/confidentialite" />
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-9">
      <h2 className="text-[17px] font-bold text-white mb-3 tracking-tight">{title}</h2>
      <div className="space-y-3 text-[14px] text-gray-500 leading-relaxed [&_strong]:text-gray-300 [&_a]:text-vn-fuchsia [&_ul]:mt-3 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul>li]:list-disc [&_ul>li]:marker:text-gray-700">
        {children}
      </div>
    </div>
  );
}

function LegalNav({ current }: { current: string }) {
  const links = [
    { label: 'CGU',             href: '/legal/cgu' },
    { label: 'CGV',             href: '/legal/cgv' },
    { label: 'Confidentialité', href: '/legal/confidentialite' },
    { label: 'Mentions légales',href: '/legal/mentions-legales' },
  ];
  return (
    <div className="mt-14 pt-8 border-t border-white/[0.07] flex flex-wrap gap-3">
      {links.map(({ label, href }) => (
        <Link
          key={href}
          href={href}
          className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors ${
            href === current
              ? 'border-vn-fuchsia/40 text-vn-fuchsia bg-vn-fuchsia/[0.06]'
              : 'border-white/[0.08] text-gray-600 hover:text-gray-300 hover:border-white/[0.14]'
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
