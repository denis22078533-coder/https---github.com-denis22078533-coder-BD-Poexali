import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToRegister: () => void;
}

export default function LoginDialog({ open, onOpenChange, onSwitchToRegister }: LoginDialogProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    const result = await login(email, password);
    if (result.success) {
      onOpenChange(false);
      setEmail("");
      setPassword("");
    } else {
      setError(result.error || "Ошибка входа");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="LogIn" size={18} className="text-gold" />
            Войти в аккаунт
          </DialogTitle>
          <DialogDescription>
            Войдите, чтобы продолжить с вашим балансом запросов
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Пароль</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-secondary border border-border rounded px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                <Icon name={showPassword ? "EyeOff" : "Eye"} size={15} />
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-negative bg-red-900/20 border border-red-900/30 rounded p-2.5">
              <Icon name="AlertCircle" size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gold text-primary-foreground rounded text-sm font-medium hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : (
              <Icon name="LogIn" size={15} />
            )}
            {loading ? "Вход…" : "Войти"}
          </button>

          <div className="text-center text-xs text-muted-foreground">
            Нет аккаунта?{" "}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                setTimeout(() => onSwitchToRegister(), 100);
              }}
              className="text-gold hover:underline"
            >
              Зарегистрироваться
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}