"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PendingDelivery, Proposal } from "../types";
import { useState } from "react";
import { Check, MessageSquare, Truck } from "lucide-react";
import { useShipmentProposals } from "../hooks/useShipmentProposals";
import { InlineLoader } from "@/components/ui/page-loader";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { useTranslations } from "next-intl";

interface ShipmentProposalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delivery: PendingDelivery | null;
  onAssign: (driverId: string) => void;
}

export function ShipmentProposalsDialog({
  open,
  onOpenChange,
  delivery,
  onAssign,
}: ShipmentProposalsDialogProps) {
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const t = useTranslations("shipments.proposalsDialog");

  const { proposals, isLoading, acceptProposal, isAccepting } =
    useShipmentProposals(delivery?.id || null, open);

  if (!delivery) return null;

  const handleAcceptProposal = () => {
    if (!selectedProposal) return;

    acceptProposal(
      { shipmentId: delivery.id, proposalId: selectedProposal.id },
      {
        onSuccess: () => {
          onAssign(selectedProposal.driverId);
          onOpenChange(false);
          setSelectedProposal(null);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { id: delivery.id })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Shipment Details */}
            <div className="md:col-span-1 space-y-4">
              <Card className="p-4 bg-muted/50">
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  {t("shipmentDetails")}
                </h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">
                      {t("titleLabel")}
                    </span>
                    <span className="font-medium">{delivery.title}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">
                      {t("routeLabel")}
                    </span>
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span>{delivery.origin}</span>
                      </div>
                      <div className="w-0.5 h-3 bg-border ml-1" />
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span>{delivery.destination}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">
                      {t("targetPrice")}
                    </span>
                    <span className="font-medium">€{delivery.price / 100}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Column: Proposals List */}
            <div className="md:col-span-2 space-y-4">
              <h4 className="font-semibold text-foreground flex items-center justify-between">
                <span>{t("proposalsCount", { count: proposals.length })}</span>
                <Badge variant="outline" className="text-xs font-normal">
                  {proposals.length > 0
                    ? t("actionRequired")
                    : t("waitingProposals")}
                </Badge>
              </h4>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <InlineLoader size="md" />
                  <span className="mt-2 text-sm text-muted-foreground">
                    {t("loadingProposals")}
                  </span>
                </div>
              ) : proposals.length > 0 ? (
                <div className="space-y-3">
                  {proposals.map((proposal: Proposal) => (
                    <div
                      key={proposal.id}
                      onClick={() => setSelectedProposal(proposal)}
                      className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedProposal?.id === proposal.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30 hover:bg-muted/30"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-10 h-10 border">
                            <AvatarImage
                              src={proposal.driver?.image || undefined}
                            />
                            <AvatarFallback>
                              {proposal.driver?.name?.[0] || "D"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-semibold text-foreground">
                                {proposal.driver?.name || "Driver"}
                              </h5>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              ID: {proposal.driverId.substring(0, 8)}
                            </p>

                            {proposal.message && (
                              <div className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground bg-background/50 p-2 rounded-md">
                                <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                                <p className="line-clamp-2 text-xs">
                                  {proposal.message}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-lg font-bold text-primary">
                            €{proposal.price / 100}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {proposal.price > delivery.price ? (
                              <span className="text-red-500 flex items-center justify-end gap-1">
                                +€{(proposal.price - delivery.price) / 100} vs
                                                                {t("vsTarget")}
                              </span>
                            ) : (
                              <span className="text-green-500 flex items-center justify-end gap-1">
                                -€{(delivery.price - proposal.price) / 100} vs
                                                                {t("vsTarget")}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {new Date(proposal.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl">
                  <div className="p-3 bg-muted rounded-full mb-3">
                    <Truck className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold">{t("noProposals")}</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mt-1">
                    {t("noProposalsDesc")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 p-6 pt-4 border-t mt-auto">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isAccepting}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleAcceptProposal}
            disabled={!selectedProposal || isAccepting}
            className="gap-2"
          >
            {isAccepting ? (
              <>
                <LottieLoader width={20} height={20} />
                {t("assigning")}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {t("acceptAssign")}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
