import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within, waitFor } from "@/test/test-utils";
import { AllTransactionsPage } from "./AllTransactionsPage";
import { format, subDays } from "date-fns";

vi.mock("jspdf", () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn().mockReturnThis(),
    setFont: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    save: vi.fn(),
    internal: { getNumberOfPages: vi.fn().mockReturnValue(1) },
  })),
}));

vi.mock("jspdf-autotable", () => ({
  default: vi.fn(),
}));

const today = new Date();
const recentDate1 = format(subDays(today, 2), "yyyy-MM-dd") + "T12:00:00Z";
const recentDate2 = format(subDays(today, 1), "yyyy-MM-dd") + "T10:00:00Z";

const mockExpenses = [
  {
    id: "1",
    amount: 100,
    category: "food",
    description: "Lunch",
    date: recentDate1,
  },
  {
    id: "2",
    amount: 50,
    category: "groceries",
    description: "Milk",
    date: recentDate2,
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
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.getByText("Transaction History")).toBeInTheDocument();
    expect(screen.getByText(/complete list of all your expense transactions/i)).toBeInTheDocument();
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

describe("AllTransactionsPage - Export flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Export button", () => {
    render(
      <AllTransactionsPage
        expenses={mockExpenses}
        isLoading={false}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
  });

  it("opens export modal on Export button click", async () => {
    const user = userEvent.setup();
    render(
      <AllTransactionsPage
        expenses={mockExpenses}
        isLoading={false}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );
    await user.click(screen.getByRole("button", { name: /export/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Export expenses")).toBeInTheDocument();
    expect(screen.getByText(/select a date range for the export/i)).toBeInTheDocument();
  });

  it("step 1 shows presets and Next button", async () => {
    const user = userEvent.setup();
    render(
      <AllTransactionsPage
        expenses={mockExpenses}
        isLoading={false}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );
    await user.click(screen.getByRole("button", { name: /export/i }));
    expect(screen.getByText("Presets")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /last 7 days/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /last 30 days/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /last 90 days/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /this month/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /custom/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^next$/i })).toBeInTheDocument();
  });

  it("Next goes to step 2 with format options", async () => {
    const user = userEvent.setup();
    render(
      <AllTransactionsPage
        expenses={mockExpenses}
        isLoading={false}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );
    await user.click(screen.getByRole("button", { name: /export/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^next$/i }));
    expect(within(dialog).getByText(/choose export format and download/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^back$/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /download/i })).toBeInTheDocument();
  });

  it("Back from step 2 returns to step 1", async () => {
    const user = userEvent.setup();
    render(
      <AllTransactionsPage
        expenses={mockExpenses}
        isLoading={false}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );
    await user.click(screen.getByRole("button", { name: /export/i }));
    await user.click(screen.getByRole("button", { name: /^next$/i }));
    await user.click(screen.getByRole("button", { name: /^back$/i }));
    expect(screen.getByText("Presets")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^next$/i })).toBeInTheDocument();
  });

  it("Cancel on step 1 closes export modal", async () => {
    const user = userEvent.setup();
    render(
      <AllTransactionsPage
        expenses={mockExpenses}
        isLoading={false}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );
    await user.click(screen.getByRole("button", { name: /export/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("selecting CSV and Download closes modal", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    render(
      <AllTransactionsPage
        expenses={mockExpenses}
        isLoading={false}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );
    await user.click(screen.getByRole("button", { name: /export/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^next$/i }));
    await user.click(within(dialog).getByRole("button", { name: /csv/i }));
    await user.click(within(dialog).getByRole("button", { name: /download/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("selecting PDF and Download closes modal", async () => {
    const user = userEvent.setup();
    render(
      <AllTransactionsPage
        expenses={mockExpenses}
        isLoading={false}
        deleteExpense={mockDeleteExpense}
        updateExpense={mockUpdateExpense}
      />
    );
    await user.click(screen.getByRole("button", { name: /export/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^next$/i }));
    await user.click(within(dialog).getByRole("button", { name: /pdf/i }));
    const downloadBtn = within(dialog).getByRole("button", { name: /download/i });
    await user.click(downloadBtn);

    await waitFor(
      () => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });
});
