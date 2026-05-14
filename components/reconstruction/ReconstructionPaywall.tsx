'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { AppPlan } from '@/lib/plans';
import type { ReconstructionAccessState } from '@/lib/types';

const premiumEase = [0.22, 1, 0.36, 1] as const;

export function ReconstructionPaywall({ plan, access }: { plan?: AppPlan; access?: ReconstructionAccessState }) {
  const isCreator = plan === 'creator';
  const isQuotaExceeded = access?.status === 'quota_exceeded';
  const quota = access?.quota;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-vn-fuchsia/22 bg-[radial-gradient(circle_at_12%_0%,rgba(232,121,249,0.16),transparent_35%),radial-gradient(circle_at_88%_15%,rgba(34,211,238,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-4 shadow-[0_28px_110px_-76px_rgba(168,85,247,0.95)] sm:p-6">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-vn-fuchsia/25 bg-vn-fuchsia/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-100">
            <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_16px_rgba(232,121,249,0.9)]" />
            {isQuotaExceeded ? 'Quota mensuel' : isCreator ? 'Creator preview' : 'Preview verrouillee'}
          </div>
          <h3 className="mt-4 text-2xl font-black leading-tight text-white sm:text-3xl">
            {isQuotaExceeded ? 'Reconstruction IA en pause' : 'Reconstruction IA verrouillee'}
          </h3>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            {isQuotaExceeded
              ? 'Tu as utilise toutes tes reconstructions IA ce mois-ci. Tes analyses restent disponibles, et le quota se remettra a zero au reset mensuel.'
              : isCreator
              ? 'Creator montre le diagnostic. Pro debloque la timeline reconstruite, les hooks caches, les cuts et les CTA optimises.'
              : 'Passe en Pro pour transformer le diagnostic en structure precise a remonter, sans generation video ni montage automatique.'}
          </p>
          {quota ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ['Utilise', String(quota.used)],
                ['Restant', String(quota.remaining)],
                ['Reset', new Date(quota.resetAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/20 px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-gray-500">{label}</p>
                  <p className="mt-1 text-sm font-black text-white">{value}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link href="/pricing" className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 text-sm font-black text-white shadow-[0_18px_65px_-34px_rgba(232,121,249,0.95)] transition hover:brightness-110">
              ✨ Debloquer Reconstruction IA
            </Link>
            <Link href="/dashboard-v2" className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.045] px-5 text-sm font-black text-white transition hover:bg-white/[0.07]">
              Voir mon plan
            </Link>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black/24 p-3">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-vn-violet/[0.03] to-vn-fuchsia/[0.06]" />
          <div className="relative space-y-2 blur-[2px] opacity-55">
            {[
              ['0:00', 'Hook cache', 'locked'],
              ['0:03', 'Preuve avancee', 'Pro'],
              ['0:07', 'Cut prioritaire', 'Pro'],
              ['0:12', 'CTA locked', 'Pro'],
            ].map(([time, label, badge], index) => (
              <motion.div
                key={label}
                initial={{ opacity: 0.55, x: index % 2 ? 10 : -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.07, ease: premiumEase }}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[11px] font-black text-cyan-100">{time}</span>
                  <span className="text-sm font-black text-white">{label}</span>
                </div>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black uppercase text-gray-400">{badge}</span>
              </motion.div>
            ))}
          </div>
          <div className="absolute inset-0 grid place-items-center bg-[#080810]/40">
            <div className="rounded-2xl border border-white/[0.1] bg-black/45 px-4 py-3 text-center backdrop-blur-md">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white">Timeline verrouillee</p>
              <p className="mt-1 text-[11px] text-gray-400">Hooks, relances et CTA caches</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
