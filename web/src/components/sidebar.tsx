import { NavLink } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BarChart2,
  Settings,
  LogOut,
  Receipt,
  MessageCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  Mail,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { supabase } from "@/lib/supabase";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItemProps = {
  to: string;
  end?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isCollapsed: boolean;
  onLinkClick: () => void;
  badge?: React.ReactNode;
};

function NavItem({ to, end, icon: Icon, label, isCollapsed, onLinkClick, badge }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onLinkClick}
      title={isCollapsed ? label : undefined}
      className={({ isActive }) =>
        isCollapsed
          ? "flex justify-center py-0.5"
          : [
            "group flex items-center px-3 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium",
            isActive
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
          ].join(" ")
      }
    >
      {({ isActive }) =>
        isCollapsed ? (
          <span
            className={[
              "w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150",
              isActive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
            ].join(" ")}
          >
            <Icon className="h-[17px] w-[17px]" />
          </span>
        ) : (
          <>
            <Icon className={`h-[17px] w-[17px] shrink-0 transition-colors ${isActive ? "text-emerald-500" : "opacity-60 group-hover:opacity-100"}`} />
            <span className="ml-2.5 whitespace-nowrap">{label}</span>
            {badge && <span className="ml-auto">{badge}</span>}
          </>
        )
      }
    </NavLink>
  );
}

export function Sidebar({
  user,
  isOpen,
  setIsOpen,
  isCollapsed,
  setIsCollapsed,
}: {
  user: any;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
}) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const { theme, setTheme } = useTheme();
  const userName = user?.user_metadata?.full_name || user?.email;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const effectiveCollapsed = isMobile ? false : isCollapsed;

  const handleLinkClick = () => {
    if (window.innerWidth < 768) setIsOpen(false);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden cursor-pointer"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={[
          "flex flex-col h-full border-r py-3",
          "fixed top-0 left-0 z-50",
          "transition-all duration-300 ease-in-out",
          "md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          effectiveCollapsed ? "w-[60px]" : "w-[232px]",
        ].join(" ")}
        style={{
          background: "var(--card)",
          backgroundImage: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(22,163,74,0.05) 0%, transparent 70%)",
        }}
      >
        {/* ── Logo ── */}
        <div className={`flex items-center h-13 shrink-0 mb-1 ${effectiveCollapsed ? "justify-center px-0" : "px-4"}`}>
          <img
            src="/logo.png"
            alt="Spenny AI"
            className="w-7 h-7 shrink-0 rounded-lg"
          />
          <div
            className={[
              "overflow-hidden transition-all duration-300",
              effectiveCollapsed ? "opacity-0 w-0 ml-0" : "opacity-100 w-auto ml-2.5",
            ].join(" ")}
          >
            <span className="font-bold text-[15px] whitespace-nowrap text-foreground leading-none">
              Spenny<span style={{ color: "#16a34a" }}>AI</span>
            </span>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className={`border-t border-border/50 mb-3 ${effectiveCollapsed ? "mx-2" : "mx-3"}`} />

        {/* ── Nav ── */}
        <nav className={`flex-1 space-y-0.5 overflow-hidden ${effectiveCollapsed ? "px-1.5" : "px-2"}`}>
          <NavItem to="/" end icon={Sparkles} label="Sage" isCollapsed={effectiveCollapsed} onLinkClick={handleLinkClick} />
          <NavItem to="/transactions" icon={Receipt} label="Transactions" isCollapsed={effectiveCollapsed} onLinkClick={handleLinkClick} />
          <NavItem to="/analytics" icon={BarChart2} label="Analytics" isCollapsed={effectiveCollapsed} onLinkClick={handleLinkClick} />

          {/* ── section label ── */}
          {!effectiveCollapsed && (
            <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Integrations
            </p>
          )}
          {effectiveCollapsed && <div className="py-1.5" />}

          <NavItem
            to="/whatsapp-integration"
            icon={MessageCircle}
            label="WhatsApp"
            isCollapsed={effectiveCollapsed}
            onLinkClick={handleLinkClick}
            badge={
              !effectiveCollapsed ? (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="h-2.5 w-2.5" />Pro
                </span>
              ) : undefined
            }
          />
          <NavItem
            to="/gmail-sync"
            icon={Mail}
            label="Gmail Sync"
            isCollapsed={effectiveCollapsed}
            onLinkClick={handleLinkClick}
            badge={
              !effectiveCollapsed ? (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="h-2.5 w-2.5" />Pro
                </span>
              ) : undefined
            }
          />

          {!effectiveCollapsed && (
            <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Account
            </p>
          )}
          {effectiveCollapsed && <div className="py-1.5" />}

          <NavItem to="/settings" icon={Settings} label="Settings" isCollapsed={effectiveCollapsed} onLinkClick={handleLinkClick} />
        </nav>

        {/* ── Bottom divider ── */}
        <div className={`border-t border-border/50 mt-2 ${effectiveCollapsed ? "mx-2" : "mx-3"}`} />

        {/* ── Collapse toggle (desktop) ── */}
        <div className={`hidden md:flex items-center py-2 ${effectiveCollapsed ? "justify-center px-0" : "px-3 justify-end"}`}>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            {effectiveCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* ── Theme toggle ── */}
        {effectiveCollapsed ? (
          <div className="flex justify-center px-0 py-1">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
              title={`Theme: ${theme}`}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              {theme === "dark" ? <Moon className="h-[15px] w-[15px]" /> : theme === "light" ? <Sun className="h-[15px] w-[15px]" /> : <Monitor className="h-[15px] w-[15px]" />}
            </button>
          </div>
        ) : (
          <div className="px-3 py-1">
            <div className="flex items-center justify-between rounded-xl px-2 py-1.5 bg-muted/40">
              <span className="text-xs font-medium text-muted-foreground">Theme</span>
              <div className="flex items-center gap-0.5">
                {(["light", "system", "dark"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    title={t.charAt(0).toUpperCase() + t.slice(1)}
                    className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors duration-150 ${theme === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {t === "light" ? <Sun className="h-3 w-3" /> : t === "system" ? <Monitor className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── User profile ── */}
        <div className={`pt-1 pb-2 ${effectiveCollapsed ? "flex justify-center px-0" : "px-3"}`}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {effectiveCollapsed ? (
                <button
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors duration-150"
                  title={userName}
                >
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt={userName} />
                    <AvatarFallback className="text-[10px]">{userName?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                </button>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full h-10 justify-start px-2 gap-2 rounded-xl hover:bg-muted/70"
                >
                  <Avatar className="w-6 h-6 shrink-0">
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt={userName} />
                    <AvatarFallback className="text-[10px]">{userName?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start overflow-hidden">
                    <p className="text-xs font-semibold whitespace-nowrap leading-tight">{userName}</p>
                    <p className="text-[10px] text-muted-foreground max-w-[130px] truncate leading-tight" title={user?.email}>
                      {user?.email}
                    </p>
                  </div>
                </Button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground max-w-[180px] truncate" title={user?.email}>
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
}
