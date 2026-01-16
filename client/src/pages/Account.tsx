import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Package,
  Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Item } from "@shared/schema";

export default function AccountPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("profile");
  
  // Form States (Profile)
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  
  // Form States (Payouts)
  // We use (user as any) here to avoid TypeScript errors if you haven't updated shared/schema.ts yet
  const [venmo, setVenmo] = useState((user as any)?.venmo_handle || "");
  const [cashapp, setCashapp] = useState((user as any)?.cashapp_tag || "");

  // Form States (Security)
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // FETCH REAL DATA: Get My Items count
  const { data: myItems } = useQuery<Item[]>({
    queryKey: ["/api/my-items"],
  });

  // Update Profile Mutation (Handles Name, Email, Venmo, CashApp)
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/user", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" })
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
    { id: "billing", label: "Payout Methods", icon: Wallet },
    { id: "security", label: "Security", icon: Lock },
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
          
          {/* --- LEFT COLUMN: ID CARD (REAL DATA) --- */}
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

                <div className="grid grid-cols-1 gap-4 w-full mt-8 pt-6 border-t">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 text-2xl font-bold text-primary">
                      <Package className="h-5 w-5" />
                      {/* REAL DATA: Shows active listings count */}
                      {myItems ? myItems.length : "-"}
                    </div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Listings</p>
                  </div>
                </div>
                
                <div className="mt-6 text-xs text-muted-foreground">
                   Member since 2024
                </div>
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
                  
                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={() => updateProfileMutation.mutate({ name, email })} 
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

             {/* --- TAB CONTENT: PAYOUT METHODS (New) --- */}
             {activeTab === "billing" && (
              <Card>
                <CardHeader>
                  <CardTitle>Payout Methods</CardTitle>
                  <CardDescription>
                    Add your handles so renters can pay you directly.
                    <br />
                    <span className="text-xs text-muted-foreground bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded mt-2 inline-block">
                      Note: Payments happen off-platform via these apps.
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {/* Venmo */}
                  <div className="flex items-center gap-4 border p-4 rounded-lg bg-white">
                    <div className="h-10 w-10 bg-[#008CFF] rounded-full flex items-center justify-center text-white font-bold text-sm">
                      V
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="venmo" className="font-semibold text-[#008CFF]">Venmo Handle</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground">@</span>
                        <Input 
                          id="venmo" 
                          className="pl-7"
                          placeholder="your-username"
                          value={venmo}
                          onChange={(e) => setVenmo(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => updateProfileMutation.mutate({ venmo_handle: venmo })}
                    >
                      Save
                    </Button>
                  </div>

                  {/* CashApp */}
                  <div className="flex items-center gap-4 border p-4 rounded-lg bg-white">
                    <div className="h-10 w-10 bg-[#00D632] rounded-full flex items-center justify-center text-white font-bold text-sm">
                      $
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="cashapp" className="font-semibold text-[#00D632]">CashApp Tag</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                        <Input 
                          id="cashapp" 
                          className="pl-7"
                          placeholder="your-cashtag"
                          value={cashapp}
                          onChange={(e) => setCashapp(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => updateProfileMutation.mutate({ cashapp_tag: cashapp })}
                    >
                      Save
                    </Button>
                  </div>

                  <div className="text-center text-sm text-muted-foreground pt-4">
                    Students prefer <strong>Venmo</strong>. We recommend adding that one first!
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
