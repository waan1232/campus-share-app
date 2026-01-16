import { useQuery } from "@tanstack/react-query";
import { Message } from "@shared/schema"; // Assuming you have a schema, otherwise define interface locally
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageDialog } from "@/components/MessageDialog";
import { Loader2, User } from "lucide-react";

// Local interface if not in shared schema yet
interface MessageWithUser extends Message {
  sender_name: string;
  receiver_name: string;
}

export default function InboxPage() {
  const { data: messages, isLoading } = useQuery<MessageWithUser[]>({
    queryKey: ["/api/messages"],
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle>Inbox</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-10 text-muted-foreground">
            No messages yet. Start renting to chat!
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Inbox</h1>
      <div className="grid gap-4">
        {messages.map((msg) => (
          <Card key={msg.id} className="overflow-hidden">
            <div className="p-6 flex flex-col sm:flex-row gap-4 justify-between items-start">
              <div className="grid gap-1">
                <div className="flex items-center gap-2 font-medium">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {/* Show the name of the OTHER person */}
                  <span>
                    {msg.sender_id === msg.receiver_id ? "Me" : msg.sender_name} 
                    <span className="text-muted-foreground font-normal"> to </span> 
                    {msg.receiver_name}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(msg.sent_at || Date.now()).toLocaleString()}
                </p>
                <div className="mt-2 text-sm bg-muted/50 p-3 rounded-md">
                  {msg.content}
                </div>
              </div>
              
              {/* Reply Button */}
              <MessageDialog 
                receiverId={msg.sender_id} 
                trigger={<Button size="sm">Reply</Button>}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
