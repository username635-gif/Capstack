type MeshPatternOverlayProps = {
  mode: 'light' | 'dark';
};

const EDGE_PATHS = [
  'M48 94 L156 186 L112 336 L208 430 L96 548',
  'M156 186 L228 222 L208 430',
  'M112 336 L228 222 L278 356 L208 430',
  'M96 548 L176 632 L278 622',
  'M278 622 L344 702 L466 674',
  'M1278 116 L1184 194 L1212 348 L1114 454 L1238 584',
  'M1184 194 L1108 228 L1114 454',
  'M1212 348 L1108 228 L1012 378 L1114 454',
  'M1238 584 L1164 676 L1046 646',
  'M1046 646 L976 736 L848 704',
  'M566 88 L646 132 L738 104 L824 168',
  'M824 168 L918 146 L1014 198',
  'M738 104 L782 218 L918 146',
  'M646 132 L598 252 L782 218',
  'M782 218 L912 284 L1014 198',
];

const NODES = [
  [48, 94], [156, 186], [112, 336], [228, 222], [278, 356], [208, 430], [96, 548], [176, 632], [278, 622], [344, 702], [466, 674],
  [1278, 116], [1184, 194], [1212, 348], [1108, 228], [1012, 378], [1114, 454], [1238, 584], [1164, 676], [1046, 646], [976, 736], [848, 704],
  [566, 88], [646, 132], [738, 104], [824, 168], [918, 146], [1014, 198], [598, 252], [782, 218], [912, 284],
] as const;

export function MeshPatternOverlay({ mode }: MeshPatternOverlayProps) {
  const stroke = mode === 'dark' ? 'rgba(249, 248, 246, 0.20)' : 'rgba(14, 13, 12, 0.14)';
  const fill = mode === 'dark' ? 'rgba(249, 248, 246, 0.24)' : 'rgba(14, 13, 12, 0.18)';

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 900"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <g fill="none" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        {EDGE_PATHS.map((path) => (
          <path key={path} d={path} />
        ))}
      </g>
      <g fill={fill}>
        {NODES.map(([cx, cy]) => (
          <circle key={`${cx}:${cy}`} cx={cx} cy={cy} r="3.1" />
        ))}
      </g>
    </svg>
  );
}