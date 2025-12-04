import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  userName: string;
}

interface VideoReactionsProps {
  meetingId: string;
  currentUserId: string;
  currentUserName: string;
}

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "👏", "🎉", "🔥"];

export const VideoReactions = ({ meetingId, currentUserId, currentUserName }: VideoReactionsProps) => {
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  useEffect(() => {
    // Subscribe to broadcast channel for reactions
    const channel = supabase
      .channel(`video-reactions-${meetingId}`)
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        addFloatingReaction(payload.emoji, payload.userName);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId]);

  const addFloatingReaction = (emoji: string, userName: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const x = 20 + Math.random() * 60; // Random horizontal position (20-80%)
    
    setFloatingReactions(prev => [...prev, { id, emoji, x, userName }]);
    
    // Remove after animation completes
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  };

  const sendReaction = async (emoji: string) => {
    // Add locally immediately
    addFloatingReaction(emoji, currentUserName);
    
    // Broadcast to others
    const channel = supabase.channel(`video-reactions-${meetingId}`);
    await channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { emoji, userId: currentUserId, userName: currentUserName }
    });
  };

  return (
    <>
      {/* Floating Reactions Overlay */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-40">
        {floatingReactions.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute animate-float-up"
            style={{
              left: `${reaction.x}%`,
              bottom: '20%',
            }}
          >
            <div className="flex flex-col items-center">
              <span className="text-5xl drop-shadow-lg">{reaction.emoji}</span>
              <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full mt-1">
                {reaction.userName}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Reaction Buttons */}
      <div className="flex gap-2 bg-card/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-medium">
        {EMOJI_OPTIONS.map(emoji => (
          <Button
            key={emoji}
            variant="ghost"
            size="sm"
            className="text-2xl hover:scale-125 transition-transform p-2 h-auto"
            onClick={() => sendReaction(emoji)}
          >
            {emoji}
          </Button>
        ))}
      </div>
    </>
  );
};
