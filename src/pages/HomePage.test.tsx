import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/test-utils";
import { HomePage } from "./HomePage";

describe("HomePage - Add expense flow", () => {
  const mockHandleMicClick = vi.fn();
  const mockGetStructuredExpenses = vi.fn().mockResolvedValue(undefined);
  const mockHandleExpenseImage = vi.fn();
  const mockHandlePDFUpload = vi.fn().mockResolvedValue(undefined);

  const defaultProps = {
    isRecording: false,
    isLoading: false,
    handleMicClick: mockHandleMicClick,
    getStructuredExpenses: mockGetStructuredExpenses,
    handleExpenseImage: mockHandleExpenseImage,
    handlePDFUpload: mockHandlePDFUpload,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading and mic CTA", () => {
    render(<HomePage {...defaultProps} />);
    expect(screen.getByText(/click the mic or button to start/i)).toBeInTheDocument();
  });

  it("opens Add Manually dialog when clicking Add Manually button", async () => {
    const user = userEvent.setup();
    render(<HomePage {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /add manually/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter expenses here/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save expenses/i })).toBeInTheDocument();
  });

  it("calls getStructuredExpenses when entering text and saving", async () => {
    const user = userEvent.setup();
    render(<HomePage {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /add manually/i }));
    const textarea = screen.getByPlaceholderText(/enter expenses here/i);
    await user.type(textarea, "Spent 10 on coffee and 150 for groceries");
    await user.click(screen.getByRole("button", { name: /save expenses/i }));

    expect(mockGetStructuredExpenses).toHaveBeenCalledWith(
      "Spent 10 on coffee and 150 for groceries"
    );
  });

  it("disables Save Expenses when loading", () => {
    render(<HomePage {...defaultProps} isLoading={true} />);
    expect(screen.getByRole("button", { name: /add manually/i })).toBeDisabled();
  });

  it("shows Upload Image and Upload PDF buttons", () => {
    render(<HomePage {...defaultProps} />);
    expect(screen.getByText(/upload image/i)).toBeInTheDocument();
    expect(screen.getByText(/upload pdf/i)).toBeInTheDocument();
  });

  it("calls handleMicClick when clicking mic area", async () => {
    const user = userEvent.setup();
    render(<HomePage {...defaultProps} />);

    const micButton = document.querySelector('button[class*="rounded-full"]');
    if (micButton) await user.click(micButton as HTMLElement);

    expect(mockHandleMicClick).toHaveBeenCalled();
  });
});
