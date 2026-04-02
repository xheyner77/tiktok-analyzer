import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Mentions Légales – Viralynz',
  description: 'Mentions légales obligatoires de la plateforme Viralynz.',
};

const LAST_UPDATE = '2 avril 2026';

export default function MentionsLegalesPage() {
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
            <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">Mentions légales</span>
          </h1>
          <p className="text-[13px] text-gray-600">Dernière mise à jour : {LAST_UPDATE}</p>
        </div>

        <div className="prose-legal">

          <Section title="Éditeur du site">
            <Row label="Nom du site" value="Viralynz" />
            <Row label="URL" value="viralynz.com" />
            <Row label="Éditeur" value="SALACROUP Tristan" />
            <Row label="Forme juridique" value="Auto-entrepreneur" />
            <Row label="Numéro SIRET" value="853 828 473 00027" />
            <Row label="Adresse" value="Rue François Ier, 75008 Paris" />
            <Row label="Email" value="contact@viralynz.com" />
            <Row label="Directeur de la publication" value="SALACROUP Tristan" />
          </Section>

          <Section title="Hébergement">
            <Row label="Hébergeur" value="Vercel Inc." />
            <Row label="Adresse" value="340 Pine Street, Suite 701, San Francisco, CA 94104, USA" />
            <Row label="Site" value="vercel.com" />
          </Section>

          <Section title="Propriété intellectuelle">
            <p>L&apos;ensemble du contenu du site viralynz.com (textes, graphismes, interface, code source, marque &laquo;&nbsp;Viralynz&nbsp;&raquo;) est la propriété exclusive de l&apos;éditeur ou de ses partenaires. Toute reproduction, distribution ou modification sans autorisation préalable écrite est strictement interdite.</p>
          </Section>

          <Section title="Données personnelles">
            <p>Le traitement des données personnelles des utilisateurs est décrit dans notre <Link href="/legal/confidentialite" className="text-vn-fuchsia hover:underline">Politique de Confidentialité</Link>.</p>
            <p>Conformément à la loi n°78-17 du 6 janvier 1978 modifiée (&laquo;&nbsp;Loi Informatique et Libertés&nbsp;&raquo;) et au Règlement Général sur la Protection des Données (RGPD), vous disposez d&apos;un droit d&apos;accès, de rectification et de suppression de vos données personnelles.</p>
            <p>Pour exercer ces droits : <a href="mailto:contact@viralynz.com" className="text-vn-fuchsia hover:underline">contact@viralynz.com</a></p>
          </Section>

          <Section title="Cookies">
            <p>Viralynz utilise uniquement des cookies techniques strictement nécessaires au bon fonctionnement du service (gestion de session, authentification). Aucun cookie publicitaire ou de traçage tiers n&apos;est déposé sans votre consentement.</p>
          </Section>

          <Section title="Limitation de responsabilité">
            <p>Viralynz s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des informations publiées sur le site, mais ne peut garantir l&apos;exhaustivité ni l&apos;absence d&apos;erreur. Les analyses générées par intelligence artificielle ont une valeur indicative et ne constituent pas un conseil professionnel.</p>
            <p>Viralynz décline toute responsabilité pour tout dommage direct ou indirect résultant de l&apos;utilisation du service ou de l&apos;impossibilité d&apos;y accéder.</p>
          </Section>

          <Section title="Liens hypertextes">
            <p>Le site peut contenir des liens vers des sites externes. Viralynz n&apos;exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.</p>
          </Section>

          <Section title="Droit applicable">
            <p>Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux français seront seuls compétents.</p>
          </Section>

        </div>

        <LegalNav current="/legal/mentions-legales" />
      </div>
    </main>
  );
}

function Row({ label, value, placeholder }: { label: string; value: string; placeholder?: boolean }) {
  return (
    <div className="flex gap-4 py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="text-[13px] text-gray-600 w-44 shrink-0">{label}</span>
      <span className={`text-[13px] ${placeholder ? 'text-amber-400/70 italic' : 'text-gray-300'}`}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-[17px] font-bold text-white mb-4 tracking-tight">{title}</h2>
      <div className="space-y-2 text-[14px] text-gray-500 leading-relaxed [&_strong]:text-gray-300 [&_a]:text-vn-fuchsia">
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
