import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertRental } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useRentals() {
  return useQuery({
    queryKey: [api.rentals.list.path],
    queryFn: async () => {
      const res = await fetch(api.rentals.list.path);
      if (!res.ok) throw new Error("Failed to fetch rentals");
      return api.rentals.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateRental() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rental: Omit<InsertRental, "renterId">) => {
      const res = await fetch(api.rentals.create.path, {
        method: api.rentals.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rental),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to request rental");
      }
      return api.rentals.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.rentals.list.path] });
      toast({
        title: "Request sent!",
        description: "The owner has been notified of your request.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Request failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateRentalStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" | "completed" }) => {
      const url = buildUrl(api.rentals.updateStatus.path, { id });
      const res = await fetch(url, {
        method: api.rentals.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }
      return api.rentals.updateStatus.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.rentals.list.path] });
      toast({
        title: `Rental ${variables.status}`,
        description: `Successfully marked rental as ${variables.status}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
