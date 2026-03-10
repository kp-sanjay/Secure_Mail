import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailAPI } from '../utils/api';

const Sent = () => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchSent();
  }, [user, navigate]);

  const fetchSent = async () => {
    try {
      setLoading(true);
      const response = await emailAPI.getSent();
      setEmails(response.data);
    } catch (err) {
      setError('Failed to load sent emails');
      console.error('Error fetching sent emails:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="portal-card">
          <div className="px-6 py-4 border-b border-forest-500/20">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-bold text-gray-100">Secure Sent</h1>
              <button
                onClick={() => navigate('/compose')}
                className="bg-forest-500 text-black px-4 py-2 rounded hover:bg-forest-400 transition font-semibold"
              >
                Compose
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-300">Loading sent emails...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-400">{error}</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-300">No sent emails</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {emails.map((email) => (
                <div
                  key={email._id}
                  onClick={() => navigate(`/email/${email._id}`)}
                  className="px-6 py-4 hover:bg-white/5 cursor-pointer transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-100">
                        To: {email.receiver?.name || email.receiver?.email || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-300 mt-1">
                        [Encrypted Email]
                      </p>
                    </div>
                    <p className="text-sm text-gray-400">{formatDate(email.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sent;

