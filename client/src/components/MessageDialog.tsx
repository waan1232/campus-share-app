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
import { Loader2, Send, Tag } from "lucide-react";
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
  const [offerPrice, setOfferPrice] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendMessage = useMutation({
    mutationFn: async () => {
      const payload: any = {
        receiverId,
        content,
      };

      // FIX: Always attach item ID if we are on an item page
      if (item) {
        payload.itemId = item.id;
      }

      // Only attach price if they actually checked the box
      if (isOffer && item && offerPrice) {
        // Convert input (dollars) to cents
        payload.offerPrice = Math.round(parseFloat(offerPrice) * 100);
      }

      await apiRequest("POST", "/api/messages", payload);
    },
    onSuccess: () => {
      toast({ title: "Message sent!" });
      setOpen(false);
      setContent("");
      setIsOffer(false);
      setOfferPrice("");
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

        {/* Show context in the modal */}
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
              placeholder={item ? `Hi, is this ${item.title} still available?` : "Type your message..."}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* MAKE OFFER TOGGLE */}
          {item && (
            <div className="space-y-4 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="offer" 
                  checked={isOffer} 
                  onCheckedChange={(checked) => setIsOffer(checked as boolean)} 
                />
                <Label htmlFor="offer" className="font-medium cursor-pointer flex items-center gap-2">
                  <Tag className="h-4 w-4 text-green-600" />
                  Make a Price Offer
                </Label>
              </div>

              {isOffer && (
                <div className="pl-6 animate-in slide-in-from-top-2">
                  <Label htmlFor="price" className="text-xs text-muted-foreground">Your Offer (per day)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                    <Input
                      id="price"
                      type="number"
                      placeholder={String(item.pricePerDay / 100)}
                      className="pl-7"
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Original price: {formatCurrency(item.pricePerDay)}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="submit" disabled={sendMessage.isPending || (isOffer && !offerPrice)}>
              {sendMessage.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {isOffer ? "Send Offer" : "Send Message"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
