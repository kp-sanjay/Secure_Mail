import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailAPI } from '../utils/api';
import { decryptRSA, importAESKey, decryptAES } from '../utils/crypto';

const Inbox = () => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, privateKey } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !privateKey) {
      navigate('/login');
      return;
    }
    fetchInbox();
  }, [user, privateKey, navigate]);

  const fetchInbox = async () => {
    try {
      setLoading(true);
      const response = await emailAPI.getInbox();
      setEmails(response.data);
    } catch (err) {
      setError('Failed to load inbox');
      console.error('Error fetching inbox:', err);
    } finally {
      setLoading(false);
    }
  };

  const decryptEmail = async (email) => {
    try {
      // Decrypt AES key using private RSA key
      const aesKeyBase64 = await decryptRSA(privateKey, email.encryptedAESKey);
      const aesKey = await importAESKey(aesKeyBase64);

      // Decrypt subject and body
      // Note: The encrypted data format should include IV
      // For simplicity, assuming encryptedSubject and encryptedBody contain "encrypted:iv" format
      const subjectParts = email.encryptedSubject.split(':');
      const bodyParts = email.encryptedBody.split(':');

      const subject = await decryptAES(aesKey, subjectParts[0], subjectParts[1]);
      const body = await decryptAES(aesKey, bodyParts[0], bodyParts[1]);

      return { subject, body };
    } catch (err) {
      console.error('Error decrypting email:', err);
      throw new Error('Failed to decrypt email');
    }
  };

  const handleEmailClick = async (email) => {
    try {
      const decrypted = await decryptEmail(email);
      navigate(`/email/${email._id}`, {
        state: { email, decrypted },
      });
    } catch (err) {
      alert('Failed to decrypt email. It may be corrupted.');
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
              <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
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
              <p className="text-gray-500">Loading inbox...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-500">{error}</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No emails in inbox</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {emails.map((email) => (
                <div
                  key={email._id}
                  onClick={() => handleEmailClick(email)}
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-semibold text-gray-900">
                          {email.sender?.name || email.sender?.email || 'Unknown'}
                        </p>
                        {!email.isRead && (
                          <span className="w-2 h-2 bg-primary-600 rounded-full"></span>
                        )}
                      </div>
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

export default Inbox;

