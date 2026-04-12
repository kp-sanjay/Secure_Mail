import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // We only construct the socket if the user is authenticated
    if (user) {
      // Connect to the backend
      const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
        auth: { token: localStorage.getItem('token') },
        transports: ['websocket'], // Force WebSocket transport
      });

      newSocket.on('connect', () => {
        console.log('[Socket] Connect success:', newSocket.id);
      });

      newSocket.on('connect_error', (err) => {
        console.error('[Socket] Connection Failed:', err.message);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    } else if (socket) {
      // If user logs out, kill the connection
      socket.close();
      setSocket(null);
    }
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
