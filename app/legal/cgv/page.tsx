import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente – Viralynz',
  description: 'Conditions générales de vente des abonnements Viralynz.',
};

const LAST_UPDATE = '2 avril 2026';

export default function CGVPage() {
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
            Conditions générales<br />
            <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">de vente</span>
          </h1>
          <p className="text-[13px] text-gray-600">Dernière mise à jour : {LAST_UPDATE}</p>
        </div>

        <div className="prose-legal">

          <Section title="1. Objet">
            <p>Les présentes Conditions Générales de Vente (&laquo;&nbsp;CGV&nbsp;&raquo;) régissent la vente des abonnements payants proposés par Viralynz sur viralynz.com.</p>
            <p>Toute commande d&apos;un abonnement implique l&apos;acceptation sans réserve des présentes CGV ainsi que des <Link href="/legal/cgu" className="text-vn-fuchsia hover:underline">Conditions Générales d&apos;Utilisation</Link>.</p>
          </Section>

          <Section title="2. Plans et tarifs">
            <p>Viralynz propose les abonnements suivants (prix TTC) :</p>
            <ul>
              <li><strong className="text-white">Starter</strong> — Gratuit, 3 analyses à vie, sans engagement</li>
              <li><strong className="text-white">Pro</strong> — 19 €/mois, 50 analyses/mois, 150 hooks/mois</li>
              <li><strong className="text-white">Elite</strong> — 49 €/mois, 200 analyses/mois, 500 hooks/mois</li>
            </ul>
            <p>Tous les prix sont indiqués en euros TTC. Viralynz se réserve le droit de modifier ses tarifs avec un préavis de 30 jours. Les modifications tarifaires ne s&apos;appliquent pas aux abonnements en cours pendant leur période de facturation.</p>
          </Section>

          <Section title="3. Commande et paiement">
            <p>La commande est passée directement sur le site viralynz.com. Le paiement est traité de manière sécurisée via <strong className="text-white">Stripe</strong>, conformément à ses propres conditions d&apos;utilisation.</p>
            <p>Viralynz n&apos;a pas accès à vos données bancaires. Le débit est effectué immédiatement lors de la souscription, puis automatiquement chaque mois à la date anniversaire.</p>
            <p>Moyens de paiement acceptés : carte bancaire (Visa, Mastercard, American Express).</p>
          </Section>

          <Section title="4. Durée et renouvellement">
            <p>Les abonnements Pro et Elite sont des abonnements mensuels à reconduction tacite. Ils se renouvellent automatiquement chaque mois sauf résiliation avant la date de renouvellement.</p>
            <p>Les quotas (analyses, hooks) sont réinitialisés à chaque date de renouvellement. Les quotas non utilisés ne sont pas reportés.</p>
          </Section>

          <Section title="5. Résiliation">
            <p>Vous pouvez résilier votre abonnement à tout moment depuis votre espace client ou en contactant notre support. La résiliation prend effet à la fin de la période de facturation en cours.</p>
            <p>Aucun remboursement n&apos;est effectué pour la période en cours après résiliation, sauf dans le cadre du droit de rétractation décrit ci-dessous.</p>
          </Section>

          <Section title="6. Droit de rétractation">
            <p>Conformément à l&apos;article L221-28 du Code de la consommation, le droit de rétractation de 14 jours ne s&apos;applique pas aux contenus numériques dont l&apos;exécution a commencé avec l&apos;accord du consommateur.</p>
            <p>Cependant, Viralynz offre une <strong className="text-white">garantie satisfaction de 7 jours</strong> pour tout premier abonnement payant. Si vous n&apos;êtes pas satisfait, contactez-nous sous 7 jours à compter de votre premier paiement pour un remboursement complet, sans justification.</p>
          </Section>

          <Section title="7. Facturation">
            <p>Une facture électronique est émise pour chaque paiement et disponible dans votre espace client. En souscrivant à un abonnement professionnel, vous pouvez renseigner votre numéro de TVA intracommunautaire pour bénéficier de la procédure d&apos;autoliquidation.</p>
          </Section>

          <Section title="8. Litiges et médiation">
            <p>En cas de litige lié à un achat sur Viralynz, vous pouvez contacter notre service client à <a href="mailto:contact@viralynz.com" className="text-vn-fuchsia hover:underline">contact@viralynz.com</a>. À défaut de résolution amiable, vous pouvez recourir à la médiation de la consommation conformément aux règles du Code de la consommation.</p>
            <p>Conformément au règlement (UE) n°524/2013, vous pouvez également utiliser la plateforme de règlement en ligne des litiges accessible à l&apos;adresse : <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-vn-fuchsia hover:underline">ec.europa.eu/consumers/odr</a></p>
          </Section>

          <Section title="9. Droit applicable">
            <p>Les présentes CGV sont soumises au droit français. En cas de litige, les juridictions françaises sont seules compétentes.</p>
          </Section>

        </div>

        <LegalNav current="/legal/cgv" />
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
