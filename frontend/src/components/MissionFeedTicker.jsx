const ITEMS = [
  'Chandrayaan-4 — Lunar payload review scheduled',
  'Gaganyaan — Crew module comms check GREEN',
  'ADITYA-L1 — Solar coronagraph downlink nominal',
  'NISAR — L-band SAR calibration window',
  'PSLV-C61 — Launch countdown simulation complete',
];

export default function MissionFeedTicker() {
  const text = ITEMS.join('   ·   ');
  return (
    <div className="border-b border-cyan-500/20 bg-[#050a14]/95 text-[11px] text-slate-400 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-1.5">
        <span className="shrink-0 font-mono text-isro-orange tracking-wide">// MISSION FEED</span>
        <div className="min-w-0 flex-1 overflow-hidden h-5">
          <div className="flex w-max animate-mission-ticker font-mono">
            <span className="pr-20">{text}</span>
            <span className="pr-20">{text}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
