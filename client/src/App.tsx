import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";

// Pages
import Home from "@/pages/Home";
import AuthPage from "@/pages/Auth";
import Marketplace from "@/pages/Marketplace";
import ItemDetail from "@/pages/ItemDetail";
import PostItem from "@/pages/PostItem";
import Dashboard from "@/pages/Dashboard";
import About from "@/pages/About";
import InboxPage from "@/pages/inbox"; // Ensure this matches your file name exactly
import AccountPage from "@/pages/Account";

function Router() {
  return (
    <Switch>
      {/* 1. Public & Static Routes */}
      <Route path="/" component={Home} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/about" component={About} />
      
      <Route path="/login">
        {() => <AuthPage mode="login" />}
      </Route>
      <Route path="/register">
        {() => <AuthPage mode="register" />}
      </Route>

      {/* 2. User Dashboard & Settings */}
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/account" component={AccountPage} />
      
      {/* 3. Messaging (The Missing Links) */}
      <Route path="/inbox" component={InboxPage} />
      <Route path="/messages" component={InboxPage} />

      {/* 4. Marketplace Routes (ORDER MATTERS!) */}
      <Route path="/items" component={Marketplace} />
      
      {/* Specific routes like 'new' must come BEFORE dynamic routes like ':id' */}
      <Route path="/items/new" component={PostItem} />
      <Route path="/items/edit/:id" component={PostItem} />
      <Route path="/items/:id" component={ItemDetail} />

      {/* 5. 404 Catch-all */}
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
