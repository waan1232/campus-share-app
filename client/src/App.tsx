import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
// 1. Add Import at top

// 2. Add Route in Router function
// Pages
import Home from "@/pages/Home";
import AuthPage from "@/pages/Auth";
import Marketplace from "@/pages/Marketplace";
import ItemDetail from "@/pages/ItemDetail";
import PostItem from "@/pages/PostItem";
import Dashboard from "@/pages/Dashboard";
import About from "@/pages/About";
import InboxPage from "@/pages/inbox";
import AccountPage from "@/pages/Account";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/about" component={About} />
      <Route path="/items/new" component={PostItem} />
      <Route path="/items/:id" component={ItemDetail} />
      <Route path="/account" component={AccountPage} />
      <Route path="/login">
        {() => <AuthPage mode="login" />}
      </Route>
      <Route path="/register">
        {() => <AuthPage mode="register" />}
      </Route>
      <Route path="/items" component={Marketplace} />
      <Route path="/items/new" component={PostItem} />
      <Route path="/items/:id" component={ItemDetail} />
      <Route path="/items/edit/:id" component={PostItem} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/account" component={AccountPage} />
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
