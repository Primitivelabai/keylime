// Pixel marks for keylime and punnet, drawn from the design artboards.

export const SOURCE_URL = 'https://github.com/Primitivelabai/keylime';

const LIME_PALETTE: Record<string, string> = {
  b: '#7a4a22', // stem
  l: '#8fbf6a', // leaf
  L: '#A9D84A', // skin
  h: '#E2F5B6', // shine
  d: '#8DBE34', // shade
  w: '#ffffff', // eye white
  k: '#2b2420', // pupil
};

const LIME_PIXELS = [
  '.....bll..',
  '...LLLL...',
  '..LhLLLL..',
  '.LhLLLLLd.',
  '.LLwwLwwd.',
  '.LLwkLwkd.',
  '.LLLLLLLd.',
  '.LLLLLLLd.',
  '.LLLLLLdd.',
  '..LLLLdd..',
  '...dddd...',
];

export function Lime({ width = 24, className }: { width?: number; className?: string }) {
  return (
    <svg
      className={className}
      style={{ display: 'block' }}
      width={width}
      height={(width * 11) / 10}
      viewBox="0 0 10 11"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {LIME_PIXELS.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={LIME_PALETTE[c]} />
        )
      )}
    </svg>
  );
}

export function PunnetMark({ size = 28 }: { size?: number }) {
  const dark = [
    [1, 4],
    [3, 4],
    [5, 4],
    [7, 4],
    [0, 5],
    [2, 5],
    [4, 5],
    [6, 5],
    [1, 6],
    [3, 6],
    [5, 6],
  ];
  return (
    <svg
      style={{ display: 'block' }}
      viewBox="0 0 8 8"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="2" y="0" width="1" height="1" fill="#4f7a3a" />
      <rect x="1" y="1" width="2" height="2" fill="#d23b2a" />
      <g fill="#3d4a9e">
        <rect x="5" y="1" width="1" height="1" />
        <rect x="4" y="2" width="3" height="1" />
      </g>
      <rect x="0" y="3" width="8" height="1" fill="#7a4a22" />
      <rect x="0" y="4" width="8" height="2" fill="#c98f52" />
      <rect x="1" y="6" width="6" height="1" fill="#c98f52" />
      <rect x="1" y="7" width="6" height="1" fill="#7a4a22" />
      <g fill="#7a4a22">
        {dark.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
        ))}
      </g>
    </svg>
  );
}

export function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

export function CheckIcon({
  size = 15,
  color = 'currentColor',
  width = 2,
}: {
  size?: number;
  color?: string;
  width?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="square"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <path d="M4 12.5 9.5 18 20 6" />
    </svg>
  );
}

export function CrossIcon({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
