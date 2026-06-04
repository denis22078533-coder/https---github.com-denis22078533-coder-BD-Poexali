import { useState } from "react";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";

type StepStatus = "idle" | "loading" | "success" | "error";

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  message?: string;
}

export default function Setup() {
  const [steps, setSteps] = useState<Step[]>([
    { id: "install", label: "Установка базы данных", status: "idle" },
    { id: "migrate", label: "Применение миграций", status: "idle" },
    { id: "register", label: "Проверка регистрации пользователей", status: "idle" },
  ]);
  const [running, setRunning] = useState(false);
  const [allDone, setAllDone] = useState(false);

  const updateStep = (id: string, status: StepStatus, message?: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, message } : s));
  };

  const runSetup = async () => {
    setRunning(true);
    setAllDone(false);
    setSteps(prev => prev.map(s => ({ ...s, status: "idle", message: undefined })));

    // Шаг 1: Установка БД
    updateStep("install", "loading");
    try {
      const installRes = await api.dbSettings.install();
      if (installRes.ok) {
        updateStep("install", "success", "База данных установлена");
      } else {
        updateStep("install", "error", installRes.error || "Ошибка установки");
        setRunning(false);
        return;
      }
    } catch (err: any) {
      updateStep("install", "error", err.message || "Ошибка");
      setRunning(false);
      return;
    }

    // Шаг 2: Миграции
    updateStep("migrate", "loading");
    try {
      const migrateRes = await api.dbSettings.migrate();
      if (migrateRes.ok) {
        updateStep("migrate", "success", `Применено ${migrateRes.applied || 0} миграций`);
      } else {
        updateStep("migrate", "error", migrateRes.error || "Ошибка миграции");
        setRunning(false);
        return;
      }
    } catch (err: any) {
      updateStep("migrate", "error", err.message || "Ошибка");
      setRunning(false);
      return;
    }

    // Шаг 3: Проверка регистрации
    updateStep("register", "loading");
    try {
      // Проверяем, что сервер авторизации отвечает
      const testEmail = `test_${Date.now()}@example.com`;
      const testPass = "Test1234";
      
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, password: testPass }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          updateStep("register", "success", "Регистрация работает! Токен получен");
          setAllDone(true);
        } else {
          updateStep("register", "success", "Сервер ответил, но без токена");
        }
      } else {
        const err = await res.text();
        updateStep("register", "error", `Ошибка: ${err}`);
      }
    } catch (err: any) {
      updateStep("register", "error", err.message || "Сервер не отвечает");
    }
    
    setRunning(false);
  };

  const getIcon = (status: StepStatus) => {
    switch (status) {
      case "loading": return "Loader2";
      case "success": return "CheckCircle2";
      case "error": return "XCircle";
      default: return "Circle";
    }
  };

  const getColor = (status: StepStatus) => {
    switch (status) {
      case "loading": return "text-blue-400";
      case "success": return "text-green-400";
      case "error": return "text-red-400";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="Zap" size={28} className="text-gold" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Установка системы</h1>
        <p className="text-muted-foreground text-sm">
          Нажмите кнопку ниже, чтобы установить базу данных и настроить регистрацию пользователей
        </p>
      </div>

      {/* Список шагов */}
      <div className="space-y-3 mb-8">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-start gap-3 p-4 rounded-lg border ${
              step.status === "success"
                ? "border-green-500/30 bg-green-500/5"
                : step.status === "error"
                ? "border-red-500/30 bg-red-500/5"
                : step.status === "loading"
                ? "border-blue-500/30 bg-blue-500/5"
                : "border-border bg-secondary/50"
            }`}
          >
            <Icon
              name={getIcon(step.status)}
              size={20}
              className={`flex-shrink-0 mt-0.5 ${getColor(step.status)} ${
                step.status === "loading" ? "animate-spin" : ""
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{step.label}</div>
              {step.message && (
                <div className="text-xs text-muted-foreground mt-1 break-all">{step.message}</div>
              )}
            </div>
            {step.status === "success" && (
              <Icon name="Check" size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
            )}
          </div>
        ))}
      </div>

      {/* Кнопка */}
      <button
        onClick={runSetup}
        disabled={running}
        className={`
          w-full py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-3
          transition-all shadow-lg
          ${allDone 
            ? "bg-green-600 hover:bg-green-700 text-white" 
            : "bg-gold hover:bg-yellow-500 text-primary-foreground"
          }
          disabled:opacity-60 disabled:cursor-not-allowed
        `}
      >
        {running ? (
          <>
            <Icon name="Loader2" size={22} className="animate-spin" />
            Выполняется установка...
          </>
        ) : allDone ? (
          <>
            <Icon name="CheckCircle2" size={22} />
            Всё работает! Нажмите для повторной проверки
          </>
        ) : (
          <>
            <Icon name="Rocket" size={22} />
            Установить базу данных и регистрацию
          </>
        )}
      </button>

      {/* Результат */}
      {allDone && (
        <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
          <Icon name="PartyPopper" size={24} className="text-green-400 mx-auto mb-2" />
          <p className="text-green-400 font-medium">
            Регистрация пользователей настроена и работает!
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Теперь вы можете регистрировать новых пользователей через форму регистрации
          </p>
        </div>
      )}

      {steps.some(s => s.status === "error") && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-xs text-red-400 font-medium mb-1">Что делать, если ошибка:</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Убедитесь, что бэкенд-сервер запущен</li>
            <li>Проверьте подключение к интернету</li>
            <li>Попробуйте обновить страницу и нажать кнопку снова</li>
          </ul>
        </div>
      )}
    </div>
  );
}