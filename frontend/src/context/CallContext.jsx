import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const socket = useSocket();
  const { user } = useAuth();

  const [call, setCall] = useState({});
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  
  // Media streams
  const [stream, setStream] = useState(null);
  const myVideoRef = useRef(null);
  const userVideoRef = useRef(null);
  const connectionRef = useRef(null);
  const [audioOnlyMode, setAudioOnlyMode] = useState(false);

  // Initialize socket listeners for calls
  useEffect(() => {
    if (!socket || !user) return;

    socket.on('call-incoming', ({ from, name, signal, audioOnly }) => {
      setCall({ isReceivingCall: true, from, name, signal, audioOnly });
      setIsReceivingCall(true);
      setAudioOnlyMode(audioOnly);
    });

    socket.on('call-ended', () => {
      endCall(true);
    });

    socket.on('call-rejected', ({ reason }) => {
      alert(reason || 'Call was rejected or user is offline.');
      endCall(true);
    });

    return () => {
      socket.off('call-incoming');
      socket.off('call-ended');
      socket.off('call-rejected');
    };
  }, [socket, user]);

  // Request user media
  const requestMedia = async (audioOnly = false) => {
    if (stream) return stream;
    try {
      setAudioOnlyMode(audioOnly);
      const currentStream = await navigator.mediaDevices.getUserMedia({ 
        video: !audioOnly, 
        audio: true 
      });
      setStream(currentStream);
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = currentStream;
      }
      return currentStream;
    } catch (err) {
      console.error('Failed to get media devices:', err);
      alert('Must allow camera/mic access to make secure calls.');
      return null;
    }
  };

  const makeCall = async (idToCall, ContactName, audioOnly = false) => {
    const activeStream = await requestMedia(audioOnly);
    if (!activeStream) return;

    setIsCalling(true);

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    });

    activeStream.getTracks().forEach((track) => peer.addTrack(track, activeStream));

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('call-user', {
          userToCall: idToCall,
          signalData: e.candidate,
          from: user._id,
          name: user.name,
          audioOnly
        });
      }
    };

    // First offer creation
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    
    socket.emit('call-user', {
      userToCall: idToCall,
      signalData: offer,
      from: user._id,
      name: user.name,
      audioOnly
    });

    peer.ontrack = (event) => {
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = event.streams[0];
      }
    };

    socket.on('call-accepted', async (signal) => {
      setCallAccepted(true);
      if (signal.type === 'answer') {
         await peer.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
         await peer.addIceCandidate(new RTCIceCandidate(signal));
      }
    });

    connectionRef.current = peer;
  };

  const answerCall = async () => {
    setCallAccepted(true);
    const activeStream = await requestMedia(call.audioOnly);
    if (!activeStream) return;

    const peer = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
    });

    activeStream.getTracks().forEach((track) => peer.addTrack(track, activeStream));

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('answer-call', { signal: e.candidate, to: call.from });
      }
    };

    peer.ontrack = (event) => {
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = event.streams[0];
      }
    };

    if (call.signal.type === 'offer') {
      await peer.setRemoteDescription(new RTCSessionDescription(call.signal));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('answer-call', { signal: answer, to: call.from });
    }

    connectionRef.current = peer;
  };

  const declineCall = () => {
    socket.emit('reject-call', { to: call.from });
    setIsReceivingCall(false);
    setCall({});
  };

  const endCall = (fromRemote = false) => {
    setCallEnded(true);
    setIsCalling(false);
    setCallAccepted(false);
    setIsReceivingCall(false);
    setCall({});
    
    if (!fromRemote && socket && call.from) {
      socket.emit('end-call', { to: call.from });
    }
    
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    socket.off('call-accepted');
  };

  return (
    <CallContext.Provider value={{
      call,
      callAccepted,
      myVideoRef,
      userVideoRef,
      stream,
      callEnded,
      isReceivingCall,
      isCalling,
      audioOnlyMode,
      makeCall,
      answerCall,
      declineCall,
      endCall,
    }}>
      {children}

      {/* GLOBAL MODAL RENDERER */}
      {(isReceivingCall || isCalling || callAccepted) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="portal-card max-w-4xl w-full mx-4 shadow-2xl shadow-cyan-900/40 translate-y-0 animate-in fade-in zoom-in duration-300 relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500" />
            
            <div className="p-4 sm:p-6 text-center">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-widest uppercase mb-1">
                {audioOnlyMode ? 'Secure Audio Link' : 'Secure Video Link'}
              </h2>
              <p className="text-emerald-400 text-xs tracking-widest font-mono mb-6">
                DTLS/SRTP E2E ENCRYPTED
              </p>

              <div className="flex flex-col md:flex-row justify-center gap-6 mb-6">
                
                {/* My Video */}
                {stream && !audioOnlyMode && (
                  <div className="relative group w-full md:w-1/2 rounded-xl overflow-hidden border border-cyan-500/30 bg-black aspect-video flex-shrink-0">
                    <video playsInline muted ref={myVideoRef} autoPlay className="w-full h-full object-cover -scale-x-100" />
                    <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] text-white backdrop-blur">
                      Local Node
                    </div>
                  </div>
                )}
                
                {/* Remote Video (Only if accepted) */}
                {callAccepted && !callEnded && !audioOnlyMode && (
                  <div className="relative group w-full md:w-1/2 rounded-xl overflow-hidden border border-emerald-500/50 bg-slate-900 aspect-video flex-shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <video playsInline ref={userVideoRef} autoPlay className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] text-white backdrop-blur">
                      Remote Node
                    </div>
                  </div>
                )}

                {/* Audio Avatar Stand-in */}
                {audioOnlyMode && (
                  <div className="w-full h-48 flex items-center justify-center bg-slate-900/50 rounded-xl border border-cyan-500/20">
                    <div className="flex flex-col items-center">
                       <span className="relative flex h-16 w-16 mb-4">
                         {callAccepted && (
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span>
                         )}
                         <span className="relative inline-flex rounded-full h-16 w-16 bg-slate-800 border border-slate-600 flex items-center justify-center text-xl text-slate-400">
                           📞
                         </span>
                       </span>
                       <div className="text-slate-300 font-mono text-sm max-w-sm px-4">
                          {isCalling && !callAccepted ? 'Connecting handshakes...' : ''}
                          {isReceivingCall && !callAccepted ? `${call.name} is bridging...` : ''}
                          {callAccepted ? 'Audio linked (P2P)' : ''}
                       </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Call Controls */}
              <div className="flex justify-center gap-4">
                {isReceivingCall && !callAccepted ? (
                  <>
                    <button onClick={answerCall} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transition transform hover:scale-105">
                      Accept Signal
                    </button>
                    <button onClick={declineCall} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transition transform hover:scale-105">
                      Decline
                    </button>
                  </>
                ) : (
                  <button onClick={() => endCall(false)} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transition transform hover:scale-105">
                    {callAccepted ? 'Disconnect' : 'Cancel Handshake'}
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </CallContext.Provider>
  );
};
