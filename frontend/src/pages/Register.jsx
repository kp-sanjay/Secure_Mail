import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CENTRES = ['SAC', 'URSC', 'VSSC', 'LPSC', 'IIRS', 'NRSC', 'ISAC', 'MCC', 'OTHER'];

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: 'SAC',
    jobRole: 'Analyst',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
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

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const result = await register(formData.name, formData.email, formData.password, {
        department: formData.department,
        jobRole: formData.jobRole,
      });
      if (result.success) {
        navigate('/inbox');
      } else {
        setError(result.message || 'Registration failed');
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
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight">New operator account</h1>
          <p className="text-xs text-cyan-500/70 uppercase tracking-widest">QDK Mail — Quantum Secure</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="border border-red-500/50 bg-red-950/30 text-red-200 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="input-glass"
              placeholder="Operator name"
            />
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="department" className="block text-sm font-medium text-slate-300 mb-1">
                Centre
              </label>
              <select
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="select-glass"
              >
                {CENTRES.map((c) => (
                  <option key={c} value={c} className="bg-[#0a1628]">
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="jobRole" className="block text-sm font-medium text-slate-300 mb-1">
                Role
              </label>
              <input
                type="text"
                id="jobRole"
                name="jobRole"
                value={formData.jobRole}
                onChange={handleChange}
                className="input-glass"
                placeholder="e.g. Analyst"
              />
            </div>
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
              minLength={6}
              className="input-glass"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1">
              Confirm password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength={6}
              className="input-glass"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-isro-orange/90 text-[#050a14] py-2.5 px-4 rounded font-semibold hover:bg-isro-orange focus:outline-none focus:ring-2 focus:ring-isro-orange/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Provisioning keys…' : 'Register'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already cleared for access?{' '}
          <Link to="/login" className="text-isro-orange hover:text-isro-orange-light font-medium">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
