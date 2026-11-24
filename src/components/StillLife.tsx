import stillLife from '../assets/still-life.jpg';

/** Van Gogh's still life (public domain), framed on a lime offset. */
export function StillLife({ tilt }: { tilt: number }) {
  return (
    <figure className="flex flex-col" style={{ margin: 0, gap: 12, maxWidth: '100%' }}>
      <div style={{ position: 'relative', padding: '0 16px 16px 0', transform: `rotate(${tilt}deg)` }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '16px 0 0 16px',
            background: 'var(--lime)',
            border: '2px solid var(--hard)',
            borderRadius: 6,
          }}
        />
        <img
          src={stillLife}
          alt="Grapes, Lemons, Pears, and Apples by Vincent van Gogh"
          width={843}
          height={698}
          loading="lazy"
          style={{
            position: 'relative',
            display: 'block',
            width: '100%',
            height: 'auto',
            aspectRatio: '843 / 698',
            objectFit: 'cover',
            borderRadius: 6,
            border: '2px solid var(--hard)',
            boxSizing: 'border-box',
          }}
        />
      </div>
      <figcaption style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(43,36,32,.78)' }}>
        <strong style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink)' }}>
          Grapes, Lemons, Pears, and Apples
        </strong>{' '}
        · Vincent van Gogh, 1887. Oil on canvas. Art Institute of Chicago.
      </figcaption>
    </figure>
  );
}
