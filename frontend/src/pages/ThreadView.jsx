import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailAPI } from '../utils/api';
import { decryptRSA, importAESKey, decryptAESWithNonce } from '../utils/crypto';

// Separate component for thread email items
const ThreadEmailItem = ({ email, index, isLast, decryptEmail, formatDate }) => {
  const [decrypted, setDecrypted] = useState(null);
  const [decrypting, setDecrypting] = useState(false);

  const handleDecrypt = async () => {
    if (decrypted) return;
    setDecrypting(true);
    try {
      const result = await decryptEmail(email);
      setDecrypted(result);
    } catch (err) {
      alert('Failed to decrypt email');
    } finally {
      setDecrypting(false);
    }
  };

  return (
    <div className="px-6 py-4 hover:bg-white/5 transition">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-gray-100">
            {email.sender?.name || email.sender?.email || 'Unknown'}
          </p>
          <p className="text-sm text-gray-400">
            To: {email.receiver?.email || 'Unknown'}
          </p>
        </div>
        <p className="text-sm text-gray-400">{formatDate(email.timestamp)}</p>
      </div>
      
      {decrypted ? (
        <div className="mt-4">
          <p className="font-medium text-gray-100 mb-2">{decrypted.subject}</p>
          <p className="text-gray-200 whitespace-pre-wrap">{decrypted.body}</p>
        </div>
      ) : (
        <div className="mt-4">
          <button
            onClick={handleDecrypt}
            disabled={decrypting}
            className="text-forest-300 hover:text-forest-400 text-sm disabled:opacity-50"
          >
            {decrypting ? 'Decrypting...' : 'Click to decrypt'}
          </button>
          <p className="text-sm text-gray-400 mt-2">[Encrypted Email]</p>
        </div>
      )}

      {!isLast && (
        <div className="mt-4 border-l-2 border-forest-500/20 pl-4">
          <p className="text-xs text-gray-400">Reply</p>
        </div>
      )}
    </div>
  );
};

const ThreadEmailsList = ({ thread, decryptEmail, formatDate }) => {
  return (
    <div className="divide-y divide-white/10">
      {thread.map((email, index) => (
        <ThreadEmailItem
          key={email._id}
          email={email}
          index={index}
          isLast={index === thread.length - 1}
          decryptEmail={decryptEmail}
          formatDate={formatDate}
        />
      ))}
    </div>
  );
};

const ThreadView = () => {
  const { threadId } = useParams();
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, privateKey } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && privateKey && threadId) {
      fetchThread();
    }
  }, [user, privateKey, threadId]);

  const fetchThread = async () => {
    try {
      setLoading(true);
      const response = await emailAPI.getThread(threadId);
      setThread(response.data);
    } catch (err) {
      setError('Failed to load thread');
      console.error('Error fetching thread:', err);
    } finally {
      setLoading(false);
    }
  };

  const decryptEmail = async (email) => {
    try {
      // Try ECDH first, fallback to RSA
      let aesKeyBase64 = null;
      
      if (email.encryptedECDHKey) {
        // ECDH decryption (simplified - would use actual ECDH in production)
        aesKeyBase64 = email.encryptedECDHKey;
      } else if (email.encryptedAESKey) {
        aesKeyBase64 = await decryptRSA(privateKey, email.encryptedAESKey);
      } else {
        throw new Error('No encryption key found');
      }

      const aesKey = await importAESKey(aesKeyBase64);

      // Decrypt with nonce handling
      const subjectParts = email.encryptedSubject.split(':');
      const bodyParts = email.encryptedBody.split(':');

      const subject = await decryptAESWithNonce(
        aesKey,
        subjectParts[0],
        subjectParts[1]
      );
      const body = await decryptAESWithNonce(
        aesKey,
        bodyParts[0],
        bodyParts[1]
      );

      return { subject, body };
    } catch (err) {
      console.error('Error decrypting email:', err);
      throw new Error('Failed to decrypt email');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!user) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="portal-card p-8 text-center">
            <p className="text-gray-300 mb-4">Please login to view threads</p>
            <button
              onClick={() => navigate('/login')}
              className="bg-forest-500 text-black px-4 py-2 rounded hover:bg-forest-400 transition font-semibold"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <button
            onClick={() => navigate('/inbox')}
            className="text-forest-300 hover:text-forest-400 font-medium"
          >
            ← Back to Inbox
          </button>
        </div>

        <div className="portal-card">
          <div className="px-6 py-4 border-b border-forest-500/20">
            <h1 className="text-xl font-bold text-gray-100">Thread Conversation</h1>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-300">Loading thread...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-400">{error}</p>
            </div>
          ) : thread.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-300">No messages in this thread</p>
            </div>
          ) : (
            <ThreadEmailsList thread={thread} decryptEmail={decryptEmail} formatDate={formatDate} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ThreadView;

