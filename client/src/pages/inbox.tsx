import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter"; // Import Link for navigation
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Loader2, 
  Send, 
  Search, 
  MessageSquareOff, 
  Trash2, 
  Check, 
  CheckCheck,
  ArrowLeft // Import ArrowLeft icon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  unreadCount: number;
  messages: Message[];
}

export default function InboxPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");

  // 1. Fetch messages
  const { data: rawMessages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    refetchInterval: 3000,
  });

  // 2. Mark as Read Mutation
  const markReadMutation = useMutation({
    mutationFn: async (senderId: number) => {
      await apiRequest("POST", "/api/messages/mark-read", { senderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  // 3. Delete Conversation Mutation
  const deleteMutation = useMutation({
    mutationFn: async (otherUserId: number) => {
      await apiRequest("DELETE", `/api/messages/${otherUserId}`);
    },
    onSuccess: () => {
      toast({ title: "Conversation deleted" });
      setSelectedUserId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  // 4. Auto-mark read when opening chat
  useEffect(() => {
    if (selectedUserId) {
      markReadMutation.mutate(selectedUserId);
    }
  }, [selectedUserId, rawMessages]);

  // 5. Group messages
  const conversations = useMemo(() => {
    if (!rawMessages || !user) return [];
    
    const groups: Record<number, Conversation> = {};

    rawMessages.forEach((msg) => {
      const isMe = msg.sender_id === user.id;
      const otherId = isMe ? msg.receiver_id : msg.sender_id;
      const otherName = isMe ? msg.receiver_name : msg.sender_name;

      if (!groups[otherId]) {
        groups[otherId] = {
          userId: otherId,
          userName: otherName,
          lastMessage: "",
          timestamp: "",
          unreadCount: 0,
          messages: [],
        };
      }
      
      groups[otherId].messages.push(msg);
      
      if (!isMe && !msg.read) {
        groups[otherId].unreadCount++;
      }
    });

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

  // Note: I removed the auto-select effect so mobile users start on the list view
  
  const activeConversation = conversations.find(c => c.userId === selectedUserId);

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
      </div>
    );
  }

  return (
    <div className="container py-4 h-[calc(100vh-4rem)] flex flex-col">
      {/* GLOBAL BACK BUTTON */}
      <div className="mb-2">
        <Link href="/dashboard">
          <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[350px_1fr] gap-6 flex-1 overflow-hidden">
        
        {/* LEFT SIDEBAR - Hidden on mobile if a chat is selected */}
        <Card className={cn(
          "flex flex-col h-full overflow-hidden border-border/60 shadow-sm",
          selectedUserId ? "hidden md:flex" : "flex"
        )}>
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
                  <div
                    key={chat.userId}
                    className={cn(
                      "group flex items-center gap-3 p-3 rounded-lg text-left transition-all hover:bg-muted/50 cursor-pointer relative",
                      selectedUserId === chat.userId && "bg-primary/10 hover:bg-primary/15"
                    )}
                    onClick={() => setSelectedUserId(chat.userId)}
                  >
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarFallback className={cn(selectedUserId === chat.userId ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        {chat.userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={cn("text-sm truncate", chat.unreadCount > 0 ? "font-bold text-foreground" : "font-semibold")}>
                          {chat.userName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className={cn("text-xs truncate max-w-[180px]", chat.unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground opacity-80")}>
                          {chat.lastMessage}
                        </p>
                        {chat.unreadCount > 0 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-8 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        if(confirm("Delete this conversation permanently?")) {
                          deleteMutation.mutate(chat.userId);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* RIGHT SIDE: CHAT - Hidden on mobile if NO chat is selected */}
        <Card className={cn(
          "flex-col h-full overflow-hidden border-border/60 shadow-sm",
          selectedUserId ? "flex" : "hidden md:flex"
        )}>
          {activeConversation ? (
            <>
              <div className="p-4 border-b bg-background flex items-center gap-3 shadow-sm z-10">
                {/* MOBILE BACK BUTTON */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden mr-1"
                  onClick={() => setSelectedUserId(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>

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
                        <div className={cn("flex items-center gap-1 text-[10px] self-end opacity-70", isMe ? "text-primary-foreground/80" : "text-muted-foreground")}>
                          <span>{new Date(msg.sent_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                          
                          {isMe && (
                            msg.read ? (
                              <CheckCheck className="h-3 w-3" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

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
