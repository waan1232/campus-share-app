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
        <span className="text-primary hover:underline cursor-pointer">
          Terms of Service & Liability Waiver
        </span>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>CampusShare User Agreement</DialogTitle>
          <DialogDescription>
            Please read carefully before creating your account.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-full pr-4 text-sm text-muted-foreground space-y-4">
          <div className="space-y-4">
            <h3 className="font-bold text-foreground">1. Acceptance of Terms</h3>
            <p>
              By creating an account on CampusShare, you agree to be bound by these Terms. If you do not agree, you may not use the platform.
            </p>

            <h3 className="font-bold text-foreground">2. The Service</h3>
            <p>
              CampusShare is a peer-to-peer venue. We are not a party to any rental agreement between users. We do not own, sell, resell, furnish, provide, rent, re-rent, manage and/or control properties or goods.
            </p>

            <h3 className="font-bold text-foreground">3. Liability Release</h3>
            <p>
              <strong>You hereby release CampusShare and its affiliates from any liability</strong> arising from your use of the service. You agree that:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>CampusShare is not responsible for damage to items rented through the platform.</li>
              <li>CampusShare is not responsible for injury or theft resulting from a meetup.</li>
              <li>You assume all risks associated with meeting other students and exchanging goods.</li>
            </ul>

            <h3 className="font-bold text-foreground">4. Renter Responsibility</h3>
            <p>
              If you rent an item, you are responsible for returning it in the same condition as received. You agree to pay for any damages or loss caused during your rental period, up to the full replacement value of the item.
            </p>

            <h3 className="font-bold text-foreground">5. Owner Responsibility</h3>
            <p>
              Owners represent and warrant that they own the items they list and have the right to rent them. Owners are responsible for inspecting their gear before and after rentals.
            </p>

            <h3 className="font-bold text-foreground">6. Payments & Disputes</h3>
            <p>
              CampusShare facilitates connections but does not process payments directly. All financial transactions (Venmo/CashApp) are solely between users. We cannot reverse payments or force refunds.
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
