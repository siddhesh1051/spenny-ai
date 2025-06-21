import { NavLink } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Home, BarChart2 } from "lucide-react";

export function Sidebar() {
  return (
    <div className="flex flex-col h-full bg-card border-r text-card-foreground p-2">
      <div className="p-4 mt-auto mb-8 mt-2">
        <div className="flex items-center justify-center font-bold text-2xl">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-8 h-8 mr-2"
          >
            <path d="M12.378 1.602a.75.75 0 00-.756 0L3 6.632l9 5.25 9-5.25-8.622-5.03zM21.75 7.933l-9 5.25v9.334l9-5.25V7.933zM2.25 7.933v9.334l9 5.25v-9.334l-9-5.25z" />
          </svg>
          Expensio
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
      </nav>
      <div className="p-4 flex items-center gap-2">
        <Avatar className="w-5 h-5">
          <AvatarImage
            src="https://i.pravatar.cc/150?u=a042581f4e29026704d"
            alt="Janice Chandler"
          />
          <AvatarFallback>JC</AvatarFallback>
        </Avatar>
        <p className="font-semibold text-sm">Janice Chandler</p>
      </div>
    </div>
  );
}
