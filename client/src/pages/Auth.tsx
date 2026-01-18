import { useState } from "react";
import { useState, useEffect } from "react"; // Added useEffect here
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
@@ -7,9 +7,9 @@ import { insertUserSchema, type InsertUser } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox"; // Added
import { Label } from "@/components/ui/label";       // Added
import { TermsModal } from "@/components/TermsModal"; // Added
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TermsModal } from "@/components/TermsModal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { GraduationCap, Loader2 } from "lucide-react";
@@ -34,8 +34,20 @@ export default function AuthPage({ mode = "login" }: { mode?: "login" | "registe
  const { loginMutation, registerMutation, user } = useAuth();
  const [, setLocation] = useLocation();

  // --- UPDATED REDIRECT LOGIC ---
  useEffect(() => {
    if (user) {
      // Immediately check verification status
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
