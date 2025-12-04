import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const meetingSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(1000).optional(),
  scheduledStart: z.string().min(1, "Start time is required"), // datetime-local format
  duration: z.number().min(5, "Duration must be at least 5 minutes").max(480, "Duration cannot exceed 8 hours"), // Max 8 hours
});

interface CreateMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  onMeetingCreated?: () => void;
}

const CreateMeetingDialog = ({ open, onOpenChange, userId, onMeetingCreated }: CreateMeetingDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledStart, setScheduledStart] = useState(""); // Stores datetime-local string
  const [duration, setDuration] = useState(30); // Default duration in minutes
  const [isConfidential, setIsConfidential] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
  
    setLoading(true);
  
    try {
      const validatedData = meetingSchema.parse({
        title,
        description,
        scheduledStart,
        duration,
      });
  
      const scheduledStartDate = new Date(validatedData.scheduledStart);
      const scheduledEndDate = new Date(scheduledStartDate.getTime() + validatedData.duration * 60000); // Add duration in milliseconds

      // Generate unique meeting link
      const meetingId = crypto.randomUUID();
      const meetingLink = `${window.location.origin}/meeting/${meetingId}`;

      const { error } = await supabase.from("meetings").insert({
        id: meetingId,
        title: validatedData.title,
        description: validatedData.description || null,
        host_id: userId,
        scheduled_start: scheduledStartDate.toISOString(),
        scheduled_end: scheduledEndDate.toISOString(),
        is_confidential: isConfidential,
        requires_approval: requiresApproval,
        status: "scheduled",
        meeting_link: meetingLink,
      });

      if (error) throw error;

      toast({
        title: "Meeting created!",
        description: "Your meeting has been scheduled successfully.",
      });

      onOpenChange(false);
      onMeetingCreated?.();
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create meeting",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setScheduledStart("");
    setDuration(30); // Reset to default duration
    setIsConfidential(true);
    setRequiresApproval(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule New Meeting</DialogTitle>
          <DialogDescription>
            Create a secure video conference for AICTE stakeholders
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title</Label>
            <Input
              id="title"
              placeholder="Monthly Review Meeting"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Meeting agenda and objectives..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start">Start Time</Label>
              <Input
                id="start"
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2"> {/* New Duration field */}
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                min={5} // Minimum duration
                max={480} // Maximum duration (8 hours)
                required
              />
            </div>
          </div>
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="confidential">Confidential Meeting</Label>
                <p className="text-sm text-muted-foreground">
                  End-to-end encryption enabled
                </p>
              </div>
              <Switch
                id="confidential"
                checked={isConfidential}
                onCheckedChange={setIsConfidential}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="approval">Require Approval</Label>
                <p className="text-sm text-muted-foreground">
                  Participants need host approval to join
                </p>
              </div>
              <Switch
                id="approval"
                checked={requiresApproval}
                onCheckedChange={setRequiresApproval}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-primary hover:opacity-90"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Meeting"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateMeetingDialog;