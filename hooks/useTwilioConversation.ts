// Twilio Conversations hook using REST API (React Native compatible)
import { useState, useEffect, useCallback, useRef } from 'react';
import { getTwilioConversationSid, sendTwilioMessage, startMessagePolling, stopMessagePolling, TwilioMessage, fetchMessages } from '@/lib/twilio/conversations';
import { getTwilioAccessToken } from '@/lib/api/twilio';
import { useAuthStore } from '@/stores/authStore';

export function useTwilioConversation(
  gigId: string | undefined,
  participant1Id: string | undefined,
  participant2Id: string | undefined
) {
  const { user } = useAuthStore();
  const [conversationSid, setConversationSid] = useState<string | null>(null);
  const [serviceSid, setServiceSid] = useState<string | null>(null);
  const [messages, setMessages] = useState<TwilioMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [otherParticipantTyping, setOtherParticipantTyping] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastMessageIndexRef = useRef<number>(0);

  // Initialize conversation
  useEffect(() => {
    if (!gigId || !participant1Id || !participant2Id) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const setupConversation = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get service SID from token
        const tokenData = await getTwilioAccessToken();
        setServiceSid(tokenData.serviceSid);

        // Get conversation SID
        const sid = await getTwilioConversationSid(gigId, participant1Id, participant2Id);
        
        if (!mounted) return;

        setConversationSid(sid);

        // Load existing messages
        try {
          const existingMessages = await fetchMessages(sid, tokenData.serviceSid);
          setMessages(existingMessages);
          if (existingMessages.length > 0) {
            lastMessageIndexRef.current = Math.max(...existingMessages.map(m => m.index));
          }
        } catch (msgError) {
          console.error('Error loading messages:', msgError);
          // Continue even if message loading fails
        }

        setIsLoading(false);
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setIsLoading(false);
        }
      }
    };

    setupConversation();

    return () => {
      mounted = false;
      stopMessagePolling();
    };
  }, [gigId, participant1Id, participant2Id]);

  // Note: Polling removed - using webhooks + Supabase Realtime instead
  // Messages are synced to Supabase via webhook, then pushed via Realtime

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationSid || !serviceSid || !user?.id) {
        throw new Error('Conversation not initialized');
      }

      try {
        const newMessage = await sendTwilioMessage(
          conversationSid,
          serviceSid,
          content,
          user.id
        );
        
        // Add message to local state immediately for optimistic update
        setMessages((prev) => [...prev, newMessage]);
        lastMessageIndexRef.current = Math.max(lastMessageIndexRef.current, newMessage.index);
      } catch (err) {
        throw err;
      }
    },
    [conversationSid, serviceSid, user?.id]
  );

  return {
    conversation: null, // Not using SDK conversation object
    messages,
    isLoading,
    error,
    sendMessage,
    isTyping: false, // Typing indicators would need WebSocket support
    otherParticipantTyping,
    setTyping: () => {}, // Placeholder
  };
}
