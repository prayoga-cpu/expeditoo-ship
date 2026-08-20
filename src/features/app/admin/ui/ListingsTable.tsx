"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Eye,
  MoreVertical,
  Trash2,
  Calendar,
  EyeIcon,
} from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslations } from "next-intl";
import { DataTable, DataTableColumnHeader, dateRangeFilterFn } from "./data-table";

interface Listing {
  id: string;
  title: string;
  user: {
    name: string;
    email: string;
  };
  price: number;
  status: "active" | "sold" | "ended" | "cancelled";
  createdAt: string;
  views: number;
}

interface ListingsTableProps {
  listings: Listing[];
  onDelete?: (id: string) => void;
  onView?: (id: string) => void;
  className?: string;
}

// Helper to format currency (handles cents)
function formatPrice(priceInCents: number): string {
  // Divide by 100 if price appears to be in cents (> 100)
  const price = priceInCents > 1000 ? priceInCents / 100 : priceInCents;
  return `€${price.toFixed(2)}`;
}

// Status badge component
function ListingStatusBadge({
  status,
}: {
  status: "active" | "sold" | "ended" | "cancelled";
}) {
  const styles = {
    active: "bg-green-500 hover:bg-green-600 text-white",
    sold: "bg-blue-500 hover:bg-blue-600 text-white",
    ended: "bg-gray-500 hover:bg-gray-600 text-white",
    cancelled: "bg-red-500 hover:bg-red-600 text-white",
  };

  return <Badge className={styles[status]}>{status}</Badge>;
}

// Action menu component
function ListingActions({
  listingId,
  onView,
  onDeleteQuery,
}: {
  listingId: string;
  onView?: (id: string) => void;
  onDeleteQuery?: (id: string) => void;
}) {
  const t = useTranslations("admin.listings.table");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView?.(listingId)}>
          <Eye className="w-4 h-4 mr-2" />
          {t("viewDetails")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-600"
          onClick={() => onDeleteQuery?.(listingId)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ListingsTable({
  listings,
  onDelete,
  onView,
  className,
}: ListingsTableProps) {
  const t = useTranslations("admin.listings.table");
  const tDialogs = useTranslations("admin.listings.dialogs");
  const [listingToDelete, setListingToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (id: string) => {
    setListingToDelete(id);
  };

  const confirmDelete = async () => {
    if (listingToDelete && onDelete) {
      setIsDeleting(true);
      try {
        await onDelete(listingToDelete);
      } finally {
        setIsDeleting(false);
        setListingToDelete(null);
      }
    }
  };

  // Define columns for TanStack Table
  const columns: ColumnDef<Listing>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("title")} />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.title}</span>
        ),
        filterFn: (row, id, filterValue) => {
          const title = row.original.title.toLowerCase();
          const sellerName = row.original.user.name.toLowerCase();
          const sellerEmail = row.original.user.email.toLowerCase();
          const value = (filterValue as string).toLowerCase();
          return (
            title.includes(value) ||
            sellerName.includes(value) ||
            sellerEmail.includes(value)
          );
        },
      },
      {
        accessorKey: "user",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("seller")} />
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {row.original.user.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.original.user.email}
            </span>
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "price",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("price")} />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{formatPrice(row.original.price)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("status")} />
        ),
        cell: ({ row }) => <ListingStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "views",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("views")} />
        ),
        cell: ({ row }) => <span>{row.original.views}</span>,
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("created")} />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        ),
        filterFn: dateRangeFilterFn<Listing>(),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("actions")}</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <ListingActions
              listingId={row.original.id}
              onView={onView}
              onDeleteQuery={handleDeleteClick}
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const sortFields = [
    { id: "title", label: t("title") },
    { id: "price", label: t("price") },
    { id: "views", label: t("views") },
    { id: "createdAt", label: t("created") },
  ];

  return (
    <>
      {/* Table View - works on all screens with horizontal scroll on mobile */}
      {/* Table View - works on all screens with horizontal scroll on mobile */}
      <DataTable
        columns={columns}
        data={listings}
        searchKey="title"
        searchPlaceholder={t("searchPlaceholder")}
        className={className}
        dateFilterKey="createdAt"
        sortFields={sortFields}
      />

      <AlertDialog
        open={!!listingToDelete}
        onOpenChange={(open) => !open && setListingToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tDialogs("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tDialogs("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {tDialogs("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <LottieLoader width={20} height={20} className="mr-2" />
              ) : null}
              {isDeleting ? tDialogs("processing") : tDialogs("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
