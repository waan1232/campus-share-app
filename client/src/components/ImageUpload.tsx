import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ImagePlus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
}

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please select an image.", variant: "destructive" });
      return;
    }

    // Limit size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max size is 5MB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      onChange(data.imageUrl); // Send the new URL back to the parent form
      toast({ title: "Image uploaded!" });
    } catch (error) {
      console.error(error);
      toast({ title: "Upload failed", description: "Could not upload image.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // If we already have an image, show the preview
  if (value) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
        <img 
          src={value} 
          alt="Item preview" 
          className="h-full w-full object-cover" 
        />
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 rounded-full shadow-md"
          onClick={() => onChange("")} // Clear the image
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Otherwise, show the upload button
  return (
    <div className="flex items-center justify-center w-full">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileSelect}
      />
      <Button
        type="button"
        variant="outline"
        className="h-32 w-full flex flex-col gap-2 border-dashed border-2 hover:bg-muted/50"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Uploading...</span>
          </>
        ) : (
          <>
            <div className="p-3 bg-primary/10 rounded-full">
              <ImagePlus className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <span className="text-sm font-semibold">Click to upload image</span>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 5MB</p>
            </div>
          </>
        )}
      </Button>
    </div>
  );
}
