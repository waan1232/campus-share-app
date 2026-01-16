import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Tag, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface MessageDialogProps {
  receiverId: number;
  trigger: React.ReactNode;
  item?: {
    id: number;
    title: string;
    pricePerDay: number;
    imageUrl: string;
  };
}

export function MessageDialog({ receiverId, trigger, item }: MessageDialogProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isOffer, setIsOffer] = useState(false);
  
  // Offer State
  const [offerPrice, setOfferPrice] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendMessage = useMutation({
    mutationFn: async () => {
      const payload: any = {
        receiverId,
        content,
      };

      // Always attach item ID if we are on an item page (context)
      if (item) {
        payload.itemId = item.id;
      }

      // If making an offer, attach the specific rental details
      if (isOffer && item && offerPrice && startDate && endDate) {
        payload.offerPrice = Math.round(parseFloat(offerPrice) * 100);
        payload.startDate = new Date(startDate).toISOString();
        payload.endDate = new Date(endDate).toISOString();
      }

      await apiRequest("POST", "/api/messages", payload);
    },
    onSuccess: () => {
      toast({ title: "Message sent!" });
      setOpen(false);
      setContent("");
      setIsOffer(false);
      setOfferPrice("");
      setStartDate("");
      setEndDate("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    sendMessage.mutate();
  };

  // Helper to calculate total days for preview
  const days = startDate && endDate 
    ? Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const totalCost = offerPrice ? parseFloat(offerPrice) * 100 * days : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send Message</DialogTitle>
          <DialogDescription>
            Start a conversation with the owner.
          </DialogDescription>
        </DialogHeader>

        {/* Item Context (If coming from an item page) */}
        {item && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-4 border">
            <img 
              src={item.imageUrl} 
              alt={item.title} 
              className="w-12 h-12 rounded object-cover" 
            />
            <div>
              <p className="font-semibold text-sm line-clamp-1">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                Listed at {formatCurrency(item.pricePerDay)}/day
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder={item ? `Hi, I'm interested in renting this for next weekend...` : "Type your message..."}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* MAKE OFFER TOGGLE */}
          {item && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="offer" 
                  checked={isOffer} 
                  onCheckedChange={(checked) => setIsOffer(checked as boolean)} 
                />
                <Label htmlFor="offer" className="font-medium cursor-pointer flex items-center gap-2">
                  <Tag className="h-4 w-4 text-green-600" />
                  Make a Booking Request
                </Label>
              </div>

              {isOffer && (
                <div className="grid gap-4 p-4 bg-slate-50 rounded-lg border animate-in slide-in-from-top-2">
                  
                  {/* Date Pickers */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Start Date</Label>
                      <Input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-white" 
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Date</Label>
                      <Input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-white" 
                      />
                    </div>
                  </div>

                  {/* Price Input */}
                  <div className="space-y-1">
                    <Label className="text-xs">Offer Price (Per Day)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                      <Input
                        id="price"
                        type="number"
                        placeholder={String(item.pricePerDay / 100)}
                        className="pl-7 bg-white"
                        value={offerPrice}
                        onChange={(e) => setOfferPrice(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Total Calculation */}
                  {days > 0 && offerPrice && (
                    <div className="text-center text-sm font-semibold text-primary pt-2 border-t mt-2 flex justify-between items-center">
                      <span>Total ({days} days):</span>
                      <span className="text-lg">{formatCurrency(totalCost)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button 
              type="submit" 
              disabled={sendMessage.isPending || (isOffer && (!offerPrice || !startDate || !endDate))}
            >
              {sendMessage.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {isOffer ? "Send Request" : "Send Message"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
