import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

export function BackgroundCircles({ className }) {
  return (
    <div
      className={cn(
        // Keep it behind app UI; don't capture clicks
        'pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden bg-[#030303]',
        className
      )}
      aria-hidden="true"
    >
      {/* Center glow - scales with viewport */}
      <div
        className="absolute rounded-full bg-cyan-500/10 blur-[120px]"
        style={{
          width: 'min(60vw, 60vh)',
          height: 'min(60vw, 60vh)',
        }}
      />

      {/* Circles container - scales with viewport */}
      <div className="relative h-full w-full">
        {/* Circle 1 - smallest with gradient arc */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          style={{
            width: 'min(20vw, 20vh)',
            height: 'min(20vw, 20vh)',
            backgroundImage:
              'conic-gradient(from 0deg, transparent 0deg, rgba(6, 182, 212, 0.5) 60deg, transparent 120deg, transparent 360deg)',
            maskImage:
              'radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))',
            WebkitMaskImage:
              'radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        />

        {/* Circle 2 with dashed effect */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          animate={{ rotate: -360 }}
          transition={{ duration: 18, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          style={{
            width: 'min(35vw, 35vh)',
            height: 'min(35vw, 35vh)',
            backgroundImage:
              'conic-gradient(from 180deg, rgba(6, 182, 212, 0.4) 0deg, transparent 40deg, transparent 90deg, rgba(6, 182, 212, 0.3) 130deg, transparent 170deg, transparent 270deg, rgba(6, 182, 212, 0.2) 310deg, transparent 350deg)',
            maskImage:
              'radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))',
            WebkitMaskImage:
              'radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        />

        {/* Circle 3 with arc */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 25, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          style={{
            width: 'min(50vw, 50vh)',
            height: 'min(50vw, 50vh)',
            backgroundImage:
              'conic-gradient(from 90deg, transparent 0deg, rgba(20, 184, 166, 0.4) 30deg, rgba(20, 184, 166, 0.6) 60deg, transparent 90deg, transparent 180deg, rgba(20, 184, 166, 0.3) 210deg, transparent 240deg, transparent 360deg)',
            maskImage:
              'radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))',
            WebkitMaskImage:
              'radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        />

        {/* Circle 4 */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          style={{
            width: 'min(65vw, 65vh)',
            height: 'min(65vw, 65vh)',
            backgroundImage:
              'conic-gradient(from 270deg, rgba(45, 212, 191, 0.3) 0deg, transparent 50deg, transparent 120deg, rgba(45, 212, 191, 0.2) 150deg, transparent 200deg, transparent 300deg, rgba(45, 212, 191, 0.25) 330deg, transparent 360deg)',
            maskImage:
              'radial-gradient(farthest-side, transparent calc(100% - 1px), black calc(100% - 1px))',
            WebkitMaskImage:
              'radial-gradient(farthest-side, transparent calc(100% - 1px), black calc(100% - 1px))',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        />

        {/* Circle 5 - largest with subtle arc */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 35, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          style={{
            width: 'min(80vw, 80vh)',
            height: 'min(80vw, 80vh)',
            backgroundImage:
              'conic-gradient(from 0deg, rgba(100, 116, 139, 0.2) 0deg, transparent 30deg, transparent 180deg, rgba(100, 116, 139, 0.15) 200deg, transparent 230deg, transparent 360deg)',
            maskImage:
              'radial-gradient(farthest-side, transparent calc(100% - 1px), black calc(100% - 1px))',
            WebkitMaskImage:
              'radial-gradient(farthest-side, transparent calc(100% - 1px), black calc(100% - 1px))',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        />
      </div>

      {/* Vignette (soft, works on both light/dark UIs) */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(circle at center, transparent 0%, transparent 40%, rgba(3,3,3,0.25) 70%, rgba(3,3,3,0.35) 100%)',
        }}
      />
    </div>
  );
}

export default BackgroundCircles;

