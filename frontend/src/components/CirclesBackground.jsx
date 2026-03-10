const CirclesBackground = ({ className = '' }) => {
  return (
    <div
      className={
        'pointer-events-none absolute inset-0 overflow-hidden ' + className
      }
      aria-hidden="true"
    >
      {/* Subtle gradient wash */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-gray-50 to-gray-100" />

      {/* Circle blobs */}
      <svg
        className="absolute -top-24 -left-24 opacity-30"
        width="520"
        height="520"
        viewBox="0 0 520 520"
        fill="none"
      >
        <circle cx="260" cy="260" r="220" stroke="#0f172a" strokeWidth="2" />
        <circle cx="260" cy="260" r="170" stroke="#ea580c" strokeWidth="2" />
        <circle cx="260" cy="260" r="120" stroke="#0f172a" strokeWidth="2" />
      </svg>

      <svg
        className="absolute -bottom-28 -right-28 opacity-25"
        width="640"
        height="640"
        viewBox="0 0 640 640"
        fill="none"
      >
        <circle cx="320" cy="320" r="280" stroke="#ea580c" strokeWidth="2" />
        <circle cx="320" cy="320" r="220" stroke="#0f172a" strokeWidth="2" />
        <circle cx="320" cy="320" r="160" stroke="#ea580c" strokeWidth="2" />
        <circle cx="320" cy="320" r="100" stroke="#0f172a" strokeWidth="2" />
      </svg>

      {/* Light noise grid */}
      <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:48px_48px]" />
    </div>
  );
};

export default CirclesBackground;

