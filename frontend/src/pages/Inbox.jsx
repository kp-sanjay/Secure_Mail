import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailAPI } from '../utils/api';
import { decryptRSA, importAESKey, decryptAES, decryptAESWithNonce } from '../utils/crypto';
import { decryptEnvelope } from '../utils/envelope';

const Inbox = () => {
  const [emails, setEmails] = useState([]);
  const [filteredEmails, setFilteredEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'thread'
  const { user, privateKey, mlkemSecretKeyB64 } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only fetch inbox if user is authenticated
    if (user && privateKey) {
      fetchInbox();
    }
  }, [user, privateKey]);

  // Filter emails based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEmails(emails);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = emails.filter((email) => {
      // Search in sender name/email
      const senderMatch = 
        email.sender?.name?.toLowerCase().includes(query) ||
        email.sender?.email?.toLowerCase().includes(query);
      
      // Search in encrypted subject (simplified - would decrypt in production)
      const subjectMatch = email.encryptedSubject?.toLowerCase().includes(query);
      
      // Search in category
      const categoryMatch = email.category?.toLowerCase().includes(query);

      return senderMatch || subjectMatch || categoryMatch;
    });

    setFilteredEmails(filtered);
  }, [searchQuery, emails]);

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
      if (email.envelope) {
        return await decryptEnvelope({
          envelope: email.envelope,
          rsaPrivateKey: privateKey,
          mlkemSecretKeyB64,
        });
      }

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

  // Group emails by thread
  const groupByThread = (emailList) => {
    const threadMap = new Map();
    const unthreaded = [];

    emailList.forEach((email) => {
      if (email.threadId) {
        if (!threadMap.has(email.threadId)) {
          threadMap.set(email.threadId, []);
        }
        threadMap.get(email.threadId).push(email);
      } else {
        unthreaded.push(email);
      }
    });

    // Sort threads by most recent email
    const threads = Array.from(threadMap.values())
      .map((thread) => ({
        ...thread[0], // Use first email as representative
        threadCount: thread.length,
        isThread: true,
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return [...threads, ...unthreaded];
  };

  const handleThreadClick = async (email) => {
    if (email.isThread && email.threadId) {
      // Navigate to thread view
      navigate(`/thread/${email.threadId}`);
    } else {
      handleEmailClick(email);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="portal-card">
          <div className="px-6 py-4 border-b border-forest-500/20">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-xl font-bold text-gray-100">Secure Inbox</h1>
              <button
                onClick={() => navigate('/compose')}
                className="bg-forest-500 text-black px-4 py-2 rounded hover:bg-forest-400 transition font-semibold"
              >
                Compose
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange focus:border-isro-orange"
              />
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange"
              >
                <option value="list">List View</option>
                <option value="thread">Thread View</option>
              </select>
            </div>
          </div>

          {!user ? (
            <div className="p-8 text-center">
              <p className="text-gray-300 mb-4">Please login to view your inbox</p>
              <button
                onClick={() => navigate('/login')}
                className="bg-forest-500 text-black px-4 py-2 rounded hover:bg-forest-400 transition font-semibold"
              >
                Login
              </button>
            </div>
          ) : loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-300">Loading inbox...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-400">{error}</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-300">No emails in inbox</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {(viewMode === 'thread' ? groupByThread(filteredEmails) : filteredEmails).map((email) => (
                <div
                  key={email._id}
                  onClick={() => handleThreadClick(email)}
                  className="px-6 py-4 hover:bg-white/5 cursor-pointer transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-semibold text-gray-100">
                          {email.sender?.name || email.sender?.email || 'Unknown'}
                        </p>
                        {!email.isRead && (
                          <span className="w-2 h-2 bg-forest-400 rounded-full"></span>
                        )}
                        {email.isThread && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Thread ({email.threadCount} messages)
                          </span>
                        )}
                        {email.category && email.category !== 'unknown' && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            email.category === 'phishing' ? 'bg-red-100 text-red-800' :
                            email.category === 'spam' ? 'bg-yellow-100 text-yellow-800' :
                            email.category === 'priority' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {email.category}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
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

export default Inbox;

