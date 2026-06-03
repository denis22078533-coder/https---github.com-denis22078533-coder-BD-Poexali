import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface RegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToLogin: () => void;
}

export default function RegisterDialog({ open, onOpenChange, onSwitchToLogin }: RegisterDialogProps) {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    setLoading(true);
    const result = await register({ email, password, confirmPassword, companyName: companyName || undefined });
    
    if (result.success) {
      onOpenChange(false);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setCompanyName("");
    } else {
      setError(result.error || "Ошибка регистрации");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="UserPlus" size={18} className="text-gold" />
            Регистрация
          </DialogTitle>
          <DialogDescription>
            Создайте аккаунт, чтобы получить бонусные запросы и сохранять историю
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5 flex items-center gap-1">
              Email <span className="text-negative">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoComplete="email"
              className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold transition-shadow"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5 flex items-center gap-1">
              Пароль <span className="text-negative">*</span>
              <span className="text-[10px] text-muted-foreground font-normal ml-auto">минимум 8 символов, A-Z, a-z, 0-9</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Придумайте надёжный пароль"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold transition-shadow"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5 flex items-center gap-1">
              Подтвердите пароль <span className="text-negative">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              required
              autoComplete="new-password"
              className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold transition-shadow"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Название компании (опционально)</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="ООО «Моя компания»"
              className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold transition-shadow"
            />
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
              <Icon name="UserPlus" size={15} />
            )}
            {loading ? "Регистрация…" : "Зарегистрироваться"}
          </button>

          <div className="text-center text-xs text-muted-foreground">
            Уже есть аккаунт?{" "}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                setTimeout(() => onSwitchToLogin(), 100);
              }}
              className="text-gold hover:underline"
            >
              Войти
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}