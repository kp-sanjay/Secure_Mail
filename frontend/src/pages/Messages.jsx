import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../utils/api';
import { encryptRSA, decryptRSA, importAESKey, encryptAES, decryptAES } from '../utils/crypto';

// Helpers
function u8ToB64(u8) {
  let binary = '';
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}

const Messages = () => {
  const socket = useSocket();
  const { user, privateKey, unlockKeys } = useAuth();
  
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');

  const messagesEndRef = useRef(null);

  // Fetch Contacts
  useEffect(() => {
    if (!user) return;
    const fetchContacts = async () => {
      try {
        const res = await userAPI.getContacts();
        setContacts(res.data);
      } catch (err) {
        console.error('Failed to load contacts', err);
      } finally {
        setLoadingContacts(false);
      }
    };
    fetchContacts();
  }, [user]);

  // Handle Socket Events
  useEffect(() => {
    if (!socket || !user || !privateKey) return;

    const handleHistory = async (history) => {
      // Decrypt history
      const decHistory = [];
      for (const msg of history) {
        try {
          const isSender = msg.sender._id === user._id;
          const payloadObj = JSON.parse(msg.encryptedPayload);
          
          let wrappedAES = isSender ? payloadObj.senderWrappedKey : payloadObj.receiverWrappedKey;
          if (!wrappedAES) throw new Error('Could not find RSA-wrapped AES key');

          const aesKeyB64 = await decryptRSA(privateKey, wrappedAES);
          const aesKey = await importAESKey(aesKeyB64);
          const plaintext = await decryptAES(aesKey, payloadObj.ct, msg.ivB64);
          
          decHistory.push({ ...msg, text: plaintext, decrypted: true });
        } catch (e) {
          console.warn('Failed to decrypt historic message:', e);
          decHistory.push({ ...msg, text: '[Encrypted Message]', decrypted: false });
        }
      }
      setMessages(decHistory);
    };

    const handleReceiveMessage = async (msg) => {
      if (activeContact && (msg.sender._id === activeContact._id || msg.receiver._id === activeContact._id)) {
        try {
          const isSender = msg.sender._id === user._id;
          const payloadObj = JSON.parse(msg.encryptedPayload);
          const wrappedAES = isSender ? payloadObj.senderWrappedKey : payloadObj.receiverWrappedKey;
          
          const aesKeyB64 = await decryptRSA(privateKey, wrappedAES);
          const aesKey = await importAESKey(aesKeyB64);
          const plaintext = await decryptAES(aesKey, payloadObj.ct, msg.ivB64);
          
          setMessages(prev => [...prev, { ...msg, text: plaintext, decrypted: true }]);
        } catch (e) {
          console.warn('Failed to decrypt incoming message:', e);
          setMessages(prev => [...prev, { ...msg, text: '[Encrypted Message]', decrypted: false }]);
        }
      }
    };

    socket.on('chat-history', handleHistory);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('message-sent', handleReceiveMessage); // Use the same handler because they have the same shape

    return () => {
      socket.off('chat-history', handleHistory);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('message-sent', handleReceiveMessage);
    };
  }, [socket, user, privateKey, activeContact]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Select Contact & Initialize Room
  const handleSelectContact = async (contact) => {
    setActiveContact(contact);
    setMessages([]);
    if (socket) {
      socket.emit('get-chat-history', { contactId: contact._id });
    }
    // Fetch their public key so we can encrypt later
    try {
      const resp = await userAPI.getPublicKeyByEmail(contact.email);
      contact.publicKeyPem = resp.data.publicKey;
      setActiveContact({ ...contact });
    } catch (e) {
      console.warn("Failed to get contact's public key:", e);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeContact || !activeContact.publicKeyPem || !privateKey) return;

    try {
      // 1. Generate unique AES-GCM session key for this single message
      const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      const rawAesKey = new Uint8Array(await crypto.subtle.exportKey('raw', aesKey));
      const aesKeyB64 = u8ToB64(rawAesKey);

      // 2. Wrap the AES key twice over: Once for receiver, once for self (so we can read history)
      const receiverWrappedKey = await encryptRSA(activeContact.publicKeyPem, aesKeyB64);
      const myPublicKey = user.publicKey; // We stored publicKey in user obj! Wait, let's fetch it if needed.
      // If user.publicKey isn't available, we have to fetch our own public key. 
      const myResp = await userAPI.getPublicKeyByEmail(user.email);
      const senderWrappedKey = await encryptRSA(myResp.data.publicKey, aesKeyB64);

      // 3. Encrypt the actual message text
      const enc = await encryptAES(aesKey, inputText);

      // 4. Construct dual-wrapped payload
      const payloadObj = {
        receiverWrappedKey,
        senderWrappedKey,
        ct: enc.encrypted
      };

      // 5. Blast over WebSockets socket.io
      socket.emit('send-message', {
        receiverId: activeContact._id,
        encryptedPayload: JSON.stringify(payloadObj),
        ivB64: enc.iv
      });

      setInputText('');
    } catch (err) {
      console.error('Failed to encrypt/send message:', err);
    }
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

  if (!privateKey) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[calc(100vh-100px)]">
        <div className="text-center portal-card p-8 max-w-md w-full">
          <p className="text-red-500 mb-6">Vault locked. Encrypted messages require your private key.</p>
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
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-[calc(100vh-64px)] overflow-hidden">
      <div className="max-w-6xl mx-auto h-full flex flex-col md:flex-row gap-6">
        
        {/* Left Side: Contact List */}
        <div className="portal-card w-full md:w-1/3 flex flex-col overflow-hidden h-full">
          <div className="p-4 border-b border-cyan-500/20">
             <h2 className="text-xl font-bold text-slate-100">Team Contacts</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingContacts && <div className="p-4 text-slate-500 text-sm">Scanning directory...</div>}
            {contacts.map(contact => (
              <button
                key={contact._id}
                onClick={() => handleSelectContact(contact)}
                className={`w-full flex flex-col items-start p-3 rounded-lg transition ${
                  activeContact?._id === contact._id 
                  ? 'bg-cyan-900/40 border border-cyan-500/50' 
                  : 'hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="font-medium text-slate-200">{contact.name}</div>
                <div className="text-xs text-slate-400 truncate w-full flex justify-start">{contact.email}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Chat Window */}
        <div className="portal-card w-full md:w-2/3 flex flex-col h-full overflow-hidden relative">
          {activeContact ? (
            <>
              {/* Header */}
              <div className="p-4 flex flex-row justify-between items-center border-b border-cyan-500/20 bg-slate-900/50">
                <div>
                  <h3 className="text-lg font-bold text-slate-100">{activeContact.name}</h3>
                  <div className="text-xs text-emerald-400 tracking-wider">E2E ENCRYPTED CHANNEL OPEN</div>
                </div>
                {socket && (
                   <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                )}
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="mt-10 text-center text-slate-500 text-sm">
                    No encrypted messages yet. Key exchanges configured successfully.
                  </div>
                )}
                {messages.map((msg, idx) => {
                  const isMe = msg.sender._id === user._id;
                  return (
                    <div key={msg._id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-xl px-4 py-2 shadow-lg backdrop-blur-sm ${
                        isMe 
                          ? 'bg-cyan-900/60 border border-cyan-500/30 text-white rounded-br-none'
                          : 'bg-slate-800/80 border border-slate-600/50 text-slate-200 rounded-bl-none'
                      }`}>
                        {!msg.decrypted && <span className="text-xs text-red-400 mr-2">⚠️ Decrypt Fail</span>}
                        <div className="text-sm break-words">{msg.text}</div>
                        <div className={`text-[10px] mt-1 ${isMe ? 'text-cyan-400/70 text-right' : 'text-slate-400 text-left'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-cyan-500/20 bg-slate-900/80">
                {!activeContact.publicKeyPem && (
                   <div className="text-xs text-red-400 mb-2 italic px-2">
                     Warning: Recipient's RSA public key not loaded. Re-selecting contact may fix this.
                   </div>
                )}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type an encrypted message..."
                    className="input-glass flex-1 !p-3 rounded-full"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-full px-6 py-2 transition disabled:opacity-50 font-semibold"
                  >
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
             <div className="m-auto text-slate-500 flex flex-col items-center select-none">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 opacity-30 mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
               <p>Select a contact to establish an encrypted tunnel.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
