"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

import {

  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminDateRange } from "../../hooks/useAdminDateRange";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  className?: string;
  tableMinHeight?: string;
  /**
   * Opens a row. The row becomes a keyboard-reachable button when set, so a
   * detail view is not mouse-only. Controls inside a cell must stop
   * propagation, or clicking one both acts and opens the row.
   */
  onRowClick?: (row: TData) => void;
  /**
   * Id of a column using `dateRangeFilterFn`. Filtered by the admin header's
   * global `DateRangeField` (via `useAdminDateRange`), not a table-local
   * control — every table sharing the same range is the point.
   */
  dateFilterKey?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder,
  className,
  tableMinHeight = "50vh",
  onRowClick,
  dateFilterKey,
}: DataTableProps<TData, TValue>) {
  // Simple local state - no URL sync to avoid re-render issues
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
  });

  // Applies the admin panel's one global date range to this table's date
  // column, whenever `dateFilterKey` opts in. `table` is deliberately not a
  // dependency: `useReactTable` returns a new object identity every render,
  // and `setFilterValue` itself triggers a re-render — listing it here would
  // loop. Depending only on the primitive from/to values keeps this to one
  // call per actual range change.
  const dateRange = useAdminDateRange();
  useEffect(() => {
    if (!dateFilterKey) return;
    table
      .getColumn(dateFilterKey)
      ?.setFilterValue(
        dateRange.from || dateRange.to
          ? { from: dateRange.from, to: dateRange.to }
          : undefined
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilterKey, dateRange.from, dateRange.to]);

  // Simple pagination handlers
  const handlePageChange = useCallback((pageIndex: number) => {
    setPagination((prev) => ({ ...prev, pageIndex }));
  }, []);

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setPagination({ pageIndex: 0, pageSize });
  }, []);

  // Simple search handler
  const handleSearchChange = useCallback(
    (value: string) => {
      if (searchKey) {
        table.getColumn(searchKey)?.setFilterValue(value);
      }
    },
    [table, searchKey]
  );

  return (
    <div className={cn("space-y-4", className)}>
      {searchKey && (
        <DataTableToolbar
          table={table}
          searchKey={searchKey}
          searchPlaceholder={searchPlaceholder}
          onSearchChange={handleSearchChange}
          initialValue=""
        />
      )}
      <div className="rounded-md border relative overflow-auto" style={{ minHeight: tableMinHeight }}>
        <table className="w-full caption-bottom text-sm">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                  onClick={
                    onRowClick ? () => onRowClick(row.original) : undefined
                  }
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          // Space scrolls the page otherwise, and the row under
                          // the cursor moves out from under the keyboard user.
                          event.preventDefault();
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
      <DataTablePagination
        table={table}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
}
