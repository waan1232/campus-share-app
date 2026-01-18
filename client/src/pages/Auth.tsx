import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TermsModal } from "@/components/TermsModal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const { loginMutation, registerMutation, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // --- STATE FOR FORGOT PASSWORD/USERNAME ---
  const [showForgotUsername, setShowForgotUsername] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "code">("email");
  const [resetEmail, setResetEmail] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // --- STATE FOR TERMS & CONDITIONS ---
  const [showTerms, setShowTerms] = useState(false);

  // --- REDIRECT LOGIC ---
  useEffect(() => {
    if (user) {
      if (user.isVerified) {
        setLocation("/dashboard");
      } else {
        setLocation("/verify");
      }
    }
  }, [user, setLocation]);

  // Prevent flash if logged in
  if (user) return null;

  // --- FORMS ---
  const loginForm = useForm({
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { username: "", password: "", name: "", email: "", terms: false },
  });

  // --- HANDLERS FOR RECOVERY ---
  
  // 1. Forgot Username
  const handleRecoverUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get("email") as string;
    
    setRecoveryLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-username", { email });
      toast({ title: "Email Sent", description: "If an account exists, we sent the username." });
      setShowForgotUsername(false);
    } catch (err) {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setRecoveryLoading(false);
    }
  };

  // 2. Forgot Password - Step 1 (Send Code)
  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get("email") as string;
    
    setRecoveryLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email });
      setResetEmail(email);
      setResetStep("code"); 
      toast({ title: "Code Sent", description: "Check your email for the reset code." });
    } catch (err) {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setRecoveryLoading(false);
    }
  };

  // 3. Forgot Password - Step 2 (Confirm Reset)
  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const code = formData.get("code") as string;
    const newPassword = formData.get("newPassword") as string;

    setRecoveryLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { email: resetEmail, code, newPassword });
      toast({ title: "Success", description: "Password reset! You can now log in." });
      setShowForgotPassword(false);
      setResetStep("email");
    } catch (err) {
      toast({ title: "Error", description: "Invalid code or email.", variant: "destructive" });
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold font-display text-center">Welcome to CampusShare</CardTitle>
          <CardDescription className="text-center">
            The marketplace for college students.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            {/* --- LOGIN TAB --- */}
            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* RECOVERY BUTTONS */}
                  <div className="flex justify-between items-center text-xs px-1">
                      <button type="button" onClick={() => setShowForgotUsername(true)} className="text-muted-foreground hover:text-primary hover:underline">
                          Forgot Username?
                      </button>
                      <button type="button" onClick={() => setShowForgotPassword(true)} className="text-muted-foreground hover:text-primary hover:underline">
                          Forgot Password?
                      </button>
                  </div>

                  <Button className="w-full" type="submit" disabled={loginMutation.isPending}>
                    {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Login
                  </Button>
                </form>
              </Form>
            </TabsContent>

            {/* --- REGISTER TAB --- */}
            <TabsContent value="register">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={registerForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>College Email</FormLabel>
                        <FormControl>
                          <Input placeholder="john@college.edu" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="johndoe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Terms Checkbox */}
                  <FormField
                    control={registerForm.control}
                    name="terms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            I agree to the{" "}
                            <span 
                              className="text-primary hover:underline cursor-pointer"
                              onClick={() => setShowTerms(true)}
                            >
                              Terms & Conditions
                            </span>
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <Button className="w-full" type="submit" disabled={registerMutation.isPending}>
                    {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* --- MODALS --- */}
      
      {/* 1. Terms Modal */}
      <TermsModal open={showTerms} onOpenChange={setShowTerms} />

      {/* 2. Forgot Username Modal */}
      <Dialog open={showForgotUsername} onOpenChange={setShowForgotUsername}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Recover Username</DialogTitle>
                <DialogDescription>Enter your email and we'll send your username to you.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRecoverUsername} className="space-y-4">
                <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input name="email" type="email" required placeholder="you@college.edu" />
                </div>
                <Button type="submit" className="w-full" disabled={recoveryLoading}>
                    {recoveryLoading ? "Sending..." : "Send Username"}
                </Button>
            </form>
        </DialogContent>
      </Dialog>

      {/* 3. Forgot Password Modal */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reset Password</DialogTitle>
                <DialogDescription>
                    {resetStep === 'email' 
                        ? "Enter your email to receive a reset code." 
                        : "Enter the code from your email and a new password."}
                </DialogDescription>
            </DialogHeader>
            
            {resetStep === 'email' ? (
                <form onSubmit={handleResetRequest} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input name="email" type="email" required placeholder="you@college.edu" />
                    </div>
                    <Button type="submit" className="w-full" disabled={recoveryLoading}>
                        {recoveryLoading ? "Sending..." : "Send Reset Code"}
                    </Button>
                </form>
            ) : (
                <form onSubmit={handleResetConfirm} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Reset Code</Label>
                        <Input name="code" placeholder="123456" required />
                    </div>
                    <div className="space-y-2">
                        <Label>New Password</Label>
                        <Input name="newPassword" type="password" required />
                    </div>
                    <Button type="submit" className="w-full" disabled={recoveryLoading}>
                        {recoveryLoading ? "Updating..." : "Set New Password"}
                    </Button>
                </form>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
