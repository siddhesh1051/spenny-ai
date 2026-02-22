import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/test/test-utils";
import AuthPage from "./AuthPage";

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithOAuth = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  },
}));

describe("AuthPage - Auth flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders welcome and sign in / sign up tabs", () => {
    render(<AuthPage />);
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /sign up/i })).toBeInTheDocument();
  });

  it("shows email and password inputs on sign in tab", () => {
    render(<AuthPage />);
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    const tabpanel = screen.getByRole("tabpanel", { name: /sign in/i });
    expect(within(tabpanel).getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("calls signInWithPassword when signing in with email/password", async () => {
    const user = userEvent.setup();
    mockSignInWithPassword.mockResolvedValue({ error: null });
    render(<AuthPage />);

    await user.type(screen.getByPlaceholderText("Email"), "test@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "password123");
    const tabpanel = screen.getByRole("tabpanel", { name: /sign in/i });
    await user.click(within(tabpanel).getByRole("button", { name: /sign in/i }));

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
  });

  it("switches to sign up tab and calls signUp when signing up", async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValue({ error: null });
    render(<AuthPage />);

    await user.click(screen.getByRole("tab", { name: /sign up/i }));
    await user.type(screen.getByPlaceholderText("Email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "securepass");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(mockSignUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "securepass",
      options: {
        data: {
          full_name: "new@example.com",
          groq_api_key: "",
        },
      },
    });
  });

  it("shows error when sign in fails", async () => {
    const user = userEvent.setup();
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    render(<AuthPage />);

    await user.type(screen.getByPlaceholderText("Email"), "bad@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "wrong");
    const tabpanel = screen.getByRole("tabpanel", { name: /sign in/i });
    await user.click(within(tabpanel).getByRole("button", { name: /sign in/i }));

    await expect(screen.findByText("Invalid login credentials")).resolves.toBeInTheDocument();
  });

  it("renders Sign In with Google button", () => {
    render(<AuthPage />);
    expect(screen.getByRole("button", { name: /sign in with google/i })).toBeInTheDocument();
  });

  it("calls signInWithOAuth when clicking Google button", async () => {
    const user = userEvent.setup();
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    render(<AuthPage />);

    await user.click(screen.getByRole("button", { name: /sign in with google/i }));

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({ provider: "google" });
  });
});
