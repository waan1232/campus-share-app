import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PayButtonProps {
  rentalId: number;
  title: string;
  pricePerDay: number;
  days: number;
  imageUrl?: string;
  ownerId: number; // <--- NEW REQUIRED PROP
}

export function PayButton({ rentalId, title, pricePerDay, days, imageUrl, ownerId }: PayButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/create-checkout-session", {
        rentalId,
        title,
        price: pricePerDay,
        days,
        image: imageUrl,
        ownerId: ownerId // <--- SENDING OWNER ID TO STRIPE
      });
      
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Payment Error", description: "Could not initialize checkout.", variant: "destructive" });
      setLoading(false);
    }
  };

  const total = pricePerDay * days;

  return (
    <Button onClick={handleCheckout} disabled={loading} size="sm" className="bg-green-600 hover:bg-green-700">
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
      Pay ${total}
    </Button>
  );
}
