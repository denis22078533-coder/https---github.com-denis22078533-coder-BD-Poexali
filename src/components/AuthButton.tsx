import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import LoginDialog from "./LoginDialog";
import RegisterDialog from "./RegisterDialog";

interface AuthButtonProps {
  className?: string;
}

export default function AuthButton({ className = "" }: AuthButtonProps) {
  const { isAuthenticated, email, balance, logout, refreshBalance } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (isAuthenticated && email) {
    return (
      <div className={`flex items-center gap-2 relative ${className}`}>
        {/* Баланс */}
        <button
          onClick={() => refreshBalance()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-900/20 border border-green-800/40 text-xs text-green-400 hover:bg-green-900/30 transition-colors"
          title="Остаток запросов (нажмите обновить)"
        >
          <Icon name="Coins" size={13} />
          <span className="font-mono-fin font-medium">{balance}</span>
        </button>

        {/* Email и выпадающее меню */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
              <span className="text-[10px] font-bold text-gold">
                {email.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-xs hidden sm:block font-medium max-w-[120px] truncate">{email}</span>
            <Icon name="ChevronDown" size={12} className="text-muted-foreground" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-popover border border-border rounded-lg shadow-lg py-1">
                <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
                  <div className="font-medium text-foreground truncate">{email}</div>
                  <div className="mt-0.5">Баланс: <strong className="text-green-400">{balance}</strong> запросов</div>
                </div>
                <button
                  onClick={() => { setShowMenu(false); refreshBalance(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <Icon name="RefreshCw" size={13} />
                  Обновить баланс
                </button>
                <button
                  onClick={() => { setShowMenu(false); logout(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-negative hover:text-negative hover:bg-red-900/20 transition-colors"
                >
                  <Icon name="LogOut" size={13} />
                  Выйти
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowLogin(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 bg-gold text-primary-foreground rounded-lg text-xs font-medium hover:bg-yellow-500 transition-colors ${className}`}
      >
        <Icon name="LogIn" size={14} />
        Войти
      </button>

      <LoginDialog
        open={showLogin}
        onOpenChange={setShowLogin}
        onSwitchToRegister={() => setShowRegister(true)}
      />
      <RegisterDialog
        open={showRegister}
        onOpenChange={setShowRegister}
        onSwitchToLogin={() => setShowLogin(true)}
      />
    </>
  );
}