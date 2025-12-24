import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailAPI, userAPI } from '../utils/api';
import {
  generateAESKey,
  exportAESKey,
  encryptAES,
  encryptRSA,
  importPublicKey,
} from '../utils/crypto';

const Compose = () => {
  const [formData, setFormData] = useState({
    receiverEmail: '',
    subject: '',
    body: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1: Get receiver's public key
      const receiverResponse = await userAPI.getPublicKeyByEmail(formData.receiverEmail);
      const receiverPublicKeyPEM = receiverResponse.data.publicKey;

      // Step 2: Import receiver's public key
      const receiverPublicKey = await importPublicKey(receiverPublicKeyPEM);

      // Step 3: Generate AES key for message encryption
      const aesKey = await generateAESKey();
      const aesKeyBase64 = await exportAESKey(aesKey);

      // Step 4: Encrypt subject and body with AES
      const encryptedSubjectData = await encryptAES(aesKey, formData.subject);
      const encryptedBodyData = await encryptAES(aesKey, formData.body);

      // Step 5: Encrypt AES key with receiver's public RSA key
      const encryptedAESKey = await encryptRSA(receiverPublicKey, aesKeyBase64);

      // Step 6: Format encrypted data (combine encrypted data with IV)
      const encryptedSubject = `${encryptedSubjectData.encrypted}:${encryptedSubjectData.iv}`;
      const encryptedBody = `${encryptedBodyData.encrypted}:${encryptedBodyData.iv}`;

      // Step 7: Send encrypted email to server
      await emailAPI.sendEmail({
        receiverEmail: formData.receiverEmail,
        encryptedSubject,
        encryptedBody,
        encryptedAESKey,
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

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate('/inbox')}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Compose;

