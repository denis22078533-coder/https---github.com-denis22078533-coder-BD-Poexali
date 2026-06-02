import Icon from "@/components/ui/icon";

/**
 * Модальное окно для ручного ввода даты документа,
 * когда ИИ не смог распознать дату.
 */
interface DatePromptDialogProps {
  /**
   * Показывать ли диалог
   */
  open: boolean;

  /**
   * Название документа (для контекста)
   */
  docName?: string;

  /**
   * Вызывается при подтверждении даты.
   * date — введённая дата в формате "YYYY-MM-DD"
   */
  onConfirm: (date: string) => void;

  /**
   * Вызывается при нажатии «Пропустить» — дата останется пустой
   */
  onSkip: () => void;

  /**
   * Вызывается при закрытии вне зависимости от решения
   */
  onClose: () => void;
}

export default function DatePromptDialog({
  open,
  docName,
  onConfirm,
  onSkip,
  onClose,
}: DatePromptDialogProps) {
  if (!open) return null;

  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const date = formData.get("doc-date") as string;
    if (date) {
      onConfirm(date);
    } else {
      onSkip();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 p-4"
      onClick={() => onClose()}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-sm animate-fade-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Иконка + заголовок */}
        <div className="pt-6 px-5 text-center">
          <div className="w-12 h-12 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-3">
            <Icon name="Calendar" size={22} className="text-gold" />
          </div>
          <h2 className="text-base font-semibold">Дата документа не распознана</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            ИИ не смог определить дату на документе.
            {docName && (
              <>
                <br />
                <span className="text-xs text-muted-foreground/70">«{docName}»</span>
              </>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 pt-4 pb-2">
            <label className="text-xs text-muted-foreground block mb-1.5">
              Укажите дату документа <span className="text-gold">*</span>
            </label>
            <input
              type="date"
              name="doc-date"
              defaultValue={today}
              autoFocus
              className="w-full bg-secondary border border-gold/50 rounded-xl px-4 py-3 text-sm text-foreground font-mono-fin focus:outline-none focus:ring-2 focus:ring-gold/60 transition-all"
            />
          </div>

          <div className="px-5 pb-5 space-y-2 pt-3">
            <button
              type="submit"
              className="w-full py-3 bg-gold text-primary-foreground rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform hover:bg-yellow-500"
            >
              <Icon name="Check" size={16} />
              Сохранить дату
            </button>
            <button
              type="button"
              onClick={() => onSkip()}
              className="w-full py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-gold/30 transition-colors flex items-center justify-center gap-1.5"
            >
              <Icon name="X" size={14} />
              Пропустить — без даты
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
