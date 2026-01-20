import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // New Import
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar"; // New Import
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"; // New Import
import { 
  Loader2, Send, Search, MessageSquareOff, Trash2, Check, CheckCheck, 
  ArrowLeft, X, CheckCircle2, CalendarDays, ExternalLink, DollarSign 
} from "lucide-react";
import { format } from "date-fns"; // New Import

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  sent_at: string;
  read: boolean;
  sender_name: string;
  receiver_name: string;
  item_id?: number;
  item_title?: string;
  item_image?: string;
  offer_price?: number;
  offer_status?: 'none' | 'pending' | 'accepted' | 'rejected';
  start_date?: string;
  end_date?: string;
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

  // --- NEW: OFFER STATE ---
  const [isOfferOpen, setIsOfferOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerDates, setOfferDates] = useState<{ from: Date; to: Date } | undefined>();

  const { data: rawMessages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    refetchInterval: 3000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (senderId: number) => apiRequest("POST", "/api/messages/mark-read", { senderId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/messages"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (otherUserId: number) => apiRequest("DELETE", `/api/messages/${otherUserId}`),
    onSuccess: () => {
      toast({ title: "Conversation deleted" });
      setSelectedUserId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  const updateOfferMutation = useMutation({
    mutationFn: async ({ msgId, status }: { msgId: number, status: 'accepted' | 'rejected' }) => {
      await apiRequest("PATCH", `/api/messages/${msgId}/offer`, { status });
    },
    onSuccess: (_, variables) => {
      const text = variables.status === 'accepted' ? "Offer Accepted! Rental created." : "Offer Declined.";
      toast({ title: text });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      // Also update rentals so it shows up in dashboard immediately
      queryClient.invalidateQueries({ queryKey: ["/api/rentals"] });
    },
  });

  // --- UPDATED SEND MESSAGE MUTATION (HANDLES TEXT OR OFFERS) ---
  const sendMessageMutation = useMutation({
    mutationFn: async (data: any) => {
      // If passing data directly (offer), use it. Otherwise use state (text message).
      const payload = data || { receiverId: selectedUserId, content: newMessage };
      await apiRequest("POST", "/api/messages", payload);
    },
    onSuccess: () => {
      setNewMessage("");
      // Clear offer state
      setOfferPrice("");
      setOfferDates(undefined);
      setIsOfferOpen(false); 
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  const handleSendOffer = () => {
    if (!offerPrice || !selectedUserId || !offerDates?.from || !offerDates?.to) {
        toast({ title: "Missing Info", description: "Please enter a price and select dates.", variant: "destructive" });
        return;
    }

    // Try to find the item context from previous messages
    const activeConv = conversations.find(c => c.userId === selectedUserId);
    const lastItemMsg = activeConv?.messages.findLast((m: Message) => m.item_id);
    const itemId = lastItemMsg?.item_id;

    if (!itemId) {
        toast({ title: "No Item Context", description: "We couldn't determine which item this offer is for. Please go to the item page and click 'Message Owner' first.", variant: "destructive" });
        return;
    }

    sendMessageMutation.mutate({
      receiverId: selectedUserId,
      content: `I'd like to rent this for $${offerPrice} total.`,
      itemId: itemId,
      offerPrice: Math.round(parseFloat(offerPrice) * 100), // Convert to cents
      startDate: offerDates.from,
      endDate: offerDates.to
    });
  };

  useEffect(() => {
    if (selectedUserId) markReadMutation.mutate(selectedUserId);
  }, [selectedUserId, rawMessages]);

  const conversations = useMemo(() => {
    if (!rawMessages || !user) return [];
    const groups: Record<number, Conversation> = {};

    rawMessages.forEach((msg) => {
      const isMe = msg.sender_id === user.id;
      const otherId = isMe ? msg.receiver_id : msg.sender_id;
      const otherName = isMe ? msg.receiver_name : msg.sender_name;

      if (!groups[otherId]) {
        groups[otherId] = { userId: otherId, userName: otherName, lastMessage: "", timestamp: "", unreadCount: 0, messages: [] };
      }
      
      groups[otherId].messages.push(msg);
      if (!isMe && !msg.read) groups[otherId].unreadCount++;
    });

    return Object.values(groups)
      .map(group => {
        group.messages.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
        const lastMsg = group.messages[group.messages.length - 1];
        group.lastMessage = lastMsg.offer_price ? `Rental Request: ${formatCurrency(lastMsg.offer_price)}` : lastMsg.content;
        group.timestamp = lastMsg.sent_at;
        return group;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [rawMessages, user]);

  const activeConversation = conversations.find(c => c.userId === selectedUserId);

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="container py-4 h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-2">
        <Link href="/dashboard">
          <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[350px_1fr] gap-6 flex-1 overflow-hidden">
        {/* Sidebar */}
        <Card className={cn("flex flex-col h-full overflow-hidden border-border/60 shadow-sm", selectedUserId ? "hidden md:flex" : "flex")}>
          <div className="p-4 border-b bg-muted/30">
            <h2 className="font-display font-bold text-xl mb-4">Messages</h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search chats..." className="pl-9 bg-background" />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {conversations.length === 0 ? <div className="p-8 text-center text-muted-foreground">No conversations yet.</div> : (
              <div className="flex flex-col p-2 gap-1">
                {conversations.map((chat) => (
                  <div key={chat.userId} onClick={() => setSelectedUserId(chat.userId)} className={cn("group flex items-center gap-3 p-3 rounded-lg text-left transition-all hover:bg-muted/50 cursor-pointer relative", selectedUserId === chat.userId && "bg-primary/10")}>
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarFallback className={cn(selectedUserId === chat.userId ? "bg-primary text-primary-foreground" : "bg-muted")}>{chat.userName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="font-semibold text-sm truncate">{chat.userName}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className={cn("text-xs truncate max-w-[180px]", chat.unreadCount > 0 ? "font-bold text-foreground" : "text-muted-foreground")}>{chat.lastMessage}</p>
                        {chat.unreadCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">{chat.unreadCount}</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="absolute right-2 top-8 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); if(confirm("Delete conversation?")) deleteMutation.mutate(chat.userId); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Chat Area */}
        <Card className={cn("flex-col h-full overflow-hidden border-border/60 shadow-sm", selectedUserId ? "flex" : "hidden md:flex")}>
          {activeConversation ? (
            <>
              <div className="p-4 border-b bg-background flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="md:hidden mr-1" onClick={() => setSelectedUserId(null)}><ArrowLeft className="h-5 w-5" /></Button>
                    <Avatar className="h-9 w-9 border"><AvatarFallback className="bg-primary/10 text-primary">{activeConversation.userName.charAt(0)}</AvatarFallback></Avatar>
                    <div><h3 className="font-bold text-sm">{activeConversation.userName}</h3><p className="text-xs text-green-600 font-medium">Online</p></div>
                </div>

                {/* --- NEW: MAKE OFFER BUTTON --- */}
                <Dialog open={isOfferOpen} onOpenChange={setIsOfferOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-2">
                        <DollarSign className="h-4 w-4" /> Make Offer
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Make a Rental Offer</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Total Price ($)</Label>
                            <Input 
                                type="number" 
                                placeholder="50.00" 
                                value={offerPrice}
                                onChange={(e) => setOfferPrice(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Rental Dates</Label>
                            <div className="border rounded-md p-2 flex justify-center">
                                <Calendar
                                    mode="range"
                                    selected={offerDates}
                                    onSelect={setOfferDates}
                                    numberOfMonths={1}
                                    defaultMonth={new Date()}
                                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                />
                            </div>
                        </div>
                        <Button className="w-full" onClick={handleSendOffer} disabled={sendMessageMutation.isPending}>
                            {sendMessageMutation.isPending ? "Sending..." : "Send Offer"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  {/* ----------------------------- */}
              </div>
              
              <ScrollArea className="flex-1 p-4 bg-slate-50/50">
                <div className="flex flex-col gap-6">
                  {activeConversation.messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    const isOffer = msg.offer_price && msg.offer_price > 0;
                    
                    // Logic to calculate days and total
                    const days = msg.start_date && msg.end_date 
                      ? Math.ceil((new Date(msg.end_date).getTime() - new Date(msg.start_date).getTime()) / (1000 * 60 * 60 * 24)) 
                      : 0;
                    const totalCost = (msg.offer_price || 0) * days; // Logic adjusted: offer_price IS the total in DB, no need to multiply if stored as total

                    return (
                      <div key={msg.id} className={cn("flex w-full flex-col gap-1", isMe ? "items-end" : "items-start")}>
                        
                        {/* --- THE OFFER CARD (Fixed Styling) --- */}
                        {(msg.item_id || msg.offer_price) && (
                          <div className={cn(
                            "mb-1 w-[280px] rounded-xl overflow-hidden shadow-sm border",
                            "bg-white" // Always white background for the card for cleanliness
                          )}>
                            {/* Header / Title Link */}
                            {msg.item_id && (
                              <Link href={`/items/${msg.item_id}`}>
                                <div className="flex items-center gap-3 p-3 border-b bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors">
                                  {msg.item_image ? (
                                    <img src={msg.item_image} className="w-10 h-10 rounded-md object-cover border" />
                                  ) : (
                                    <div className="w-10 h-10 bg-gray-200 rounded-md" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate text-primary flex items-center gap-1">
                                      {msg.item_title} <ExternalLink className="h-3 w-3 opacity-50" />
                                    </p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">View Item</p>
                                  </div>
                                </div>
                              </Link>
                            )}

                            {/* Offer Details Body */}
                            {msg.offer_price ? (
                              <div className="p-3 space-y-3">
                                <div className="flex justify-between items-baseline">
                                  <span className="text-xs text-muted-foreground">Proposed Deal</span>
                                  <span className="font-semibold text-sm">{formatCurrency(msg.offer_price)}<span className="text-xs font-normal text-muted-foreground"> Total</span></span>
                                </div>
                                
                                {days > 0 && (
                                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-slate-50 p-2 rounded">
                                    <CalendarDays className="h-4 w-4 mt-0.5" />
                                    <div>
                                      <p>{new Date(msg.start_date!).toLocaleDateString()} - {new Date(msg.end_date!).toLocaleDateString()}</p>
                                      <p className="font-medium text-black">{days} Days</p>
                                    </div>
                                  </div>
                                )}

                                {/* Status Bar */}
                                <div className="pt-2">
                                  {msg.offer_status === 'accepted' && (
                                    <div className="w-full py-2 bg-green-100 text-green-700 rounded text-center text-xs font-bold flex items-center justify-center gap-2">
                                      <CheckCircle2 className="h-4 w-4" /> ACCEPTED
                                    </div>
                                  )}
                                  {msg.offer_status === 'rejected' && (
                                    <div className="w-full py-2 bg-red-100 text-red-700 rounded text-center text-xs font-bold flex items-center justify-center gap-2">
                                      <X className="h-4 w-4" /> DECLINED
                                    </div>
                                  )}
                                  {msg.offer_status === 'pending' && !isMe && (
                                    <div className="grid grid-cols-2 gap-2">
                                      <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white h-8" onClick={() => updateOfferMutation.mutate({ msgId: msg.id, status: 'accepted' })}>Accept</Button>
                                      <Button size="sm" variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 h-8" onClick={() => updateOfferMutation.mutate({ msgId: msg.id, status: 'rejected' })}>Decline</Button>
                                    </div>
                                  )}
                                  {msg.offer_status === 'pending' && isMe && (
                                    <div className="w-full py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded text-center text-xs font-medium">
                                      Waiting for response...
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="p-2 text-center text-xs text-muted-foreground italic bg-slate-50">Mentioned this item</div>
                            )}
                          </div>
                        )}

                        {/* --- THE TEXT MESSAGE BUBBLE --- */}
                        <div className={cn(
                          "px-4 py-2 text-sm shadow-sm max-w-[85%]",
                          isMe ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm" : "bg-white border border-border/50 rounded-2xl rounded-tl-sm"
                        )}>
                          {msg.content}
                          <div className={cn("flex items-center gap-1 text-[10px] justify-end opacity-70 mt-1", isMe ? "text-primary-foreground/80" : "text-muted-foreground")}>
                            <span>{new Date(msg.sent_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                            {isMe && (msg.read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="p-4 bg-background border-t">
                <form onSubmit={(e) => { e.preventDefault(); sendMessageMutation.mutate(null); }} className="flex gap-2">
                  <Input placeholder="Type a message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 rounded-full bg-muted/30 border-muted-foreground/20" />
                  <Button type="submit" size="icon" className="rounded-full h-10 w-10 shrink-0 shadow-sm" disabled={!newMessage.trim() || sendMessageMutation.isPending}><Send className="h-4 w-4" /></Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-slate-50/50"><MessageSquareOff className="h-12 w-12 mb-4 opacity-20" /><p>Select a conversation to start chatting</p></div>
          )}
        </Card>
      </div>
    </div>
  );
}
