'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';

/** Pages where the footer is hidden (app-style pages) */
const HIDDEN_PATHS = ['/analyzer', '/dashboard', '/hook-generator', '/login', '/signup'];

export default function FooterWrapper() {
  const pathname = usePathname();
  const hide = HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (hide) return null;
  return <Footer />;
}
