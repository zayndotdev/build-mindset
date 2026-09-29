import React from 'react';

export interface RadarDimension {
  name: string;
  slug: string;
  score: number;
  max: number;
}

interface SkillRadarChartProps {
  dimensions: RadarDimension[];
  size?: number;
}

export const SkillRadarChart: React.FC<SkillRadarChartProps> = ({
  dimensions,
  size = 320,
}) => {
  const center = size / 2;
  const radius = size * 0.36; // Leave space for labels
  const totalAxes = dimensions.length;

  // Grid levels (1 to 4)
  const levels = [1, 2, 3, 4];

  // Helper to get coordinates for a given index and value
  const getCoordinates = (index: number, value: number) => {
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const r = (value / 4.0) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Helper for label coordinates (slightly outside the chart)
  const getLabelCoordinates = (index: number) => {
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const r = radius + 28;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      angle,
    };
  };

  // Construct data polygon points string
  const dataPoints = dimensions
    .map((dim, i) => {
      const { x, y } = getCoordinates(i, Math.min(4.0, Math.max(0, dim.score)));
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="flex flex-col items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible select-none"
        role="img"
        aria-label="Engineering Competency Skill Radar Chart based on Answer Quality"
      >
        <title>Engineering Competency Radar (Quality Only)</title>
        <desc>
          Radar chart showing competency scores across {dimensions.map((d) => `${d.name}: ${d.score.toFixed(1)}`).join(', ')}
        </desc>

        <defs>
          <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.15" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Concentric grid polygons */}
        {levels.map((lvl) => {
          const gridPoints = dimensions
            .map((_, i) => {
              const { x, y } = getCoordinates(i, lvl);
              return `${x},${y}`;
            })
            .join(' ');

          return (
            <g key={`grid-level-${lvl}`}>
              <polygon
                points={gridPoints}
                fill="none"
                stroke="currentColor"
                strokeWidth={lvl === 4 ? '1.5' : '1'}
                className={lvl === 4 ? 'text-slate-700' : 'text-slate-800/80'}
                strokeDasharray={lvl < 4 ? '2 2' : undefined}
              />
              {/* Level indicator tick on top axis */}
              <text
                x={center + 5}
                y={center - (lvl / 4.0) * radius + 4}
                className="text-[9px] fill-slate-500 font-mono"
              >
                {lvl}.0
              </text>
            </g>
          );
        })}

        {/* Radial axes from center */}
        {dimensions.map((_, i) => {
          const { x, y } = getCoordinates(i, 4.0);
          return (
            <line
              key={`axis-${i}`}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="currentColor"
              className="text-slate-800"
              strokeWidth="1"
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={dataPoints}
          fill="url(#radarGradient)"
          stroke="#0ea5e9"
          strokeWidth="2.5"
          filter="url(#glow)"
        />

        {/* Data vertices */}
        {dimensions.map((dim, i) => {
          const { x, y } = getCoordinates(i, Math.min(4.0, Math.max(0, dim.score)));
          return (
            <g key={`vertex-${dim.slug}`}>
              <circle
                cx={x}
                cy={y}
                r="4.5"
                className="fill-accent-cyan stroke-background stroke-2 shadow-sm"
              />
            </g>
          );
        })}

        {/* Axis labels */}
        {dimensions.map((dim, i) => {
          const { x, y } = getLabelCoordinates(i);
          const isTop = y < center - 30;
          const isBottom = y > center + 30;
          const isLeft = x < center - 20;
          const isRight = x > center + 20;

          let textAnchor: 'middle' | 'end' | 'start' = 'middle';
          if (isLeft) textAnchor = 'end';
          else if (isRight) textAnchor = 'start';

          return (
            <g key={`label-${dim.slug}`} className="transition-all">
              <text
                x={x}
                y={isTop ? y - 8 : isBottom ? y + 10 : y}
                textAnchor={textAnchor}
                className="text-[11px] font-semibold fill-slate-200"
              >
                {dim.name}
              </text>
              <text
                x={x}
                y={isTop ? y + 4 : isBottom ? y + 22 : y + 14}
                textAnchor={textAnchor}
                className="text-[10px] font-mono font-medium fill-accent-cyan"
              >
                {dim.score.toFixed(1)} / 4.0
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
