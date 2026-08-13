"use client";

import { Table } from "@tanstack/react-table";
import { X, Search } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchKey: string;
  searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  initialValue?: string;
}

export function DataTableToolbar<TData>({
  table,
  searchKey,
  searchPlaceholder,
  onSearchChange,
  initialValue = "",
}: DataTableToolbarProps<TData>) {
  const t = useTranslations("admin.table");
  const [value, setValue] = useState(initialValue);

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      onSearchChange(value);
    }, 300);

    return () => clearTimeout(timeout);
  }, [value, onSearchChange]);

  const handleClear = useCallback(() => {
    setValue("");
    onSearchChange("");
  }, [onSearchChange]);

  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder || t("searchPlaceholder")}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="pl-8 h-9"
          />
        </div>
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={handleClear}
            className="h-8 px-2 xl:px-3"
          >
            {t("clearFilters")}
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
