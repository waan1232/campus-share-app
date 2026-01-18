import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // State for Recovery Dialogs
  const [showForgotUsername, setShowForgotUsername] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "code">("email");
  const [resetEmail, setResetEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  const loginForm = useForm({
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { username: "", password: "", name: "", email: "" },
  });

  // Forgot Username Handler
  const handleRecoverUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get("email") as string;
    
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-username", { email });
      toast({ title: "Email Sent", description: "If an account exists, we sent the username." });
      setShowForgotUsername(false);
    } catch (err) {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password Handler (Step 1: Send Code)
  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get("email") as string;
    
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email });
      setResetEmail(email);
      setResetStep("code"); 
      toast({ title: "Code Sent", description: "Check your email for the reset code." });
    } catch (err) {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password Handler (Step 2: Confirm Reset)
  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const code = formData.get("code") as string;
    const newPassword = formData.get("newPassword") as string;

    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { email: resetEmail, code, newPassword });
      toast({ title: "Success", description: "Password reset! You can now log in." });
      setShowForgotPassword(false);
      setResetStep("email");
    } catch (err) {
      toast({ title: "Error", description: "Invalid code or email.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold font-display">Welcome to CampusShare</CardTitle>
            <p className="text-sm text-muted-foreground">
              The marketplace for college students.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

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
                    
                    {/* --- RESTORED BUTTONS IN ORIGINAL LAYOUT --- */}
                    <div className="flex justify-between text-xs text-muted-foreground px-1 mt-1">
                        <button type="button" onClick={() => setShowForgotUsername(true)} className="hover:underline hover:text-primary">
                            Forgot Username?
                        </button>
                        <button type="button" onClick={() => setShowForgotPassword(true)} className="hover:underline hover:text-primary">
                            Forgot Password?
                        </button>
                    </div>
                    {/* ------------------------------------------- */}

                    <Button className="w-full mt-2" type="submit" disabled={loginMutation.isPending}>
                      {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Login
                    </Button>
                  </form>
                </Form>
              </TabsContent>

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
      </div>
      
      {/* Original Gradient Background Section */}
      <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-primary/10 to-primary/5 border-l">
        <div className="max-w-md mx-auto space-y-4 text-center">
          <div className="bg-background/50 backdrop-blur-sm p-8 rounded-2xl border shadow-sm">
            <blockquote className="space-y-2">
              <p className="text-lg font-medium leading-relaxed italic text-foreground/80">
                "CampusShare has made it so easy to find gear for my projects. I saved over $200 last semester by renting instead of buying!"
              </p>
              <footer className="text-sm font-semibold text-primary">— Sarah J., Film Student</footer>
            </blockquote>
          </div>
        </div>
      </div>

      {/* --- FORGOT USERNAME MODAL --- */}
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
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Sending..." : "Send Username"}
                </Button>
            </form>
        </DialogContent>
      </Dialog>

      {/* --- FORGOT PASSWORD MODAL --- */}
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
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Sending..." : "Send Reset Code"}
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
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Updating..." : "Set New Password"}
                    </Button>
                </form>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper Label Component
function Label({ children }: { children: React.ReactNode }) {
    return <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{children}</label>
}
