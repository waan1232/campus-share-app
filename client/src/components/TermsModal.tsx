import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function TermsModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <span className="cursor-pointer text-primary hover:underline">
          Terms of Service
        </span>
      </DialogTrigger>
      <DialogContent className="max-w-md h-[80vh]">
        <DialogHeader>
          <DialogTitle>Terms of Service</DialogTitle>
          <DialogDescription>
            Please read the following terms carefully before using CampusShare.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-full pr-4 text-sm text-muted-foreground space-y-4">
          <p><strong>1. Acceptance of Terms</strong><br/>By accessing CampusShare, you agree to be bound by these Terms of Use.</p>
          <p><strong>2. University Affiliation</strong><br/>You must hold a valid .edu email address from a supported university to register.</p>
          <p><strong>3. Liability</strong><br/>CampusShare is a venue. We are not liable for damaged, lost, or stolen items.</p>
          <br/>
          <p><em>(This is a demo legal agreement)</em></p>
        </ScrollArea>
        <div className="flex justify-end">
          <Button type="button" variant="secondary">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
