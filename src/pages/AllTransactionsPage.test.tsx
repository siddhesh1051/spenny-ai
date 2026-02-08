import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/test/test-utils";
import { AllTransactionsPage } from "./AllTransactionsPage";

const mockExpenses = [
  {
    id: "1",
    amount: 100,
    category: "food",
    description: "Lunch",
    date: "2025-02-01T12:00:00Z",
  },
  {
    id: "2",
    amount: 50,
    category: "groceries",
    description: "Milk",
    date: "2025-02-02T10:00:00Z",
  },
];

const mockDeleteExpense = vi.fn().mockResolvedValue(undefined);
const mockUpdateExpense = vi.fn().mockResolvedValue(undefined);

describe("AllTransactionsPage - Transactions flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page title and description", () => {
    render(
      <AllTransactionsPage
        expenses={[]}
        isLoading={false}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );
    expect(screen.getByText("All Transactions")).toBeInTheDocument();
    expect(screen.getByText(/view and manage all your expense transactions/i)).toBeInTheDocument();
  });

  it("shows empty state when no expenses", () => {
    render(
      <AllTransactionsPage
        expenses={[]}
        isLoading={false}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );
    expect(screen.getByText("No transactions yet")).toBeInTheDocument();
    expect(screen.getByText(/start adding expenses to see them here/i)).toBeInTheDocument();
  });

  it("shows loading skeletons when isLoading", () => {
    render(
      <AllTransactionsPage
        expenses={[]}
        isLoading={true}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );
    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders expense list with total when expenses exist", () => {
    render(
      <AllTransactionsPage
        expenses={mockExpenses}
        isLoading={false}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );
    expect(screen.getAllByText("Lunch").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Milk").length).toBeGreaterThan(0);
    expect(screen.getByText("₹150.00")).toBeInTheDocument();
  });

  it("opens edit dialog when edit button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <AllTransactionsPage
        expenses={mockExpenses}
        isLoading={false}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );

    // Find the row or card that contains "Lunch", then the edit button (first action button)
    const lunchCell = screen.getAllByText("Lunch")[0]!;
    const row = lunchCell.closest("tr");
    const card = lunchCell.closest('[data-slot="card"]');
    const container = row ?? card;
    expect(container).toBeTruthy();
    const editButton = within(container as HTMLElement).getAllByRole("button")[0]!;
    await user.click(editButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Edit Transaction")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lunch")).toBeInTheDocument();
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
    expect(screen.getByDisplayValue("food")).toBeInTheDocument();
  });

  it("calls updateExpense when saving edit", async () => {
    const user = userEvent.setup();
    render(
      <AllTransactionsPage
        expenses={mockExpenses}
        isLoading={false}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );

    const lunchCell = screen.getAllByText("Lunch")[0]!;
    const row = lunchCell.closest("tr");
    const card = lunchCell.closest('[data-slot="card"]');
    const container = row ?? card;
    const editButton = within(container as HTMLElement).getAllByRole("button")[0]!;
    await user.click(editButton);

    const descInput = await screen.findByDisplayValue("Lunch");
    await user.clear(descInput);
    await user.type(descInput, "Updated Lunch");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(mockUpdateExpense).toHaveBeenCalledWith("1", {
      amount: 100,
      category: "food",
      description: "Updated Lunch",
    });
  });

  it("calls deleteExpense when delete button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <AllTransactionsPage
        expenses={mockExpenses}
        isLoading={false}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );

    const iconButtons = screen.getAllByRole("button").filter((b) => b.querySelector("svg") && !b.textContent?.trim());
    const deleteBtn = iconButtons[iconButtons.length - 1];
    if (deleteBtn) await user.click(deleteBtn);

    expect(mockDeleteExpense).toHaveBeenCalled();
  });
});
