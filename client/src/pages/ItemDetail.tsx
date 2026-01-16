import { useParams, Link } from "wouter";
import { useItem, useToggleFavorite, useFavorites } from "@/hooks/use-items";
import { useCreateRental, useRentals } from "@/hooks/use-rentals";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Calendar as CalendarIcon, ShieldCheck, Loader2, Heart } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { format, addDays, isWithinInterval } from "date-fns";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageDialog } from "@/components/MessageDialog";
import { useAuth } from "@/hooks/use-auth"; // Ensure you have access to the user

export default function ItemDetail() {
  const { id } = useParams();
  const itemId = Number(id);
  const { data: item, isLoading, error } = useItem(itemId);
  const { data: rentals } = useRentals();
  const { user } = useAuth();
  const createRental = useCreateRental();
  const toggleFavorite = useToggleFavorite();
  const { data: favorites } = useFavorites();
  
  const isFavorite = favorites?.some(f => f.id === itemId);

  const isDateUnavailable = (date: Date) => {
    if (!rentals) return false;
    
    // Check if date falls within any approved rental or manual block for this item
    const itemRentals = [...rentals.incoming, ...rentals.outgoing].filter(r => 
      r.itemId === itemId && (r.status === 'approved' || r.status === 'unavailable_block')
    );

    return itemRentals.some(rental => 
      isWithinInterval(date, { 
        start: new Date(rental.startDate), 
        end: new Date(rental.endDate) 
      })
    );
  };
  
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 3),
  });

  const handleRent = () => {
    if (!date?.from || !date?.to || !item) return;
    
    createRental.mutate({
      itemId: item.id,
      startDate: date.from,
      endDate: date.to,
    });
  };

  const handleToggleFavorite = () => {
    if (!user) return;
    toggleFavorite.mutate(itemId);
  };

  const days = date?.from && date?.to 
    ? Math.ceil((date.to.getTime() - date.from.getTime()) / (1000 * 60 * 60 * 24)) 
    : 0;

  const totalPrice = item && days ? item.pricePerDay * days : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="container py-8 max-w-5xl">
          <Skeleton className="h-8 w-32 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <div className="space-y-6">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <h2 className="text-2xl font-bold mb-4">Item not found</h2>
          <Link href="/items">
            <Button>Back to Marketplace</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === item.ownerId;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 container py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <Link href="/items">
            <Button variant="ghost" className="pl-0 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Marketplace
            </Button>
          </Link>

          {user && (
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-2 rounded-full", isFavorite && "text-red-500 border-red-200 bg-red-50 hover:bg-red-100")}
              onClick={handleToggleFavorite}
            >
              <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
              {isFavorite ? "Saved" : "Save Item"}
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left Column: Image */}
          <div className="rounded-3xl overflow-hidden shadow-2xl bg-white aspect-[4/3] relative">
            <img 
              src={item.imageUrl} 
              alt={item.title} 
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Badge variant="secondary" className="backdrop-blur-md bg-white/90 text-primary font-semibold shadow-sm text-sm py-1.5 px-3">
                Condition: {item.condition || 'Good'}
              </Badge>
              <Badge variant="secondary" className="backdrop-blur-md bg-white/90 text-primary font-semibold shadow-sm text-sm py-1.5 px-3">
                Location: {item.location || 'Campus'}
              </Badge>
            </div>
            {!item.isAvailable && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                <span className="text-white font-bold text-2xl uppercase tracking-widest border-4 border-white px-8 py-3 rounded-lg rotate-[-12deg]">
                  Currently Rented
                </span>
              </div>
            )}
          </div>
          
          {/* Right Column: Details */}
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Badge variant="secondary" className="px-3 py-1">{item.category}</Badge>
                {item.isAvailable ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none px-3 py-1">Available</Badge>
                ) : (
                  <Badge variant="destructive" className="px-3 py-1">Unavailable</Badge>
                )}
              </div>
              <h1 className="text-4xl font-display font-bold text-foreground leading-tight mb-2">{item.title}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {item.ownerName.charAt(0)}
                </div>
                <span className="text-sm font-medium">Listed by {item.ownerName}</span>
                <span className="text-sm text-muted-foreground/50">•</span>
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Verified Student
                </span>
              </div>
            </div>

            <div className="prose prose-slate max-w-none text-muted-foreground">
              <p>{item.description}</p>
            </div>
            
            <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-6">
              <div className="flex justify-between items-end pb-6 border-b border-border">
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Price per day</p>
                  <p className="text-3xl font-display font-bold text-primary">{formatCurrency(item.pricePerDay)}</p>
                </div>
              </div>
              
              {!isOwner && item.isAvailable && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Rental Dates</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="date"
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal h-12",
                            !date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date?.from ? (
                            date.to ? (
                              <>
                                {format(date.from, "LLL dd, y")} -{" "}
                                {format(date.to, "LLL dd, y")}
                                <span className="ml-auto font-medium text-foreground">
                                  ({days} days)
                                </span>
                              </>
                            ) : (
                              format(date.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Pick a date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={date?.from}
                          selected={date}
                          onSelect={setDate}
                          numberOfMonths={2}
                          disabled={(date) => 
                            date < new Date(new Date().setHours(0, 0, 0, 0)) || 
                            isDateUnavailable(date)
                          }
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  {days > 0 && (
                    <div className="bg-secondary/30 p-4 rounded-lg flex justify-between items-center">
                      <span className="text-sm font-medium">Total Price</span>
                      <span className="text-xl font-bold">{formatCurrency(totalPrice)}</span>
                    </div>
                  )}
                  
                  {user ? (
                    <Button 
                      size="lg" 
                      className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20" 
                      onClick={handleRent}
                      disabled={createRental.isPending || !date?.from || !date?.to}
                    >
                      {createRental.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Request to Rent"
                      )}
                    </Button>
                  ) : (
                    <Link href="/login">
                      <Button variant="outline" className="w-full h-12">
                        Log in to Rent
                      </Button>
                    </Link>
                  )}
                </div>
              )}

              {isOwner && (
                <div className="bg-secondary/30 p-4 rounded-lg text-center">
                  <p className="text-sm font-medium text-muted-foreground">This is your item</p>
                </div>
              )}
              
              {!item.isAvailable && !isOwner && (
                <Button disabled className="w-full" variant="secondary">Currently Unavailable</Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
