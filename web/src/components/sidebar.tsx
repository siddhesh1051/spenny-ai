import { NavLink } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Home,
  BarChart2,
  Settings,
  LogOut,
  Receipt,
  MessageCircle,
  Server,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
};

function NavItem({ to, end, icon: Icon, label, isCollapsed, onLinkClick }: NavItemProps) {
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
            "flex items-center px-4 py-2.5 rounded-lg transition-colors duration-150",
            isActive
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted text-foreground",
          ].join(" ")
      }
    >
      {({ isActive }) =>
        isCollapsed ? (
          <span
            className={[
              "w-10 h-10 flex items-center justify-center rounded-lg transition-colors duration-150",
              isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground",
            ].join(" ")}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
        ) : (
          <>
            <Icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
            <span className="ml-3 text-sm font-medium whitespace-nowrap">{label}</span>
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

  const userName = user?.user_metadata?.full_name || user?.email;

  const handleLinkClick = () => {
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden cursor-pointer"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={[
          "flex flex-col h-full bg-card border-r py-4",
          "fixed top-0 left-0 z-50",
          "transition-all duration-300 ease-in-out",
          "md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "w-[64px]" : "w-[240px]",
        ].join(" ")}
      >
        {/* Logo */}
        <div className={`flex items-center h-14 shrink-0 ${isCollapsed ? "justify-center" : "px-5"}`}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6 shrink-0 text-primary"
          >
            <path d="M12.378 1.602a.75.75 0 00-.756 0L3 6.632l9 5.25 9-5.25-8.622-5.03zM21.75 7.933l-9 5.25v9.334l9-5.25V7.933zM2.25 7.933v9.334l9 5.25v-9.334l-9-5.25z" />
          </svg>
          <span
            className={[
              "ml-2.5 font-bold text-base whitespace-nowrap transition-all duration-300 overflow-hidden",
              isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto",
            ].join(" ")}
          >
            Spenny AI
          </span>
        </div>

        {/* Divider */}
        <div className={`border-t mb-6 ${isCollapsed ? "mx-3" : "mx-4"}`} />

        {/* Nav */}
        <nav className={`flex-1 space-y-1 overflow-hidden ${isCollapsed ? "px-2" : "px-4"}`}>
          <NavItem
            to="/"
            end
            icon={Home}
            label="Home"
            isCollapsed={isCollapsed}
            onLinkClick={handleLinkClick}
          />
          <NavItem
            to="/transactions"
            icon={Receipt}
            label="All Transactions"
            isCollapsed={isCollapsed}
            onLinkClick={handleLinkClick}
          />
          <NavItem
            to="/analytics"
            icon={BarChart2}
            label="Analytics"
            isCollapsed={isCollapsed}
            onLinkClick={handleLinkClick}
          />
          <NavItem
            to="/whatsapp-integration"
            icon={MessageCircle}
            label="WhatsApp"
            isCollapsed={isCollapsed}
            onLinkClick={handleLinkClick}
          />

          {/* MCP Server — disabled */}
          {isCollapsed ? (
            <div
              className="flex justify-center py-0.5"
              title="MCP Server (Coming soon)"
            >
              <span className="w-10 h-10 flex items-center justify-center rounded-lg opacity-40 cursor-not-allowed select-none">
                <Server className="h-[18px] w-[18px]" />
              </span>
            </div>
          ) : (
            <div className="flex items-center px-4 py-2.5 rounded-lg opacity-40 cursor-not-allowed select-none pointer-events-none">
              <Server className="h-[18px] w-[18px] shrink-0" />
              <span className="ml-3 text-sm font-medium">MCP Server</span>
              <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                Soon
              </span>
            </div>
          )}

          <NavItem
            to="/settings"
            icon={Settings}
            label="Settings"
            isCollapsed={isCollapsed}
            onLinkClick={handleLinkClick}
          />
        </nav>

        {/* Bottom section */}
        <div className={`border-t mt-2 ${isCollapsed ? "mx-3" : "mx-4"}`} />

        {/* Collapse toggle — desktop only */}
        <div className={`hidden md:flex items-center py-2 ${isCollapsed ? "px-2" : "px-4"}`}>
          {/* spacer pushes button right when expanded */}
          {!isCollapsed && <div className="flex-1" />}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={[
              "w-8 h-8 shrink-0 flex items-center justify-center rounded-lg",
              "hover:bg-muted text-muted-foreground hover:text-foreground transition-colors duration-150",
              isCollapsed ? "mx-auto" : "",
            ].join(" ")}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* User profile */}
        <div className={`pb-3 ${isCollapsed ? "flex justify-center px-0" : "px-4"}`}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {isCollapsed ? (
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-muted transition-colors duration-150"
                  title={userName}
                >
                  <Avatar className="w-7 h-7">
                    <AvatarImage
                      src={user?.user_metadata?.avatar_url}
                      alt={userName}
                    />
                    <AvatarFallback className="text-xs">
                      {userName?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full h-10 justify-start px-2 gap-2 rounded-lg hover:bg-muted"
                >
                  <Avatar className="w-7 h-7 shrink-0">
                    <AvatarImage
                      src={user?.user_metadata?.avatar_url}
                      alt={userName}
                    />
                    <AvatarFallback className="text-xs">
                      {userName?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start overflow-hidden">
                    <p className="text-xs font-semibold whitespace-nowrap leading-tight">
                      {userName}
                    </p>
                    <p
                      className="text-[11px] text-muted-foreground max-w-[130px] truncate leading-tight"
                      title={user?.email}
                    >
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
                  <p
                    className="text-xs leading-none text-muted-foreground max-w-[180px] truncate"
                    title={user?.email}
                  >
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
