import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { WebRTCManager, Participant } from "@/utils/webrtc";
import { MeetingChat } from "@/components/MeetingChat";
import { VideoReactions } from "@/components/VideoReactions";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Users,
  Settings
} from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  is_confidential: boolean;
}

const Meeting = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    if (meetingId) {
      loadMeeting();
      loadCurrentUser();
    }

    return () => {
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.cleanup();
      }
    };
  }, [meetingId]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setCurrentUser(profile);
    }
  };

  const loadMeeting = async () => {
    try {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", meetingId)
        .single();

      if (error) throw error;

      const scheduledEnd = new Date(data.scheduled_end);
      const now = new Date();

      if (now > scheduledEnd || data.status === 'completed') {
        toast({
          title: "Meeting has ended",
          description: "This meeting is over and can no longer be joined.",
          variant: "destructive",
        });
        if (data.status !== 'completed') {
          await supabase.from("meetings").update({ status: 'completed' }).eq('id', meetingId);
        }
        navigate("/dashboard");
        return;
      }

      setMeeting(data);
    } catch (error: any) {
      console.error("Error loading meeting:", error);
      toast({
        title: "Error",
        description: "Failed to load meeting details",
        variant: "destructive",
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const initializeWebRTC = async () => {
    if (!currentUser || !meetingId) return;

    try {
      const manager = new WebRTCManager(
        meetingId,
        currentUser.id,
        currentUser.full_name || "User",
        {
          onParticipantJoined: (participant) => {
            console.log("Participant joined:", participant);
            setParticipants((prev) => new Map(prev).set(participant.userId, participant));
          },
          onParticipantLeft: (userId) => {
            console.log("Participant left:", userId);
            setParticipants((prev) => {
              const updated = new Map(prev);
              updated.delete(userId);
              return updated;
            });
            remoteVideoRefs.current.delete(userId);
          },
          onStreamAdded: (userId, stream) => {
            console.log("Stream added for participant:", userId);
            setParticipants((prev) => {
              const updated = new Map(prev);
              const participant = updated.get(userId);
              if (participant) {
                participant.stream = stream;
                updated.set(userId, participant);
              }
              return updated;
            });
            
            // Attach stream to video element
            const videoElement = remoteVideoRefs.current.get(userId);
            if (videoElement) {
              videoElement.srcObject = stream;
            }
          },
        }
      );

      const localStream = await manager.initialize();
      webrtcManagerRef.current = manager;

      if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
      }

      toast({
        title: "Connected",
        description: "You've joined the meeting",
      });
    } catch (error) {
      console.error("Error initializing WebRTC:", error);
      toast({
        title: "Media Access Error",
        description: "Could not access camera or microphone",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (currentUser && !loading) {
      initializeWebRTC();
    }
  }, [currentUser, loading]);

  useEffect(() => {
    if (meeting) {
      const scheduledEnd = new Date(meeting.scheduled_end);
      const now = new Date();
      const timeUntilEnd = scheduledEnd.getTime() - now.getTime();

      if (timeUntilEnd > 0) {
        const timer = setTimeout(async () => {
          toast({
            title: "Meeting time has elapsed",
            description: "This meeting has now ended.",
          });
          await handleEndCall(true); // Pass true to indicate it's an automatic end
        }, timeUntilEnd);

        return () => clearTimeout(timer);
      }
    }
  }, [meeting]);

  const toggleVideo = () => {
    if (webrtcManagerRef.current) {
      const newState = !isVideoOn;
      webrtcManagerRef.current.toggleVideo(newState);
      setIsVideoOn(newState);
    }
  };

  const toggleAudio = () => {
    if (webrtcManagerRef.current) {
      const newState = !isAudioOn;
      webrtcManagerRef.current.toggleAudio(newState);
      setIsAudioOn(newState);
    }
  };

  const handleEndCall = async (isAutoEnd = false) => {
    if (webrtcManagerRef.current) {
      await webrtcManagerRef.current.cleanup();
    }
    if (isAutoEnd && meetingId) {
      await supabase.from("meetings").update({ status: 'completed' }).eq('id', meetingId);
    }
    navigate("/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading meeting...</p>
        </div>
      </div>
    );
  }

  const participantArray = Array.from(participants.values());
  const totalParticipants = participantArray.length + 1; // +1 for current user

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-soft">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{meeting?.title}</h1>
            <p className="text-xs text-muted-foreground">
              {meeting?.is_confidential && "🔒 Confidential Meeting"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{totalParticipants}</span>
          </div>
        </div>
      </header>

      {/* Main Meeting Area */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Grid */}
            <div className={`grid gap-4 ${totalParticipants === 1 ? 'grid-cols-1' : totalParticipants === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
            {/* Local Video */}
            <Card className="relative overflow-hidden bg-black aspect-video shadow-medium">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!isVideoOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-primary">
                  <div className="w-20 h-20 rounded-full bg-card flex items-center justify-center">
                    <span className="text-2xl font-bold text-foreground">
                      {currentUser?.full_name?.charAt(0) || "Y"}
                    </span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                <span className="text-white text-sm">You {!isAudioOn && "🔇"}</span>
              </div>
            </Card>

            {/* Remote Videos */}
            {participantArray.map((participant) => (
              <Card key={participant.userId} className="relative overflow-hidden bg-black aspect-video shadow-medium">
                <video
                  ref={(el) => {
                    if (el) {
                      remoteVideoRefs.current.set(participant.userId, el);
                      if (participant.stream) {
                        el.srcObject = participant.stream;
                      }
                    }
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!participant.stream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-primary">
                    <div className="w-20 h-20 rounded-full bg-card flex items-center justify-center">
                      <span className="text-2xl font-bold text-foreground">
                        {participant.userName?.charAt(0) || "U"}
                      </span>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                  <span className="text-white text-sm">{participant.userName}</span>
                </div>
              </Card>
            ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              {/* Video Reactions */}
              {currentUser && (
                <VideoReactions
                  meetingId={meetingId!}
                  currentUserId={currentUser.id}
                  currentUserName={currentUser.full_name || 'User'}
                />
              )}
              
          <Button
            variant={isAudioOn ? "outline" : "destructive"}
            size="lg"
            className="rounded-full w-14 h-14"
            onClick={toggleAudio}
          >
            {isAudioOn ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}
          </Button>
          <Button
            variant={isVideoOn ? "outline" : "destructive"}
            size="lg"
            className="rounded-full w-14 h-14"
            onClick={toggleVideo}
          >
            {isVideoOn ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="rounded-full w-14 h-14 bg-destructive hover:bg-destructive/90"
            onClick={() => handleEndCall()}
          >
            <PhoneOff className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full w-14 h-14"
          >
            <Settings className="w-5 h-5" />
          </Button>
            </div>

            {/* Participants List */}
            <Card className="p-4 shadow-soft">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Participants ({totalParticipants})</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
                    <span className="text-sm font-bold text-white">
                      {currentUser?.full_name?.charAt(0) || "Y"}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">You (Host)</p>
                  </div>
                  <div className="flex gap-1">
                    {isAudioOn ? (
                      <Mic className="w-4 h-4 text-primary" />
                    ) : (
                      <MicOff className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                </div>
                {participantArray.map((participant) => (
                  <div key={participant.userId} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <span className="text-sm font-bold text-white">
                        {participant.userName?.charAt(0) || "U"}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{participant.userName}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Chat Section */}
          <div className="lg:col-span-1">
            {currentUser && (
              <MeetingChat 
                meetingId={meetingId!}
                currentUserId={currentUser.id}
                currentUserName={currentUser.full_name || 'User'}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Meeting;
