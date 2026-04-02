import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation – Viralynz",
  description: "Conditions générales d'utilisation de la plateforme Viralynz.",
};

const LAST_UPDATE = '2 avril 2026';

export default function CGUPage() {
  return (
    <main className="min-h-screen bg-vn-void">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-20 sm:py-28">

        {/* Header */}
        <div className="mb-12 pb-8 border-b border-white/[0.08]">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[12px] text-gray-600 hover:text-gray-400 transition-colors mb-8">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M10 4l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Retour
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-vn-fuchsia mb-4">Légal</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
            Conditions générales<br />
            <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">d&apos;utilisation</span>
          </h1>
          <p className="text-[13px] text-gray-600">Dernière mise à jour : {LAST_UPDATE}</p>
        </div>

        {/* Content */}
        <div className="prose-legal">

          <Section title="1. Présentation du service">
            <p>Viralynz est une plateforme SaaS d&apos;analyse de contenus vidéo courts (TikTok, Reels, Shorts) par intelligence artificielle. Elle est éditée et exploitée par <strong className="text-white">Viralynz</strong> (ci-après &laquo;&nbsp;nous&nbsp;&raquo; ou &laquo;&nbsp;le Service&nbsp;&raquo;).</p>
            <p>En accédant au site <strong className="text-white">viralynz.com</strong> ou en utilisant l&apos;une de ses fonctionnalités, vous acceptez sans réserve les présentes Conditions Générales d&apos;Utilisation (&laquo;&nbsp;CGU&nbsp;&raquo;).</p>
          </Section>

          <Section title="2. Accès au service">
            <p>L&apos;accès au service est réservé aux personnes majeures (18 ans ou plus) ou aux mineurs disposant de l&apos;autorisation de leur représentant légal.</p>
            <p>Lors de la création de votre compte, vous vous engagez à fournir des informations exactes et complètes. Vous êtes seul responsable de la confidentialité de vos identifiants de connexion.</p>
            <p>Viralynz se réserve le droit de suspendre ou supprimer tout compte ne respectant pas les présentes CGU.</p>
          </Section>

          <Section title="3. Utilisation acceptable">
            <p>Vous vous engagez à utiliser Viralynz uniquement pour des finalités légales et conformément aux présentes CGU. Il est notamment interdit de :</p>
            <ul>
              <li>Analyser des contenus violant les droits de tiers (droit d&apos;auteur, droits à l&apos;image, etc.)</li>
              <li>Tenter de contourner les quotas ou les mécanismes de sécurité du service</li>
              <li>Utiliser le service à des fins commerciales de revente sans autorisation préalable écrite</li>
              <li>Automatiser les requêtes par scraping, bots ou tout autre moyen non autorisé</li>
              <li>Uploader des contenus illicites, haineux, pornographiques ou incitant à la violence</li>
            </ul>
          </Section>

          <Section title="4. Propriété intellectuelle">
            <p>L&apos;ensemble des éléments du service (code, design, textes, marque &laquo;&nbsp;Viralynz&nbsp;&raquo;, interface graphique) sont protégés par le droit de la propriété intellectuelle. Toute reproduction, modification ou exploitation sans autorisation écrite est interdite.</p>
            <p>Les analyses générées par l&apos;IA vous sont fournies à titre personnel. Elles ne constituent pas une œuvre originale protégeable par le droit d&apos;auteur et ne peuvent être revendues en l&apos;état.</p>
          </Section>

          <Section title="5. Données et vidéos uploadées">
            <p>Les vidéos que vous soumettez à l&apos;analyse sont traitées de manière confidentielle. Elles sont utilisées uniquement pour générer votre analyse et ne sont pas conservées au-delà de la durée nécessaire au traitement (généralement moins de 5 minutes).</p>
            <p>Vous garantissez détenir tous les droits nécessaires sur les contenus que vous soumettez. Viralynz décline toute responsabilité en cas de violation de droits de tiers par vos contenus.</p>
          </Section>

          <Section title="6. Quotas et abonnements">
            <p>Le service est disponible selon différents plans tarifaires (Starter, Pro, Elite) détaillés sur la <Link href="/pricing" className="text-vn-fuchsia hover:underline">page Tarifs</Link>. Les quotas (analyses, hooks) sont réinitialisés chaque mois calendaire.</p>
            <p>Les quotas non utilisés ne sont pas reportés au mois suivant. Le plan Starter offre un accès gratuit limité à 3 analyses à vie.</p>
          </Section>

          <Section title="7. Disponibilité et responsabilité">
            <p>Viralynz s&apos;efforce d&apos;assurer la disponibilité du service 24h/24, 7j/7. Cependant, des interruptions pour maintenance ou force majeure peuvent survenir sans préavis.</p>
            <p>Les analyses fournies sont générées par intelligence artificielle et ont une valeur indicative. Elles ne constituent pas un conseil professionnel. Viralynz ne peut être tenu responsable des décisions prises sur la base des résultats d&apos;analyse.</p>
            <p>En aucun cas la responsabilité de Viralynz ne pourra excéder le montant des sommes effectivement payées par l&apos;utilisateur au cours des 3 derniers mois.</p>
          </Section>

          <Section title="8. Modification des CGU">
            <p>Viralynz se réserve le droit de modifier les présentes CGU à tout moment. Les modifications entrent en vigueur dès leur publication sur le site. La poursuite de l&apos;utilisation du service après modification vaut acceptation des nouvelles CGU.</p>
          </Section>

          <Section title="9. Droit applicable et juridiction">
            <p>Les présentes CGU sont soumises au droit français. En cas de litige, les parties s&apos;efforceront de trouver une solution amiable. À défaut, les tribunaux français seront seuls compétents.</p>
          </Section>

          <Section title="10. Contact">
            <p>Pour toute question relative aux présentes CGU, vous pouvez nous contacter à l&apos;adresse : <a href="mailto:contact@viralynz.com" className="text-vn-fuchsia hover:underline">contact@viralynz.com</a></p>
          </Section>

        </div>

        {/* Nav légale */}
        <LegalNav current="/legal/cgu" />
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
