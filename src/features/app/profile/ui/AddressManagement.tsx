"use client";

import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  Edit2,
  Trash2,
  Home,
  MapPin,
  Plus,
  Check,
  ArrowLeft,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { PageLoader } from "@/components/ui/page-loader";
import { addressDisplayName, addressLabelPreset } from "@/lib/saved-address";
import { AddressBadges } from "./SavedAddressesCard";

import {
  fetchAddresses,
  deleteAddress,
  setDefaultAddress
} from "../api";

export function AddressManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const t = useTranslations("profile.address");

  const { data: addresses = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["user-addresses"],
    queryFn: fetchAddresses,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-addresses"] });
      toast({
        title: t("list.deleted"),
        description: t("list.deletedDescription"),
      });
    },
    onError: () => {
      toast({
        title: t("list.errorTitle"),
        description: t("list.deleteFailed"),
        variant: "destructive",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: setDefaultAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-addresses"] });
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleSetDefault = (id: string) => {
    setDefaultMutation.mutate(id);
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full" asChild>
            <Link href="/profile" aria-label={t("list.back")}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{t("list.title")}</h1>
        </div>
        <Button className="rounded-full" asChild>
          <Link href="/profile/addresses/create">
            <Plus className="w-4 h-4 mr-2" />
            {t("addNew")}
          </Link>
        </Button>
      </div>

      {isError ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-6">
            <p className="text-sm text-destructive">{t("loadError")}</p>
            <Button variant="outline" onClick={() => refetch()}>
              {t("retry")}
            </Button>
          </CardContent>
        </Card>
      ) : addresses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">{t("list.empty")}</p>
            <Button asChild>
              <Link href="/profile/addresses/create">
                <Plus className="w-4 h-4 mr-2" />
                {t("list.addFirst")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => {
            const name = addressDisplayName(address, (p) =>
              t(`form.labelPresets.${p}`)
            );
            const Icon =
              addressLabelPreset(address.label) === "home" ? Home : MapPin;
            return (
              <Card
                key={address.id}
                className={`relative ${address.isDefault ? "border-primary shadow-sm" : ""}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon className="w-4 h-4 text-primary" aria-hidden />
                      <CardTitle className="text-base font-semibold">{name}</CardTitle>
                      <AddressBadges address={address} />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 -mr-2 -mt-2"
                          aria-label={t("list.actions", { name })}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!address.isDefault && (
                          <DropdownMenuItem
                            onClick={() => handleSetDefault(address.id)}
                            disabled={setDefaultMutation.isPending}
                          >
                            <Check className="w-4 h-4 mr-2" /> {t("list.setDefault")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <Link href={`/profile/addresses/${address.id}/edit`}>
                            <Edit2 className="w-4 h-4 mr-2" /> {t("list.edit")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(address.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> {t("list.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{address.street}</p>
                    <p>
                      {address.zip} {address.city}
                    </p>
                    <p>{address.country}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
