import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageDialog } from "@/components/MessageDialog";
import { Loader2, User, Mail } from "lucide-react";

// 1. Define the shape of a Message right here (Self-contained)
interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  sent_at: string;
  read: boolean;
  sender_name: string;
  receiver_name: string;
}

export default function InboxPage() {
  // 2. Fetch messages
  const { data: messages, isLoading, error } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
  });

  // 3. Loading State
  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 4. Error State (Prevents White Screen if API fails)
  if (error) {
    return (
      <div className="container py-10">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error loading inbox: </strong>
          <span className="block sm:inline">{(error as Error).message}</span>
        </div>
      </div>
    );
  }

  // 5. Empty State
  if (!messages || messages.length === 0) {
    return (
      <div className="container py-10 max-w-4xl">
        <h1 className="text-3xl font-display font-bold mb-6">Inbox</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4">
            <div className="bg-muted p-4 rounded-full">
              <Mail className="h-8 w-8" />
            </div>
            <p>No messages yet. Start renting to chat!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 6. The List (Safe Render)
  return (
    <div className="container py-10 max-w-4xl">
      <h1 className="text-3xl font-display font-bold mb-6">Inbox</h1>
      <div className="grid gap-4">
        {messages.map((msg) => (
          <Card key={msg.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6 flex flex-col sm:flex-row gap-4 justify-between items-start">
              <div className="grid gap-1">
                <div className="flex items-center gap-2 font-medium text-lg">
                  <User className="h-4 w-4 text-primary" />
                  <span>
                    {/* Logic to show who sent it */}
                    {msg.sender_name} 
                    <span className="text-muted-foreground font-normal text-sm mx-1">to</span> 
                    {msg.receiver_name}
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground mb-2">
                  {new Date(msg.sent_at).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
                
                <div className="text-sm bg-secondary/30 p-3 rounded-lg border border-border/50">
                  {msg.content}
                </div>
              </div>
              
              {/* Reply Button */}
              <div className="shrink-0">
                <MessageDialog 
                  receiverId={msg.sender_id} 
                  trigger={<Button size="sm" variant="secondary">Reply</Button>}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
