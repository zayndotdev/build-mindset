import React from 'react';

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface MindsetLogoProps {
  size?: LogoSize | number;
  className?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  badge?: string;
  subtext?: string;
  alt?: string;
}

const SIZE_MAP: Record<LogoSize, { height: number; width: number }> = {
  xs: { height: 20, width: 24 },
  sm: { height: 28, width: 33 },
  md: { height: 36, width: 43 },
  lg: { height: 52, width: 62 },
  xl: { height: 72, width: 86 },
};

export const MindsetLogo: React.FC<MindsetLogoProps> = ({
  size = 'md',
  className = '',
  showWordmark = false,
  wordmarkClassName = '',
  badge,
  subtext,
  alt = 'Mindset Logo',
}) => {
  const dimensions = typeof size === 'number'
    ? { height: size, width: Math.round(size * (510 / 429)) }
    : SIZE_MAP[size] || SIZE_MAP.md;

  const logoImg = (
    <img
      src="/logo.png"
      alt={alt}
      width={dimensions.width}
      height={dimensions.height}
      className={`object-contain transition-transform duration-200 select-none ${className}`}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        display: 'block',
      }}
      draggable={false}
      loading="eager"
    />
  );

  if (!showWordmark) {
    return logoImg;
  }

  return (
    <div className="flex items-center space-x-3 select-none">
      <div className="shrink-0 flex items-center justify-center">
        {logoImg}
      </div>
      <div>
        <div className="flex items-center space-x-2">
          <span className={`font-extrabold tracking-tight text-text-primary ${wordmarkClassName || 'text-base'}`}>
            Mindset
          </span>
          {badge && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary-subtle text-primary-text border border-primary-border">
              {badge}
            </span>
          )}
        </div>
        {subtext && (
          <p className="text-[11px] text-text-muted font-medium hidden lg:block">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
};
