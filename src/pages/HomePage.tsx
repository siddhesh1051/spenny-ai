import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Plus } from "lucide-react";
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
}: {
  expenses: Expense[];
  isRecording: boolean;
  isLoading: boolean;
  handleMicClick: () => void;
  clearAllExpenses: () => void;
  getStructuredExpenses: (text: string) => Promise<void>;
}) {
  const [textInput, setTextInput] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const totalExpense = expenses.reduce(
    (total, expense) => total + expense.amount,
    0
  );

  const handleSaveTextExpense = async () => {
    if (textInput.trim()) {
      await getStructuredExpenses(textInput);
      setTextInput("");
      setIsDialogOpen(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-40 h-40 flex items-center justify-center">
            {isRecording && (
              <div className="absolute w-full h-full rounded-full bg-gradient-to-r from-cyan-400 via-purple-600 to-pink-600 animate-spin-slow blur-xl"></div>
            )}
            <button
              onClick={handleMicClick}
              disabled={isLoading}
              className="relative w-32 h-32 bg-[#1a0a30] rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <div
                className="absolute w-full h-full rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(44,18,80,1) 0%, rgba(26,10,48,1) 60%)",
                }}
              ></div>
              <div className="relative z-10">
                {isLoading ? (
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                ) : (
                  <Mic className="h-12 w-12" />
                )}
              </div>
            </button>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full shadow-lg transition-transform transform hover:scale-105"
              >
                <Plus className="h-12 w-12" /> Add Manually
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
          <ScrollArea className="h-72">
            {expenses.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No expenses yet. Click the mic or button to add some.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense, index) => (
                    <TableRow key={index}>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
        {expenses.length > 0 && (
          <CardFooter className="flex justify-end font-bold text-xl">
            Total: ₹{totalExpense.toFixed(2)}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
