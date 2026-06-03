import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/* ─────────────────────── типы плиток ─────────────────────── */
interface TileDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  color: string;        /* tailwind accent class for border/icon */
  fields: FieldDef[];
}

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
  hint?: string;
}

/* ─────────────────────── конфигурация плиток ─────────────── */
const tiles: TileDef[] = [
  {
    id: "functions",
    title: "Функции",
    desc: "Статус скриптов FastAPI",
    icon: "Code2",
    color: "text-sky-400 border-sky-900/40",
    fields: [
      { key: "fastapiUrl", label: "FastAPI URL", placeholder: "https://api.moy-buhuchet.ru" },
      { key: "healthEndpoint", label: "Health-check эндпоинт", placeholder: "/health" },
      { key: "timeout", label: "Таймаут (сек)", placeholder: "30" },
    ],
  },

  {
    id: "storage",
    title: "Хранилище",
    desc: "Яндекс Object Storage S3",
    icon: "HardDrive",
    color: "text-violet-400 border-violet-900/40",
    fields: [
      { key: "bucketName", label: "Имя бакета (Bucket Name)", placeholder: "moy-buhuchet", hint: "Пример: moy-buxgalter" },
      { key: "accessKey", label: "Access Key ID", placeholder: "YCAJExxxxxxxxxxxxx", hint: "Пример: YCAJE0ASk-YYRHKM84fafpy88" },
      { key: "secretKey", label: "Secret Access Key", placeholder: "YCxxxxxxxxxxxxxxxx", type: "password", hint: "Пример: YC...ваш-секретный-ключ..." },
      { key: "endpointUrl", label: "Endpoint URL", placeholder: "https://storage.yandexcloud.net", hint: "Должно быть: https://storage.yandexcloud.net" },
    ],
  },
];

/* ─────────────────────── компонент модалки ───────────────── */
function TileDialog({
  tile,
  data,
  onChange,
  open,
  onOpenChange,
  onSave,
  saving,
  onTest,
  testing,
  sizeMb,
  loadingSize,
}: {
  tile: TileDef;
  data: Record<string, string>;
  onChange: (key: string, val: string) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave?: () => void;
  saving?: boolean;
  onTest?: () => void;
  testing?: boolean;
  sizeMb?: number | null;
  loadingSize?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Icon name={tile.icon} size={18} className={tile.color.split(" ")[0]} />
            <DialogTitle className="text-base text-zinc-100">{tile.title}</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-zinc-500">
            {tile.desc}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {tile.fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs text-zinc-400 mb-1.5">{f.label}</label>
              <input
                type={f.type ?? "text"}
                value={data[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-mono-fin text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-colors"
              />
              {f.hint && (
                <span className="block text-[11px] text-zinc-500 mt-1.5">{f.hint}</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2 flex-wrap">
          {onTest && (
            <button
              onClick={onTest}
              disabled={testing || saving}
              className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {testing ? (
                <div className="w-4 h-4 rounded-full border-2 border-zinc-300 border-t-transparent animate-spin" />
              ) : (
                <Icon name="Wifi" size={14} />
              )}
              Проверить подключение
            </button>
          )}
          {onTest && tile.id === 'storage' && sizeMb !== null && sizeMb !== undefined && (
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Icon name="HardDrive" size={12} />
              Занято: {sizeMb.toFixed(2)} МБ
            </span>
          )}
          {onTest && tile.id === 'storage' && loadingSize && (
            <div className="w-4 h-4 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
          )}
          {onTest && tile.id === 'storage' && !loadingSize && sizeMb === null && (
            <span className="text-xs text-zinc-600">Размер недоступен</span>
          )}

          {onSave && (
            <button
              onClick={onSave}
              disabled={saving}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <Icon name="Save" size={14} />
              )}
              Сохранить
            </button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm rounded-lg transition-colors"
          >
            Готово
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────── главный компонент ───────────────── */
export default function BrainSettings() {
  /* состояние для каждой плитки */
  const [fnData, setFnData] = useState<Record<string, string>>({});

  const [stData, setStData] = useState<Record<string, string>>({});
  const [storageSizeMb, setStorageSizeMb] = useState<number | null>(null);

  const allData: Record<string, Record<string, string>> = {
    functions: fnData,

    storage: stData,
  };

  const setters: Record<string, React.Dispatch<React.SetStateAction<Record<string, string>>>> = {
    functions: setFnData,

    storage: setStData,
  };

  const [activeTile, setActiveTile] = useState<string | null>(null);
  const [savingStorage, setSavingStorage] = useState(false);
  const [testingStorage, setTestingStorage] = useState(false);
  const [loadingStorageSize, setLoadingStorageSize] = useState(false);

  const handleChange = (key: string, val: string) => {
    if (!activeTile) return;
    setters[activeTile]?.((prev) => ({ ...prev, [key]: val }));
  };

  /* ── загрузка размера хранилища при открытии модалки ── */
  const loadStorageSize = async () => {
    if (activeTile !== 'storage') return;
    setLoadingStorageSize(true);
    try {
      const res = await api.s3Settings.get();
      setStorageSizeMb(res.settings.size_mb ?? null);
    } catch {
      setStorageSizeMb(null);
    } finally {
      setLoadingStorageSize(false);
    }
  };

  // Загружаем размер при открытии модалки storage
  useEffect(() => {
    loadStorageSize();
  }, [activeTile]);

  /* ── сохранение Хранилища → api.s3Settings.update ──────── */
  const handleSaveStorage = async () => {
    setSavingStorage(true);
    try {
      const payload: Record<string, string> = {};
      if (stData.bucketName?.trim()) payload.bucket_name = stData.bucketName.trim();
      if (stData.endpointUrl?.trim()) payload.endpoint_url = stData.endpointUrl.trim();
      if (stData.accessKey?.trim()) payload.access_key = stData.accessKey.trim();
      if (stData.secretKey?.trim()) payload.secret_key = stData.secretKey.trim();

      if (Object.keys(payload).length === 0) {
        alert("Нет данных для сохранения. Заполните хотя бы одно поле.");
        return;
      }

      await api.s3Settings.update(payload);
      alert("Настройки сохранены");
    } catch (e) {
      console.error("Ошибка сохранения хранилища:", e);
      alert("Ошибка: " + (e instanceof Error ? e.message : "Неизвестная ошибка"));
    } finally {
      setSavingStorage(false);
    }
  };

  /* ── проверка подключения Хранилища ────────────────────── */
  const handleTestStorage = async () => {
    setTestingStorage(true);
    try {
      const res = await api.s3Settings.test();
      if (res.ok) {
        alert("Подключение успешно!");
      } else {
        alert("Ошибка подключения: " + (res.error || "неизвестная ошибка"));
      }
    } catch (e) {
      alert("Ошибка: " + (e instanceof Error ? e.message : "Неизвестная ошибка"));
    } finally {
      setTestingStorage(false);
    }
  };

  return (
    <div className="animate-fade-in w-full max-w-3xl space-y-3 sm:space-y-4">
      {/* заголовок */}
      <div className="card-fin p-3 sm:p-4 border border-zinc-700/50">
        <div className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500 mb-1 gold-line pl-3">
          Модули бэкенда
        </div>
        <p className="text-xs text-zinc-500 pl-3">
          Настройте параметры подключения к серверным модулям. Данные хранятся локально.
        </p>
      </div>

      {/* сетка 2×2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {tiles.map((tile) => {
          const currentData = allData[tile.id] ?? {};
          const filledCount = Object.keys(currentData).filter(
            (k) => (currentData[k] ?? "").trim().length > 0,
          ).length;
          const totalCount = tile.fields.length;

          return (
            <button
              key={tile.id}
              onClick={() => setActiveTile(tile.id)}
              className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 sm:p-5 text-left transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/80 hover:shadow-[0_0_24px_-6px_rgba(255,255,255,0.04)]"
            >
              {/* subtle glow top edge */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-600/30 to-transparent" />

              <div className="flex items-start gap-3">
                {/* icon circle */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-zinc-900 border border-zinc-800 ${tile.color.split(" ")[0]}`}>
                  <Icon name={tile.icon} size={18} className={tile.color.split(" ")[0]} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-100 transition-colors">
                    {tile.title}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                    {tile.desc}
                  </div>

                  {/* progress bar */}
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-zinc-500"
                        style={{ width: `${(filledCount / totalCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono-fin text-zinc-500 flex-shrink-0">
                      {filledCount}/{totalCount}
                    </span>
                  </div>
                </div>

                {/* arrow hint */}
                <Icon
                  name="ChevronRight"
                  size={14}
                  className="text-zinc-700 group-hover:text-zinc-400 transition-colors flex-shrink-0 mt-2"
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* модалка активной плитки */}
      {tiles.map((tile) => (
        <TileDialog
          key={tile.id}
          tile={tile}
          data={allData[tile.id] ?? {}}
          onChange={handleChange}
          open={activeTile === tile.id}
          onOpenChange={(v) => {
            if (!v) setActiveTile(null);
          }}
          onSave={
            tile.id === "storage"
              ? handleSaveStorage
              : undefined
          }
          saving={
            tile.id === "storage"
              ? savingStorage
              : undefined
          }
          onTest={
            tile.id === "storage"
              ? handleTestStorage
              : undefined
          }
          testing={
            tile.id === "storage"
              ? testingStorage
              : undefined
          }
          sizeMb={
            tile.id === "storage"
              ? storageSizeMb
              : undefined
          }
          loadingSize={
            tile.id === "storage"
              ? loadingStorageSize
              : undefined
          }
        />
      ))}
    </div>
  );
}
