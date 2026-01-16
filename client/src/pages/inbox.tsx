import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Send, Search, MessageSquareOff } from "lucide-react";
import { cn } from "@/lib/utils";

// --- TYPES ---
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

interface Conversation {
  userId: number;
  userName: string;
  lastMessage: string;
  timestamp: string;
  messages: Message[];
}

export default function InboxPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");

  // 1. Fetch all raw messages
  const { data: rawMessages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    refetchInterval: 3000, // Auto-refresh every 3s for "real-time" feel
  });

  // 2. Group messages into "Conversations"
  const conversations = useMemo(() => {
    if (!rawMessages || !user) return [];
    
    const groups: Record<number, Conversation> = {};

    rawMessages.forEach((msg) => {
      // Determine who the "other person" is
      const isMe = msg.sender_id === user.id;
      const otherId = isMe ? msg.receiver_id : msg.sender_id;
      const otherName = isMe ? msg.receiver_name : msg.sender_name;

      if (!groups[otherId]) {
        groups[otherId] = {
          userId: otherId,
          userName: otherName,
          lastMessage: "",
          timestamp: "",
          messages: [],
        };
      }
      
      groups[otherId].messages.push(msg);
    });

    // Sort messages inside each group & set preview text
    return Object.values(groups)
      .map(group => {
        group.messages.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
        const lastMsg = group.messages[group.messages.length - 1];
        group.lastMessage = lastMsg.content;
        group.timestamp = lastMsg.sent_at;
        return group;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [rawMessages, user]);

  // 3. Send Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !newMessage.trim()) return;
      await apiRequest("POST", "/api/messages", {
        receiverId: selectedUserId,
        content: newMessage,
      });
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  // Auto-select first conversation on load if none selected
  if (!selectedUserId && conversations.length > 0) {
    setSelectedUserId(conversations[0].userId);
  }

  const activeConversation = conversations.find(c => c.userId === selectedUserId);

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
      </div>
    );
  }

  return (
    <div className="container py-6 h-[calc(100vh-4rem)]">
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[350px_1fr] gap-6 h-full">
        
        {/* --- LEFT SIDEBAR: CONVERSATION LIST --- */}
        <Card className="flex flex-col h-full overflow-hidden border-border/60 shadow-sm">
          <div className="p-4 border-b bg-muted/30">
            <h2 className="font-display font-bold text-xl mb-4">Messages</h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search chats..." className="pl-9 bg-background" />
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground p-4 text-center">
                <MessageSquareOff className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No conversations yet.</p>
              </div>
            ) : (
              <div className="flex flex-col p-2 gap-1">
                {conversations.map((chat) => (
                  <button
                    key={chat.userId}
                    onClick={() => setSelectedUserId(chat.userId)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg text-left transition-all hover:bg-muted/50",
                      selectedUserId === chat.userId && "bg-primary/10 hover:bg-primary/15"
                    )}
                  >
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarFallback className={cn(selectedUserId === chat.userId ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        {chat.userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="font-semibold text-sm truncate">{chat.userName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate font-medium opacity-80">
                        {chat.lastMessage}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* --- RIGHT SIDE: ACTIVE CHAT --- */}
        <Card className="flex flex-col h-full overflow-hidden border-border/60 shadow-sm">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b bg-background flex items-center gap-3 shadow-sm z-10">
                <Avatar className="h-9 w-9 border">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {activeConversation.userName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-sm">{activeConversation.userName}</h3>
                  <p className="text-xs text-green-600 font-medium">Online</p>
                </div>
              </div>

              {/* Messages Area */}
              <ScrollArea className="flex-1 p-4 bg-slate-50/50">
                <div className="flex flex-col gap-4">
                  {activeConversation.messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex w-max max-w-[75%] flex-col gap-1 px-4 py-2.5 text-sm shadow-sm",
                          isMe
                            ? "ml-auto bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                            : "bg-white border border-border/50 rounded-2xl rounded-tl-sm"
                        )}
                      >
                        {msg.content}
                        <span className={cn("text-[10px] self-end opacity-70", isMe ? "text-primary-foreground/80" : "text-muted-foreground")}>
                          {new Date(msg.sent_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="p-4 bg-background border-t">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessageMutation.mutate();
                  }}
                  className="flex gap-2"
                >
                  <Input 
                    placeholder="Type a message..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 rounded-full bg-muted/30 border-muted-foreground/20 focus-visible:ring-primary/20"
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    className="rounded-full h-10 w-10 shrink-0 shadow-sm"
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-slate-50/50">
              <MessageSquareOff className="h-12 w-12 mb-4 opacity-20" />
              <p>Select a conversation to start chatting</p>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
