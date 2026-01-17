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
  ownerId: number;
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
        price: pricePerDay, // Send raw cents to backend
        days,
        image: imageUrl,
        ownerId: ownerId
      });
      
      const data = await res.json();
      
      // If backend sends an error (like "Owner not onboarded"), show it
      if (!res.ok) {
        throw new Error(data.error || "Failed to create session");
      }
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error(error);
      toast({ 
        title: "Payment Error", 
        description: error.message || "Could not initialize checkout.", 
        variant: "destructive" 
      });
      setLoading(false);
    }
  };

  // FIX: Calculate total in cents, then format for display
  const totalCents = pricePerDay * days;
  const displayAmount = (totalCents / 100).toFixed(2); // Converts 30000 -> "300.00"

  return (
    <Button onClick={handleCheckout} disabled={loading} size="sm" className="bg-green-600 hover:bg-green-700 text-white font-bold">
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
      Pay ${displayAmount}
    </Button>
  );
}
