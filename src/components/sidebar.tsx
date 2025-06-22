import { NavLink } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Home, BarChart2, Settings, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "./ui/button";

export function Sidebar({ user }: { user: any }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex flex-col h-full bg-card border-r text-card-foreground p-2">
      <div className="p-4 mb-8 mt-2">
        <div className="flex items-center justify-center font-bold text-2xl">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-8 h-8 mr-2"
          >
            <path d="M12.378 1.602a.75.75 0 00-.756 0L3 6.632l9 5.25 9-5.25-8.622-5.03zM21.75 7.933l-9 5.25v9.334l9-5.25V7.933zM2.25 7.933v9.334l9 5.25v-9.334l-9-5.25z" />
          </svg>
          Spenny AI
        </div>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center px-4 py-2 rounded-lg ${
              isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`
          }
        >
          <Home className="mr-3 h-5 w-5" />
          Home
        </NavLink>
        <NavLink
          to="/analytics"
          className={({ isActive }) =>
            `flex items-center px-4 py-2 rounded-lg ${
              isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`
          }
        >
          <BarChart2 className="mr-3 h-5 w-5" />
          Analytics
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center px-4 py-2 rounded-lg ${
              isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`
          }
        >
          <Settings className="mr-3 h-5 w-5" />
          Settings
        </NavLink>
      </nav>
      <div className="p-4 mt-auto">
        <div className="flex items-center gap-2 mb-4">
          <Avatar className="w-5 h-5">
            <AvatarImage
              src={user?.user_metadata?.avatar_url}
              alt={user?.user_metadata?.full_name || user?.email}
            />
            <AvatarFallback>{user?.email?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <p className="font-semibold text-sm">
            {user?.user_metadata?.full_name || user?.email}
          </p>
        </div>
        <Button onClick={handleLogout} className="w-full" variant="outline">
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </div>
    </div>
  );
}
