import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Lock, 
  ShieldCheck, 
  CreditCard, 
  Bell, 
  LogOut, 
  ArrowLeft,
  Camera,
  LayoutDashboard,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AccountPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("profile");
  
  // Form States
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Update Profile Mutation
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/user", { name, email });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: () => toast({ title: "Failed to update profile", variant: "destructive" })
  });

  // Change Password Mutation
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (password !== confirmPassword) throw new Error("Passwords do not match");
      await apiRequest("PATCH", "/api/user/password", { newPassword: password });
    },
    onSuccess: () => {
      toast({ title: "Password changed successfully" });
      setPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" })
  });

  if (!user) return null;

  const tabs = [
    { id: "profile", label: "Edit Profile", icon: User },
    { id: "security", label: "Security", icon: Lock },
    { id: "billing", label: "Billing & Payouts", icon: CreditCard },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      
      {/* --- HERO HEADER --- */}
      <div className="relative h-48 bg-gradient-to-r from-primary to-blue-600 overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        <div className="container h-full flex items-center relative z-10">
           <Link href="/dashboard">
            <Button variant="ghost" className="text-white hover:bg-white/20">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
           </Link>
        </div>
      </div>

      <div className="container max-w-5xl -mt-20 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
          
          {/* --- LEFT COLUMN: ID CARD --- */}
          <div className="space-y-6">
            <Card className="overflow-hidden border-none shadow-xl">
              <CardContent className="p-6 flex flex-col items-center text-center pt-10 relative">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-primary/10 to-transparent" />
                
                <div className="relative mb-4 group cursor-pointer">
                  <Avatar className="h-28 w-28 border-4 border-white shadow-lg">
                    <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                      {user.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow-md transition-transform group-hover:scale-110">
                    <Camera className="h-4 w-4" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold font-display">{user.name}</h2>
                <p className="text-muted-foreground">@{user.username}</p>
                
                <div className="flex items-center gap-2 mt-4 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                  <ShieldCheck className="h-4 w-4" /> Verified Student
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mt-8 pt-6 border-t">
                  <div>
                    <p className="text-2xl font-bold text-primary">4.9</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Rating</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">12</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Rentals</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold">Pro Status</p>
                    <p className="text-xs text-gray-400">Level 1 Lender</p>
                  </div>
                </div>
                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-yellow-400 h-full w-[70%]" />
                </div>
                <p className="text-xs text-gray-400 mt-2">3 more rentals to reach Level 2</p>
              </CardContent>
            </Card>
          </div>

          {/* --- RIGHT COLUMN: SETTINGS TABS --- */}
          <div className="space-y-6">
            
            {/* Custom Tab Switcher */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all text-sm whitespace-nowrap",
                      activeTab === tab.id 
                        ? "bg-primary text-white shadow-md" 
                        : "bg-white border text-muted-foreground hover:bg-slate-50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* --- TAB CONTENT: PROFILE --- */}
            {activeTab === "profile" && (
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your public profile details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input 
                      id="name" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Location</Label>
                      <Input placeholder="Campus Dorm (North)" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Phone (Optional)</Label>
                      <Input placeholder="(555) 000-0000" />
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-4">
                    <Button onClick={() => updateProfileMutation.mutate()} disabled={updateProfileMutation.isPending}>
                      {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* --- TAB CONTENT: SECURITY --- */}
            {activeTab === "security" && (
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>Manage your password and account access.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="password">New Password</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirm">Confirm Password</Label>
                    <Input 
                      id="confirm" 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex justify-end pt-4">
                    <Button onClick={() => changePasswordMutation.mutate()} disabled={changePasswordMutation.isPending}>
                      Update Password
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

             {/* --- TAB CONTENT: BILLING (Placeholder) --- */}
             {activeTab === "billing" && (
              <Card>
                <CardHeader>
                  <CardTitle>Payout Methods</CardTitle>
                  <CardDescription>Where should we send your earnings?</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                  <div className="p-4 bg-muted rounded-full">
                    <CreditCard className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">No payout method added</p>
                    <p className="text-sm text-muted-foreground">Add a debit card to receive instant payouts.</p>
                  </div>
                  <Button variant="outline">Add Payout Method</Button>
                </CardContent>
              </Card>
            )}

            {/* DANGER ZONE (Always Visible at bottom of right column) */}
            <Card className="border-red-100 bg-red-50/50">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-red-900">Log Out</h3>
                  <p className="text-sm text-red-700/80">End your current session safely.</p>
                </div>
                <Button variant="destructive" onClick={() => logoutMutation.mutate()}>
                  <LogOut className="mr-2 h-4 w-4" /> Log Out
                </Button>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
