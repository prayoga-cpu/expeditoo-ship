"use client";

import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  Edit2,
  Trash2,
  Home,
  Briefcase,
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
import { useToast } from "@/hooks/use-toast";
import { PageLoader } from "@/components/ui/page-loader";



import {
  fetchAddresses,
  deleteAddress,
  setDefaultAddress
} from "../api";

export function AddressManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["user-addresses"],
    queryFn: fetchAddresses,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["user-default-address"] });
      toast({
        title: "Address deleted",
        description: "The address has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete address. Please try again.",
        variant: "destructive",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: setDefaultAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["user-default-address"] });
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleSetDefault = (id: string) => {
    setDefaultMutation.mutate(id);
  };

  if (isLoading) {
    return <PageLoader variant="padded" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/profile">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">My Addresses</h1>
        </div>
        <Link href="/profile/addresses/create">
          <Button className="rounded-full">
            <Plus className="w-4 h-4 mr-2" />
            Add New Address
          </Button>
        </Link>
      </div>

      {addresses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              You haven&apos;t added any addresses yet.
            </p>
            <Link href="/profile/addresses/create">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Address
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <Card
              key={address.id}
              className={`relative ${address.isDefault ? "border-primary shadow-sm" : ""}`}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    {address.label.toLowerCase() === "home" ? (
                      <Home className="w-4 h-4 text-primary" />
                    ) : (
                      <Briefcase className="w-4 h-4 text-primary" />
                    )}
                    <CardTitle className="text-base font-semibold">
                      {address.label}
                    </CardTitle>
                    {address.isDefault && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 -mr-2 -mt-2"
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
                          <Check className="w-4 h-4 mr-2" /> Set as Default
                        </DropdownMenuItem>
                      )}
                      <Link href={`/profile/addresses/${address.id}/edit`}>
                        <DropdownMenuItem>
                          <Edit2 className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(address.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{address.street}</p>
                  <p>
                    {address.city}, {address.zip}
                  </p>
                  <p>{address.country}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
