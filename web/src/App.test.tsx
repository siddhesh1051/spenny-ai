import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/test-utils";
import App from "./App";

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        mockOnAuthStateChange(callback);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
    from: (table: string) => mockFrom(table),
  },
}));

describe("App - Full flow integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { groq_api_key: null } }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      upsert: vi.fn().mockResolvedValue({}),
    });
  });

  it("shows AuthPage when no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    render(<App />);

    await vi.waitFor(() => {
      expect(screen.getByText("Welcome")).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows main app with sidebar when session exists", async () => {
    const mockSession = {
      user: { id: "user-1", email: "test@example.com", user_metadata: { full_name: "Test User" } },
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { groq_api_key: null } }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          upsert: vi.fn().mockResolvedValue({}),
        };
      }
      if (table === "expenses") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        upsert: vi.fn().mockResolvedValue({}),
      };
    });

    render(<App />);

    await vi.waitFor(() => {
      expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    });
  });
});
