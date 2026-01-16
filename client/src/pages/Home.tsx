import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Search, ShieldCheck, Wallet, GraduationCap } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Home() {
  const features = [
    {
      icon: <Wallet className="h-6 w-6 text-primary" />,
      title: "Save Money",
      description: "Stop buying expensive gear you only need once. Rent it from a classmate for a fraction of the cost."
    },
    {
      icon: <ShieldCheck className="h-6 w-6 text-primary" />,
      title: "Trusted Community",
      description: "Every user is verified with a .edu email address. Rent with confidence from fellow students."
    },
    {
      icon: <CheckCircle2 className="h-6 w-6 text-primary" />,
      title: "Easy Process",
      description: "Find what you need, request it, meet on campus, and return it. Simple as that."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-32 md:pt-24 md:pb-48">
        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl font-display font-bold tracking-tight text-foreground sm:text-6xl mb-6"
            >
              Don't Buy it. <span className="text-gradient">Share it.</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              The exclusive marketplace for students to rent gear from peers. 
              Find calculators, cameras, textbooks, and party supplies right on campus.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/items">
                <Button size="lg" className="rounded-full px-8 h-12 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                  <Search className="mr-2 h-4 w-4" />
                  Browse Marketplace
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" size="lg" className="rounded-full px-8 h-12 text-base font-semibold border-2 hover:bg-secondary/50">
                  Join CampusShare
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
        
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 -z-10 h-full w-full overflow-hidden opacity-30 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-[30%] -right-[10%] h-[400px] w-[400px] rounded-full bg-accent/20 blur-3xl" />
        </div>
      </section>

      {/* How it Works Section */}
      <section className="bg-secondary/30 py-24 border-y border-border/50">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-display font-bold tracking-tight sm:text-4xl mb-4">Why Students Love CampusShare</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We make it safe and easy to share resources within your campus community.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {features.map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-card p-8 rounded-2xl shadow-sm border border-border/50 hover:shadow-md transition-all"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Teaser */}
      <section className="py-24">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
            <div>
              <h2 className="text-3xl font-display font-bold tracking-tight mb-2">Popular Categories</h2>
              <p className="text-muted-foreground">Find exactly what you need for your semester.</p>
            </div>
            <Link href="/items">
              <Button variant="ghost" className="group font-semibold text-primary">
                View All Items <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Electronics', 'Textbooks', 'Party', 'Sports'].map((category) => (
              <Link key={category} href={`/items?category=${category}`}>
                <div className="group relative overflow-hidden rounded-xl aspect-[4/3] cursor-pointer">
                  {/* Category Image Placeholder with Unsplash */}
                  {/* Category: {category} */}
                  <img 
                    src={`https://source.unsplash.com/800x600/?${category.toLowerCase()},student`} 
                    alt={category}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                    <h3 className="text-white font-bold text-lg">{category}</h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-border/40 py-12 bg-card">
        <div className="container text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-4 font-display font-bold text-xl text-primary">
            <GraduationCap className="h-5 w-5" />
            <span>CampusShare</span>
          </div>
          <p>© {new Date().getFullYear()} CampusShare. Built for students.</p>
        </div>
      </footer>
    </div>
  );
}
