import { useState } from 'react';
import { aiAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Assistant = () => {
  const { user } = useAuth();
  const [compose, setCompose] = useState({
    purpose: '',
    tone: 'professional',
    recipientName: '',
    details: '',
  });
  const [draft, setDraft] = useState(null);
  const [composeLoading, setComposeLoading] = useState(false);
  const [composeError, setComposeError] = useState('');

  const [chatMessage, setChatMessage] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const generateDraft = async () => {
    setComposeError('');
    setComposeLoading(true);
    try {
      const resp = await aiAPI.compose({
        ...compose,
        senderName: user?.name || user?.email || '',
      });
      setDraft(resp.data);
    } catch (e) {
      setComposeError(e.response?.data?.message || 'Failed to generate draft');
    } finally {
      setComposeLoading(false);
    }
  };

  const sendChat = async () => {
    const msg = chatMessage.trim();
    if (!msg) return;
    setChatMessage('');
    setChatLoading(true);
    setChatLog((l) => [...l, { role: 'user', text: msg }]);
    try {
      const resp = await aiAPI.chat({ message: msg });
      setChatLog((l) => [...l, { role: 'assistant', text: resp.data.answer }]);
    } catch (e) {
      setChatLog((l) => [...l, { role: 'assistant', text: 'Sorry—failed to answer that.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="portal-card p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Qrypt AI Assistant</h1>
          <p className="text-gray-600">Generate professional drafts and get help with security levels, keys, and SMTP.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="portal-card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Compose Assistant</h2>
            {composeError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {composeError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Purpose</label>
                <input
                  value={compose.purpose}
                  onChange={(e) => setCompose((c) => ({ ...c, purpose: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange focus:border-isro-orange"
                  placeholder="e.g., Request for meeting, Project update, Follow-up"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                  <select
                    value={compose.tone}
                    onChange={(e) => setCompose((c) => ({ ...c, tone: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange focus:border-isro-orange"
                  >
                    <option value="professional">Professional</option>
                    <option value="formal">Formal</option>
                    <option value="friendly">Friendly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Recipient name (optional)</label>
                  <input
                    value={compose.recipientName}
                    onChange={(e) => setCompose((c) => ({ ...c, recipientName: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange focus:border-isro-orange"
                    placeholder="e.g., Dr. Rao"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Details</label>
                <textarea
                  value={compose.details}
                  onChange={(e) => setCompose((c) => ({ ...c, details: e.target.value }))}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange focus:border-isro-orange"
                  placeholder="Key points, dates, requirements..."
                />
              </div>

              <button
                type="button"
                onClick={generateDraft}
                disabled={composeLoading}
                className="w-full px-4 py-2 bg-isro-navy text-white rounded hover:bg-isro-navy-light disabled:opacity-50 transition"
              >
                {composeLoading ? 'Generating...' : 'Generate draft'}
              </button>
            </div>

            {draft && (
              <div className="mt-6 border-t pt-4 space-y-2">
                <div className="text-sm text-gray-500">Subject</div>
                <div className="font-semibold text-gray-900">{draft.subject}</div>
                <div className="text-sm text-gray-500 mt-3">Body</div>
                <pre className="whitespace-pre-wrap text-gray-900 bg-white/70 border border-white/20 rounded p-3 backdrop-blur">{draft.body}</pre>
              </div>
            )}
          </div>

          <div className="portal-card p-6 flex flex-col">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Help Chatbot</h2>
            <div className="flex-1 overflow-auto border border-white/20 rounded p-3 bg-white/50 backdrop-blur space-y-3">
              {chatLog.length === 0 ? (
                <div className="text-gray-500 text-sm">Ask about “Level 4”, “SMTP”, “keys”, or “QRNG”.</div>
              ) : (
                chatLog.map((m, idx) => (
                  <div key={idx} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                    <div
                      className={
                        'inline-block max-w-[90%] px-3 py-2 rounded-lg text-sm ' +
                        (m.role === 'user'
                          ? 'bg-primary-600 text-white'
                          : 'bg-white border text-gray-900')
                      }
                    >
                      {m.text}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendChat();
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-isro-orange focus:border-isro-orange"
                placeholder="Type your question..."
              />
              <button
                type="button"
                onClick={sendChat}
                disabled={chatLoading}
                className="px-4 py-2 bg-isro-navy text-white rounded hover:bg-isro-navy-light disabled:opacity-50 transition"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Assistant;

