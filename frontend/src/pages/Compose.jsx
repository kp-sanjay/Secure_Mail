import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailAPI, qrngAPI, userAPI } from '../utils/api';
import {
  // kept for legacy flows if needed later
  encryptAESWithNonce,
} from '../utils/crypto';
import { encryptEnvelope } from '../utils/envelope';
import { phishingDetector } from '../utils/phishingDetector';
import { anomalyDetector } from '../utils/anomalyDetector';
import { getTrustedFingerprints, setTrustedFingerprints } from '../utils/trustStore';

const Compose = () => {
  const location = useLocation();
  const [formData, setFormData] = useState({
    receiverEmail: '',
    subject: '',
    body: '',
  });
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState('');
  const [securityWarning, setSecurityWarning] = useState(null);
  const { user, privateKey } = useAuth();
  const [securityLevel, setSecurityLevel] = useState(4);
  const [trustIssue, setTrustIssue] = useState(null);
  const navigate = useNavigate();

  // Load draft if editing
  useEffect(() => {
    if (location.state?.draft) {
      const draft = location.state.draft;
      setFormData({
        receiverEmail: draft.receiver?.email || '',
        subject: draft.encryptedSubject || '', // Note: Would need to decrypt in production
        body: draft.encryptedBody || '', // Note: Would need to decrypt in production
      });
    }
  }, [location.state]);

  // Check for phishing when content changes
  useEffect(() => {
    if (formData.receiverEmail && formData.subject && formData.body) {
      const emailData = {
        sender: { email: user?.email },
        subject: formData.subject,
        body: formData.body,
      };
      const prediction = phishingDetector.predict(emailData);
      if (prediction.isPhishing || prediction.riskScore > 40) {
        setSecurityWarning({
          level: prediction.riskLevel,
          score: prediction.riskScore,
          message: `Warning: This email may be suspicious (${prediction.riskLevel} risk: ${prediction.riskScore}%)`,
        });
      } else {
        setSecurityWarning(null);
      }
    }
  }, [formData, user]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSaveDraft = async () => {
    if (!user) {
      alert('Please login to save drafts');
      return;
    }

    setSavingDraft(true);
    try {
      // Save draft with minimal encryption (or unencrypted for drafts)
      await emailAPI.saveDraft({
        receiverEmail: formData.receiverEmail,
        encryptedSubject: formData.subject, // Simplified for drafts
        encryptedBody: formData.body,
        encryptedAESKey: '', // Not needed for drafts
        nonce: Date.now().toString(),
      });
      alert('Draft saved successfully!');
    } catch (err) {
      console.error('Error saving draft:', err);
      alert('Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !privateKey) {
      alert('Please login to send emails');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Step 1: Get receiver's public keys (RSA + ML-KEM)
      const receiverResponse = await userAPI.getPublicKeyByEmail(formData.receiverEmail);
      const receiverPublicKeyPEM = receiverResponse.data.publicKey;
      const receiverMlKemPublicKeyB64 = receiverResponse.data.mlkemPublicKey;

      // Step 1.5: TOFU key trust check (warn on key changes)
      const sha256B64 = async (text) => {
        const bytes = new TextEncoder().encode(text || '');
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const u8 = new Uint8Array(digest);
        let bin = '';
        for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
        return btoa(bin);
      };

      const newFp = {
        rsaFpB64: receiverPublicKeyPEM ? await sha256B64(receiverPublicKeyPEM) : null,
        mlkemFpB64: receiverMlKemPublicKeyB64 ? await sha256B64(receiverMlKemPublicKeyB64) : null,
      };
      const prevFp = getTrustedFingerprints(formData.receiverEmail);
      const changed =
        prevFp &&
        ((prevFp.rsaFpB64 && newFp.rsaFpB64 && prevFp.rsaFpB64 !== newFp.rsaFpB64) ||
          (prevFp.mlkemFpB64 && newFp.mlkemFpB64 && prevFp.mlkemFpB64 !== newFp.mlkemFpB64));

      if (changed) {
        setTrustIssue({
          email: formData.receiverEmail,
          prevFp,
          newFp,
        });
        setError('Recipient keys have changed since last time. Verify before sending.');
        return;
      }

      // First contact: store trust on first use
      if (!prevFp) {
        setTrustedFingerprints(formData.receiverEmail, newFp);
      }
      setTrustIssue(null);

      // Step 2: For Level 2, fetch a (simulated) quantum seed from backend
      let quantumSeedB64 = null;
      if (securityLevel === 2) {
        const seedResp = await qrngAPI.getSeed(32);
        quantumSeedB64 = seedResp.data.seedB64;
      }

      // Step 3: Encrypt into a versioned SecureEnvelope
      const envelope = await encryptEnvelope({
        level: securityLevel,
        senderEmail: user.email,
        receiverEmail: formData.receiverEmail,
        receiverPublicKeyPem: receiverPublicKeyPEM,
        receiverMlKemPublicKeyB64,
        subject: formData.subject,
        body: formData.body,
        quantumSeedB64,
      });

      // Step 4: Create search index
      // For privacy, only store plaintext index for Level 1 (unencrypted SMTP).
      // For Level 2/4 we disable plaintext indexing.
      const searchIndex =
        securityLevel === 1
          ? `${formData.subject} ${formData.body}`.toLowerCase()
          : '';

      // Step 5: Track behavioral event
      anomalyDetector.trackEvent('email_sent', {
        recipient: formData.receiverEmail,
        bodyLength: formData.body.length,
        hour: new Date().getHours(),
      });

      // Step 6: Send email to server (envelope-first; legacy fields are optional)
      await emailAPI.sendEmail({
        receiverEmail: formData.receiverEmail,
        envelope,
        securityLevel,
        transport: securityLevel === 1 ? 'smtp' : 'api',
        // Keep nonce for server-side replay-defense bookkeeping
        nonce: Date.now().toString(),
        searchIndex: searchIndex,
      });

      // Success - navigate to sent box
      navigate('/sent');
    } catch (err) {
      console.error('Error sending email:', err);
      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to send email. Make sure the receiver has set up their encryption keys.'
      );
    } finally {
      setLoading(false);
    }
  };

  const levelCards = [
    { level: 1, label: 'Level 1', desc: 'Basic SMTP', color: 'bg-gray-100 border-gray-300', activeColor: 'ring-2 ring-gray-500' },
    { level: 2, label: 'Level 2', desc: 'Quantum-Aided AES', color: 'bg-blue-50 border-blue-200', activeColor: 'ring-2 ring-blue-600' },
    { level: 4, label: 'Level 4', desc: 'Post-Quantum (PQ)', color: 'bg-orange-50 border-orange-200', activeColor: 'ring-2 ring-isro-orange' },
  ];

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="portal-card p-6">
          <div className="mb-6 flex items-center justify-between border-b border-forest-500/20 pb-4">
            <h1 className="text-xl font-bold text-gray-100">Compose Email</h1>
            <span className="text-xs text-gray-400">Security Level: {securityLevel}</span>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {securityWarning && (
            <div className={`mb-4 border px-4 py-3 rounded ${
              securityWarning.level === 'High' 
                ? 'bg-red-50 border-red-200 text-red-700'
                : securityWarning.level === 'Medium'
                ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
              <strong>Security Warning:</strong> {securityWarning.message}
            </div>
          )}

          {trustIssue && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
              <strong>Key Change Detected:</strong> The recipient’s key fingerprint changed. Only proceed if you verified the new key out-of-band.
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTrustedFingerprints(trustIssue.email, trustIssue.newFp);
                    setTrustIssue(null);
                    setError('');
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                >
                  Trust new key
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/inbox')}
                  className="px-4 py-2 border border-yellow-300 rounded-lg text-yellow-900 hover:bg-yellow-100 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Security Level</label>
              <div className="grid grid-cols-3 gap-3">
                {levelCards.map(({ level, label, desc, color, activeColor }) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSecurityLevel(level)}
                    className={`px-4 py-3 border rounded text-left transition ${color} ${
                      securityLevel === level ? activeColor : 'hover:opacity-90'
                    }`}
                  >
                    <span className="font-semibold text-gray-900">{label}</span>
                    <span className="block text-xs text-gray-600 mt-0.5">{desc}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">Level 3 (One-Time Pad) requires QKD setup — coming soon.</p>
            </div>

            <div>
              <label htmlFor="receiverEmail" className="block text-sm font-medium text-gray-700 mb-2">
                To
              </label>
              <input
                type="email"
                id="receiverEmail"
                name="receiverEmail"
                value={formData.receiverEmail}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange focus:border-isro-orange"
                placeholder="recipient@email.com"
              />
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange focus:border-isro-orange"
                placeholder="Email subject"
              />
            </div>

            <div>
              <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                id="body"
                name="body"
                value={formData.body}
                onChange={handleChange}
                required
                rows={12}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange focus:border-isro-orange"
                placeholder="Write your encrypted message here..."
              />
            </div>

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingDraft || !user}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingDraft ? 'Saving...' : 'Save Draft'}
              </button>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => navigate('/inbox')}
                  className="px-6 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !user}
                  className="px-6 py-2 bg-forest-500 text-black rounded hover:bg-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
                >
                  {loading ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Compose;

