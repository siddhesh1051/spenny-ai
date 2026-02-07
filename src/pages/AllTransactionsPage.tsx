import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Search, ChevronDown } from "lucide-react";
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
import { DateRangePicker } from "@/components/ui/date-range-picker";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">All Transactions</h1>
        <p className="text-muted-foreground">
          View and manage all your expense transactions in one place.
        </p>
      </div>

      {/* Filters section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            Search by name or amount, filter by category, or pick a date range.
          </CardDescription>
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