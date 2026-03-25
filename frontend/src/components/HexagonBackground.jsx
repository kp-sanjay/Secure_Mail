import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../lib/utils';

export function HexagonBackground({
  className,
  children,
  hexagonSize = 60,
  hexagonMargin = 2,
  // Dark by default; only lights up green near cursor (see cursor overlay)
  glowColor = 'rgba(34, 197, 94, 0.75)',
  borderColor = 'rgba(63, 63, 70, 0.55)',
}) {
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const [grid, setGrid] = useState({ rows: 0, cols: 0, scale: 1 });

  const hexWidth = hexagonSize;
  const hexHeight = hexagonSize * 1.15;
  const rowSpacing = hexagonSize * 0.86;

  const updateGrid = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();
    const scale = Math.max(1, Math.min(width, height) / 800);
    const scaledSize = hexagonSize * scale;

    const cols = Math.ceil(width / scaledSize) + 2;
    const rows = Math.ceil(height / (scaledSize * 0.86)) + 2;

    setGrid({ rows, cols, scale });
  }, [hexagonSize]);

  useEffect(() => {
    updateGrid();
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(updateGrid);
    ro.observe(container);
    return () => ro.disconnect();
  }, [updateGrid]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        el.style.setProperty('--mx', `${x}%`);
        el.style.setProperty('--my', `${y}%`);
      });
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const scaledHexWidth = hexWidth * grid.scale;
  const scaledHexHeight = hexHeight * grid.scale;
  const scaledRowSpacing = rowSpacing * grid.scale;
  const scaledMargin = hexagonMargin * grid.scale;

  const hexagonStyle = useMemo(
    () => ({
      width: scaledHexWidth,
      height: scaledHexHeight,
      marginLeft: scaledMargin,
      '--glow-color': glowColor,
      '--border-color': borderColor,
      '--margin': `${scaledMargin}px`,
    }),
    [scaledHexWidth, scaledHexHeight, scaledMargin, glowColor, borderColor]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'pointer-events-none fixed inset-0 overflow-hidden bg-neutral-950',
        className
      )}
      aria-hidden="true"
    >
      {/* Hexagon grid */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: grid.rows }).map((_, rowIndex) => {
          const isOddRow = rowIndex % 2 === 1;
          const marginLeft = isOddRow
            ? -(scaledHexWidth / 2) + scaledMargin
            : scaledMargin;

          return (
            <div
              key={rowIndex}
              className="flex"
              style={{
                marginTop:
                  rowIndex === 0
                    ? -scaledHexHeight * 0.25
                    : -scaledRowSpacing * 0.16,
                marginLeft: marginLeft - scaledHexWidth * 0.1,
              }}
            >
              {Array.from({ length: grid.cols }).map((_, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={cn(
                    'relative shrink-0 transition-all duration-1000',
                    '[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]',
                    // Border layer
                    'before:absolute before:inset-0 before:bg-[var(--border-color)]',
                    'before:transition-all before:duration-1000',
                    // Inner fill
                    'after:absolute after:inset-[var(--margin)] after:bg-neutral-950',
                    'after:[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]',
                    'after:transition-all after:duration-500',
                    // Hover effects (kept, though pointer-events are disabled globally)
                    'hover:before:bg-[var(--glow-color)] hover:before:duration-0',
                    'hover:after:bg-neutral-900 hover:after:duration-0',
                    'hover:before:shadow-[0_0_20px_var(--glow-color)]'
                  )}
                  style={hexagonStyle}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Ambient glow overlay */}
      {/* Subtle neutral ambient (keeps it dark) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.04) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.03) 0%, transparent 55%)',
        }}
      />

      {/* Cursor-follow highlight (uses ops cyan; forest variant via glowColor on parent) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(180px 180px at var(--mx, 50%) var(--my, 50%), rgba(34, 211, 238, 0.18) 0%, transparent 60%)',
        }}
      />

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(10,10,10,0.8) 100%)',
        }}
      />

      {/* Content layer (optional) */}
      {children ? (
        <div className="relative z-10 h-full w-full pointer-events-auto">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default HexagonBackground;

