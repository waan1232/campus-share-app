import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ShieldCheck, Mail, ArrowLeft, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VerifyPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState("");

  // Verify Code Mutation
  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      await apiRequest("POST", "/api/verify-account", { code });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Success!", description: "Your account is now verified." });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid code.",
        variant: "destructive",
      });
    },
  });

  // Resend Email Mutation
  const resendMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/resend-verification");
    },
    onSuccess: () => {
      toast({ title: "Email Sent", description: "Check your inbox (and spam folder)!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not resend email. Try again later.", variant: "destructive" });
    }
  });

  // Logout Mutation (Back Button)
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      setLocation("/login");
    }
  });

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
              We sent a code to <strong>{user?.email}</strong>.
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
          </div>

          <Button 
            className="w-full h-12 text-lg" 
            onClick={() => verifyMutation.mutate(code)}
            disabled={verifyMutation.isPending || code.length < 6}
          >
            {verifyMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
            Verify Account
          </Button>

          <div className="flex justify-between items-center pt-4 border-t">
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back / Logout
            </Button>

            <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => resendMutation.mutate()}
                disabled={resendMutation.isPending}
            >
                {resendMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <RefreshCw className="mr-2 h-4 w-4" />}
                Resend Email
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
