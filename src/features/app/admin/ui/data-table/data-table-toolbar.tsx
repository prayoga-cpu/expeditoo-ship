"use client";

import { Table } from "@tanstack/react-table";
import { X, Search } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangeField } from "@/components/ui/date-range-field";

import { DataTableSortField, type SortField } from "./data-table-sort-field";
import type { DateRangeFilterValue } from "./date-range-filter";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchKey?: string;
  searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  initialValue?: string;
  /** Id of a column carrying `dateRangeFilterFn`, to show a date-range field beside the search box. */
  dateFilterKey?: string;
  /** Columns offered by the "sort by" dropdown, alongside per-column header sorting. */
  sortFields?: SortField[];
}

export function DataTableToolbar<TData>({
  table,
  searchKey,
  searchPlaceholder,
  onSearchChange,
  initialValue = "",
  dateFilterKey,
  sortFields,
}: DataTableToolbarProps<TData>) {
  const t = useTranslations("admin.table");
  const [value, setValue] = useState(initialValue);

  // Debounce search
  useEffect(() => {
    if (!searchKey) return;
    const timeout = setTimeout(() => {
      onSearchChange(value);
    }, 300);

    return () => clearTimeout(timeout);
  }, [value, searchKey, onSearchChange]);

  const isFiltered = table.getState().columnFilters.length > 0;

  const handleClear = useCallback(() => {
    setValue("");
    table.resetColumnFilters();
  }, [table]);

  const dateColumn = dateFilterKey ? table.getColumn(dateFilterKey) : undefined;
  const dateFilterValue = dateColumn?.getFilterValue() as
    | DateRangeFilterValue
    | undefined;

  const handleDateChange = (from: string, to: string) => {
    dateColumn?.setFilterValue(from || to ? { from, to } : undefined);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {searchKey && (
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder || t("searchPlaceholder")}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="pl-8 h-9"
            />
          </div>
        )}
        {dateColumn && (
          <DateRangeField
            from={dateFilterValue?.from ?? ""}
            to={dateFilterValue?.to ?? ""}
            onChange={handleDateChange}
          />
        )}
        {sortFields && sortFields.length > 0 && (
          <DataTableSortField table={table} fields={sortFields} />
        )}
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
