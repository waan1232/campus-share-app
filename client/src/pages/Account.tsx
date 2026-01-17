import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  User, Lock, ShieldCheck, CreditCard, Bell, LogOut, ArrowLeft, Camera, 
  Package, Wallet, Loader2, TrendingUp, DollarSign, Trash2 
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Item } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
// --- NEW IMPORTS FOR WITHDRAWAL ---
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Types for Balance & Withdrawals
interface BalanceData {
  totalEarned: number;
  totalWithdrawn: number;
  available: number;
  history: any[]; // Withdrawal history
}

export default function AccountPage() {
  const { user, logoutMutation, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [activeTab, setActiveTab] = useState("profile");
  
  // Form States (Profile)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  
  // Form States (Payouts)
  const [venmo, setVenmo] = useState("");
  const [cashapp, setCashapp] = useState("");

  // Form States (Security)
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Form States (Withdrawal)
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("venmo");
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  // Populate state when user loads
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setVenmo((user as any).venmo_handle || "");
      setCashapp((user as any).cashapp_tag || "");
    } else if (!isLoading) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  // FETCH REAL DATA: Get My Items count
  const { data: myItems } = useQuery<Item[]>({
    queryKey: ["/api/my-items"],
    enabled: !!user,
  });

  // --- NEW: FETCH BALANCE DATA ---
  const { data: balance, refetch: refetchBalance } = useQuery<BalanceData>({
    queryKey: ["/api/balance"],
    enabled: !!user && activeTab === "billing",
  });

  // Update Profile Mutation
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

  // Delete Account Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/user");
    },
    onSuccess: () => {
      window.location.href = "/auth";
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    }
  });

  // --- NEW: WITHDRAW MUTATION ---
  const withdrawMutation = useMutation({
    mutationFn: async () => {
      // Determine details based on method
      let details = "";
      if (withdrawMethod === "venmo") details = venmo || "Not set";
      if (withdrawMethod === "cashapp") details = cashapp || "Not set";
      if (withdrawMethod === "debit") details = "Debit Card Request";

      await apiRequest("POST", "/api/withdraw", {
        amount: Number(withdrawAmount),
        method: withdrawMethod,
        details: details
      });
    },
    onSuccess: () => {
      toast({ title: "Request Sent", description: "You will receive funds within 24 hours." });
      setIsWithdrawOpen(false);
      setWithdrawAmount("");
      refetchBalance(); // Refresh the balance card
    },
    onError: () => toast({ title: "Error", description: "Could not process request", variant: "destructive" })
  });

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tabs = [
    { id: "profile", label: "Edit Profile", icon: User },
    { id: "billing", label: "Earnings & Payouts", icon: Wallet },
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

                <div className="grid grid-cols-1 gap-4 w-full mt-8 pt-6 border-t">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 text-2xl font-bold text-primary">
                      <Package className="h-5 w-5" />
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

             {/* --- TAB CONTENT: EARNINGS & PAYOUTS --- */}
             {activeTab === "billing" && (
              <div className="space-y-6">
                
                {/* 1. BALANCE CARD (With Withdraw Feature) */}
                <Card className="bg-gradient-to-br from-primary to-blue-700 text-white border-none shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-blue-100 font-medium mb-1">Available to Withdraw</p>
                        <h2 className="text-5xl font-bold font-display tracking-tight">
                          ${balance?.available || 0}
                        </h2>
                      </div>
                      
                      {/* WITHDRAW MODAL */}
                      <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
                        <DialogTrigger asChild>
                          <Button variant="secondary" size="lg" className="font-bold shadow-lg">
                            Withdraw Funds
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Withdraw Funds</DialogTitle>
                            <DialogDescription>
                              Choose where you want us to send your money.
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                              <Label>Amount ($)</Label>
                              <Input 
                                type="number" 
                                placeholder="0.00" 
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                max={balance?.available}
                              />
                              <p className="text-xs text-muted-foreground">Max: ${balance?.available}</p>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Payout Method</Label>
                              <Select value={withdrawMethod} onValueChange={setWithdrawMethod}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="venmo">Venmo ({venmo || "Not Set"})</SelectItem>
                                  <SelectItem value="cashapp">Cash App ({cashapp || "Not Set"})</SelectItem>
                                  <SelectItem value="debit">Debit Card (Stripe)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <DialogFooter>
                            <Button onClick={() => withdrawMutation.mutate()} disabled={withdrawMutation.isPending || !withdrawAmount}>
                              {withdrawMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                              Confirm Withdraw
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="mt-8 flex gap-6 text-sm text-blue-100">
                      <div>
                        <span className="opacity-70">Lifetime Earnings:</span> 
                        <span className="font-bold ml-2">${balance?.totalEarned || 0}</span>
                      </div>
                      <div>
                        <span className="opacity-70">Total Withdrawn:</span> 
                        <span className="font-bold ml-2">${balance?.totalWithdrawn || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. WITHDRAWAL HISTORY */}
                <Card>
                   <CardHeader><CardTitle>Withdrawal History</CardTitle></CardHeader>
                   <CardContent>
                     {!balance || balance.history.length === 0 ? (
                       <p className="text-muted-foreground text-sm">No withdrawals yet.</p>
                     ) : (
                       <div className="space-y-4">
                         {balance.history.map((tx: any) => (
                           <div key={tx.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                             <div>
                               <p className="font-bold capitalize">{tx.method} Transfer</p>
                               <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                             </div>
                             <div className="text-right">
                               <span className="font-bold block">-${tx.amount}</span>
                               <span className={cn(
                                 "text-xs font-bold px-2 py-0.5 rounded-full",
                                 tx.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                                 tx.status === 'paid' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                               )}>
                                 {tx.status.toUpperCase()}
                               </span>
                             </div>
                           </div>
                         ))}
                       </div>
                     )}
                   </CardContent>
                </Card>

                {/* 3. Payout Destination Config */}
                <Card>
                  <CardHeader>
                    <CardTitle>Payout Destination</CardTitle>
                    <CardDescription>Where should students send your money?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 border p-4 rounded-lg bg-white">
                      <div className="h-10 w-10 bg-[#008CFF] rounded-full flex items-center justify-center text-white font-bold text-sm">
                        V
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="venmo" className="font-semibold text-[#008CFF]">Venmo Handle</Label>
                        <Input 
                          id="venmo" 
                          className="pl-3"
                          placeholder="@username"
                          value={venmo}
                          onChange={(e) => setVenmo(e.target.value)}
                        />
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateProfileMutation.mutate({ venmo_handle: venmo })}
                      >
                        Save
                      </Button>
                    </div>

                    <div className="flex items-center gap-4 border p-4 rounded-lg bg-white">
                      <div className="h-10 w-10 bg-[#00D632] rounded-full flex items-center justify-center text-white font-bold text-sm">
                        $
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="cashapp" className="font-semibold text-[#00D632]">CashApp Tag</Label>
                        <Input 
                          id="cashapp" 
                          className="pl-3"
                          placeholder="$cashtag"
                          value={cashapp}
                          onChange={(e) => setCashapp(e.target.value)}
                        />
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateProfileMutation.mutate({ cashapp_tag: cashapp })}
                      >
                        Save
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* --- TAB CONTENT: SECURITY --- */}
            {activeTab === "security" && (
              <div className="space-y-6">
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

                {/* --- DANGER ZONE (Delete Account) --- */}
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                      <Trash2 className="h-5 w-5" /> Danger Zone
                    </CardTitle>
                    <CardDescription>
                      Once you delete your account, there is no going back. Please be certain.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full sm:w-auto">
                          Delete Account
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your
                            account, listings, and all associated data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteMutation.mutate()}
                          >
                            {deleteMutation.isPending ? "Deleting..." : "Yes, delete my account"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* LOG OUT (Always Visible at bottom) */}
            <Card className="border-red-100 bg-red-50/50 mt-8">
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
