import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailAPI } from '../utils/api';
import { decryptRSA, importAESKey, decryptAES } from '../utils/crypto';

const ViewEmail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, privateKey } = useAuth();
  const [email, setEmail] = useState(null);
  const [decrypted, setDecrypted] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // If decrypted data is passed from navigation, use it
    if (location.state?.decrypted) {
      setEmail(location.state.email);
      setDecrypted(location.state.decrypted);
      setLoading(false);
    } else {
      fetchEmail();
    }
  }, [id, user, navigate, location.state]);

  const fetchEmail = async () => {
    try {
      setLoading(true);
      const response = await emailAPI.getEmail(id);
      const emailData = response.data;

      setEmail(emailData);

      // Decrypt if user is receiver (has private key)
      if (privateKey && emailData.receiver._id === user._id) {
        await decryptEmailData(emailData);
      }
    } catch (err) {
      setError('Failed to load email');
      console.error('Error fetching email:', err);
    } finally {
      setLoading(false);
    }
  };

  const decryptEmailData = async (emailData) => {
    try {
      // Decrypt AES key using private RSA key
      const aesKeyBase64 = await decryptRSA(privateKey, emailData.encryptedAESKey);
      const aesKey = await importAESKey(aesKeyBase64);

      // Decrypt subject and body
      const subjectParts = emailData.encryptedSubject.split(':');
      const bodyParts = emailData.encryptedBody.split(':');

      const subject = await decryptAES(aesKey, subjectParts[0], subjectParts[1]);
      const body = await decryptAES(aesKey, bodyParts[0], bodyParts[1]);

      setDecrypted({ subject, body });
    } catch (err) {
      console.error('Error decrypting email:', err);
      setError('Failed to decrypt email. It may be corrupted.');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading email...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate('/inbox')}
            className="text-primary-600 hover:text-primary-700"
          >
            Back to Inbox
          </button>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Email not found</p>
      </div>
    );
  }

  const isReceiver = email.receiver._id === user._id;
  const isSender = email.sender._id === user._id;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <button
              onClick={() => navigate(isReceiver ? '/inbox' : '/sent')}
              className="text-primary-600 hover:text-primary-700 mb-4"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {decrypted ? decrypted.subject : 'Encrypted Email'}
            </h1>
          </div>

          <div className="space-y-4 border-b border-gray-200 pb-4 mb-4">
            <div>
              <span className="text-sm font-medium text-gray-500">From: </span>
              <span className="text-gray-900">{email.sender.name} ({email.sender.email})</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">To: </span>
              <span className="text-gray-900">{email.receiver.name} ({email.receiver.email})</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Date: </span>
              <span className="text-gray-900">{formatDate(email.timestamp)}</span>
            </div>
          </div>

          <div className="prose max-w-none">
            {decrypted ? (
              <div className="whitespace-pre-wrap text-gray-900">{decrypted.body}</div>
            ) : isSender ? (
              <div className="text-gray-500 italic">
                You sent this email. Only the recipient can decrypt and read it.
              </div>
            ) : (
              <div className="text-gray-500 italic">
                Unable to decrypt email. Your private key may not be loaded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewEmail;

