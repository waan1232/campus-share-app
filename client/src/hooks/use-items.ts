import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertItem, type Item } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useItems(filters?: { search?: string; category?: string }) {
  // Construct query string for caching key and fetch URL
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.category && filters.category !== "All") params.append("category", filters.category);
  const queryString = params.toString();
  const url = `${api.items.list.path}${queryString ? `?${queryString}` : ""}`;

  return useQuery<(Item & { ownerName: string })[]>({
    queryKey: [api.items.list.path, filters],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });
}

export function useItem(id: number) {
  return useQuery<Item & { ownerName: string }>({
    queryKey: [api.items.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.items.get.path, { id });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Item not found");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertItem> }) => {
      const url = buildUrl(api.items.update.path, { id });
      const res = await fetch(url, {
        method: api.items.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update item");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.items.get.path, data.id] });
      toast({ title: "Item updated!" });
    },
  });
}

export function useFavorites() {
  return useQuery<(Item & { ownerName: string })[]>({
    queryKey: [api.favorites.list.path],
    queryFn: async () => {
      const res = await fetch(api.favorites.list.path);
      if (!res.ok) throw new Error("Failed to fetch favorites");
      return res.json();
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: number) => {
      const url = buildUrl(api.favorites.toggle.path, { itemId });
      const res = await fetch(url, {
        method: api.favorites.toggle.method,
      });
      if (!res.ok) throw new Error("Failed to toggle favorite");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.favorites.list.path] });
    },
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (item: Omit<InsertItem, "ownerId">) => {
      const res = await fetch(api.items.create.path, {
        method: api.items.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create item");
      }
      return api.items.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.items.list.path] });
      toast({
        title: "Item listed!",
        description: "Your item is now available for rent.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating item",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
