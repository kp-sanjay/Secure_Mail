import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailAPI } from '../utils/api';
import { decryptRSA, importAESKey, decryptAES } from '../utils/crypto';
import { decryptEnvelope } from '../utils/envelope';

const ViewEmail = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, privateKey, mlkemSecretKeyB64, mlkem768SecretKeyB64, unlockKeys } = useAuth();
  const [email, setEmail] = useState(null);
  const [decrypted, setDecrypted] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [level3Password, setLevel3Password] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const preDecrypted = location.state?.decrypted;

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // If decrypted data is passed from navigation, use it
    if (preDecrypted) {
      setEmail(location.state.email);
      setDecrypted(preDecrypted);
      setLoading(false);
    } else {
      fetchEmail();
    }
  }, [id, user, navigate, preDecrypted]);

  const fetchEmail = async () => {
    try {
      setLoading(true);
      const response = await emailAPI.getEmail(id);
      const emailData = response.data;

      setEmail(emailData);
    } catch (err) {
      setError('Failed to load email');
      console.error('Error fetching email:', err);
    } finally {
      setLoading(false);
    }
  };

  const decryptEmailData = async (emailData, providedPassword = null) => {
    try {
      setError('');
      setNeedsPassword(false);
      if (emailData.envelope) {
        const dec = await decryptEnvelope({
          envelope: emailData.envelope,
          rsaPrivateKey: privateKey,
          mlkemSecretKeyB64,
          mlkem768SecretKeyB64,
          password: providedPassword,
        });
        setDecrypted(dec);
        return;
      }

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
      if (err.message.includes('OTP') || err.message.includes('Password Required') || err.message.includes('Incorrect password') || err.message.includes('Invalid OTP Code')) {
        setNeedsPassword(true);
      }
      setError(err?.message || 'Failed to decrypt email. It may be corrupted.');
    }
  };

  // Auto-decrypt when keys finish loading/unlocking after initial fetch.
  useEffect(() => {
    if (!email || !user) return;
    if (preDecrypted) return; // keep decrypted payload from navigation
    const receiverMatch = email?.receiver?._id && email.receiver._id === user._id;
    if (!receiverMatch) return;

    // Attempt decrypt once; if it fails due to missing keys, it'll be retried when keys change.
    // eslint-disable-next-line no-void
    void decryptEmailData(email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, user, privateKey, mlkemSecretKeyB64, mlkem768SecretKeyB64, preDecrypted]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!level3Password || !email) return;
    setIsUnlocking(true);
    await decryptEmailData(email, level3Password);
    setIsUnlocking(false);
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    setIsUnlocking(true);
    setError('');
    try {
      if (unlockKeys) await unlockKeys(unlockPassword);
    } catch (err) {
      setError(err?.message || 'Failed to unlock keys. Incorrect password?');
    } finally {
      setIsUnlocking(false);
      setUnlockPassword('');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-slate-500">Loading email...</p>
      </div>
    );
  }

  if (error) {
    const isKeyUnlock = error.includes('secret key loaded') || error.includes('private key') || error.includes('unlock');

    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center portal-card p-8 max-w-md w-full">
          <p className="text-red-500 mb-6">{error}</p>

          {needsPassword ? (
            <form onSubmit={handlePasswordSubmit} className="mb-6">
              <p className="text-sm text-slate-300 mb-4">This Level 3 transmission is protected by a pre-shared password.</p>
              <input
                type="password"
                placeholder="Enter password"
                value={level3Password}
                onChange={(e) => setLevel3Password(e.target.value)}
                className="input-glass w-full mb-3 text-center text-xl text-slate-100"
                required
              />
              <button
                type="submit"
                disabled={isUnlocking}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded w-full transition"
              >
                {isUnlocking ? 'Verifying...' : 'Verify & Decrypt'}
              </button>
            </form>
          ) : isKeyUnlock ? (
            <form onSubmit={handleUnlock} className="mb-6">
              <input
                type="password"
                placeholder="Enter password to unlock keys"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                className="input-glass w-full mb-3"
                required
              />
              <button
                type="submit"
                disabled={isUnlocking}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded w-full transition"
              >
                {isUnlocking ? 'Unlocking...' : 'Unlock Keys'}
              </button>
            </form>
          ) : null}

          <button
            onClick={() => navigate('/inbox')}
            className="text-isro-orange hover:text-isro-orange-light font-medium"
          >
            ← Back to Inbox
          </button>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-slate-500">Email not found</p>
      </div>
    );
  }

  const senderId = email.sender?._id;
  const receiverId = email.receiver?._id;
  const isReceiver = receiverId && receiverId === user._id;
  const isSender = senderId && senderId === user._id;

  const level = email.envelope?.level ?? email.securityLevel;
  const transport = email.transport || 'api';

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="portal-card p-6">
          <div className="mb-6">
            <button
              onClick={() => navigate(isReceiver ? '/inbox' : '/sent')}
              className="text-isro-orange hover:text-isro-orange-light mb-4 text-sm font-medium"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold text-gray-100">
              {decrypted ? decrypted.subject : 'Encrypted Email'}
            </h1>
          </div>

          {level != null && (
            <div className="mb-4 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-medium border ${
                  level === 1
                    ? 'border-slate-600 bg-slate-900/80 text-slate-300'
                    : level === 2
                      ? 'border-cyan-500/40 bg-cyan-950/40 text-cyan-200'
                      : level === 4
                        ? 'border-isro-orange/50 bg-isro-orange/10 text-isro-orange'
                        : 'border-slate-600 text-slate-400'
                }`}
              >
                Level {level}
                {level === 4 && ' · ML-KEM-1024'}
                {level === 2 && ' · QRNG + Kyber'}
                {level === 1 && ' · Clear channel'}
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-medium border border-slate-600 text-slate-400">
                Transport: {transport.toUpperCase()}
              </span>
              {email.missionTag ? (
                <span className="text-[10px] px-2 py-1 rounded border border-cyan-500/40 text-cyan-300">
                  {email.missionTag}
                </span>
              ) : null}
              {email.classification ? (
                <span className="text-[10px] px-2 py-1 rounded border border-isro-orange/50 text-isro-orange">
                  {String(email.classification).replace('_', ' ')}
                </span>
              ) : null}
            </div>
          )}

          <div className="space-y-4 border-b border-forest-500/20 pb-4 mb-4">
            <div>
              <span className="text-sm font-medium text-gray-400">From: </span>
              <span className="text-gray-100">
                {email.sender?.name || email.sender?.email || 'Unknown'}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-400">To: </span>
              <span className="text-gray-100">
                {email.receiver?.name || email.receiver?.email || 'Unknown'}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-400">Date: </span>
              <span className="text-gray-100">{formatDate(email.timestamp)}</span>
            </div>
          </div>

          <div className="prose max-w-none">
            {decrypted ? (
              <div className="whitespace-pre-wrap text-slate-200 leading-relaxed">{decrypted.body}</div>
            ) : isSender ? (
              <div className="text-slate-500 italic">
                You sent this email. Only the recipient can decrypt and read it.
              </div>
            ) : (
              <div className="text-slate-500 italic">
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

