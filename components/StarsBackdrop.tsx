/**
 * Fond étoilé global — doux (radial) + masques de fondu sur les bords.
 * Rendu derrière le contenu (layout z-index).
 */
export default function StarsBackdrop() {
  return (
    <div className="stars-backdrop" aria-hidden>
      <div className="stars-layer-sm" />
      <div className="stars-layer-md" />
      <div className="stars-layer-lg" />
      <div className="stars-backdrop-mask" />
    </div>
  );
}
