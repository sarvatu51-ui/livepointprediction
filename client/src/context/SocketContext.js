import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user, updatePoints } = useAuth();

  useEffect(() => {
    // In production use Render URL, in development use localhost
    const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      if (user) {
        newSocket.emit('joinUserRoom', user.id);
      }
    });

    newSocket.on('betPlaced', (data) => {
      updatePoints(data.newPoints);
    });

    setSocket(newSocket);

    return () => { newSocket.disconnect(); };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
