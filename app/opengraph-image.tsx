import { ImageResponse } from 'next/og';

export const alt = 'Viralynz — Du diagnostic à la V2 à republier';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: '#020611',
          color: 'white',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          padding: '64px 72px',
          position: 'relative',
          width: '100%',
        }}
      >
        <div
          style={{
            background: 'radial-gradient(circle at center, rgba(124, 58, 237, 0.32), rgba(2, 6, 17, 0) 68%)',
            display: 'flex',
            height: 720,
            position: 'absolute',
            right: -120,
            top: -220,
            width: 720,
          }}
        />
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 36,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            justifyContent: 'space-between',
            padding: '48px 54px',
            position: 'relative',
            width: '100%',
          }}
        >
          <div style={{ alignItems: 'center', display: 'flex', fontSize: 34, fontWeight: 800 }}>
            <span
              style={{
                background: 'linear-gradient(135deg, #c026d3, #7c3aed 55%, #22d3ee)',
                borderRadius: 14,
                display: 'flex',
                height: 48,
                marginRight: 18,
                width: 48,
              }}
            />
            VIRALYNZ
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 930 }}>
            <div style={{ color: '#a5b4fc', display: 'flex', fontSize: 22, fontWeight: 700, marginBottom: 18 }}>
              ANALYSE → DIAGNOSTIC → VERSION CORRIGÉE
            </div>
            <div style={{ display: 'flex', fontSize: 66, fontWeight: 800, letterSpacing: -2.6, lineHeight: 1.05 }}>
              Comprends ce qui fait décrocher. Prépare la V2 à republier.
            </div>
          </div>

          <div style={{ color: '#94a3b8', display: 'flex', fontSize: 23 }}>
            Quoi couper · quoi avancer · quoi réécrire · quoi garder
          </div>
        </div>
      </div>
    ),
    size,
  );
}
