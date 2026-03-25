import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailAPI } from '../utils/api';
import { decryptRSA, importAESKey, decryptAES } from '../utils/crypto';
import { decryptEnvelope } from '../utils/envelope';

const CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'secret', label: 'Secret' },
  { id: 'top_secret', label: 'Top Secret' },
];

const Inbox = () => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [chip, setChip] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const { user, privateKey, mlkemSecretKeyB64, mlkem768SecretKeyB64 } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && privateKey) {
      fetchInbox();
    }
  }, [user, privateKey]);

  const filteredEmails = useMemo(() => {
    let list = emails;

    if (chip === 'unread') list = list.filter((e) => !e.isRead);
    else if (chip === 'flagged') list = list.filter((e) => e.isFlagged);
    else if (chip === 'secret') list = list.filter((e) => e.classification === 'SECRET');
    else if (chip === 'top_secret') list = list.filter((e) => e.classification === 'TOP_SECRET');

    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase();
    return list.filter(
      (email) =>
        email.sender?.name?.toLowerCase().includes(query) ||
        email.sender?.email?.toLowerCase().includes(query) ||
        email.encryptedSubject?.toLowerCase().includes(query) ||
        email.category?.toLowerCase().includes(query) ||
        email.missionTag?.toLowerCase().includes(query) ||
        email.classification?.toLowerCase().includes(query)
    );
  }, [searchQuery, emails, chip]);

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

  const toggleFlag = async (e, email) => {
    e.stopPropagation();
    try {
      const next = !email.isFlagged;
      await emailAPI.updateEmailCategory(email._id, { isFlagged: next });
      setEmails((prev) => prev.map((x) => (x._id === email._id ? { ...x, isFlagged: next } : x)));
    } catch (err) {
      console.error(err);
    }
  };

  const decryptEmail = async (email) => {
    try {
      if (email.envelope) {
        return await decryptEnvelope({
          envelope: email.envelope,
          rsaPrivateKey: privateKey,
          mlkemSecretKeyB64,
          mlkem768SecretKeyB64,
        });
      }

      const aesKeyBase64 = await decryptRSA(privateKey, email.encryptedAESKey);
      const aesKey = await importAESKey(aesKeyBase64);

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
    return (
      date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

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

    const threads = Array.from(threadMap.values())
      .map((thread) => ({
        ...thread[0],
        threadCount: thread.length,
        isThread: true,
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return [...threads, ...unthreaded];
  };

  const handleThreadClick = async (email) => {
    if (email.isThread && email.threadId) {
      navigate(`/thread/${email.threadId}`);
    } else {
      handleEmailClick(email);
    }
  };

  const displayList = viewMode === 'thread' ? groupByThread(filteredEmails) : filteredEmails;

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="portal-card">
          <div className="px-6 py-4 border-b border-cyan-500/20">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-100 tracking-wide uppercase">Secure Inbox</h1>
                <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider">
                  End-to-end · CRYSTALS-Kyber ML-KEM-1024 + AES-GCM
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/compose')}
                className="shrink-0 border border-slate-400 px-4 py-2 text-xs uppercase tracking-wider text-slate-200 hover:border-isro-orange hover:text-isro-orange transition"
              >
                + Compose
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                  ⌕
                </span>
                <input
                  type="text"
                  placeholder="Search encrypted messages…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-glass pl-9"
                />
              </div>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="select-glass sm:w-44"
              >
                <option value="list" className="bg-[#0a1628]">
                  List view
                </option>
                <option value="thread" className="bg-[#0a1628]">
                  Thread view
                </option>
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              {CHIPS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setChip(id)}
                  className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-wide border transition ${
                    chip === id
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'border-slate-600 text-slate-400 hover:border-cyan-500/30'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!user ? (
            <div className="p-8 text-center">
              <p className="text-slate-400 mb-4">Authenticate to open secure inbox</p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-isro-orange/90 text-[#050a14] rounded font-semibold"
              >
                Login
              </button>
            </div>
          ) : loading ? (
            <div className="p-8 text-center text-slate-400">Loading inbox…</div>
          ) : error ? (
            <div className="p-8 text-center text-red-400">{error}</div>
          ) : emails.length === 0 ? (
            <div className="p-16 text-center">
              <div className="mx-auto mb-6 h-20 w-20 rounded-full border border-cyan-500/30 flex items-center justify-center text-4xl text-slate-600">
                ✉
              </div>
              <h2 className="text-slate-200 uppercase tracking-[0.2em] text-sm mb-2">
                No transmissions received
              </h2>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Awaiting encrypted signals from authorized nodes. Outbound compose uses Kyber-wrapped
                session keys.
              </p>
            </div>
          ) : displayList.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">No messages match this filter.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {displayList.map((email) => (
                <div
                  key={email._id}
                  onClick={() => handleThreadClick(email)}
                  className="px-6 py-4 hover:bg-cyan-500/5 cursor-pointer transition flex gap-3"
                >
                  <button
                    type="button"
                    aria-label={email.isFlagged ? 'Unflag' : 'Flag'}
                    onClick={(e) => toggleFlag(e, email)}
                    className={`mt-1 text-lg leading-none ${email.isFlagged ? 'text-isro-orange' : 'text-slate-600 hover:text-slate-400'}`}
                  >
                    ★
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-100 truncate">
                        {email.sender?.name || email.sender?.email || 'Unknown'}
                      </p>
                      {!email.isRead && <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />}
                      {email.missionTag ? (
                        <span className="text-[10px] px-2 py-0.5 rounded border border-cyan-500/40 text-cyan-300">
                          {email.missionTag}
                        </span>
                      ) : null}
                      {email.classification && email.classification !== 'UNCLASSIFIED' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded border border-isro-orange/50 text-isro-orange">
                          {email.classification.replace('_', ' ')}
                        </span>
                      ) : null}
                      {email.isThread && (
                        <span className="text-[10px] px-2 py-0.5 rounded border border-slate-600 text-slate-400">
                          Thread ({email.threadCount})
                        </span>
                      )}
                      {email.category && email.category !== 'unknown' && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded ${
                            email.category === 'phishing'
                              ? 'bg-red-950/60 text-red-300 border border-red-500/40'
                              : email.category === 'spam'
                                ? 'bg-yellow-950/50 text-yellow-200 border border-yellow-600/40'
                                : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {email.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1 font-mono">[Encrypted · envelope L{email.securityLevel ?? '?'}]</p>
                  </div>
                  <p className="text-xs text-slate-500 shrink-0 whitespace-nowrap">{formatDate(email.timestamp)}</p>
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
