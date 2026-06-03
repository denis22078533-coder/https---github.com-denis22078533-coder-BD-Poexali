import { useAuth } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";

interface SidebarUserProps {
  className?: string;
}

export default function SidebarUser({ className = "" }: SidebarUserProps) {
  const { isAuthenticated, email, balance, logout } = useAuth();

  if (isAuthenticated && email) {
    return (
      <div className={`p-4 border-t border-sidebar-border ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-gold">
              {email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate">{email}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Icon name="Coins" size={10} className="text-green-400" />
              <span className="font-mono-fin">{balance} запросов</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-negative hover:bg-red-900/20 transition-colors"
            title="Выйти"
          >
            <Icon name="LogOut" size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 border-t border-sidebar-border ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-zinc-700/30 border border-zinc-600/40 flex items-center justify-center flex-shrink-0">
          <Icon name="User" size={15} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-muted-foreground">Гость</div>
          <div className="text-[11px] text-muted-foreground">5 бесплатных запросов</div>
        </div>
      </div>
    </div>
  );
}