import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailAPI, userAPI } from '../utils/api';
import {
  generateAESKey,
  exportAESKey,
  encryptAESWithNonce,
  encryptRSA,
  importPublicKey,
  generateECCKeyPair,
  exportECCPublicKey,
  importECCPublicKey,
  deriveECDHKeyBase64,
  generateECDSAKeyPair,
  signECDSA,
  exportECCPublicKey as exportECDSAKey,
} from '../utils/crypto';
import { phishingDetector } from '../utils/phishingDetector';
import { anomalyDetector } from '../utils/anomalyDetector';

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
      // Step 1: Get receiver's public keys (RSA and ECC)
      const receiverResponse = await userAPI.getPublicKeyByEmail(formData.receiverEmail);
      const receiverPublicKeyPEM = receiverResponse.data.publicKey;
      const receiverECCPublicKey = receiverResponse.data.eccPublicKey;

      // Step 2: Import receiver's public keys
      const receiverPublicKey = await importPublicKey(receiverPublicKeyPEM);
      let receiverECCPublicKeyObj = null;
      let encryptedECDHKey = null;

      // Step 3: Generate ECDH key pair for session key exchange
      if (receiverECCPublicKey) {
        try {
          receiverECCPublicKeyObj = await importECCPublicKey(receiverECCPublicKey);
          const eccKeyPair = await generateECCKeyPair();
          encryptedECDHKey = await deriveECDHKeyBase64(eccKeyPair.privateKey, receiverECCPublicKeyObj);
        } catch (err) {
          console.warn('ECDH key exchange failed, falling back to RSA:', err);
        }
      }

      // Step 4: Generate AES key for message encryption
      const aesKey = await generateAESKey();
      const aesKeyBase64 = await exportAESKey(aesKey);

      // Step 5: Encrypt subject and body with AES-GCM and proper nonce handling
      const encryptedSubjectData = await encryptAESWithNonce(aesKey, formData.subject);
      const encryptedBodyData = await encryptAESWithNonce(aesKey, formData.body);

      // Step 6: Encrypt AES key (prefer ECDH, fallback to RSA)
      let encryptedAESKey = null;
      if (encryptedECDHKey) {
        // Use ECDH-derived key
        encryptedAESKey = encryptedECDHKey;
      } else {
        // Fallback to RSA
        encryptedAESKey = await encryptRSA(receiverPublicKey, aesKeyBase64);
      }

      // Step 7: Generate digital signature with ECDSA
      const ecdsaKeyPair = await generateECDSAKeyPair();
      const messageToSign = `${formData.subject}${formData.body}${formData.receiverEmail}`;
      const signature = await signECDSA(ecdsaKeyPair.privateKey, messageToSign);

      // Step 8: Create search index (simplified - would be encrypted in production)
      const searchIndex = `${formData.subject} ${formData.body}`.toLowerCase();

      // Step 9: Track behavioral event
      anomalyDetector.trackEvent('email_sent', {
        recipient: formData.receiverEmail,
        bodyLength: formData.body.length,
        hour: new Date().getHours(),
      });

      // Step 10: Send encrypted email to server
      await emailAPI.sendEmail({
        receiverEmail: formData.receiverEmail,
        encryptedSubject: `${encryptedSubjectData.encrypted}:${encryptedSubjectData.iv}`,
        encryptedBody: `${encryptedBodyData.encrypted}:${encryptedBodyData.iv}`,
        encryptedAESKey: encryptedAESKey,
        encryptedECDHKey: encryptedECDHKey || null,
        signature: signature,
        nonce: encryptedSubjectData.timestamp.toString(),
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Compose Email</h1>
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

          <form onSubmit={handleSubmit} className="space-y-6">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Write your encrypted message here..."
              />
            </div>

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={savingDraft || !user}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingDraft ? 'Saving...' : 'Save Draft'}
              </button>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => navigate('/inbox')}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !user}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
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

