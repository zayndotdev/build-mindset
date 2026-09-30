import React from 'react';

export interface RadarDimension {
  name: string;
  slug: string;
  score: number;
  max: number;
}

interface SkillRadarChartProps {
  dimensions: RadarDimension[];
  showBreakdown?: boolean;
}

export const SkillRadarChart: React.FC<SkillRadarChartProps> = ({
  dimensions,
  showBreakdown = true,
}) => {
  // Use a generous coordinate system so labels never clip on any screen size
  const svgWidth = 520;
  const svgHeight = 380;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const radius = 125; // Leaves ~135px on left/right for long text like "Synthesis & Communication"
  const totalAxes = dimensions.length;

  // Grid levels (1.0, 2.0, 3.0, 4.0)
  const levels = [1, 2, 3, 4];

  // Helper to get coordinates for a given axis index and value
  const getCoordinates = (index: number, value: number) => {
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const r = (value / 4.0) * radius;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  // Helper for label coordinates (positioned outside the outer ring with safe margins)
  const getLabelCoordinates = (index: number) => {
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const r = radius + 32;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
      angle,
    };
  };

  // Data polygon points
  const dataPoints = dimensions
    .map((dim, i) => {
      const { x, y } = getCoordinates(i, Math.min(4.0, Math.max(0, dim.score)));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const getSeniorityTier = (score: number) => {
    if (score >= 3.5) return { label: 'Staff / L6+', color: 'text-primary font-bold' };
    if (score >= 3.0) return { label: 'Senior / L5', color: 'text-success-text font-bold' };
    if (score >= 2.0) return { label: 'Mid-Level / L4', color: 'text-warning-text font-medium' };
    return { label: 'Foundational', color: 'text-text-muted font-medium' };
  };

  return (
    <div className="w-full space-y-6">
      {/* SVG Chart Container */}
      <div className="w-full flex justify-center overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full max-w-[480px] h-auto select-none"
          role="img"
          aria-label="Engineering Competency Skill Radar Chart"
        >
          <defs>
            <linearGradient id="skillRadarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.40" />
              <stop offset="100%" stopColor="var(--color-primary-hover)" stopOpacity="0.10" />
            </linearGradient>
            <filter id="radarShadow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="var(--color-primary)" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Concentric grid rings */}
          {levels.map((lvl) => {
            const gridPoints = dimensions
              .map((_, i) => {
                const { x, y } = getCoordinates(i, lvl);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(' ');

            return (
              <g key={`grid-level-${lvl}`}>
                <polygon
                  points={gridPoints}
                  fill={lvl % 2 === 0 ? 'rgba(249, 115, 22, 0.02)' : 'none'}
                  stroke="currentColor"
                  strokeWidth={lvl === 4 ? '1.5' : '1'}
                  className={lvl === 4 ? 'text-surface-border-strong' : 'text-surface-border'}
                  strokeDasharray={lvl < 4 ? '3 3' : undefined}
                />
                {/* Level indicator tick on top axis */}
                <text
                  x={centerX + 6}
                  y={centerY - (lvl / 4.0) * radius + 4}
                  className="text-[10px] fill-text-muted font-mono font-medium"
                >
                  {lvl}.0
                </text>
              </g>
            );
          })}

          {/* Radial axes from center to 4.0 ring */}
          {dimensions.map((_, i) => {
            const { x, y } = getCoordinates(i, 4.0);
            return (
              <line
                key={`axis-${i}`}
                x1={centerX}
                y1={centerY}
                x2={x}
                y2={y}
                stroke="currentColor"
                className="text-surface-border"
                strokeWidth="1"
              />
            );
          })}

          {/* Data filled polygon */}
          <polygon
            points={dataPoints}
            fill="url(#skillRadarGrad)"
            stroke="var(--color-primary)"
            strokeWidth="2.5"
            filter="url(#radarShadow)"
          />

          {/* Data vertices with inner points */}
          {dimensions.map((dim, i) => {
            const { x, y } = getCoordinates(i, Math.min(4.0, Math.max(0, dim.score)));
            return (
              <g key={`vertex-${dim.slug}`}>
                <circle
                  cx={x}
                  cy={y}
                  r="6"
                  fill="var(--color-primary)"
                  fillOpacity="0.25"
                />
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="var(--color-primary)"
                  stroke="var(--color-surface)"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {/* Axis Labels (Positioned with safe bounding margins) */}
          {dimensions.map((dim, i) => {
            const { x, y } = getLabelCoordinates(i);
            const isTop = y < centerY - 30;
            const isBottom = y > centerY + 30;
            const isLeft = x < centerX - 25;
            const isRight = x > centerX + 25;

            let textAnchor: 'middle' | 'end' | 'start' = 'middle';
            if (isLeft) textAnchor = 'end';
            else if (isRight) textAnchor = 'start';

            return (
              <g key={`label-${dim.slug}`}>
                <text
                  x={x}
                  y={isTop ? y - 10 : isBottom ? y + 8 : y - 2}
                  textAnchor={textAnchor}
                  className="text-[12px] font-bold fill-text-primary"
                >
                  {dim.name}
                </text>
                <text
                  x={x}
                  y={isTop ? y + 6 : isBottom ? y + 24 : y + 14}
                  textAnchor={textAnchor}
                  className="text-[11px] font-mono font-bold fill-primary"
                >
                  {dim.score.toFixed(1)} / 4.0
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Competency Breakdown Cards */}
      {showBreakdown && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {dimensions.map((dim) => {
            const percentage = Math.round((dim.score / 4.0) * 100);
            const tier = getSeniorityTier(dim.score);

            return (
              <div
                key={dim.slug}
                className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border flex flex-col justify-between space-y-2 hover:border-primary-border/60 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary">{dim.name}</span>
                  <span className="text-xs font-mono font-black text-primary">{dim.score.toFixed(1)} / 4.0</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-surface border border-surface-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-text-muted">
                  <span>Rating: <span className={tier.color}>{tier.label}</span></span>
                  <span>{percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
