import { Navbar } from "@/components/layout/Navbar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertItemSchema } from "@shared/schema";
import { z } from "zod";
import { useCreateItem, useItem, useUpdateItem } from "@/hooks/use-items";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { ImageUpload } from "@/components/ImageUpload"; // <--- NEW IMPORT

// Form schema with validation
const formSchema = insertItemSchema.omit({ ownerId: true, isAvailable: true }).extend({
  pricePerDay: z.coerce.number().min(0.01, "Price must be at least $0.01"),
  condition: z.enum(["New", "Good", "Fair"]).default("Good"),
  location: z.string().min(1, "Location is required").default("Main Campus"),
});

export default function PostItem() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { id } = useParams();
  const isEditing = !!id;
  const itemId = id ? Number(id) : null;

  const { data: item, isLoading: isLoadingItem } = useItem(itemId as number);
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();

  // Redirect if not logged in
  if (!user) {
    setLocation("/login");
    return null;
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      imageUrl: "",
      pricePerDay: undefined,
      condition: "Good",
      location: "Main Campus",
    },
  });

  useEffect(() => {
    if (item && isEditing) {
      form.reset({
        title: item.title,
        description: item.description,
        category: item.category,
        imageUrl: item.imageUrl,
        pricePerDay: item.pricePerDay / 100,
        condition: (item.condition as any) || "Good",
        location: item.location || "Main Campus",
      });
    }
  }, [item, isEditing, form]);

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    const payload = {
      ...data,
      pricePerDay: Math.round(data.pricePerDay * 100),
    };

    if (isEditing && itemId) {
      updateItem.mutate({ id: itemId, data: payload }, {
        onSuccess: () => setLocation("/dashboard")
      });
    } else {
      createItem.mutate(payload, {
        onSuccess: () => setLocation("/dashboard")
      });
    }
  };

  if (isEditing && isLoadingItem) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 container py-12 max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">
              {isEditing ? "Edit Listing" : "List an Item"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isEditing ? "Update your item details below." : "Share your gear with the campus community and earn some extra cash."}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
        
        <div className="bg-card p-8 rounded-2xl border border-border shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. TI-84 Plus CE Calculator" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Electronics">Electronics</SelectItem>
                          <SelectItem value="Textbooks">Textbooks</SelectItem>
                          <SelectItem value="Party">Party Supplies</SelectItem>
                          <SelectItem value="Sports">Sports</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="pricePerDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price per Day ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="5.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="Good">Good</SelectItem>
                          <SelectItem value="Fair">Fair</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup Location</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Main Campus / North Hall" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe the condition, what's included, etc." 
                        className="min-h-[120px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* --- IMAGE UPLOAD FIELD (REPLACES TEXT INPUT) --- */}
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Photo</FormLabel>
                    <FormControl>
                       {/* The new component handles upload & preview */}
                      <ImageUpload 
                        value={field.value} 
                        onChange={field.onChange} 
                      />
                    </FormControl>
                    <FormDescription>
                      Upload a clear photo of your item (JPG/PNG).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="pt-4">
                <Button type="submit" size="lg" className="w-full" disabled={createItem.isPending || updateItem.isPending}>
                  {createItem.isPending || updateItem.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    isEditing ? "Update Listing" : "List Item"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </main>
    </div>
  );
}
