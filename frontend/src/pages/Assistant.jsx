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
      setChatLog((l) => [...l, { role: 'assistant', text: 'Downlink error — retry shortly.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="portal-card p-6 border-isro-orange/20">
          <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight">Qrypt / Quantum Assistant</h1>
          <p className="text-xs text-cyan-500/80 uppercase tracking-widest">
            Drafting · Kyber / QRNG / SMTP help
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="portal-card p-6 flex flex-col border-cyan-500/15">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest mb-4 border-b border-cyan-500/20 pb-2">
              Compose assistant
            </h2>
            {composeError && (
              <div className="mb-4 border border-red-500/40 bg-red-950/30 text-red-200 px-4 py-3 rounded text-sm">
                {composeError}
              </div>
            )}

            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                  Purpose
                </label>
                <input
                  value={compose.purpose}
                  onChange={(e) => setCompose((c) => ({ ...c, purpose: e.target.value }))}
                  className="input-glass"
                  placeholder="e.g. Coordination note, read-ahead for review"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                    Tone
                  </label>
                  <select
                    value={compose.tone}
                    onChange={(e) => setCompose((c) => ({ ...c, tone: e.target.value }))}
                    className="select-glass"
                  >
                    <option value="professional" className="bg-[#0a1628]">
                      Professional
                    </option>
                    <option value="formal" className="bg-[#0a1628]">
                      Formal
                    </option>
                    <option value="friendly" className="bg-[#0a1628]">
                      Friendly
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                    Recipient (optional)
                  </label>
                  <input
                    value={compose.recipientName}
                    onChange={(e) => setCompose((c) => ({ ...c, recipientName: e.target.value }))}
                    className="input-glass"
                    placeholder="e.g. Dr. Rao"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                  Details
                </label>
                <textarea
                  value={compose.details}
                  onChange={(e) => setCompose((c) => ({ ...c, details: e.target.value }))}
                  rows={6}
                  className="input-glass min-h-[140px]"
                  placeholder="Constraints, dates, references…"
                />
              </div>

              <button
                type="button"
                onClick={generateDraft}
                disabled={composeLoading}
                className="w-full py-2.5 rounded bg-cyan-600/80 hover:bg-cyan-500 text-white text-sm font-semibold disabled:opacity-50 transition border border-cyan-400/30"
              >
                {composeLoading ? 'Generating…' : 'Generate draft'}
              </button>
            </div>

            {draft && (
              <div className="mt-6 border-t border-cyan-500/20 pt-4 space-y-2">
                <div className="text-[10px] uppercase text-slate-500 tracking-wider">Subject</div>
                <div className="font-semibold text-slate-100 text-sm">{draft.subject}</div>
                <div className="text-[10px] uppercase text-slate-500 tracking-wider mt-3">Body</div>
                <pre className="whitespace-pre-wrap text-slate-300 text-sm bg-[#030b14]/80 border border-cyan-500/20 rounded-lg p-4 font-mono leading-relaxed">
                  {draft.body}
                </pre>
              </div>
            )}
          </div>

          <div className="portal-card p-6 flex flex-col min-h-[480px] border-isro-orange/15">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest mb-4 border-b border-isro-orange/25 pb-2">
              Technical chatbot
            </h2>
            <div className="flex-1 overflow-auto rounded-lg border border-slate-700/80 bg-[#030b14]/90 p-4 space-y-3 min-h-[280px] shadow-inner">
              {chatLog.length === 0 ? (
                <p className="text-slate-500 text-xs leading-relaxed">
                  Try: <span className="text-cyan-500/90">“Explain Kyber 1024”</span>,{' '}
                  <span className="text-cyan-500/90">“Level 2 QRNG”</span>,{' '}
                  <span className="text-cyan-500/90">“SMTP level 1”</span>, or{' '}
                  <span className="text-cyan-500/90">“Dilithium signatures”</span>.
                </p>
              ) : (
                chatLog.map((m, idx) => (
                  <div key={idx} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                    <div
                      className={
                        'inline-block max-w-[92%] px-3 py-2 rounded-lg text-xs leading-relaxed ' +
                        (m.role === 'user'
                          ? 'bg-cyan-600/25 border border-cyan-500/40 text-cyan-100'
                          : 'bg-slate-900/90 border border-slate-600 text-slate-200')
                      }
                    >
                      {m.text}
                    </div>
                  </div>
                ))
              )}
              {chatLoading && <p className="text-[10px] text-slate-500 animate-pulse">Uplink…</p>}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendChat();
                }}
                className="input-glass flex-1"
                placeholder="Query Kyber, QRNG, SMTP…"
              />
              <button
                type="button"
                onClick={sendChat}
                disabled={chatLoading}
                className="border border-isro-orange/60 bg-isro-orange/15 text-isro-orange px-4 py-2 rounded hover:bg-isro-orange/25 disabled:opacity-50 text-sm font-semibold transition"
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
