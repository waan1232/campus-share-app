import { Item } from "@shared/schema";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useToggleFavorite, useFavorites } from "@/hooks/use-items";
import { useAuth } from "@/hooks/use-auth";

interface ItemCardProps {
  item: Item & { ownerName: string };
}

export function ItemCard({ item }: ItemCardProps) {
  const { user } = useAuth();
  const toggleFavorite = useToggleFavorite();
  const { data: favorites } = useFavorites();
  
  const isFavorite = favorites?.some(f => f.id === item.id);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    toggleFavorite.mutate(item.id);
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Link href={`/items/${item.id}`}>
        <Card className="overflow-hidden border-none shadow-md hover:shadow-xl transition-shadow duration-300 h-full flex flex-col cursor-pointer group bg-card">
          <div className="relative aspect-[4/3] overflow-hidden">
            <img 
              src={item.imageUrl} 
              alt={item.title}
              className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute top-3 right-3 flex gap-2">
              {user && (
                <Button
                  size="icon"
                  variant="secondary"
                  className={`h-8 w-8 rounded-full backdrop-blur-md ${isFavorite ? 'text-red-500' : 'text-primary'}`}
                  onClick={handleToggleFavorite}
                >
                  <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                </Button>
              )}
              <Badge variant="secondary" className="backdrop-blur-md bg-white/90 text-primary font-semibold shadow-sm">
                {item.category}
              </Badge>
            </div>
            {!item.isAvailable && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[2px]">
                <Badge variant="destructive" className="px-4 py-2 text-sm font-bold uppercase tracking-wide">
                  Rented Out
                </Badge>
              </div>
            )}
          </div>
          
          <CardContent className="p-5 flex-grow">
            <div className="flex justify-between items-start gap-2 mb-2">
              <h3 className="font-display font-bold text-lg leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {item.title}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
              {item.description}
            </p>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {item.ownerName.charAt(0)}
              </div>
              <span>{item.ownerName}</span>
            </div>
          </CardContent>
          
          <CardFooter className="p-5 pt-0 flex items-center justify-between border-t border-border/50 bg-secondary/20 mt-auto">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Per Day</span>
              <span className="font-display font-bold text-lg text-primary">
                {formatCurrency(item.pricePerDay)}
              </span>
            </div>
            <Button size="sm" variant={item.isAvailable ? "default" : "secondary"} disabled={!item.isAvailable}>
              {item.isAvailable ? "Rent Now" : "Unavailable"}
            </Button>
          </CardFooter>
        </Card>
      </Link>
    </motion.div>
  );
}
