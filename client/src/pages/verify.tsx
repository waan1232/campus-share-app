import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ShieldCheck, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VerifyPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState("");

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      await apiRequest("POST", "/api/verify-account", { code });
    },
    onSuccess: () => {
      // Force refresh user data to update 'isVerified' status
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Success!", description: "Your account is now verified." });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid code. Please check your console.",
        variant: "destructive",
      });
    },
  });

  // If user is already verified, kick them out of this page
  if (user?.isVerified) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-2 border-primary/10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-display font-bold text-primary">Check your Email</CardTitle>
            <CardDescription className="text-base mt-2">
              We sent a verification code to <strong>{user?.email}</strong>.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Verification Code</label>
            <Input 
              placeholder="123456" 
              className="text-center text-2xl tracking-widest h-14" 
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <p className="text-xs text-muted-foreground text-center">
              (Check your server console for the code simulation)
            </p>
          </div>

          <Button 
            className="w-full h-12 text-lg" 
            onClick={() => verifyMutation.mutate(code)}
            disabled={verifyMutation.isPending || code.length < 6}
          >
            {verifyMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
            Verify Account
          </Button>
          
          <div className="text-center">
             <Button variant="link" size="sm" className="text-muted-foreground" onClick={() => window.location.reload()}>
               I entered the code but nothing happened?
             </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
