import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/inbox', label: 'Secure Inbox' },
  { to: '/sent', label: 'Secure Sent' },
  { to: '/compose', label: 'Compose' },
  { to: '/drafts', label: 'Drafts' },
  { to: '/messages', label: 'Personal Messages' },
  { to: '/call', label: 'Secure Calls' },
  { to: '/assistant', label: 'Quantum Assistant' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/dashboard', label: 'Security Dashboard' },
];

const Layout = ({ children }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Top portal banner */}
      <header className="bg-black/90 text-white border-b border-forest-500/50 backdrop-blur">
        <div className="flex justify-between items-center h-14 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight">QDK Mail</h1>
            <span className="hidden sm:inline text-gray-300 text-sm font-normal">
              Quantum Secure Mail Client
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-gray-200">{user?.name || user?.email}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm px-3 py-1 rounded border border-forest-500/60 hover:bg-white/5 hover:border-forest-400 transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-gray-200 hover:text-white px-3 py-1 rounded border border-forest-500/60 hover:border-forest-400 transition"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-sm bg-forest-500 text-black px-4 py-1 rounded hover:bg-forest-400 transition font-semibold"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Left sidebar - only when authenticated */}
        {isAuthenticated && (
          <aside className="w-56 bg-black/60 backdrop-blur border-r border-forest-500/20 flex-shrink-0">
            <nav className="py-4 px-2">
              {navItems.map(({ to, label }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`block px-3 py-2 mb-1 text-sm font-medium rounded transition ${
                      active
                        ? 'bg-black/70 text-white border border-forest-500/50'
                        : 'text-gray-200 hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto relative">
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
