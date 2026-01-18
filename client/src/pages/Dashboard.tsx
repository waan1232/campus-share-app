import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/hooks/use-auth";
import { useRentals, useUpdateRentalStatus } from "@/hooks/use-rentals";
import { useFavorites, useToggleFavorite } from "@/hooks/use-items";
import { useLocation, Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { format, isWithinInterval, startOfDay, startOfMonth, startOfYear, isSameDay, isSameMonth, isSameYear } from "date-fns";
import { Loader2, Package, CalendarCheck, AlertCircle, CheckCircle, XCircle, Heart, Trash2, CalendarOff, BarChart3, TrendingUp } from "lucide-react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Item } from "@shared/schema";
import { PayButton } from "@/components/PayButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// --- NEW IMPORT ---
import { ImageUpload } from "@/components/ImageUpload"; 


export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: rentals, isLoading: rentalsLoading } = useRentals();
  const { data: favoriteItems } = useFavorites();
  const { data: myItems, isLoading: itemsLoading } = useQuery<(Item & { ownerName: string })[]>({
    queryKey: ["/api/my-items"],
  });
  
  const isLoading = rentalsLoading || itemsLoading;
  const toggleFavorite = useToggleFavorite();
  const updateStatus = useUpdateRentalStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>();
  const [earningsView, setEarningsView] = useState<'day' | 'month' | 'year' | 'all'>('month');

  const earningsData = useMemo(() => {
    if (!rentals?.incoming) return [];
    
    const completedRentals = rentals.incoming.filter(r => r.status === 'completed' || r.status === 'approved');
    
    if (earningsView === 'day') {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return startOfDay(d);
      }).reverse();
      
      return last7Days.map(day => {
        const amount = completedRentals
          .filter(r => isSameDay(new Date(r.startDate), day))
          .reduce((sum, r) => {
            const days = Math.max(1, Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24)));
            return sum + (r.item.pricePerDay * days);
          }, 0);
        return { name: format(day, 'MMM d'), amount: amount / 100 };
      });
    }

    if (earningsView === 'month') {
      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return startOfMonth(d);
      }).reverse();
      
      return last6Months.map(month => {
        const amount = completedRentals
          .filter(r => isSameMonth(new Date(r.startDate), month))
          .reduce((sum, r) => {
            const days = Math.max(1, Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24)));
            return sum + (r.item.pricePerDay * days);
          }, 0);
        return { name: format(month, 'MMM'), amount: amount / 100 };
      });
    }

    if (earningsView === 'year') {
      const last3Years = Array.from({ length: 3 }, (_, i) => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - i);
        return startOfYear(d);
      }).reverse();
      
      return last3Years.map(year => {
        const amount = completedRentals
          .filter(r => isSameYear(new Date(r.startDate), year))
          .reduce((sum, r) => {
            const days = Math.max(1, Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24)));
            return sum + (r.item.pricePerDay * days);
          }, 0);
        return { name: format(year, 'yyyy'), amount: amount / 100 };
      });
    }

    // All time
    const total = completedRentals.reduce((sum, r) => {
      const days = Math.max(1, Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24)));
      return sum + (r.item.pricePerDay * days);
    }, 0);
    return [{ name: 'Total Earnings', amount: total / 100 }];
  }, [rentals, earningsView]);

  const totalEarnings = useMemo(() => {
    if (!rentals?.incoming) return 0;
    return rentals.incoming
      .filter(r => r.status === 'completed' || r.status === 'approved')
      .reduce((sum, r) => {
        const days = Math.max(1, Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24)));
        return sum + (r.item.pricePerDay * days);
      }, 0);
  }, [rentals]);

  const blockMutation = useMutation({
    mutationFn: async ({ itemId, startDate, endDate }: { itemId: number; startDate: Date; endDate: Date }) => {
      await apiRequest("POST", `/api/items/${itemId}/unavailable`, { startDate, endDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rentals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-items"] });
      toast({ title: "Dates blocked", description: "Item is now marked as unavailable for selected dates." });
      setDateRange(undefined);
      setSelectedItemId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/rentals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rentals"] });
      toast({ title: "Block removed", description: "Unavailability period has been removed." });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rentals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-items"] });
      toast({ title: "Item deleted", description: "Listing has been removed from the marketplace." });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Delete failed", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  if (!user) {
    setLocation("/login");
    return null;
  }

  const FavoritesList = () => {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!favoriteItems || favoriteItems.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-secondary/10 rounded-xl border border-dashed">
            <p className="text-muted-foreground mb-4">You haven't saved any items yet.</p>
            <Link href="/items">
              <Button variant="outline">Browse Marketplace</Button>
            </Link>
          </div>
        ) : (
          favoriteItems.map(item => (
            <Card key={item.id} className="overflow-hidden group">
              <div className="h-32 w-full overflow-hidden relative">
                <img 
                  src={item.imageUrl} 
                  alt={item.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => toggleFavorite.mutate(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <CardHeader className="p-4 pb-2">
                <Link href={`/items/${item.id}`}>
                  <CardTitle className="text-base line-clamp-1 hover:text-primary cursor-pointer transition-colors">
                    {item.title}
                  </CardTitle>
                </Link>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-sm">
                <p className="font-bold text-primary">{formatCurrency(item.pricePerDay)}/day</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  };

  const IncomingRequests = () => {
    const pendingRentals = rentals?.incoming.filter(r => r.status === 'pending') || [];
    
    return (
      <div className="space-y-4">
        {pendingRentals.length === 0 ? (
          <div className="text-center py-12 bg-secondary/10 rounded-xl border border-dashed">
            <p className="text-muted-foreground">No pending requests</p>
          </div>
        ) : (
          pendingRentals.map(rental => (
            <Card key={rental.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{rental.item.title}</CardTitle>
                    <CardDescription>Requested by {rental.renter.name}</CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase font-medium">Dates</span>
                    <span className="font-medium">
                      {format(new Date(rental.startDate), "MMM d")} - {format(new Date(rental.endDate), "MMM d")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase font-medium">Total Value</span>
                    <span className="font-medium text-primary">
                      {/* Calculate based on days * price */}
                      {formatCurrency(
                        Math.ceil((new Date(rental.endDate).getTime() - new Date(rental.startDate).getTime()) / (1000 * 60 * 60 * 24)) * rental.item.pricePerDay
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2 pt-0">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                  onClick={() => updateStatus.mutate({ id: rental.id, status: 'rejected' })}
                  disabled={updateStatus.isPending}
                >
                  Reject
                </Button>
                <Button 
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => updateStatus.mutate({ id: rental.id, status: 'approved' })}
                  disabled={updateStatus.isPending}
                >
                  Approve Request
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    );
  };

  const MyRentals = () => {
    const myRentals = rentals?.outgoing || [];
    
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {myRentals.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-secondary/10 rounded-xl border border-dashed">
            <p className="text-muted-foreground mb-4">You haven't rented anything yet.</p>
            <Link href="/items">
              <Button>Browse Marketplace</Button>
            </Link>
          </div>
        ) : (
          myRentals.map(rental => (
            <Card key={rental.id} className="overflow-hidden flex flex-col justify-between">
              <div>
                <div className="h-32 w-full overflow-hidden relative">
                    <img 
                    src={rental.item.imageUrl} 
                    alt={rental.item.title} 
                    className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                    <StatusBadge status={rental.status} />
                    </div>
                </div>
                <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base line-clamp-1">{rental.item.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-sm">
                    <div className="flex justify-between items-center mt-2">
                    <span className="text-muted-foreground">
                        {format(new Date(rental.startDate), "MMM d")} - {format(new Date(rental.endDate), "MMM d")}
                    </span>
                    </div>
                </CardContent>
              </div>

              {/* --- PAY BUTTON LOGIC --- */}
              {rental.status === 'approved' && (
                <CardFooter className="p-4 pt-0">
                    <PayButton 
                        rentalId={rental.id}
                        title={rental.item.title}
                        pricePerDay={rental.item.pricePerDay}
                        days={Math.max(1, Math.ceil((new Date(rental.endDate).getTime() - new Date(rental.startDate).getTime()) / (1000 * 60 * 60 * 24)))}
                        imageUrl={rental.item.imageUrl}
                        ownerId={rental.item.ownerId}
                    />
                </CardFooter>
              )}
            </Card>
          ))
        )}
      </div>
    );
  };

  const activeRentals = rentals?.incoming.filter(r => r.status === 'approved') || [];
  const unavailableBlocks = rentals?.incoming.filter(r => r.status === 'unavailable_block') || [];
  
  const MyListings = () => {
    // State for the Edit Modal (Matches PostItem form state)
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [editForm, setEditForm] = useState({ 
        title: "", 
        description: "", 
        price: 0, 
        category: "", 
        condition: "Good",
        location: "Main Campus",
        imageUrl: "" 
    });

    const categories = [
        "Textbooks", "Electronics", "Furniture", "Clothing", "Sports", "Games", "Kitchen", "Other"
    ];

    const editMutation = useMutation({
        mutationFn: async () => {
          if(!editingItem) return;
          const res = await apiRequest("PATCH", `/api/items/${editingItem.id}`, {
            title: editForm.title,
            description: editForm.description,
            pricePerDay: Math.round(editForm.price * 100),
            category: editForm.category,
            condition: editForm.condition,
            location: editForm.location,
            imageUrl: editForm.imageUrl
          });
          return res.json();
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/my-items"] });
          toast({ title: "Updated", description: "Listing details saved successfully." });
          setEditingItem(null); // Close modal
        },
        onError: (err: any) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    });

    const openEditModal = (item: Item) => {
        setEditingItem(item);
        setEditForm({ 
            title: item.title, 
            description: item.description, 
            price: item.pricePerDay / 100,
            category: item.category,
            condition: (item as any).condition || "Good",
            location: (item as any).location || "Main Campus",
            imageUrl: item.imageUrl
        });
    };

    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-medium mb-4">Currently Rented Out</h3>
          {activeRentals.length === 0 ? (
            <p className="text-muted-foreground text-sm">No items currently rented out.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {activeRentals.map(rental => (
                <Card key={rental.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <img src={rental.item.imageUrl} alt="" className="h-16 w-16 rounded-md object-cover" />
                    <div className="flex-1">
                      <p className="font-bold">{rental.item.title}</p>
                      <p className="text-sm text-muted-foreground">Rented by {rental.renter.name}</p>
                      <p className="text-xs text-muted-foreground">Due back: {format(new Date(rental.endDate), "PP")}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: rental.id, status: 'completed' })}>
                      Returned
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-medium mb-4">Manage Availability & Listings</h3>
          {!myItems || myItems.length === 0 ? (
            <div className="text-center py-12 bg-secondary/10 rounded-xl border border-dashed">
              <p className="text-muted-foreground mb-4">You haven't listed any items yet.</p>
              <Link href="/items/new">
                <Button variant="outline">List Your First Item</Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myItems.map(item => (
                <Card key={item.id}>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">{item.title}</CardTitle>
                  </CardHeader>
                  <CardFooter className="p-4 pt-0 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1">
                          <CalendarOff className="mr-2 h-4 w-4" /> Availability
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-4 space-y-4">
                          <p className="text-sm font-medium">Block timeframe</p>
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={new Date()}
                            selected={{ from: dateRange?.from, to: dateRange?.to }}
                            onSelect={(range: any) => setDateRange(range)}
                          />
                          <Button 
                            className="w-full" 
                            disabled={!dateRange?.from || !dateRange?.to || blockMutation.isPending}
                            onClick={() => blockMutation.mutate({ itemId: item.id, startDate: dateRange!.from, endDate: dateRange!.to })}
                          >
                            {blockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm Block
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* --- FULL LISTING-STYLE EDIT MODAL --- */}
                    <Dialog open={editingItem?.id === item.id} onOpenChange={(open) => !open && setEditingItem(null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full flex-1" onClick={() => openEditModal(item)}>
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-3xl font-display font-bold tracking-tight">Edit Listing</DialogTitle>
                          <CardDescription>Update your item details below.</CardDescription>
                        </DialogHeader>
                        
                        <div className="space-y-6 py-4">
                            
                            {/* 1. Title */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Title</Label>
                                <Input 
                                    placeholder="e.g. TI-84 Plus CE Calculator"
                                    value={editForm.title} 
                                    onChange={(e) => setEditForm(prev => ({...prev, title: e.target.value}))} 
                                />
                            </div>

                            {/* 2. Grid: Category & Price (Matches PostItem layout) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Category</Label>
                                    <Select 
                                        value={editForm.category} 
                                        onValueChange={(val) => setEditForm(prev => ({...prev, category: val}))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Price per Day ($)</Label>
                                    <Input 
                                        type="number"
                                        step="0.01"
                                        placeholder="5.00"
                                        value={editForm.price} 
                                        onChange={(e) => setEditForm(prev => ({...prev, price: parseFloat(e.target.value)}))} 
                                    />
                                </div>
                            </div>

                            {/* 3. Grid: Condition & Location (New Fields) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Condition</Label>
                                    <Select 
                                        value={editForm.condition} 
                                        onValueChange={(val) => setEditForm(prev => ({...prev, condition: val}))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select condition" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="New">New</SelectItem>
                                            <SelectItem value="Good">Good</SelectItem>
                                            <SelectItem value="Fair">Fair</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Pickup Location</Label>
                                    <Input 
                                        placeholder="e.g. Main Campus"
                                        value={editForm.location} 
                                        onChange={(e) => setEditForm(prev => ({...prev, location: e.target.value}))} 
                                    />
                                </div>
                            </div>

                            {/* 4. Description */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Description</Label>
                                <Textarea 
                                    className="min-h-[120px]"
                                    placeholder="Describe the condition, what's included, etc."
                                    value={editForm.description} 
                                    onChange={(e) => setEditForm(prev => ({...prev, description: e.target.value}))} 
                                />
                            </div>

                            {/* 5. Image Upload (Using the ImageUpload component) */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Item Photo</Label>
                                <ImageUpload 
                                    value={editForm.imageUrl} 
                                    onChange={(url) => setEditForm(prev => ({...prev, imageUrl: url}))} 
                                />
                                <p className="text-[0.8rem] text-muted-foreground">Upload a clear photo of your item (JPG/PNG).</p>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t mt-4">
                                <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
                                <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending} className="px-8">
                                    {editMutation.isPending ? "Saving..." : "Update Listing"}
                                </Button>
                            </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    {/* ---------------------------------- */}

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (window.confirm("Are you sure you want to delete this listing? This cannot be undone.")) {
                          deleteItemMutation.mutate(item.id);
                        }
                      }}
                      disabled={deleteItemMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
        
        {unavailableBlocks.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-4">Manual Availability Blocks</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {unavailableBlocks.map(block => (
                <Card key={block.id} className="border-dashed">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-bold text-sm">{block.item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(block.startDate), "MMM d")} - {format(new Date(block.endDate), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate(block.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
        
        <div className="pt-8 border-t flex gap-4">
          <Link href="/items/new">
            <Button>
              <Package className="mr-2 h-4 w-4" />
              List New Item
            </Button>
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Manage your rentals and listings.</p>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="rentals" className="space-y-8">
            <TabsList className="bg-secondary/30 p-1">
              <TabsTrigger value="rentals" className="data-[state=active]:bg-background">My Rentals</TabsTrigger>
              <TabsTrigger value="listings" className="data-[state=active]:bg-background">My Listings</TabsTrigger>
              <TabsTrigger value="earnings" className="data-[state=active]:bg-background">Earnings</TabsTrigger>
              <TabsTrigger value="favorites" className="data-[state=active]:bg-background">Favorites</TabsTrigger>
              <TabsTrigger value="requests" className="data-[state=active]:bg-background">
                Requests
                {rentals?.incoming.filter(r => r.status === 'pending').length ? (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground text-[10px]">
                    {rentals?.incoming.filter(r => r.status === 'pending').length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="rentals">
              <MyRentals />
            </TabsContent>
            
            <TabsContent value="listings">
              <MyListings />
            </TabsContent>

            <TabsContent value="earnings">
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-primary/70">Total Revenue</CardDescription>
                      <CardTitle className="text-3xl font-display">{formatCurrency(totalEarnings)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-xs text-green-600 font-medium">
                        <TrendingUp className="mr-1 h-3 w-3" />
                        All-time earnings
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-xl">Earnings Overview</CardTitle>
                      <CardDescription>Visual breakdown of your rental income</CardDescription>
                    </div>
                    <div className="flex bg-secondary/30 rounded-lg p-1">
                      {(['day', 'month', 'year', 'all'] as const).map((view) => (
                        <Button
                          key={view}
                          variant={earningsView === view ? "default" : "ghost"}
                          size="sm"
                          className="text-xs h-7 px-3 capitalize"
                          onClick={() => setEarningsView(view)}
                        >
                          {view}
                        </Button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={earningsData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            tickFormatter={(value) => `$${value}`}
                          />
                          <Tooltip 
                            cursor={{ fill: 'hsl(var(--secondary)/0.5)' }}
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--background))',
                              borderColor: 'hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: '12px'
                            }}
                            formatter={(value) => [`$${value}`, 'Earnings']}
                          />
                          <Bar 
                            dataKey="amount" 
                            fill="hsl(var(--primary))" 
                            radius={[4, 4, 0, 0]} 
                            barSize={earningsView === 'all' ? 100 : 40}
                          >
                            {earningsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fillOpacity={0.8 + (index / earningsData.length) * 0.2} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="pt-4">
                  <h4 className="text-sm font-medium mb-4">Recent Transactions</h4>
                  <div className="space-y-3">
                    {rentals?.incoming
                      .filter(r => r.status === 'completed' || r.status === 'approved')
                      .slice(0, 5)
                      .map(rental => (
                        <div key={rental.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                              <TrendingUp className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{rental.item.title}</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(rental.startDate), "MMM d, yyyy")}</p>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-green-600">+{formatCurrency(rental.item.pricePerDay)}</p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="favorites">
              <FavoritesList />
            </TabsContent>
            
            <TabsContent value="requests">
              <IncomingRequests />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved':
      return <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>;
    case 'pending':
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
    case 'rejected':
      return <Badge variant="destructive">Rejected</Badge>;
    case 'completed':
      return <Badge variant="secondary">Completed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
