import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Handshake, 
  CalendarCheck, 
  ShieldCheck, 
  ArrowRight,
  UserPlus,
  PackagePlus,
  MessageSquare
} from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function About() {
  const steps = [
    {
      icon: <UserPlus className="h-8 w-8 text-primary" />,
      title: "1. Join the Community",
      description: "Sign up with your .edu email to verify you're a student. It's fast, free, and secure."
    },
    {
      icon: <Search className="h-8 w-8 text-primary" />,
      title: "2. Find What You Need",
      description: "Browse the marketplace for calculators, cameras, textbooks, or even party supplies."
    },
    {
      icon: <Handshake className="h-8 w-8 text-primary" />,
      title: "3. Request and Rent",
      description: "Send a request to the owner. Once approved, meet on campus to exchange the item."
    },
    {
      icon: <CalendarCheck className="h-8 w-8 text-primary" />,
      title: "4. Use and Return",
      description: "Use the gear for the agreed duration and return it safely to the owner."
    }
  ];

  const benefits = [
    {
      icon: <ShieldCheck className="h-6 w-6" />,
      title: "Verified Students",
      description: "Every member is a verified student from your campus."
    },
    {
      icon: <PackagePlus className="h-6 w-6" />,
      title: "Earn Extra Cash",
      description: "List your unused gear and earn money while helping others."
    },
    {
      icon: <MessageSquare className="h-6 w-6" />,
      title: "Easy Communication",
      description: "Coordinate meetups easily through our secure platform."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 bg-primary/5 border-b border-border/50">
          <div className="container max-w-5xl">
            <div className="text-center">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-5xl font-display font-bold mb-6"
              >
                How CampusShare Works
              </motion.h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                We've built a simple, secure way for students to share resources and save money.
              </p>
            </div>
          </div>
        </section>

        {/* Steps Section */}
        <section className="py-24">
          <div className="container max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {steps.map((step, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-6 items-start"
                >
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    {step.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-24 bg-secondary/30">
          <div className="container max-w-5xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-display font-bold mb-4">Built for Campus Life</h2>
              <p className="text-muted-foreground">Why thousands of students trust CampusShare for their daily needs.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {benefits.map((benefit, i) => (
                <div key={i} className="bg-card p-8 rounded-2xl border border-border/50 shadow-sm">
                  <div className="text-primary mb-4">{benefit.icon}</div>
                  <h3 className="font-bold mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="container max-w-5xl">
            <div className="bg-primary rounded-3xl p-12 text-center text-primary-foreground">
              <h2 className="text-3xl font-display font-bold mb-6">Ready to get started?</h2>
              <p className="text-primary-foreground/80 mb-10 max-w-xl mx-auto text-lg">
                Join your campus marketplace today and start sharing gear with your fellow students.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button size="lg" variant="secondary" className="rounded-full px-8 font-bold">
                    Create Account
                  </Button>
                </Link>
                <Link href="/items">
                  <Button size="lg" variant="outline" className="rounded-full px-8 font-bold bg-white/10 border-white/20 hover:bg-white/20">
                    Browse Marketplace
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
