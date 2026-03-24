import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { blueprintKeys } from '@/api/blueprints';
import { useWorkshopStore } from '../stores/workshop-store';
import { SSEStreamParser } from './use-sse-parser';
import type { SSEEvent } from '../types';

interface AgentMessage {
  rid: string;
  role: 'user' | 'assistant';
  content: string;
}

interface UseAgentChatReturn {
  messages: AgentMessage[];
  streamingText: string;
  isStreaming: boolean;
  send: (content: string) => void;
  reconnect: () => void;
}

const MAX_RECONNECT_DELAY = 30000;
const API_BASE = '/api/v1';

export function useAgentChat(
  sessionRid: string | null,
): UseAgentChatReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectDelayRef = useRef(1000);
  const queryClient = useQueryClient();

  const store = useWorkshopStore.getState;

  const handleEvent = useCallback(
    (event: SSEEvent) => {
      switch (event.type) {
        case 'text-delta':
          setStreamingText((prev) => prev + event.data.text);
          break;
        case 'plan-step':
          useWorkshopStore.getState().addPlanStep(event.data);
          break;
        case 'blueprint-item':
          useWorkshopStore.getState().addPendingCrystallization(event.data);
          queryClient.invalidateQueries({ queryKey: blueprintKeys.lists() });
          break;
        case 'blueprint-complete':
          useWorkshopStore.getState().setPageState('blueprint_pending');
          break;
        case 'done':
          setStreamingText((prev) => {
            if (prev) {
              setMessages((msgs) => [
                ...msgs,
                {
                  rid: `assistant-${Date.now()}`,
                  role: 'assistant',
                  content: prev,
                },
              ]);
            }
            return '';
          });
          setIsStreaming(false);
          useWorkshopStore.getState().setConnectionStatus('idle');
          break;
        case 'error':
          setIsStreaming(false);
          useWorkshopStore.getState().setConnectionStatus('idle');
          break;
      }
    },
    [queryClient],
  );

  const startStream = useCallback(
    async (content: string) => {
      if (!sessionRid) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setStreamingText('');
      store().setConnectionStatus('connected');
      store().setPageState('analyzing');
      reconnectDelayRef.current = 1000;

      // Add user message
      setMessages((msgs) => [
        ...msgs,
        { rid: `user-${Date.now()}`, role: 'user', content },
      ]);

      const parser = new SSEStreamParser();

      try {
        const response = await fetch(`${API_BASE}/agent/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionRid, content }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const events = parser.feed(chunk);
          for (const event of events) {
            handleEvent(event);
          }
        }

        // Process any remaining buffer
        const remaining = parser.feed('\n\n');
        for (const event of remaining) {
          handleEvent(event);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;

        // Start reconnection with exponential backoff
        store().setConnectionStatus('reconnecting');
        setIsStreaming(false);

        const scheduleReconnect = () => {
          const delay = reconnectDelayRef.current;
          if (delay >= MAX_RECONNECT_DELAY) {
            store().setConnectionStatus('disconnected');
            return;
          }

          reconnectTimerRef.current = setTimeout(() => {
            reconnectDelayRef.current = Math.min(
              delay * 2,
              MAX_RECONNECT_DELAY,
            );
            // In a real implementation, we'd retry the connection here.
            // For now, escalate to disconnected after max delay.
            store().setConnectionStatus('disconnected');
          }, delay);
        };

        scheduleReconnect();
      }
    },
    [sessionRid, handleEvent, store],
  );

  const send = useCallback(
    (content: string) => {
      if (isStreaming || !sessionRid) return;
      startStream(content);
    },
    [isStreaming, sessionRid, startStream],
  );

  const reconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    reconnectDelayRef.current = 1000;
    store().setConnectionStatus('idle');
  }, [store]);

  return { messages, streamingText, isStreaming, send, reconnect };
}
