import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { userAPI } from '../utils/api';

const Call = () => {
  const { user } = useAuth();
  const { makeCall, isCalling, isReceivingCall, callAccepted } = useCall();
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchContacts = async () => {
      try {
        const res = await userAPI.getContacts();
        setContacts(res.data);
      } catch (err) {
        console.error('Failed to load contacts for calling', err);
      } finally {
        setLoadingContacts(false);
      }
    };
    fetchContacts();
  }, [user]);

  const onStartVideoCall = (contact) => {
    makeCall(contact._id, contact.name, false);
  };

  const onStartAudioCall = (contact) => {
    makeCall(contact._id, contact.name, true);
  };

  const busy = isCalling || isReceivingCall || callAccepted;

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="portal-card p-6 min-h-[500px]">
          
          <div className="flex justify-between items-center mb-6 border-b border-isro-orange/20 pb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                <span>Secure Communications</span>
                {busy && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/50 px-2 py-0.5 rounded animate-pulse">
                    LINE BUSY
                  </span>
                )}
              </h1>
              <p className="text-slate-400 mt-1 text-sm">
                Initiate end-to-end encrypted peer-to-peer audio or video streams. Data never passes through backend servers.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingContacts && <p className="text-slate-500">Scanning frequency list...</p>}
            
            {!loadingContacts && contacts.length === 0 && (
               <p className="text-slate-500">No available contacts found on the network.</p>
            )}

            {contacts.map((contact) => (
              <div key={contact._id} className="border border-cyan-500/20 rounded-lg p-5 bg-slate-900/50 hover:bg-slate-900 transition shadow-[0_4px_20px_-10px_rgba(34,211,238,0.1)] flex flex-col items-center text-center">
                 <div className="h-16 w-16 bg-slate-800 border border-cyan-500/50 rounded-full flex items-center justify-center text-xl text-cyan-300 shadow-[inset_0_0_15px_rgba(34,211,238,0.2)] mb-3">
                   {contact.name.substring(0, 2).toUpperCase()}
                 </div>
                 <h3 className="font-bold text-slate-200">{contact.name}</h3>
                 <p className="text-xs text-slate-500 mb-6 font-mono truncate w-full px-2">{contact.email}</p>
                 
                 <div className="flex gap-2 w-full mt-auto">
                    <button 
                      onClick={() => onStartAudioCall(contact)}
                      disabled={busy}
                      className="flex-1 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <span>📞 Audio</span>
                    </button>
                    <button 
                      onClick={() => onStartVideoCall(contact)}
                      disabled={busy}
                      className="flex-1 py-2 rounded bg-cyan-900/60 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <span>📹 Video</span>
                    </button>
                 </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Call;
