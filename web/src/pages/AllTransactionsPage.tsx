import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Edit,
  Trash2,
  Search,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import type { DateRange } from "react-day-picker";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const categories: { [key: string]: string } = {
  food: "🍔",
  travel: "✈️",
  groceries: "🛒",
  entertainment: "🎉",
  utilities: "💡",
  rent: "🏠",
  other: "🤷",
};

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

export function AllTransactionsPage({
  expenses,
  isLoading,
  deleteExpense,
  updateExpense,
}: {
  expenses: Expense[];
  isLoading: boolean;
  deleteExpense: (id: string) => Promise<void>;
  updateExpense: (id: string, updatedFields: Partial<Expense>) => Promise<void>;
}) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Export modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStep, setExportStep] = useState<1 | 2>(1);
  const [exportPreset, setExportPreset] = useState<
    "last7" | "last30" | "last90" | "thisMonth" | "custom"
  >("last30");
  const [exportDateFrom, setExportDateFrom] = useState<string>("");
  const [exportDateTo, setExportDateTo] = useState<string>("");
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf" | null>(null);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch =
        !searchQuery.trim() ||
        expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.amount.toString().includes(searchQuery.trim()) ||
        (searchQuery.trim() && !isNaN(Number(searchQuery.trim())) && expense.amount === Number(searchQuery.trim()));
      const matchesCategory =
        categoryFilter === "all" || expense.category === categoryFilter;
      const expenseDate = new Date(expense.date);
      const matchesDateFrom = !dateFrom || expenseDate >= new Date(dateFrom + "T00:00:00");
      const matchesDateTo = !dateTo || expenseDate <= new Date(dateTo + "T23:59:59");
      return matchesSearch && matchesCategory && matchesDateFrom && matchesDateTo;
    });
  }, [expenses, searchQuery, categoryFilter, dateFrom, dateTo]);

  const totalExpense = filteredExpenses.reduce(
    (total, expense) => total + expense.amount,
    0
  );

  const handleEditClick = (expense: Expense) => {
    setEditingExpense({ ...expense });
    setIsEditDialogOpen(true);
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense) return;
    await updateExpense(editingExpense.id, {
      amount: editingExpense.amount,
      category: editingExpense.category,
      description: editingExpense.description,
    });
    setIsEditDialogOpen(false);
    setEditingExpense(null);
  };

  const hasActiveFilters = searchQuery.trim() || categoryFilter !== "all" || dateFrom || dateTo;
  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  // Export: get date range from preset (for a given preset id or current state)
  const getExportDateRangeForPreset = (
    preset: "last7" | "last30" | "last90" | "thisMonth" | "custom"
  ): { from: string; to: string } => {
    const today = new Date();
    if (preset === "last7") {
      const from = format(subDays(today, 6), "yyyy-MM-dd");
      return { from, to: format(today, "yyyy-MM-dd") };
    }
    if (preset === "last30") {
      const from = format(subDays(today, 29), "yyyy-MM-dd");
      return { from, to: format(today, "yyyy-MM-dd") };
    }
    if (preset === "last90") {
      const from = format(subDays(today, 89), "yyyy-MM-dd");
      return { from, to: format(today, "yyyy-MM-dd") };
    }
    if (preset === "thisMonth") {
      const from = format(startOfMonth(today), "yyyy-MM-dd");
      const to = format(endOfMonth(today), "yyyy-MM-dd");
      return { from, to };
    }
    return {
      from: exportDateFrom || format(subDays(today, 29), "yyyy-MM-dd"),
      to: exportDateTo || format(today, "yyyy-MM-dd"),
    };
  };

  const getExportDateRange = (): { from: string; to: string } =>
    getExportDateRangeForPreset(exportPreset);

  const exportRangeExpenses = useMemo(() => {
    const { from, to } = getExportDateRange();
    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59");
    return expenses.filter((e) => {
      const d = new Date(e.date);
      return d >= fromDate && d <= toDate;
    });
  }, [expenses, exportPreset, exportDateFrom, exportDateTo]);

  const downloadCSV = (list: Expense[], from: string, to: string) => {
    const headers = "Date,Description,Category,Amount (₹)\n";
    const rows = list
      .map(
        (e) =>
          `${new Date(e.date).toLocaleDateString()},"${(e.description || "").replace(/"/g, '""')}",${e.category},${e.amount.toFixed(2)}`
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + headers + rows], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = (list: Expense[], from: string, to: string) => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Expenses Export", 14, 15);
    doc.setFontSize(10);
    doc.text(`Date range: ${from} to ${to}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [["Date", "Description", "Category", "Amount (₹)"]],
      body: list.map((e) => [
        new Date(e.date).toLocaleDateString(),
        (e.description || "").slice(0, 40),
        e.category,
        e.amount.toFixed(2),
      ]),
    });
    doc.save(`expenses_${from}_to_${to}.pdf`);
  };

  const openExportModal = () => {
    setExportStep(1);
    setExportFormat(null);
    setExportPreset("last30");
    const today = new Date();
    setExportDateFrom(format(subDays(today, 29), "yyyy-MM-dd"));
    setExportDateTo(format(today, "yyyy-MM-dd"));
    setIsExportModalOpen(true);
  };

  const handleExportNext = () => {
    if (exportStep === 1) setExportStep(2);
  };

  const handleExportBack = () => {
    if (exportStep === 2) setExportStep(1);
  };

  const handleExportDownload = () => {
    if (!exportFormat) return;
    const { from, to } = getExportDateRange();
    const list = expenses.filter((e) => {
      const d = new Date(e.date);
      return d >= new Date(from + "T00:00:00") && d <= new Date(to + "T23:59:59");
    });
    if (exportFormat === "csv") downloadCSV(list, from, to);
    else downloadPDF(list, from, to);
    setIsExportModalOpen(false);
  };

  const canExportNext = () => {
    if (exportPreset === "custom")
      return Boolean(exportDateFrom && exportDateTo);
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Filters section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-4">
            <div>
              <CardTitle className="text-base">Filters</CardTitle>
              <CardDescription>
                Search by name or amount, filter by category, or pick a date range.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={openExportModal}
              className="shrink-0 gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
            {/* Search bar - left */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search by name or amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {/* Category filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[180px] justify-between">
                  <span className="truncate">
                    {categoryFilter === "all"
                      ? "All categories"
                      : `${categories[categoryFilter] || ""} ${categoryFilter}`}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[180px]">
                <DropdownMenuLabel>Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <DropdownMenuRadioItem value="all">All categories</DropdownMenuRadioItem>
                  {Object.keys(categories).map((key) => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      <span className="mr-2">{categories[key]}</span>
                      {key}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Date range - shadcn Range Picker (calendar view) */}
            <DateRangePicker
              value={{
                from: dateFrom || undefined,
                to: dateTo || undefined,
              }}
              onChange={({ from, to }) => {
                setDateFrom(from ?? "");
                setDateTo(to ?? "");
              }}
              placeholder="Date range"
              align="start"
            />
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Complete list of all your expense transactions.
              </CardDescription>
            </div>
            {filteredExpenses.length > 0 && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  Total {hasActiveFilters ? `(filtered)` : ""}
                </p>
                <p className="text-2xl font-bold">₹{totalExpense.toFixed(2)}</p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {/* Mobile View - Skeleton Card List */}
              <div className="md:hidden space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Card key={i} className="px-4 py-3 gap-2">
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-3 w-1/4 mb-2" />
                    <Skeleton className="h-4 w-1/3" />
                  </Card>
                ))}
              </div>
              {/* Desktop View - Skeleton Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(8)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="h-4 w-12" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-12 h-12 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {hasActiveFilters ? "No matching transactions" : "No transactions yet"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {hasActiveFilters
                  ? "Try adjusting your filters or clear them to see all transactions."
                  : "Start adding expenses to see them here."}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile View - Card List */}
              <div className="md:hidden space-y-4">
                {filteredExpenses.map((expense) => (
                  <Card key={expense.id} className="px-4 py-3 gap-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{expense.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {expense.category}
                        </p>
                      </div>
                      <p className="font-bold">
                        ₹{expense.amount.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-xs text-muted-foreground">
                        {new Date(expense.date).toLocaleDateString()}
                      </p>
                      <div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(expense)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteExpense(expense.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              {/* Desktop View - Full Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">
                          {expense.description}
                        </TableCell>
                        <TableCell>
                          <span className="mr-2">
                            {categories[expense.category] || "🤷"}
                          </span>
                          {expense.category}
                        </TableCell>
                        <TableCell>
                          {new Date(expense.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ₹{expense.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(expense)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteExpense(expense.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Export Modal */}
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Export expenses</DialogTitle>
            <DialogDescription>
              {exportStep === 1
                ? "Select a date range for the export."
                : "Choose export format and download."}
            </DialogDescription>
          </DialogHeader>
          {exportStep === 1 ? (
            <div className="grid gap-4 py-2">
              <div className="flex gap-6">
                <div className="flex flex-col gap-1.5 border-r pr-6 shrink-0">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Presets
                  </p>
                  {(
                    [
                      { id: "last7", label: "Last 7 days" },
                      { id: "last30", label: "Last 30 days" },
                      { id: "last90", label: "Last 90 days" },
                      { id: "thisMonth", label: "This month" },
                      { id: "custom", label: "Custom" },
                    ] as const
                  ).map(({ id, label }) => (
                    <Button
                      key={id}
                      variant={exportPreset === id ? "secondary" : "ghost"}
                      size="sm"
                      className="justify-start"
                      onClick={() => {
                        setExportPreset(id);
                        if (id !== "custom") {
                          const { from, to } = getExportDateRangeForPreset(id);
                          setExportDateFrom(from);
                          setExportDateTo(to);
                        }
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="flex-1 min-w-0 flex justify-center">
                  <Calendar
                    key={exportPreset}
                    mode="range"
                    defaultMonth={
                      exportDateFrom
                        ? new Date(exportDateFrom + "T00:00:00")
                        : new Date()
                    }
                    selected={
                      exportDateFrom || exportDateTo
                        ? {
                            from: exportDateFrom
                              ? new Date(exportDateFrom + "T00:00:00")
                              : undefined,
                            to: exportDateTo
                              ? new Date(exportDateTo + "T23:59:59")
                              : undefined,
                          }
                        : undefined
                    }
                    onSelect={(range: DateRange | undefined) => {
                      setExportPreset("custom");
                      setExportDateFrom(
                        range?.from ? format(range.from, "yyyy-MM-dd") : ""
                      );
                      setExportDateTo(
                        range?.to ? format(range.to, "yyyy-MM-dd") : ""
                      );
                    }}
                    numberOfMonths={2}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 py-2">
              <p className="text-sm font-medium text-muted-foreground">
                Choose export format
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setExportFormat("csv")}
                  className={`
                    cursor-pointer group relative flex flex-col items-center gap-3 rounded-xl border-2 p-6
                    transition-all duration-200 ease-out
                    hover:border-primary/70 hover:bg-primary/5 hover:shadow-md
                    hover:ring-2 hover:ring-white/50 dark:hover:ring-white/20
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                    ${exportFormat === "csv"
                      ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/30"
                      : "border-border bg-muted/30"
                    }
                  `}
                >
                  <div
                    className={`
                    flex h-12 w-12 items-center justify-center rounded-lg transition-colors
                    ${exportFormat === "csv"
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary"
                    }
                  `}
                  >
                    <FileSpreadsheet className="h-7 w-7" strokeWidth={1.75} />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">CSV</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Spreadsheet (Excel, Sheets)
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat("pdf")}
                  className={`
                    cursor-pointer group relative flex flex-col items-center gap-3 rounded-xl border-2 p-6
                    transition-all duration-200 ease-out
                    hover:border-primary/70 hover:bg-primary/5 hover:shadow-md
                    hover:ring-2 hover:ring-white/50 dark:hover:ring-white/20
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                    ${exportFormat === "pdf"
                      ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/30"
                      : "border-border bg-muted/30"
                    }
                  `}
                >
                  <div
                    className={`
                    flex h-12 w-12 items-center justify-center rounded-lg transition-colors
                    ${exportFormat === "pdf"
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary"
                    }
                  `}
                  >
                    <FileText className="h-7 w-7" strokeWidth={1.75} />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">PDF</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Document
                    </p>
                  </div>
                </button>
              </div>
              {exportRangeExpenses.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {exportRangeExpenses.length} transaction
                  {exportRangeExpenses.length !== 1 ? "s" : ""} in selected range.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            {exportStep === 1 ? (
              <>
                <Button variant="outline" onClick={() => setIsExportModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleExportNext} disabled={!canExportNext()}>
                  Next
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleExportBack}>
                  Back
                </Button>
                <Button
                  onClick={handleExportDownload}
                  disabled={!exportFormat || exportRangeExpenses.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {editingExpense && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
              <DialogDescription>
                Update the details of this transaction.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="description" className="text-right">
                  Description
                </label>
                <Input
                  id="description"
                  value={editingExpense.description}
                  onChange={(e) =>
                    setEditingExpense({
                      ...editingExpense,
                      description: e.target.value,
                    })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="amount" className="text-right">
                  Amount
                </label>
                <Input
                  id="amount"
                  type="number"
                  value={editingExpense.amount}
                  onChange={(e) =>
                    setEditingExpense({
                      ...editingExpense,
                      amount: Number(e.target.value),
                    })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="category" className="text-right">
                  Category
                </label>
                <Input
                  id="category"
                  value={editingExpense.category}
                  onChange={(e) =>
                    setEditingExpense({
                      ...editingExpense,
                      category: e.target.value,
                    })
                  }
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleUpdateExpense}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 