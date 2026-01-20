import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TermsModal } from "@/components/TermsModal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { GraduationCap, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Extend schema to ensure passwords match for registration
const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string(),
  email: z.string().email().refine(val => val.endsWith(".edu"), {
    message: "Must use a valid .edu email address"
  })
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function AuthPage({ mode = "login" }: { mode?: "login" | "register" }) {
  const { loginMutation, registerMutation, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // --- RECOVERY STATE ---
  const [showForgotUsername, setShowForgotUsername] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "code">("email");
  const [resetEmail, setResetEmail] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);

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

  // Prevent flash of content if already logged in
  if (user) {
    setLocation("/dashboard");
    return null;
  }

  const isLogin = mode === "login";

  // --- RECOVERY HANDLERS ---
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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left side - Visual */}
      <div className="hidden lg:flex flex-col bg-primary text-primary-foreground p-12 justify-between relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 font-display text-2xl font-bold mb-12">
            <GraduationCap className="h-8 w-8" />
            <span>CampusShare</span>
          </div>
          <h1 className="text-5xl font-display font-bold leading-tight mb-6">
            Access the campus marketplace.
          </h1>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Join thousands of students renting, sharing, and saving money on gear every day.
          </p>
        </div>

        <div className="relative z-10 text-sm text-primary-foreground/60">
          © {new Date().getFullYear()} CampusShare Inc.
        </div>

        {/* Decor */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Right side - Form */}
      <div className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex justify-center mb-8">
            <div className="flex items-center gap-2 font-display text-2xl font-bold text-primary">
              <GraduationCap className="h-8 w-8" />
              <span>CampusShare</span>
            </div>
          </div>

          <Card className="border-none shadow-none lg:border lg:shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">
                {isLogin ? "Welcome back" : "Create an account"}
              </CardTitle>
              <CardDescription>
                {isLogin 
                  ? "Enter your credentials to access your account" 
                  : "Enter your details to get started with CampusShare"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLogin ? (
                <LoginForm 
                    onSubmit={(data) => loginMutation.mutate(data)} 
                    isLoading={loginMutation.isPending} 
                    onForgotUsername={() => setShowForgotUsername(true)}
                    onForgotPassword={() => setShowForgotPassword(true)}
                />
              ) : (
                <RegisterForm onSubmit={(data) => registerMutation.mutate(data)} isLoading={registerMutation.isPending} />
              )}
            </CardContent>
            <CardFooter className="flex justify-center border-t p-6">
              <p className="text-sm text-muted-foreground">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <Link href={isLogin ? "/register" : "/login"} className="text-primary font-semibold hover:underline">
                  {isLogin ? "Sign up" : "Log in"}
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* --- RECOVERY MODALS --- */}
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

function LoginForm({ 
    onSubmit, 
    isLoading, 
    onForgotUsername, 
    onForgotPassword 
}: { 
    onSubmit: (data: any) => void, 
    isLoading: boolean, 
    onForgotUsername: () => void, 
    onForgotPassword: () => void 
}) {
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="jdoe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* --- FORGOT BUTTONS --- */}
        <div className="flex justify-between items-center text-xs px-1">
            <button type="button" onClick={onForgotUsername} className="text-muted-foreground hover:text-primary hover:underline">
                Forgot Username?
            </button>
            <button type="button" onClick={onForgotPassword} className="text-muted-foreground hover:text-primary hover:underline">
                Forgot Password?
            </button>
        </div>
        {/* ---------------------- */}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Log In
        </Button>
      </form>
    </Form>
  );
}

function RegisterForm({ onSubmit, isLoading }: { onSubmit: (data: any) => void, isLoading: boolean }) {
  // State for Terms Checkbox
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", password: "", confirmPassword: "", email: "", name: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
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
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>University Email (.edu)</FormLabel>
              <FormControl>
                <Input placeholder="john@university.edu" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="jdoe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* --- UPDATED TERMS CHECKBOX --- */}
        <div className="flex items-start space-x-2 py-2">
          <Checkbox 
            id="terms" 
            checked={agreedToTerms}
            onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
          />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              I agree to the{" "}
              <span className="text-primary hover:underline cursor-pointer" onClick={() => setShowTerms(true)}>
                Terms of Service & Liability Waiver
              </span>
            </Label>
            <p className="text-xs text-muted-foreground">
              You must accept the liability waiver to join.
            </p>
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={isLoading || !agreedToTerms} // Disable if not checked
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create Account
        </Button>
      </form>
      <TermsModal open={showTerms} onOpenChange={setShowTerms} />
    </Form>
  );
}
