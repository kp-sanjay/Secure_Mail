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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Sent</h1>
              <button
                onClick={() => navigate('/compose')}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
              >
                Compose
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">Loading sent emails...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-500">{error}</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No sent emails</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {emails.map((email) => (
                <div
                  key={email._id}
                  onClick={() => navigate(`/email/${email._id}`)}
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        To: {email.receiver?.name || email.receiver?.email || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        [Encrypted Email]
                      </p>
                    </div>
                    <p className="text-sm text-gray-500">{formatDate(email.timestamp)}</p>
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

