import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MissionFeedTicker from './MissionFeedTicker';

const CLASS_OPTIONS = ['UNCLASSIFIED', 'RESTRICTED', 'SECRET', 'TOP_SECRET'];

const navSections = [
  {
    title: 'Communications',
    items: [
      { to: '/inbox', label: 'Secure Inbox' },
      { to: '/sent', label: 'Secure Sent' },
      { to: '/compose', label: 'Compose' },
      { to: '/drafts', label: 'Drafts' },
    ],
  },
  {
    title: 'Secure Channels',
    items: [
      { to: '/messages', label: 'Personal Messages' },
      { to: '/call', label: 'Secure Calls' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { to: '/assistant', label: 'Quantum Assistant' },
      { to: '/calendar', label: 'Calendar' },
      { to: '/dashboard', label: 'Security Dashboard' },
    ],
  },
];

const Layout = ({ children }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionClass, setSessionClass] = useState(
    () => localStorage.getItem('qdk-session-classification') || 'UNCLASSIFIED'
  );

  useEffect(() => {
    localStorage.setItem('qdk-session-classification', sessionClass);
  }, [sessionClass]);

  const initials = (user?.name || user?.email || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const dept = user?.department || 'SAC';
  const role = user?.jobRole || 'Analyst';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col relative font-mono text-slate-200">
      <header className="bg-[#050a14]/95 text-white border-b border-cyan-500/30 backdrop-blur-md z-20">
        <div className="flex flex-wrap justify-between items-center gap-3 h-auto sm:h-16 px-4 sm:px-6 py-3 sm:py-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-10 w-10 shrink-0 rounded-full border-2 border-isro-orange bg-gradient-to-br from-isro-orange/30 to-transparent flex items-center justify-center text-isro-orange text-xs font-bold shadow-[0_0_16px_rgba(243,156,18,0.35)]"
              title="ISRO"
            >
              ISRO
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                QDK MAIL
              </h1>
              <p className="text-[10px] sm:text-xs text-cyan-400/90 tracking-[0.12em] uppercase truncate">
                Quantum Secure Communications
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 flex-1 justify-center">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]" />
              Channel active
            </div>
            <div className="px-2 py-1 rounded border border-cyan-500/50 text-[10px] text-cyan-300 bg-cyan-950/40">
              CRYSTALS-Kyber ML-KEM-1024
            </div>
            <div className="px-2 py-1 rounded border border-isro-orange/60 text-[10px] text-isro-orange bg-isro-orange/10">
              ML-DSA (Dilithium-3) · planned
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            <label className="hidden sm:flex items-center gap-2 text-[10px] uppercase text-slate-500">
              Class
              <select
                value={sessionClass}
                onChange={(e) => setSessionClass(e.target.value)}
                className="input-glass !py-1 !px-2 text-[10px] max-w-[140px] border-isro-orange/40"
              >
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c} className="bg-[#0a1628]">
                    {c.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2 text-right">
                  <div className="h-9 w-9 rounded-full border border-cyan-500/40 bg-slate-900 flex items-center justify-center text-cyan-300 text-xs font-bold">
                    {initials}
                  </div>
                  <div className="hidden sm:block leading-tight max-w-[180px]">
                    <div className="text-xs text-white truncate">{user?.name || 'Operator'}</div>
                    <div className="text-[10px] text-slate-500 truncate">
                      ISRO-{dept} · {role}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-[11px] px-3 py-1.5 rounded border border-slate-600 hover:border-isro-orange/60 hover:text-isro-orange transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-[11px] text-slate-300 hover:text-white px-3 py-1.5 rounded border border-slate-600 hover:border-cyan-500/50 transition"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-[11px] bg-isro-orange/90 text-[#050a14] px-4 py-1.5 rounded font-semibold hover:bg-isro-orange transition"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
        {isAuthenticated && <MissionFeedTicker />}
      </header>

      <div className="flex flex-1 relative">
        {isAuthenticated && (
          <aside className="w-56 bg-[#050a14]/80 backdrop-blur border-r border-cyan-500/20 flex-shrink-0 z-10">
            <nav className="py-4 px-2 overflow-y-auto max-h-[calc(100vh-8rem)]">
              {navSections.map((section) => (
                <div key={section.title} className="mb-5">
                  <div className="px-2 mb-1.5 text-[10px] uppercase tracking-widest text-isro-orange/80">
                    {section.title}
                  </div>
                  {section.items.map(({ to, label }) => {
                    const active = location.pathname === to;
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={`block px-3 py-2 mb-0.5 text-[12px] rounded-l border-l-2 transition ${
                          active
                            ? 'border-cyan-400 bg-cyan-500/10 text-cyan-100 shadow-[inset_0_0_12px_rgba(34,211,238,0.08)]'
                            : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </aside>
        )}

        <main className="flex-1 overflow-auto relative">
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
