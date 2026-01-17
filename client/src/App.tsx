import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";

// Pages
import Home from "@/pages/Home";
import AuthPage from "@/pages/Auth";
import Marketplace from "@/pages/Marketplace";
import ItemDetail from "@/pages/ItemDetail";
import PostItem from "@/pages/PostItem";
import About from "@/pages/About";
import InboxPage from "@/pages/inbox";
import AccountPage from "@/pages/Account";
import VerifyPage from "@/pages/verify";
import Dashboard from "@/pages/Dashboard"; //

// --- THE GUARD COMPONENT ---
// Blocks access if you are NOT logged in OR NOT verified
function VerifiedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 1. Not Logged In -> Go to Auth
  if (!user) {
    setLocation("/auth");
    return null;
  }

  // 2. Logged In BUT Not Verified -> Go to Jail
  if (!user.isVerified) {
    setLocation("/verify");
    return null;
  }

  // 3. Allowed -> Show Page
  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* --- PRIORITY ROUTES (Specific paths must come first) --- */}
      
      {/* 1. "New Item" MUST be before "Item Detail" (:id) */}
      <Route path="/items/new">
         {() => <VerifiedRoute component={PostItem} />}
      </Route>

      {/* --- PUBLIC ROUTES --- */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/about" component={About} />
      
      <Route path="/login">
        <AuthPage mode="login" />
      </Route>
      <Route path="/register">
        <AuthPage mode="register" />
      </Route>

      {/* Browsing */}
      <Route path="/" component={Home} />
      <Route path="/items" component={Marketplace} />
      
      {/* Now it's safe to put the generic ID route here */}
      <Route path="/items/:id" component={ItemDetail} />

      {/* Verification */}
      <Route path="/verify" component={VerifyPage} />


      {/* --- PROTECTED ROUTES --- */}
      <Route path="/dashboard">
         {() => <VerifiedRoute component={Dashboard} />} 
      </Route>

      <Route path="/account">
         {() => <VerifiedRoute component={AccountPage} />}
      </Route>

      <Route path="/inbox">
         {() => <VerifiedRoute component={InboxPage} />}
      </Route>

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
