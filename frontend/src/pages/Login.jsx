import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(formData.email, formData.password);
      if (result.success) {
        navigate('/inbox');
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full portal-card p-8">
        <div className="text-center mb-8 border-b border-cyan-500/20 pb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-isro-orange text-isro-orange text-[10px] font-bold mb-3">
            ISRO
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">QDK Mail</h1>
          <p className="text-xs text-cyan-500/70 uppercase tracking-widest">Secure access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="border border-red-500/50 bg-red-950/30 text-red-200 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="input-glass"
              placeholder="operator@domain.gov"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="input-glass"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-isro-orange/90 text-[#050a14] py-2.5 px-4 rounded font-semibold hover:bg-isro-orange focus:outline-none focus:ring-2 focus:ring-isro-orange/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Authenticating…' : 'Login'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Need clearance?{' '}
          <Link to="/register" className="text-isro-orange hover:text-isro-orange-light font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
