import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AnalysesEmptyPage() {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/analyses');

  return (
    <main className="min-h-screen bg-[#020611] px-6 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <section className="relative w-full overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(11,18,36,0.96),rgba(4,8,17,0.99))] p-10 text-center shadow-[0_30px_120px_-70px_rgba(124,58,237,0.95)]">
          <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(139,92,246,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,.12)_1px,transparent_1px)] [background-size:38px_38px]" />
          <div className="relative mx-auto max-w-2xl">
            <span className="inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-violet-200">
              Analyse complète
            </span>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] text-white">Aucune analyse complète pour le moment</h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-slate-300">
              Analyse ta première vidéo pour débloquer ton diagnostic, tes moments faibles et ta V2 recommandée.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link href="/dashboard/analyze" className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 px-5 py-3 text-sm font-black text-white shadow-[0_24px_70px_-36px_rgba(168,85,247,0.95)] transition hover:brightness-110">
                Analyser une vidéo
              </Link>
              <Link href="/dashboard" className="rounded-xl border border-white/[0.09] bg-white/[0.045] px-5 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.07]">
                Retour au dashboard
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
