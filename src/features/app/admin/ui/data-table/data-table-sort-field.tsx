"use client";

import type { Table } from "@tanstack/react-table";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** One column a table's toolbar offers as a sort target. */
export interface SortField {
  /** Column id — must match a `ColumnDef`'s `id`/`accessorKey` and have sorting enabled. */
  id: string;
  label: string;
}

interface DataTableSortFieldProps<TData> {
  table: Table<TData>;
  fields: SortField[];
}

/**
 * A toolbar-level "sort by" control, next to the search box and date range.
 *
 * Every sortable column already toggles asc/desc from its own header (see
 * `DataTableColumnHeader`), but that means hunting for the right header and
 * is awkward once a table scrolls horizontally on mobile. This surfaces the
 * same `table.setSorting` state as one dropdown plus a direction toggle, so
 * sorting is reachable without touching a column at all — while staying the
 * same underlying sort, not a second competing mechanism.
 */
export function DataTableSortField<TData>({
  table,
  fields,
}: DataTableSortFieldProps<TData>) {
  const t = useTranslations("admin.table");
  const current = table.getState().sorting[0];
  const currentField = current && fields.some((f) => f.id === current.id)
    ? current
    : undefined;

  const handleFieldChange = (id: string) => {
    // A field picked for the first time starts ascending; re-picking the
    // field already active keeps its current direction rather than
    // resetting it out from under the direction toggle.
    table.setSorting([{ id, desc: currentField?.id === id ? currentField.desc : false }]);
  };

  const toggleDirection = () => {
    if (!currentField) return;
    table.setSorting([{ id: currentField.id, desc: !currentField.desc }]);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select value={currentField?.id ?? ""} onValueChange={handleFieldChange}>
        <SelectTrigger className="h-9 w-auto gap-2 text-sm">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder={t("sortBy")} />
        </SelectTrigger>
        <SelectContent>
          {fields.map((field) => (
            <SelectItem key={field.id} value={field.id}>
              {field.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {currentField && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={toggleDirection}
          aria-label={
            currentField.desc ? t("sortDescending") : t("sortAscending")
          }
          title={currentField.desc ? t("sortDescending") : t("sortAscending")}
        >
          {currentField.desc ? (
            <ArrowDownWideNarrow className="h-4 w-4" />
          ) : (
            <ArrowUpNarrowWide className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}
