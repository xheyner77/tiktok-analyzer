'use client';

import { useEffect } from 'react';

/**
 * À placer dans une page pour que les étoiles couvrent toute la hauteur
 * de l'écran (sans masque de fondu en bas).
 * Utile pour les pages courtes : login, signup, etc.
 */
export default function StarsFullPage() {
  useEffect(() => {
    document.body.setAttribute('data-stars-full', '');
    return () => {
      document.body.removeAttribute('data-stars-full');
    };
  }, []);

  return null;
}
