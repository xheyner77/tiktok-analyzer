import { redirect } from 'next/navigation'

import { getSession } from '@/lib/session'
import RadarComingSoonClient from './RadarComingSoonClient'

export const dynamic = 'force-dynamic'

export default async function DashboardRadarPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login?redirect=/dashboard/radar')
  }

  return <RadarComingSoonClient />
}
