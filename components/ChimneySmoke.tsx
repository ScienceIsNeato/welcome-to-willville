type Puff = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  driftX: number;
  rise: number;
  delay: string;
  duration: string;
};

type Plume = {
  id: string;
  puffs: Puff[];
};

const PLUMES: Plume[] = [
  {
    id: "foundry-stack-west",
    puffs: [
      {
        x: 1030,
        y: 76,
        rx: 11,
        ry: 7,
        driftX: -16,
        rise: 64,
        delay: "0s",
        duration: "5.8s",
      },
      {
        x: 1038,
        y: 60,
        rx: 14,
        ry: 9,
        driftX: -24,
        rise: 82,
        delay: "1.5s",
        duration: "6.4s",
      },
      {
        x: 1048,
        y: 44,
        rx: 18,
        ry: 11,
        driftX: -34,
        rise: 96,
        delay: "3.1s",
        duration: "7s",
      },
    ],
  },
  {
    id: "foundry-stack-east",
    puffs: [
      {
        x: 1138,
        y: 104,
        rx: 9,
        ry: 6,
        driftX: -12,
        rise: 52,
        delay: "0.8s",
        duration: "5.4s",
      },
      {
        x: 1145,
        y: 88,
        rx: 12,
        ry: 8,
        driftX: -22,
        rise: 76,
        delay: "2.3s",
        duration: "6.2s",
      },
      {
        x: 1152,
        y: 72,
        rx: 15,
        ry: 10,
        driftX: -30,
        rise: 92,
        delay: "3.8s",
        duration: "6.8s",
      },
    ],
  },
  {
    id: "hearth-chimney",
    puffs: [
      {
        x: 230,
        y: 704,
        rx: 8,
        ry: 5,
        driftX: 10,
        rise: 42,
        delay: "0.4s",
        duration: "6s",
      },
      {
        x: 236,
        y: 690,
        rx: 11,
        ry: 7,
        driftX: 18,
        rise: 62,
        delay: "2s",
        duration: "6.8s",
      },
      {
        x: 244,
        y: 674,
        rx: 14,
        ry: 9,
        driftX: 26,
        rise: 78,
        delay: "3.6s",
        duration: "7.4s",
      },
    ],
  },
];

export function ChimneySmoke() {
  return (
    <g className="chimney-smoke" aria-hidden>
      {PLUMES.map((plume) => (
        <g key={plume.id} style={{ filter: "blur(3.8px)" }}>
          {plume.puffs.map((puff, index) => (
            <ellipse
              key={`${plume.id}-${index}`}
              cx={puff.x}
              cy={puff.y}
              rx={puff.rx}
              ry={puff.ry}
              fill="#c8c2bb"
              className="smoke-puff-anim"
              style={
                {
                  animationDuration: puff.duration,
                  animationDelay: puff.delay,
                  transformOrigin: `${puff.x}px ${puff.y}px`,
                  "--drift-x": `${puff.driftX}px`,
                  "--rise-y": `${-puff.rise}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </g>
      ))}
    </g>
  );
}
