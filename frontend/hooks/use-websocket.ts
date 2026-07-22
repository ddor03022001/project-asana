'use client';

import { useEffect, useRef, useState } from 'react';
import { getAccessToken } from '@/lib/api';

export interface WebSocketMessage {
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export function useWebSocket(onMessage?: (data: WebSocketMessage) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const connect = () => {
      const token = getAccessToken();
      if (!token) return;

      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const wsProtocol = apiBase.startsWith('https') ? 'wss' : 'ws';
      const wsHost = apiBase.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/ws?token=${encodeURIComponent(token)}`;

      try {
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          setIsConnected(true);
          retryCountRef.current = 0;
        };

        socket.onmessage = (event) => {
          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            if (onMessageRef.current) {
              onMessageRef.current(data);
            }
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        socket.onclose = () => {
          setIsConnected(false);
          socketRef.current = null;

          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
          retryCountRef.current += 1;

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        };

        socket.onerror = (err) => {
          console.warn('WebSocket error:', err);
          socket.close();
        };

        socketRef.current = socket;
      } catch (e) {
        console.error('Failed to initiate WebSocket connection:', e);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  return { isConnected };
}
