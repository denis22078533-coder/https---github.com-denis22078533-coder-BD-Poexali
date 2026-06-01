import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BrainSettings from "@/components/BrainSettings";
import { api, type AiSettings, type S3Settings, type DbSettingsStatus } from "@/lib/api";

const models = [
  { id: "proxyapi-gpt-4o", name: "GPT-4o (ProxyAPI)", provider: "ProxyAPI", desc: "Лучшая модель OpenAI для русских документов", recommended: true },
  { id: "proxyapi-gpt-4o-mini", name: "GPT-4o mini (ProxyAPI)", provider: "ProxyAPI", desc: "Дешевле, быстрее, тоже видит фото" },
  { id: "proxyapi-claude-3-5-sonnet", name: "Claude 3.5 Sonnet (ProxyAPI)", provider: "ProxyAPI", desc: "Отлично для аналитики и таблиц" },
  { id: "proxyapi-gemini-2.0-flash", name: "Gemini 2.0 Flash (ProxyAPI)", provider: "ProxyAPI", desc: "Очень быстрый, большой контекст" },
  { id: "proxyapi-gemini-1.5-pro", name: "Gemini 1.5 Pro (ProxyAPI)", provider: "ProxyAPI", desc: "Максимум точности Google" },
  { id: "proxyapi-claude-3-haiku", name: "Claude 3 Haiku (ProxyAPI)", provider: "ProxyAPI", desc: "Самый быстрый и дешёвый" },
  { id: "deepseek-chat", name: "DeepSeek V3", provider: "DeepSeek (прямой)", desc: "Доступная цена, прямой ключ" },
  { id: "deepseek-reasoner", name: "DeepSeek R1", provider: "DeepSeek (прямой)", desc: "Режим рассуждений" },
];

const endpointByModel: Record<string, string> = {
  "proxyapi-gpt-4o": "https://api.proxyapi.ru/openai/v1",
  "proxyapi-gpt-4o-mini": "https://api.proxyapi.ru/openai/v1",
  "proxyapi-claude-3-5-sonnet": "https://api.proxyapi.ru/anthropic/v1",
  "proxyapi-claude-3-haiku": "https://api.proxyapi.ru/anthropic/v1",
  "proxyapi-gemini-2.0-flash": "https://api.proxyapi.ru/google/v1beta",
  "proxyapi-gemini-1.5-pro": "https://api.proxyapi.ru/google/v1beta",
  "deepseek-chat": "https://api.deepseek.com/v1",
  "deepseek-reasoner": "https://api.deepseek.com/v1",
};

const providerGroups = [
  { name: "ProxyAPI — один ключ, все модели", color: "text-gold", ids: ["proxyapi-gpt-4o", "proxyapi-gpt-4o-mini", "proxyapi-claude-3-5-sonnet", "proxyapi-gemini-2.0-flash", "proxyapi-gemini-1.5-pro", "proxyapi-claude-3-haiku"] },
  { name: "DeepSeek (прямой ключ)", color: "text-blue-400", ids: ["deepseek-chat", "deepseek-reasoner"] },
];

const visionProviders = [
  { id: "proxyapi-gpt-4o", name: "GPT-4o Vision (ProxyAPI)", desc: "Лучше всех читает рукописные суммы и таблицы", recommended: true },
  { id: "proxyapi-gpt-4o-mini", name: "GPT-4o mini Vision", desc: "Дешевле, для простых чеков" },
  { id: "proxyapi-claude-3-5-sonnet", name: "Claude 3.5 Sonnet Vision", desc: "Отлично с таблицами и накладными" },
  { id: "proxyapi-gemini-2.0-flash", name: "Gemini 2.0 Flash Vision", desc: "Быстрый, многостраничный" },
  { id: "proxyapi-gemini-1.5-pro", name: "Gemini 1.5 Pro Vision", desc: "Максимум точности Google" },
  { id: "yandex", name: "Яндекс Vision OCR (свой ключ)", desc: "Отличен для русского — нужен Folder ID" },
  { id: "gemini", name: "Google Gemini (свой ключ)", desc: "Прямой ключ Google AI Studio" },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState<AiSettings>({
    selected_model: "proxyapi-gpt-4o",
    max_tokens: 4096,
    temperature: 0.3,
    system_prompt: "Ты финансовый ИИ-ассистент для B2B компании. Отвечай профессионально, кратко и по делу. Форматируй суммы в рублях.",
    api_key_set: false,
    api_key_masked: "",
    vision_provider: "proxyapi-gpt-4o",
  });
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [editKey, setEditKey] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [editGeminiKey, setEditGeminiKey] = useState(false);
  const [yandexKeyInput, setYandexKeyInput] = useState("");
  const [yandexFolderInput, setYandexFolderInput] = useState("");
  const [showYandexKey, setShowYandexKey] = useState(false);
  const [editYandexKey, setEditYandexKey] = useState(false);
  const [proxyapiKeyInput, setProxyapiKeyInput] = useState("");
  const [showProxyapiKey, setShowProxyapiKey] = useState(false);
  const [editProxyapiKey, setEditProxyapiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
    ai_model?: string;
    ai?: { ok: boolean; error?: string };
    vision_provider?: string;
    vision?: { ok: boolean | null; error?: string };
    yandex?: { ok: boolean | null; error?: string };
  } | null>(null);

  // S3 — всегда Яндекс Object Storage
  const [s3, setS3] = useState<S3Settings>({ bucket_name: "", endpoint_url: "https://storage.yandexcloud.net", access_key: "", secret_key_masked: "", use_yandex: true });
  const [s3SecretInput, setS3SecretInput] = useState("");
  const [showS3Secret, setShowS3Secret] = useState(false);
  const [s3Saving, setS3Saving] = useState(false);
  const [s3Saved, setS3Saved] = useState(false);
  const [s3SaveError, setS3SaveError] = useState("");
  const [s3Testing, setS3Testing] = useState(false);
  const [s3TestResult, setS3TestResult] = useState<{ ok: boolean; error?: string; message?: string } | null>(null);
  const [fixingAcl, setFixingAcl] = useState(false);
  const [fixAclResult, setFixAclResult] = useState<{ ok: boolean; fixed: number; errors_count: number } | null>(null);

  // DB state
  const [dbStatus, setDbStatus] = useState<DbSettingsStatus | null>(null);
  const [dbInstalling, setDbInstalling] = useState(false);
  const [dbInstallResult, setDbInstallResult] = useState<{ ok?: boolean; steps?: string[]; error?: string; database_url_masked?: string } | null>(null);
  const [dbMigrating, setDbMigrating] = useState(false);
  const [dbMigrateResult, setDbMigrateResult] = useState<{ ok?: boolean; applied?: number; total?: number; errors?: string[]; error?: string } | null>(null);
  const [dbManualUrl, setDbManualUrl] = useState("");
  const [dbSavingUrl, setDbSavingUrl] = useState(false);
  const [dbUrlSaved, setDbUrlSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      api.aiSettings.get(),
      api.s3Settings.get(),
      api.dbSettings.get(),
    ]).then(([aiRes, s3Res, dbRes]) => {
      setSettings(aiRes.settings);
      setS3(s3Res.settings);
      setDbStatus(dbRes);
    }).finally(() => setLoading(false));
  }, []);

  const handleS3Save = async () => {
    setS3Saving(true); setS3Saved(false); setS3SaveError(""); setS3TestResult(null);
    try {
      const payload: Parameters<typeof api.s3Settings.update>[0] = {
        bucket_name: s3.bucket_name,
        endpoint_url: s3.endpoint_url,
        access_key: s3.access_key,
        use_yandex: true,
      };
      if (s3SecretInput.trim()) payload.secret_key = s3SecretInput.trim();
      const res = await api.s3Settings.update(payload);
      setS3(res.settings);
      if (s3SecretInput.trim()) setS3SecretInput("");
      setS3Saved(true);
      setTimeout(() => setS3Saved(false), 3000);
    } catch (e) {
      setS3SaveError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setS3Saving(false);
    }
  };

  const handleS3Test = async () => {
    if (s3SecretInput.trim()) await handleS3Save();
    setS3Testing(true); setS3TestResult(null);
    try {
      const res = await api.s3Settings.test();
      setS3TestResult(res);
    } catch (e) {
      setS3TestResult({ ok: false, error: e instanceof Error ? e.message : "Ошибка" });
    } finally {
      setS3Testing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError("");
    setTestResult(null);
    try {
      const payload: Parameters<typeof api.aiSettings.update>[0] = {
        selected_model: settings.selected_model,
        max_tokens: settings.max_tokens,
        temperature: settings.temperature,
        system_prompt: settings.system_prompt,
        vision_provider: settings.vision_provider || "proxyapi-gpt-4o",
      };
      if (apiKeyInput.trim()) {
        payload.api_key = apiKeyInput.trim();
      }
      if (geminiKeyInput.trim()) {
        payload.gemini_api_key = geminiKeyInput.trim();
      }
      if (yandexKeyInput.trim()) {
        payload.yandex_api_key = yandexKeyInput.trim();
      }
      if (yandexFolderInput.trim()) {
        payload.yandex_folder_id = yandexFolderInput.trim();
      }
      if (proxyapiKeyInput.trim()) {
        payload.proxyapi_key = proxyapiKeyInput.trim();
      }
      const res = await api.aiSettings.update(payload);
      setSettings(res.settings);
      if (apiKeyInput.trim()) { setApiKeyInput(""); setEditKey(false); }
      if (geminiKeyInput.trim()) { setGeminiKeyInput(""); setEditGeminiKey(false); }
      if (yandexKeyInput.trim()) { setYandexKeyInput(""); setEditYandexKey(false); }
      if (yandexFolderInput.trim()) setYandexFolderInput("");
      if (proxyapiKeyInput.trim()) { setProxyapiKeyInput(""); setEditProxyapiKey(false); }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    // Если есть несохранённый ключ — сначала сохраним
    if (apiKeyInput.trim()) {
      await handleSave();
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.aiSettings.testConnection();
      setTestResult(res);
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : "Ошибка подключения" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in max-w-3xl space-y-4">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="card-fin p-5 space-y-3 animate-pulse">
            <div className="h-4 bg-secondary rounded w-1/4" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 bg-secondary rounded" />
              <div className="h-16 bg-secondary rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const currentModel = models.find((m) => m.id === settings.selected_model);

  const currentVision = visionProviders.find((v) => v.id === (settings.vision_provider || "proxyapi-gpt-4o"));

  return (
    <div className="animate-fade-in w-full max-w-3xl space-y-3 sm:space-y-4">

      {/* ── Вкладки ──────────────────────────────── */}
      <Tabs defaultValue="ai" className="w-full">
        <TabsList className="w-full justify-start bg-zinc-900 border border-zinc-800 rounded-lg p-1 mb-2 overflow-x-auto">
          <TabsTrigger
            value="ai"
            className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 text-xs sm:text-sm gap-1.5"
          >
            <Icon name="Bot" size={15} />
            <span className="hidden sm:inline">ИИ-ассистент</span>
            <span className="sm:hidden">ИИ</span>
          </TabsTrigger>
          <TabsTrigger
            value="brain"
            className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 text-xs sm:text-sm gap-1.5"
          >
            <Icon name="Cpu" size={15} />
            Мозг
          </TabsTrigger>
          <TabsTrigger
            value="database"
            className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 text-xs sm:text-sm gap-1.5"
          >
            <Icon name="Database" size={15} />
            <span className="hidden sm:inline">База данных</span>
            <span className="sm:hidden">БД</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-0 space-y-3 sm:space-y-4">

      {/* ── Сводка активных ИИ ──────────────────────────────── */}
      <div className="card-fin p-3 sm:p-4 border border-gold/20">
        <div className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground mb-3 gold-line pl-3">Активный ИИ сейчас</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Чат-модель */}
          <div className="bg-secondary/50 rounded-lg p-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold/15 flex items-center justify-center flex-shrink-0">
              <Icon name="MessageSquare" size={15} className="text-gold" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">ИИ-ассистент (чат)</div>
              <div className="text-sm font-semibold text-foreground truncate">{currentModel?.name || settings.selected_model}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{currentModel?.provider}</div>
              <div className="mt-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
                <span className="text-[11px] text-positive">Используется для чата и анализа</span>
              </div>
            </div>
          </div>
          {/* Vision-модель */}
          <div className="bg-secondary/50 rounded-lg p-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
              <Icon name="ScanLine" size={15} className="text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Распознавание документов</div>
              <div className="text-sm font-semibold text-foreground truncate">{currentVision?.name || settings.vision_provider}</div>
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{currentVision?.desc}</div>
              <div className="mt-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-[11px] text-purple-300">Читает чеки, накладные, фото</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Model selection */}
      <div className="card-fin p-3 sm:p-5">
        <div className="text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest text-muted-foreground mb-3 sm:mb-4 gold-line pl-3">Выбор модели ИИ</div>
        <div className="space-y-3 sm:space-y-4">
          {providerGroups.map((group) => (
            <div key={group.name}>
              <div className={`text-xs font-medium mb-2 ${group.color}`}>{group.name}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.ids.map((id) => {
                  const m = models.find((x) => x.id === id)!;
                  return (
                    <button key={id} onClick={() => setSettings((s) => ({ ...s, selected_model: id }))}
                      className={`p-3 rounded-lg border text-left transition-all ${settings.selected_model === id ? "border-gold bg-gold/5" : "border-border hover:border-gold/30"}`}>
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <span className="text-sm font-medium flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="truncate">{m.name}</span>
                          {m.recommended && (
                            <span className="text-[10px] sm:text-xs bg-gold/20 text-gold px-1.5 py-0.5 rounded font-mono-fin whitespace-nowrap">Рекомендуем</span>
                          )}
                        </span>
                        {settings.selected_model === id && <Icon name="CheckCircle" size={14} className="text-gold flex-shrink-0 mt-0.5" />}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{m.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Key + Test */}
      <div className="card-fin p-3 sm:p-5">
        <div className="text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest text-muted-foreground mb-3 sm:mb-4 gold-line pl-3">Подключение к API</div>
        <div className="space-y-3">

          {/* API Key field */}
          <div>
            <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
              <label className="text-xs text-muted-foreground min-w-0">
                API Ключ
                {currentModel && <span className="ml-2 text-muted-foreground/60 hidden sm:inline">для {currentModel.provider}</span>}
              </label>
              {settings.api_key_set && !editKey && (
                <span className="flex items-center gap-1 text-xs text-positive flex-shrink-0">
                  <Icon name="CheckCircle" size={11} /> Ключ сохранён
                </span>
              )}
            </div>
            <div className="relative">
              {settings.api_key_set && !editKey ? (
                <div className="relative flex items-center w-full bg-secondary border border-border rounded px-3 sm:px-4 py-2.5 pr-16 sm:pr-20">
                  <span className="text-xs sm:text-sm font-mono-fin text-foreground flex-1 truncate">
                    {showKey ? settings.api_key_masked : "sk-" + "●".repeat(16) + settings.api_key_masked?.slice(-4)}
                  </span>
                  <div className="absolute right-1.5 flex items-center gap-0.5">
                    <button type="button" onClick={() => setShowKey(v => !v)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name={showKey ? "EyeOff" : "Eye"} size={15} />
                    </button>
                    <button type="button" onClick={() => { setEditKey(true); setShowKey(false); }} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-gold transition-colors" title="Заменить ключ">
                      <Icon name="Pencil" size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    autoFocus={editKey}
                    type={showKey ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Вставьте API-ключ..."
                    className="w-full bg-secondary border border-gold/50 rounded px-3 sm:px-4 py-2.5 text-sm font-mono-fin text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold pr-16"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <button type="button" onClick={() => setShowKey(v => !v)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name={showKey ? "EyeOff" : "Eye"} size={15} />
                    </button>
                    {editKey && (
                      <button type="button" onClick={() => { setEditKey(false); setApiKeyInput(""); }} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                        <Icon name="X" size={14} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              {settings.api_key_set && !editKey ? "Нажмите карандаш чтобы заменить ключ" : "Ключ сохраняется на сервере, не в браузере"}
            </div>
          </div>

          {/* Endpoint (read-only info) */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">API Endpoint</label>
            <input
              value={endpointByModel[settings.selected_model] ?? "https://api.openai.com/v1"}
              readOnly
              className="w-full bg-secondary border border-border rounded px-4 py-2.5 text-sm font-mono-fin text-muted-foreground focus:outline-none"
            />
          </div>

          {/* ProxyAPI Key — единый ключ для GPT/Claude/Gemini */}
          <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 sm:p-3.5 space-y-2.5">
            <div className="flex items-start gap-2 flex-wrap">
              <Icon name="KeyRound" size={15} className="text-gold flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gold">ProxyAPI — один ключ на GPT, Claude и Gemini</div>
                <div className="text-xs text-muted-foreground">Рекомендуется. Работает из России без VPN, оплата в рублях</div>
              </div>
              {settings.proxyapi_key_set && (
                <span className="flex items-center gap-1 text-xs text-positive whitespace-nowrap flex-shrink-0"><Icon name="CheckCircle" size={11} />Ключ есть</span>
              )}
            </div>
            <div className="relative">
              {settings.proxyapi_key_set && !editProxyapiKey ? (
                <div className="relative flex items-center w-full bg-secondary border border-border rounded px-3 sm:px-4 py-2.5 pr-16 sm:pr-20">
                  <span className="text-xs sm:text-sm font-mono-fin text-foreground flex-1 truncate">
                    {showProxyapiKey ? settings.proxyapi_key_masked : "sk-" + "●".repeat(16) + (settings.proxyapi_key_masked?.slice(-4) || "")}
                  </span>
                  <div className="absolute right-1.5 flex items-center gap-0.5">
                    <button type="button" onClick={() => setShowProxyapiKey(v => !v)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name={showProxyapiKey ? "EyeOff" : "Eye"} size={15} />
                    </button>
                    <button type="button" onClick={() => { setEditProxyapiKey(true); setShowProxyapiKey(false); }} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-gold transition-colors" title="Заменить ключ">
                      <Icon name="Pencil" size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    autoFocus={editProxyapiKey}
                    type={showProxyapiKey ? "text" : "password"}
                    value={proxyapiKeyInput}
                    onChange={(e) => setProxyapiKeyInput(e.target.value)}
                    placeholder="sk-... (ключ из личного кабинета ProxyAPI)"
                    className="w-full bg-secondary border border-gold/50 rounded px-3 sm:px-4 py-2.5 text-sm font-mono-fin text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold pr-16"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <button type="button" onClick={() => setShowProxyapiKey(v => !v)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name={showProxyapiKey ? "EyeOff" : "Eye"} size={15} />
                    </button>
                    {editProxyapiKey && (
                      <button type="button" onClick={() => { setEditProxyapiKey(false); setProxyapiKeyInput(""); }} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                        <Icon name="X" size={14} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <a href="https://proxyapi.ru/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-gold hover:text-yellow-300 transition-colors">
              <Icon name="ExternalLink" size={12} /> Получить ключ на proxyapi.ru
            </a>
          </div>

          {/* Vision провайдер — для распознавания документов */}
          <div className="rounded-lg border border-purple-900/30 bg-purple-900/10 p-3 sm:p-3.5 space-y-2.5">
            <div className="flex items-start gap-2 flex-wrap">
              <Icon name="Eye" size={15} className="text-purple-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-purple-300">ИИ для распознавания документов (Vision)</div>
                <div className="text-xs text-muted-foreground">Какая модель будет читать ваши фото чеков и накладных</div>
              </div>
            </div>
            <select
              value={settings.vision_provider || "proxyapi-gpt-4o"}
              onChange={(e) => setSettings((s) => ({ ...s, vision_provider: e.target.value }))}
              className="w-full bg-secondary border border-purple-500/40 rounded px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {visionProviders.map((vp) => (
                <option key={vp.id} value={vp.id}>
                  {vp.name}{vp.recommended ? " — рекомендуется" : ""}
                </option>
              ))}
            </select>
            <div className="text-xs text-muted-foreground">
              {visionProviders.find(v => v.id === (settings.vision_provider || "proxyapi-gpt-4o"))?.desc}
            </div>
          </div>

          {/* Gemini API Key — для распознавания фото */}
          <div className="rounded-lg border border-blue-900/30 bg-blue-900/10 p-3 sm:p-3.5 space-y-2.5">
            <div className="flex items-start gap-2 flex-wrap">
              <Icon name="ScanLine" size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-blue-300">Google Gemini — распознавание фото</div>
                <div className="text-xs text-muted-foreground">Бесплатно. Для чтения накладных и чеков</div>
              </div>
              {settings.gemini_key_set && (
                <span className="flex items-center gap-1 text-xs text-positive whitespace-nowrap flex-shrink-0"><Icon name="CheckCircle" size={11} />Ключ есть</span>
              )}
            </div>
            <div className="relative">
              {settings.gemini_key_set && !editGeminiKey ? (
                <div className="relative flex items-center w-full bg-secondary border border-border rounded px-3 sm:px-4 py-2.5 pr-16 sm:pr-20">
                  <span className="text-xs sm:text-sm font-mono-fin text-foreground flex-1 truncate">
                    {showGeminiKey ? settings.gemini_key_masked : "AIza" + "●".repeat(16) + settings.gemini_key_masked?.slice(-4)}
                  </span>
                  <div className="absolute right-1.5 flex items-center gap-0.5">
                    <button type="button" onClick={() => setShowGeminiKey(v => !v)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name={showGeminiKey ? "EyeOff" : "Eye"} size={15} />
                    </button>
                    <button type="button" onClick={() => { setEditGeminiKey(true); setShowGeminiKey(false); }} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-blue-400 transition-colors" title="Заменить ключ">
                      <Icon name="Pencil" size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    autoFocus={editGeminiKey}
                    type={showGeminiKey ? "text" : "password"}
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder="Вставьте ключ AIzaSy..."
                    className="w-full bg-secondary border border-blue-500/50 rounded px-3 sm:px-4 py-2.5 text-sm font-mono-fin text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-blue-500 pr-16"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <button type="button" onClick={() => setShowGeminiKey(v => !v)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name={showGeminiKey ? "EyeOff" : "Eye"} size={15} />
                    </button>
                    {editGeminiKey && (
                      <button type="button" onClick={() => { setEditGeminiKey(false); setGeminiKeyInput(""); }} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                        <Icon name="X" size={14} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
              <Icon name="ExternalLink" size={12} /> Получить бесплатный ключ на aistudio.google.com
            </a>
          </div>

          {/* Yandex Vision — распознавание фото (приоритетный) */}
          <div className="rounded-lg border border-red-900/30 bg-red-900/10 p-3 sm:p-3.5 space-y-2.5">
            <div className="flex items-start gap-2 flex-wrap">
              <Icon name="ScanEye" size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-red-300">Яндекс Vision — распознавание документов</div>
                <div className="text-xs text-muted-foreground">Приоритетный провайдер. Отлично читает русский текст</div>
              </div>
              {settings.yandex_key_set && (
                <span className="flex items-center gap-1 text-xs text-positive whitespace-nowrap flex-shrink-0"><Icon name="CheckCircle" size={11} />Ключ есть</span>
              )}
            </div>
            <div className="relative">
              {settings.yandex_key_set && !editYandexKey ? (
                <div className="relative flex items-center w-full bg-secondary border border-border rounded px-3 sm:px-4 py-2.5 pr-16 sm:pr-20">
                  <span className="text-xs sm:text-sm font-mono-fin text-foreground flex-1 truncate">
                    {showYandexKey
                      ? settings.yandex_key_masked
                      : "AQVN" + "●".repeat(16) + settings.yandex_key_masked?.slice(-4)}
                  </span>
                  <div className="absolute right-1.5 flex items-center gap-0.5">
                    <button type="button" onClick={() => setShowYandexKey(v => !v)}
                      className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name={showYandexKey ? "EyeOff" : "Eye"} size={15} />
                    </button>
                    <button type="button" onClick={() => { setEditYandexKey(true); setShowYandexKey(false); }}
                      className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors" title="Заменить ключ">
                      <Icon name="Pencil" size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    autoFocus={editYandexKey}
                    type={showYandexKey ? "text" : "password"}
                    value={yandexKeyInput}
                    onChange={(e) => setYandexKeyInput(e.target.value)}
                    placeholder="API-ключ AQVN..."
                    className="w-full bg-secondary border border-red-500/50 rounded px-3 sm:px-4 py-2.5 text-sm font-mono-fin text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-red-500 pr-16"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <button type="button" onClick={() => setShowYandexKey(v => !v)}
                      className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name={showYandexKey ? "EyeOff" : "Eye"} size={15} />
                    </button>
                    {editYandexKey && (
                      <button type="button" onClick={() => { setEditYandexKey(false); setYandexKeyInput(""); }}
                        className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Отмена">
                        <Icon name="X" size={14} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Folder ID каталога Яндекс Облако
                {settings.yandex_folder_set && !yandexFolderInput && (
                  <span className="ml-2 text-positive">✓ сохранён</span>
                )}
              </label>
              <input
                type="text"
                value={yandexFolderInput}
                onChange={(e) => setYandexFolderInput(e.target.value)}
                placeholder={settings.yandex_folder_masked || "b1g..."}
                className="w-full bg-secondary border border-border rounded px-3 sm:px-4 py-2.5 text-sm font-mono-fin text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <a href="https://console.yandex.cloud" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
              <Icon name="ExternalLink" size={12} /> Открыть Яндекс Облако — скопировать ключ и Folder ID
            </a>
          </div>

          {/* Test connection result */}
          {testResult && (
            <div className="space-y-2 animate-fade-in">
              {/* ИИ-модель */}
              <div className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm ${
                testResult.ai?.ok
                  ? "bg-green-900/20 border-green-900/30"
                  : "bg-red-900/20 border-red-900/30"
              }`}>
                <Icon name={testResult.ai?.ok ? "CheckCircle" : "AlertCircle"} size={15} className={`flex-shrink-0 mt-0.5 ${testResult.ai?.ok ? "text-positive" : "text-negative"}`} />
                <div>
                  <div className={`font-medium ${testResult.ai?.ok ? "text-positive" : "text-negative"}`}>
                    ИИ-чат ({currentModel?.name}): {testResult.ai?.ok ? "✓ работает" : "✗ ошибка"}
                  </div>
                  {!testResult.ai?.ok && testResult.ai?.error && (
                    <div className="text-xs text-negative/80 mt-0.5">{testResult.ai.error}</div>
                  )}
                </div>
              </div>
              {/* Vision-провайдер (Yandex / ProxyAPI / Gemini) */}
              {(() => {
                const v = testResult.vision || testResult.yandex;
                const vpName = visionProviders.find(p => p.id === (testResult.vision_provider || settings.vision_provider))?.name || "Vision";
                return (
                  <div className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm ${
                    v?.ok === true
                      ? "bg-green-900/20 border-green-900/30"
                      : v?.ok === null
                      ? "bg-secondary border-border"
                      : "bg-red-900/20 border-red-900/30"
                  }`}>
                    <Icon
                      name={v?.ok === true ? "CheckCircle" : v?.ok === null ? "Info" : "AlertCircle"}
                      size={15}
                      className={`flex-shrink-0 mt-0.5 ${v?.ok === true ? "text-positive" : v?.ok === null ? "text-muted-foreground" : "text-negative"}`}
                    />
                    <div>
                      <div className={`font-medium ${v?.ok === true ? "text-positive" : v?.ok === null ? "text-muted-foreground" : "text-negative"}`}>
                        Распознавание ({vpName}): {v?.ok === true ? "✓ работает" : v?.ok === null ? "— ключ не задан" : "✗ ошибка"}
                      </div>
                      {v?.error && (
                        <div className="text-xs mt-0.5 text-negative/80">{v.error}</div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Generation params */}
      <div className="card-fin p-4 sm:p-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-4 gold-line pl-3">Параметры генерации</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Максимум токенов</label>
            <input
              type="number"
              value={settings.max_tokens}
              onChange={(e) => setSettings((s) => ({ ...s, max_tokens: Number(e.target.value) }))}
              className="w-full bg-secondary border border-border rounded px-4 py-2.5 text-sm font-mono-fin text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground flex items-center justify-between mb-1.5">
              <span>Температура</span>
              <span className="font-mono-fin text-gold">{settings.temperature}</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.1"
              value={settings.temperature}
              onChange={(e) => setSettings((s) => ({ ...s, temperature: Number(e.target.value) }))}
              className="w-full accent-yellow-500"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Точно</span><span>Творчески</span>
            </div>
          </div>
        </div>
      </div>

      {/* System prompt */}
      <div className="card-fin p-4 sm:p-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-4 gold-line pl-3">Системный промпт</div>
        <textarea
          rows={4}
          value={settings.system_prompt}
          onChange={(e) => setSettings((s) => ({ ...s, system_prompt: e.target.value }))}
          className="w-full bg-secondary border border-border rounded px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold resize-none leading-relaxed"
        />
      </div>

      {/* Action buttons AI */}
      <div className="flex flex-wrap items-center gap-3 pb-2">
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2.5 bg-gold text-primary-foreground rounded text-sm font-medium hover:bg-yellow-500 transition-colors flex items-center gap-2 disabled:opacity-50">
          {saving ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : <Icon name="Save" size={15} />}
          Сохранить ИИ
        </button>
        <button onClick={handleTest} disabled={testing || saving}
          className="px-4 py-2.5 border border-border rounded text-sm text-muted-foreground hover:text-foreground hover:border-gold/40 transition-colors flex items-center gap-2 disabled:opacity-50">
          {testing ? <div className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" /> : <Icon name="Wifi" size={15} />}
          Проверить связь с ИИ
        </button>
        {saved && <span className="flex items-center gap-1.5 text-xs text-positive animate-fade-in"><Icon name="CheckCircle" size={13} /> Сохранено</span>}
        {saveError && <span className="flex items-center gap-1.5 text-xs text-negative animate-fade-in"><Icon name="AlertCircle" size={13} /> {saveError}</span>}
      </div>

      {/* ═══════════ БЛОК S3 ═══════════ */}
      <div className="card-fin p-4 sm:p-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1 gold-line pl-3">Яндекс Object Storage (S3)</div>
        <div className="text-xs text-muted-foreground mb-4 pl-3">Хранилище для фото документов и PDF-отчётов</div>

        <div className="mb-4 flex items-center p-3 rounded-lg border border-gold/30 bg-gold/5">
          <div>
            <div className="text-sm font-medium text-gold">Яндекс Object Storage</div>
            <div className="text-xs text-muted-foreground mt-0.5">Файлы сохраняются в ваш Яндекс бакет</div>
          </div>

      <div className="space-y-3">
            <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gold">
                <Icon name="BookOpen" size={15} />
                Как подключить Яндекс Object Storage
              </div>
              <ol className="space-y-2.5 text-xs text-muted-foreground list-none">
                <li className="flex gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>Войдите в <span className="text-foreground font-medium">console.yandex.cloud</span> → выберите каталог → раздел <span className="text-foreground font-medium">Object Storage</span></span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>Нажмите <span className="text-foreground font-medium">«Создать бакет»</span> → задайте имя (латиницей, например <span className="font-mono text-gold/80">moy-buhuchet</span>) → доступ <span className="text-foreground font-medium">«Публичный»</span> → Создать</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>Перейдите в <span className="text-foreground font-medium">Сервисные аккаунты</span> → создайте аккаунт с ролью <span className="text-foreground font-medium">storage.editor</span></span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-bold">4</span>
                  <span>На странице сервисного аккаунта нажмите <span className="text-foreground font-medium">«Создать новый ключ»</span> → <span className="text-foreground font-medium">«Статический ключ доступа»</span> → скопируйте <span className="text-gold/80 font-mono">Access Key ID</span> и <span className="text-gold/80 font-mono">Secret Access Key</span> — они показываются один раз!</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-bold">5</span>
                  <span>Вставьте ключи в поля ниже. В поле <span className="text-foreground font-medium">Endpoint URL</span> должно быть: <span className="font-mono text-gold/90 select-all">https://storage.yandexcloud.net</span> — не меняйте. Нажмите <span className="text-foreground font-medium">«Сохранить»</span>, затем <span className="text-foreground font-medium">«Проверить связь»</span></span>
                </li>
              </ol>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Имя бакета (Bucket Name)</label>
                <input value={s3.bucket_name} onChange={(e) => setS3((s) => ({ ...s, bucket_name: e.target.value }))}
                  placeholder="moy-buhuchet"
                  className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm font-mono-fin text-foreground focus:outline-none focus:ring-1 focus:ring-gold" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Endpoint URL</label>
                <div className="flex gap-1.5">
                  <input value={s3.endpoint_url} onChange={(e) => setS3((s) => ({ ...s, endpoint_url: e.target.value }))}
                    placeholder="https://storage.yandexcloud.net"
                    className="flex-1 bg-secondary border border-border rounded px-3 py-2.5 text-sm font-mono-fin text-foreground focus:outline-none focus:ring-1 focus:ring-gold" />
                  <button type="button" onClick={() => setS3((s) => ({ ...s, endpoint_url: "https://storage.yandexcloud.net" }))}
                    className="px-2.5 py-2 rounded border border-border text-xs text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors whitespace-nowrap flex-shrink-0">
                    Сбросить
                  </button>
                </div>
                <div className="text-[11px] text-muted-foreground/70 mt-1">Должно быть: <span className="font-mono text-gold/80">https://storage.yandexcloud.net</span></div>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Access Key ID</label>
              <input value={s3.access_key} onChange={(e) => setS3((s) => ({ ...s, access_key: e.target.value }))}
                placeholder="YCAJExxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm font-mono-fin text-foreground focus:outline-none focus:ring-1 focus:ring-gold" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-muted-foreground">Secret Access Key</label>
                {s3.secret_key_masked && !s3SecretInput && (
                  <span className="flex items-center gap-1 text-xs text-positive"><Icon name="CheckCircle" size={11} /> Ключ сохранён</span>
                )}
              </div>
              <div className="relative">
                <input type={showS3Secret ? "text" : "password"} value={s3SecretInput}
                  onChange={(e) => setS3SecretInput(e.target.value)}
                  placeholder={s3.secret_key_masked || "YCxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                  className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm font-mono-fin text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold pr-10" />
                <button type="button" onClick={() => setShowS3Secret((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <Icon name={showS3Secret ? "EyeOff" : "Eye"} size={15} />
                </button>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Ключ хранится в защищённом хранилище сервера, не передаётся третьим лицам</div>
            </div>

            {s3TestResult && (
              <div className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm animate-fade-in ${s3TestResult.ok ? "bg-green-900/20 border-green-900/30 text-positive" : "bg-red-900/20 border-red-900/30 text-negative"}`}>
                <Icon name={s3TestResult.ok ? "CheckCircle" : "AlertCircle"} size={16} className="flex-shrink-0 mt-0.5" />
                <div>{s3TestResult.ok ? (s3TestResult.message || "Подключение успешно!") : (s3TestResult.error || "Ошибка подключения")}</div>
              </div>
            )}

      </div>

      {/* S3 action buttons */}
      <div className="flex flex-wrap items-center gap-3 pb-4">
        <button onClick={handleS3Save} disabled={s3Saving}
          className="px-5 py-2.5 bg-gold text-primary-foreground rounded text-sm font-medium hover:bg-yellow-500 transition-colors flex items-center gap-2 disabled:opacity-50">
          {s3Saving ? <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" /> : <Icon name="Save" size={15} />}
          Сохранить S3
        </button>
        <button onClick={handleS3Test} disabled={s3Testing || s3Saving}
          className="px-4 py-2.5 border border-border rounded text-sm text-muted-foreground hover:text-foreground hover:border-gold/40 transition-colors flex items-center gap-2 disabled:opacity-50">
          {s3Testing ? <div className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" /> : <Icon name="HardDrive" size={15} />}
          Проверить связь S3
        </button>
        <>
          <button
              onClick={async () => {
                setFixingAcl(true);
                setFixAclResult(null);
                try {
                  const res = await api.fixS3Acl();
                  setFixAclResult(res);
                } catch (e) {
                  setFixAclResult({ ok: false, fixed: 0, errors_count: 1 });
                } finally {
                  setFixingAcl(false);
                }
              }}
              disabled={fixingAcl || s3Saving}
              className="px-4 py-2.5 border border-purple-900/40 text-purple-400 rounded text-sm hover:bg-purple-900/20 transition-colors flex items-center gap-2 disabled:opacity-50">
              {fixingAcl ? <div className="w-4 h-4 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" /> : <Icon name="Eye" size={15} />}
              Открыть доступ к фото
            </button>
        </>
        {s3Saved && <span className="flex items-center gap-1.5 text-xs text-positive animate-fade-in"><Icon name="CheckCircle" size={13} /> Сохранено</span>}
        {s3SaveError && <span className="flex items-center gap-1.5 text-xs text-negative animate-fade-in"><Icon name="AlertCircle" size={13} /> {s3SaveError}</span>}
        {fixAclResult && (
          <div className={`w-full mt-2 p-3 rounded-lg border text-xs animate-fade-in ${fixAclResult.ok && fixAclResult.errors_count === 0 ? "border-green-900/30 bg-green-900/20 text-positive" : "border-yellow-900/30 bg-yellow-900/10 text-yellow-400"}`}>
            {fixAclResult.ok
              ? `Открыт доступ к ${fixAclResult.fixed} файлам${fixAclResult.errors_count > 0 ? `, ошибок: ${fixAclResult.errors_count}` : " — готово!"}`
              : "Ошибка при открытии доступа"}
          </div>
        )}
      </div>
      </div>
      </div>

        </TabsContent>

        <TabsContent value="brain" className="mt-0">
          <BrainSettings />
        </TabsContent>

        <TabsContent value="database" className="mt-0 space-y-3 sm:space-y-4">
          <DatabaseSettings
            dbStatus={dbStatus}
            dbInstalling={dbInstalling}
            setDbInstalling={setDbInstalling}
            dbInstallResult={dbInstallResult}
            setDbInstallResult={setDbInstallResult}
            dbMigrating={dbMigrating}
            setDbMigrating={setDbMigrating}
            dbMigrateResult={dbMigrateResult}
            setDbMigrateResult={setDbMigrateResult}
            dbManualUrl={dbManualUrl}
            setDbManualUrl={setDbManualUrl}
            dbSavingUrl={dbSavingUrl}
            setDbSavingUrl={setDbSavingUrl}
            dbUrlSaved={dbUrlSaved}
            setDbUrlSaved={setDbUrlSaved}
            onRefresh={() => {
              api.dbSettings.get().then(setDbStatus);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Компонент Базы данных ──────────────────────────────────

interface DatabaseSettingsProps {
  dbStatus: DbSettingsStatus | null;
  dbInstalling: boolean;
  setDbInstalling: (v: boolean) => void;
  dbInstallResult: { ok?: boolean; steps?: string[]; error?: string; database_url_masked?: string } | null;
  setDbInstallResult: (v: any) => void;
  dbMigrating: boolean;
  setDbMigrating: (v: boolean) => void;
  dbMigrateResult: { ok?: boolean; applied?: number; total?: number; errors?: string[]; error?: string } | null;
  setDbMigrateResult: (v: any) => void;
  dbManualUrl: string;
  setDbManualUrl: (v: string) => void;
  dbSavingUrl: boolean;
  setDbSavingUrl: (v: boolean) => void;
  dbUrlSaved: boolean;
  setDbUrlSaved: (v: boolean) => void;
  onRefresh: () => void;
}

function DatabaseSettings({
  dbStatus,
  dbInstalling, setDbInstalling,
  dbInstallResult, setDbInstallResult,
  dbMigrating, setDbMigrating,
  dbMigrateResult, setDbMigrateResult,
  dbManualUrl, setDbManualUrl,
  dbSavingUrl, setDbSavingUrl,
  dbUrlSaved, setDbUrlSaved,
  onRefresh,
}: DatabaseSettingsProps) {
  // Статус-бейдж
  const StatusBadge = ({ ok, label }: { ok: boolean | null | undefined; label: string }) => (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
      ok === true
        ? "bg-green-900/30 text-green-400 border border-green-800/50"
        : ok === false
        ? "bg-red-900/30 text-red-400 border border-red-800/50"
        : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        ok === true ? "bg-green-400"
        : ok === false ? "bg-red-400"
        : "bg-zinc-500"
      }`} />
      {label}
    </span>
  );

  const handleMigrate = async () => {
    setDbMigrating(true);
    setDbMigrateResult(null);
    try {
      const res = await api.dbSettings.migrate();
      setDbMigrateResult(res);
      if (res.ok) onRefresh();
    } catch (e) {
      setDbMigrateResult({ ok: false, error: e instanceof Error ? e.message : "Ошибка" });
    } finally {
      setDbMigrating(false);
    }
  };

  const handleSaveUrl = async () => {
    if (!dbManualUrl.trim()) return;
    setDbSavingUrl(true);
    setDbUrlSaved(false);
    try {
      const res = await api.dbSettings.configure(dbManualUrl.trim());
      if (res.ok) {
        setDbUrlSaved(true);
        setDbManualUrl("");
        onRefresh();
        setTimeout(() => setDbUrlSaved(false), 3000);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setDbSavingUrl(false);
    }
  };

  const handleRefresh = () => {
    onRefresh();
  };

  const handleInstall = async () => {
    setDbInstalling(true);
    setDbInstallResult(null);
    try {
      const res = await api.dbSettings.install();
      setDbInstallResult(res);
      if (res.ok) onRefresh();
    } catch (e) {
      setDbInstallResult({ ok: false, error: e instanceof Error ? e.message : "Ошибка" });
    } finally {
      setDbInstalling(false);
    }
  };

  const installed = dbStatus?.installed ?? false;
  const running = dbStatus?.running ?? false;
  const configured = dbStatus?.configured ?? false;
  const schemaExists = dbStatus?.schema_exists ?? false;
  const connected = dbStatus?.connected ?? false;
  const tablesExist = (dbStatus?.tables_count ?? 0) > 0;
  const migrationsApplied = dbStatus?.migrations_applied ?? 0;
  const migrationsTotal = dbStatus?.migrations_total ?? dbStatus?.migration_files?.length ?? 0;

  // Если статус ещё не получен — показываем кнопку для ручной проверки
  if (!dbStatus) {
    return (
      <div className="space-y-4 animate-fade-in">
        {/* Приветственная карточка */}
        <div className="card-fin p-5 border border-gold/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center">
              <Icon name="Database" size={20} className="text-gold" />
            </div>
            <div>
              <h3 className="text-base font-semibold">База данных</h3>
              <p className="text-xs text-muted-foreground">Настройка PostgreSQL для хранения документов и транзакций</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/40 p-4 mb-4">
            <p className="text-sm text-muted-foreground mb-3">
              Для работы приложения требуется база данных PostgreSQL. У вас есть два способа:
            </p>
            <div className="space-y-3">
              <div className="flex gap-3 p-3 rounded-lg bg-gold/5 border border-gold/20">
                <Icon name="Wifi" size={16} className="text-gold flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-gold">Способ 1 — автоматическая установка на сервер</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Нажмите кнопку «Проверить статус» ниже, затем «Установить PostgreSQL». 
                    Сервер сам установит БД и настроит подключение.
                  </div>
                </div>
              </div>
              <div className="flex gap-3 p-3 rounded-lg bg-blue-900/10 border border-blue-900/30">
                <Icon name="Link" size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-blue-300">Способ 2 — подключить внешнюю БД</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Если у вас есть готовая PostgreSQL (например, на Supabase, Aiven), 
                    вставьте её DATABASE_URL в поле ниже.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button onClick={handleRefresh}
            className="px-5 py-2.5 bg-gold text-primary-foreground rounded text-sm font-medium hover:bg-yellow-500 transition-colors flex items-center gap-2">
            <Icon name="Search" size={15} />
            Проверить статус
          </button>
        </div>

        {/* Поле для ручного ввода DATABASE_URL */}
        <div className="card-fin p-4 sm:p-5">
          <div className="text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest text-muted-foreground mb-3 gold-line pl-3">
            Подключить внешнюю БД
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Вставьте DATABASE_URL от вашего PostgreSQL-провайдера:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={dbManualUrl}
              onChange={(e) => setDbManualUrl(e.target.value)}
              placeholder="postgresql://user:password@host:5432/dbname?sslmode=require"
              className="flex-1 bg-secondary border border-border rounded px-3 py-2.5 text-sm font-mono-fin text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold"
            />
            <button onClick={handleSaveUrl} disabled={dbSavingUrl || !dbManualUrl.trim()}
              className="px-4 py-2.5 bg-gold text-primary-foreground rounded text-sm font-medium hover:bg-yellow-500 transition-colors flex items-center gap-2 disabled:opacity-50 whitespace-nowrap">
              {dbSavingUrl ? (
                <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
              ) : (
                <Icon name="Save" size={15} />
              )}
              Сохранить
            </button>
          </div>
          {dbUrlSaved && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-positive">
              <Icon name="CheckCircle" size={13} />
              DATABASE_URL сохранён!
            </div>
          )}
        </div>

        {/* Инструкция */}
        <div className="card-fin p-4 sm:p-5 border border-blue-900/30 bg-blue-900/10">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-300 mb-2">
            <Icon name="Info" size={15} />
            Как получить DATABASE_URL бесплатно
          </div>
          <div className="text-xs text-muted-foreground space-y-2">
            <p>Вы можете использовать любую PostgreSQL БД:</p>
            <ol className="list-none space-y-1.5">
              <li className="flex gap-2">
                <span className="text-blue-400 font-bold">1.</span>
                <span><strong>Supabase:</strong> <code className="text-blue-300">supabase.com</code> — регистрация → проект → получить строку подключения (Connection string)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400 font-bold">2.</span>
                <span><strong>Aiven:</strong> <code className="text-blue-300">aiven.io</code> — бесплатный PostgreSQL на 1 ГБ</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400 font-bold">3.</span>
                <span><strong>Railway:</strong> <code className="text-blue-300">railway.app</code> — быстрый старт</span>
              </li>
            </ol>
            <p className="mt-2">Скопируйте строку вида <code className="text-blue-300">postgresql://user:pass@host:5432/db</code> и вставьте в поле выше.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Статус ──────────────────────────────── */}
      <div className="card-fin p-4 sm:p-5">
        <div className="text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest text-muted-foreground mb-4 gold-line pl-3">Статус базы данных</div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase mb-1">PostgreSQL</div>
            <StatusBadge ok={installed} label={installed ? "Установлен" : "Не установлен"} />
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase mb-1">Сервис</div>
            <StatusBadge ok={running} label={running ? "Запущен" : "Остановлен"} />
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase mb-1">DATABASE_URL</div>
            <StatusBadge ok={configured} label={configured ? "Задан" : "Не задан"} />
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase mb-1">Подключение</div>
            <StatusBadge ok={connected} label={connected ? "Работает" : "Нет связи"} />
          </div>
        </div>

        {/* Версия и таблицы */}
        {dbStatus.version && (
          <div className="text-xs text-muted-foreground mb-2">
            <span className="text-foreground font-medium">Версия:</span> {dbStatus.version}
          </div>
        )}
        {dbStatus.schema_exists && (
          <div className="text-xs text-muted-foreground mb-2">
            <span className="text-foreground font-medium">Таблиц в схеме:</span> {dbStatus.tables_count ?? 0}
            {dbStatus.tables && dbStatus.tables.length > 0 && (
              <span className="ml-2 text-muted-foreground/70">
                ({dbStatus.tables.join(", ")})
              </span>
            )}
          </div>
        )}
        {dbStatus.migrations_applied !== undefined && (
          <div className="text-xs text-muted-foreground">
            <span className="text-foreground font-medium">Миграций применено:</span> {dbStatus.migrations_applied} / {dbStatus.migrations_total ?? dbStatus.migration_files?.length ?? "?"}
          </div>
        )}
        {dbStatus.connection_error && (
          <div className="mt-2 p-2 rounded bg-red-900/20 border border-red-900/30 text-xs text-red-400">
            {dbStatus.connection_error}
          </div>
        )}

        <button onClick={handleRefresh}
          className="mt-3 px-3 py-1.5 border border-border rounded text-xs text-muted-foreground hover:text-foreground hover:border-gold/40 transition-colors flex items-center gap-1.5">
          <Icon name="RefreshCw" size={13} />
          Обновить статус
        </button>
      </div>

      {/* ── Установка PostgreSQL ───────────── */}
      {!installed && (
        <div className="card-fin p-4 sm:p-5 border border-gold/20">
          <div className="text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest text-muted-foreground mb-3 gold-line pl-3">Установка PostgreSQL</div>
          <p className="text-sm text-muted-foreground mb-4">
            PostgreSQL не обнаружен на сервере. Нажмите кнопку ниже, чтобы установить его автоматически.
            Скрипт установит PostgreSQL, создаст пользователя <code className="text-gold font-mono text-xs">accounting</code> и базу данных <code className="text-gold font-mono text-xs">accounting</code>.
          </p>
          <button onClick={handleInstall} disabled={dbInstalling}
            className="px-5 py-2.5 bg-gold text-primary-foreground rounded text-sm font-medium hover:bg-yellow-500 transition-colors flex items-center gap-2 disabled:opacity-50">
            {dbInstalling ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                Установка… (1-2 минуты)
              </>
            ) : (
              <><Icon name="Database" size={15} /> Установить PostgreSQL</>
            )}
          </button>

          {dbInstallResult && (
            <div className={`mt-3 p-3 rounded-lg border text-sm ${
              dbInstallResult.ok
                ? "bg-green-900/20 border-green-900/30 text-green-400"
                : "bg-red-900/20 border-red-900/30 text-red-400"
            }`}>
              {dbInstallResult.ok ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Icon name="CheckCircle" size={16} />
                    PostgreSQL успешно установлен!
                  </div>
                  {dbInstallResult.database_url_masked && (
                    <div className="text-xs mt-1">
                      DATABASE_URL: <code className="text-gold font-mono">{dbInstallResult.database_url_masked}</code>
                    </div>
                  )}
                  {dbInstallResult.steps && (
                    <div className="text-xs text-muted-foreground mt-2">
                      {dbInstallResult.steps.map((s, i) => (
                        <div key={i}>✓ {s}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Icon name="AlertCircle" size={16} />
                    Ошибка установки
                  </div>
                  <div className="text-xs">{dbInstallResult.error}</div>
                  {dbInstallResult.steps && (
                    <div className="text-xs text-muted-foreground mt-2">
                      {dbInstallResult.steps.map((s, i) => (
                        <div key={i}>✓ {s}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Ручная настройка DATABASE_URL ───── */}
      <div className="card-fin p-4 sm:p-5">
        <div className="text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest text-muted-foreground mb-3 gold-line pl-3">
          {installed ? "DATABASE_URL" : "Подключение к внешней БД"}
        </div>
        
        {installed && (
          <p className="text-xs text-muted-foreground mb-3">
            Если PostgreSQL уже установлен, но DATABASE_URL не настроен автоматически — 
            вставьте ссылку вручную.
          </p>
        )}

        {!installed && (
          <p className="text-sm text-muted-foreground mb-3">
            Если у вас есть готовая PostgreSQL БД (например, от хостинга), вставьте её ссылку сюда.
          </p>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={dbManualUrl}
            onChange={(e) => setDbManualUrl(e.target.value)}
            placeholder={installed ? "postgresql://user:pass@localhost:5432/accounting" : "postgresql://user:password@host:5432/dbname?sslmode=require"}
            className="flex-1 bg-secondary border border-border rounded px-3 py-2.5 text-sm font-mono-fin text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold"
          />
          <button onClick={handleSaveUrl} disabled={dbSavingUrl || !dbManualUrl.trim()}
            className="px-4 py-2.5 bg-gold text-primary-foreground rounded text-sm font-medium hover:bg-yellow-500 transition-colors flex items-center gap-2 disabled:opacity-50 whitespace-nowrap">
            {dbSavingUrl ? (
              <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : (
              <Icon name="Save" size={15} />
            )}
            Сохранить
          </button>
        </div>
        {dbUrlSaved && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-positive">
            <Icon name="CheckCircle" size={13} />
            DATABASE_URL сохранён!
          </div>
        )}
      </div>

      {/* ── Миграции ──────────────────────────── */}
      {installed && configured && (
        <div className="card-fin p-4 sm:p-5">
          <div className="text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest text-muted-foreground mb-3 gold-line pl-3">Миграции базы данных</div>
          
          <p className="text-sm text-muted-foreground mb-3">
            Создать таблицы в базе данных: транзакции, документы, налоговые отчёты, настройки ИИ и другие.
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <span>Всего миграций: <strong className="text-foreground">{dbStatus.migrations_total ?? dbStatus.migration_files?.length ?? "?"}</strong></span>
            {dbStatus.migrations_applied !== undefined && (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span>Применено: <strong className="text-foreground">{dbStatus.migrations_applied}</strong></span>
              </>
            )}
            {dbStatus.schema_exists && (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span className="text-green-400">✓ Схема существует</span>
              </>
            )}
          </div>

          <button onClick={handleMigrate} disabled={dbMigrating}
            className="px-5 py-2.5 bg-gold text-primary-foreground rounded text-sm font-medium hover:bg-yellow-500 transition-colors flex items-center gap-2 disabled:opacity-50">
            {dbMigrating ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                Выполнение миграций…
              </>
            ) : (
              <><Icon name="Play" size={15} /> Запустить миграции</>
            )}
          </button>

          {dbMigrateResult && (
            <div className={`mt-3 p-3 rounded-lg border text-sm ${
              dbMigrateResult.ok
                ? "bg-green-900/20 border-green-900/30 text-green-400"
                : "bg-red-900/20 border-red-900/30 text-red-400"
            }`}>
              {dbMigrateResult.ok ? (
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <Icon name="CheckCircle" size={16} />
                    Миграции выполнены!
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Применено: {dbMigrateResult.applied} / {dbMigrateResult.total}
                  </div>
                  {dbMigrateResult.errors && dbMigrateResult.errors.length > 0 && (
                    <div className="text-xs text-red-400 mt-2">
                      {dbMigrateResult.errors.map((e, i) => (
                        <div key={i}>✗ {e}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <Icon name="AlertCircle" size={16} />
                    Ошибка миграций
                  </div>
                  <div className="text-xs mt-1">{dbMigrateResult.error}</div>
                  {dbMigrateResult.errors && dbMigrateResult.errors.length > 0 && (
                    <div className="text-xs mt-2">
                      {dbMigrateResult.errors.map((e, i) => (
                        <div key={i}>✗ {e}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Список миграций ──────────────────── */}
      {dbStatus.migration_files && dbStatus.migration_files.length > 0 && (
        <div className="card-fin p-4 sm:p-5">
          <div className="text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest text-muted-foreground mb-3 gold-line pl-3">Файлы миграций</div>
          <div className="space-y-1">
            {dbStatus.migration_files.map((f, i) => (
              <div key={i} className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center text-[8px]">
                  {i + 1}
                </span>
                {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Инструкция по внешней БД ────────── */}
      {!installed && (
        <div className="card-fin p-4 sm:p-5 border border-blue-900/30 bg-blue-900/10">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-300 mb-2">
            <Icon name="Info" size={15} />
            Как получить DATABASE_URL бесплатно
          </div>
          <div className="text-xs text-muted-foreground space-y-2">
            <p>Вы можете использовать любую PostgreSQL БД:</p>
            <ol className="list-none space-y-1.5">
              <li className="flex gap-2">
                <span className="text-blue-400 font-bold">1.</span>
                <span><strong>Supabase:</strong> <code className="text-blue-300">supabase.com</code> — регистрация, создать проект → получить строку подключения</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400 font-bold">2.</span>
                <span><strong>Aiven:</strong> <code className="text-blue-300">aiven.io</code> — бесплатный PostgreSQL на 1 ГБ</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400 font-bold">3.</span>
                <span><strong>Railway:</strong> <code className="text-blue-300">railway.app</code> — быстрый старт</span>
              </li>
            </ol>
            <p className="mt-2">Скопируйте строку вида <code className="text-blue-300">postgresql://user:pass@host:5432/db</code> и вставьте в поле выше.</p>
          </div>
        </div>
      )}
    </div>
  );
}