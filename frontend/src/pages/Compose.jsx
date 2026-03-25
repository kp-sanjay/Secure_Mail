import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailAPI, qrngAPI, userAPI } from '../utils/api';
import { encryptEnvelope } from '../utils/envelope';
import { phishingDetector } from '../utils/phishingDetector';
import { anomalyDetector } from '../utils/anomalyDetector';
import { getTrustedFingerprints, setTrustedFingerprints } from '../utils/trustStore';

const MISSION_TAGS = ['', 'Chandrayaan-4', 'Gaganyaan', 'ADITYA-L1', 'NISAR', 'PSLV-C61', 'EOS-06'];

const Compose = () => {
  const location = useLocation();

  const [formData, setFormData] = useState({
    receiverEmail: '',
    subject: '',
    body: '',
    classification: 'UNCLASSIFIED',
    missionTag: '',
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
        subject: draft.encryptedSubject || '',
        body: draft.encryptedBody || '',
        classification: draft.classification || 'UNCLASSIFIED',
        missionTag: draft.missionTag || '',
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
        nonce: Date.now().toString(),
        searchIndex,
        classification: formData.classification,
        missionTag: formData.missionTag || undefined,
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
    {
      level: 1,
      label: 'Level 1',
      desc: 'SMTP relay · no payload crypto',
      color: 'bg-slate-900/80 border-slate-600 text-slate-200',
      activeColor: 'ring-2 ring-slate-400 border-cyan-500/40',
    },
    {
      level: 2,
      label: 'Level 2',
      desc: 'QRNG salt + CRYSTALS-Kyber ML-KEM-1024 + AES-GCM',
      color: 'bg-slate-900/80 border-cyan-500/30 text-slate-200',
      activeColor: 'ring-2 ring-cyan-400',
    },
    {
      level: 4,
      label: 'Level 4',
      desc: 'ML-KEM-1024 encaps + AES-GCM (PQ channel)',
      color: 'bg-slate-900/80 border-isro-orange/40 text-slate-200',
      activeColor: 'ring-2 ring-isro-orange',
    },
  ];

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="portal-card p-6">
          <div className="mb-6 flex items-center justify-between border-b border-cyan-500/20 pb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">Compose transmission</h1>
              <p className="text-[11px] text-cyan-500/70 mt-1 uppercase tracking-widest">
                Kyber ML-KEM-1024 · AES-256-GCM
              </p>
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">Level {securityLevel}</span>
          </div>

          {error && (
            <div className="mb-4 border border-red-500/50 bg-red-950/40 text-red-200 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {securityWarning && (
            <div
              className={`mb-4 border px-4 py-3 rounded text-sm ${
                securityWarning.level === 'High'
                  ? 'border-red-500/50 bg-red-950/30 text-red-200'
                  : securityWarning.level === 'Medium'
                    ? 'border-isro-orange/50 bg-isro-orange/10 text-isro-orange-light'
                    : 'border-cyan-500/40 bg-cyan-950/30 text-cyan-200'
              }`}
            >
              <strong>Security Warning:</strong> {securityWarning.message}
            </div>
          )}

          {trustIssue && (
            <div className="mb-4 border border-isro-orange/50 bg-[#0a1628] text-slate-200 px-4 py-3 rounded text-sm">
              <strong className="text-isro-orange">Key Change Detected:</strong> Recipient key fingerprints
              differ from TOFU store. Verify out-of-band before trusting.
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTrustedFingerprints(trustIssue.email, trustIssue.newFp);
                    setTrustIssue(null);
                    setError('');
                  }}
                  className="px-4 py-2 bg-isro-orange/90 text-[#050a14] rounded font-semibold hover:bg-isro-orange transition"
                >
                  Trust new key
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/inbox')}
                  className="px-4 py-2 border border-slate-600 rounded hover:border-cyan-500/50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Security level</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {levelCards.map(({ level, label, desc, color, activeColor }) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSecurityLevel(level)}
                    className={`px-4 py-3 border rounded text-left transition ${color} ${
                      securityLevel === level ? activeColor : 'hover:border-cyan-500/30'
                    }`}
                  >
                    <span className="font-semibold text-slate-100">{label}</span>
                    <span className="block text-[11px] text-slate-400 mt-1 leading-snug">{desc}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Level 3 (OTP) requires QKD / pad logistics — not enabled. Transport signing upgrade: ML-DSA
                (DILITHIUM-3) on roadmap.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="classification" className="block text-sm font-medium text-slate-300 mb-2">
                  Classification
                </label>
                <select
                  id="classification"
                  name="classification"
                  value={formData.classification}
                  onChange={handleChange}
                  className="select-glass"
                >
                  {['UNCLASSIFIED', 'RESTRICTED', 'SECRET', 'TOP_SECRET'].map((c) => (
                    <option key={c} value={c} className="bg-[#0a1628]">
                      {c.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="missionTag" className="block text-sm font-medium text-slate-300 mb-2">
                  Mission tag
                </label>
                <select
                  id="missionTag"
                  name="missionTag"
                  value={formData.missionTag}
                  onChange={handleChange}
                  className="select-glass"
                >
                  {MISSION_TAGS.map((m) => (
                    <option key={m || 'none'} value={m} className="bg-[#0a1628]">
                      {m || '— None —'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="receiverEmail" className="block text-sm font-medium text-slate-300 mb-2">
                To
              </label>
              <input
                type="email"
                id="receiverEmail"
                name="receiverEmail"
                value={formData.receiverEmail}
                onChange={handleChange}
                required
                className="input-glass"
                placeholder="recipient@email.com"
              />
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-slate-300 mb-2">
                Subject
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="input-glass"
                placeholder="Transmission subject"
              />
            </div>

            <div>
              <label htmlFor="body" className="block text-sm font-medium text-slate-300 mb-2">
                Message
              </label>
              <textarea
                id="body"
                name="body"
                value={formData.body}
                onChange={handleChange}
                required
                rows={12}
                className="input-glass min-h-[200px]"
                placeholder="Encrypted body (plaintext here; ciphertext on the wire)…"
              />
            </div>

            <div className="flex justify-between items-center flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingDraft || !user}
                className="px-4 py-2 border border-slate-600 rounded text-slate-200 hover:border-cyan-500/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingDraft ? 'Saving...' : 'Save Draft'}
              </button>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/inbox')}
                  className="px-6 py-2 border border-slate-600 rounded text-slate-200 hover:border-cyan-500/40 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !user}
                  className="px-6 py-2 bg-isro-orange/90 text-[#050a14] rounded font-semibold hover:bg-isro-orange focus:outline-none focus:ring-2 focus:ring-isro-orange/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
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

