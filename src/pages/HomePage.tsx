import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Plus, Upload, Edit, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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

export function HomePage({
  expenses,
  isRecording,
  isLoading,
  handleMicClick,
  clearAllExpenses,
  getStructuredExpenses,
  handleExpenseImage,
  deleteExpense,
  updateExpense,
}: {
  expenses: Expense[];
  isRecording: boolean;
  isLoading: boolean;
  handleMicClick: () => void;
  clearAllExpenses: () => void;
  getStructuredExpenses: (text: string) => Promise<void>;
  handleExpenseImage: (file: File) => void;
  deleteExpense: (id: string) => Promise<void>;
  updateExpense: (id: string, updatedFields: Partial<Expense>) => Promise<void>;
}) {
  const [textInput, setTextInput] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [lastImageUrl, setLastImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail && e.detail.imageUrl) {
        setLastImageUrl(e.detail.imageUrl);
      }
    };
    window.addEventListener("spenny-image-shared", handler);
    return () => window.removeEventListener("spenny-image-shared", handler);
  }, []);

  const totalExpense = expenses.reduce(
    (total, expense) => total + expense.amount,
    0
  );

  const handleSaveTextExpense = async () => {
    if (textInput.trim()) {
      await getStructuredExpenses(textInput);
      setTextInput("");
      setIsAddDialogOpen(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleExpenseImage(file);
      const url = URL.createObjectURL(file);
      setLastImageUrl(url);
      window.dispatchEvent(
        new CustomEvent("spenny-image-shared", { detail: { imageUrl: url } })
      );
    }
    event.target.value = ""; // Reset file input
  };

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

  return (
    <div>
      {lastImageUrl && (
        <div className="flex flex-col items-center mb-6">
          <img
            src={lastImageUrl}
            alt="Last uploaded or shared receipt"
            className="max-h-64 rounded-lg shadow border mb-2"
            style={{ objectFit: "contain" }}
          />
          <span className="text-xs text-muted-foreground">
            Last uploaded/shared image
          </span>
        </div>
      )}
      <div className="flex flex-col items-center justify-center h-auto md:h-[50vh] py-12 md:py-0">
        <h2 className="text-xl md:text-2xl font-bold mb-4 text-center">
          Click the mic or button to start
        </h2>
        <div className="flex items-center gap-4 md:gap-8">
          <div className="relative w-28 h-28 md:w-40 md:h-40 flex items-center justify-center">
            {isRecording && (
              <div className="absolute w-full h-full rounded-full bg-gradient-to-r from-cyan-400 via-purple-600 to-pink-600 animate-spin-slow blur-xl"></div>
            )}
            <button
              onClick={handleMicClick}
              disabled={isLoading}
              className="relative w-24 h-24 md:w-32 md:h-32 bg-[#1a0a30] rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <div
                className="absolute w-full h-full rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(44,18,80,1) 0%, rgba(26,10,48,1) 60%)",
                }}
              ></div>
              <div className="relative z-10">
                {isLoading && isRecording ? (
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                ) : (
                  <Mic className="h-12 w-12" />
                )}
              </div>
            </button>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 mt-4">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full shadow-lg transition-transform transform hover:scale-105"
                disabled={isLoading}
              >
                Add Manually <Plus className="h-4 w-4 ml-2" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Expenses Manually</DialogTitle>
                <DialogDescription>
                  Type your expenses in a single sentence. e.g., "Spent 10 on
                  coffee and 150 for groceries"
                </DialogDescription>
              </DialogHeader>
              <Textarea
                placeholder="Enter expenses here..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <DialogFooter>
                <Button onClick={handleSaveTextExpense} disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Expenses"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full shadow-lg transition-transform transform hover:scale-105"
            disabled={isLoading}
          >
            <label htmlFor="image-upload" className="flex items-center">
              Upload Screenshot
              {isLoading && !isRecording ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary ml-2"></div>
              ) : (
                <Upload className="h-4 w-4 ml-2" />
              )}
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={isLoading}
            />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Expenses</CardTitle>
            {expenses.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={clearAllExpenses}
              >
                Clear All
              </Button>
            )}
          </div>
          <CardDescription>
            A list of your most recent expenses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-72 w-full">
            {isLoading ? (
              <>
                {/* Mobile View - Skeleton Card List */}
                <div className="md:hidden space-y-4">
                  {[...Array(3)].map((_, i) => (
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
                      {[...Array(5)].map((_, i) => (
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
              </>
            ) : expenses.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No expenses yet. Click the mic or button to add some.
              </p>
            ) : (
              <>
                {/* Mobile View - Card List */}
                <div className="md:hidden space-y-4">
                  {expenses.map((expense) => (
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
                {/* Desktop View - Table */}
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
                      {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>{expense.description}</TableCell>
                          <TableCell>
                            <span className="mr-2">
                              {categories[expense.category] || "🤷"}
                            </span>
                            {expense.category}
                          </TableCell>
                          <TableCell>
                            {new Date(expense.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
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
          </ScrollArea>
        </CardContent>
        {expenses.length > 0 && (
          <CardFooter className="flex justify-end font-bold text-xl">
            Total: ₹{totalExpense.toFixed(2)}
          </CardFooter>
        )}
      </Card>
      {editingExpense && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Expense</DialogTitle>
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
