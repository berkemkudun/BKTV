"use client";

import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  FileUp,
  KeyRound,
  Link2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useLibraryStore } from "@/lib/store/libraryStore";
import type { XtreamAccount } from "@/lib/types";

export type SourceTab = "url" | "xtream" | "file" | "demo";

/**
 * İçerik kaynağı ekleme formu.
 *
 * Hem ana sayfadaki panelde hem de modalda aynı bileşen kullanılıyor: kaynak
 * ekleme akışı tek yerde tanımlı olsun diye. Mobil öncelikli tasarlandı —
 * input yazı boyutu 16px (altında iOS Safari sayfayı zoomluyor) ve dokunma
 * hedefleri 44px'ten küçük değil.
 */
export function SourceForm({
  defaultTab = "url",
  onDone,
  compact = false,
}: {
  defaultTab?: SourceTab;
  /** Ekleme başarılı olduğunda (modalı kapatmak için) */
  onDone?: () => void;
  /** Modal içinde daha dar yerleşim */
  compact?: boolean;
}) {
  const addFromUrl = useLibraryStore((state) => state.addFromUrl);
  const addFromText = useLibraryStore((state) => state.addFromText);
  const addFromXtream = useLibraryStore((state) => state.addFromXtream);
  const loadDemo = useLibraryStore((state) => state.loadDemo);
  const load = useLibraryStore((state) => state.load);
  const resetLoadState = useLibraryStore((state) => state.resetLoadState);

  const [tab, setTab] = useState<SourceTab>(defaultTab);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [account, setAccount] = useState<XtreamAccount | null>(null);
  const [busy, setBusy] = useState(false);
  /** İlerleme kutusu yalnızca kullanıcı bir şey başlattıysa görünmeli
      (uygulama açılırken demo yüklenmesi de load state'i "done" yapıyor). */
  const [submitted, setSubmitted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    resetLoadState();
  }, [resetLoadState]);

  const finish = () => {
    // Kullanıcı "tamamlandı" mesajını görebilsin diye kısa bir bekleme.
    setTimeout(() => onDone?.(), 900);
  };

  const submitUrl = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setSubmitted(true);
    setLocalError(null);
    try {
      await addFromUrl(url.trim(), name);
      setUrl("");
      setName("");
      finish();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Playlist eklenemedi");
    } finally {
      setBusy(false);
    }
  };

  const submitXtream = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!host.trim() || !username.trim() || !password.trim()) return;
    setBusy(true);
    setSubmitted(true);
    setLocalError(null);
    setAccount(null);
    try {
      const result = await addFromXtream(
        { host: host.trim(), username: username.trim(), password: password.trim() },
        name,
      );
      setAccount(result);
      setPassword("");
      setName("");
      // Hesap özetini görebilsin diye biraz daha uzun bekletiyoruz.
      setTimeout(() => onDone?.(), 2500);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Panele bağlanılamadı");
    } finally {
      setBusy(false);
    }
  };

  const submitFile = async (file: File) => {
    setBusy(true);
    setSubmitted(true);
    setLocalError(null);
    try {
      const text = await file.text();
      if (!text.includes("#EXTINF")) {
        throw new Error("Dosyada #EXTINF kaydı bulunamadı — geçerli bir M3U dosyası değil");
      }
      await addFromText(text, name.trim() || file.name.replace(/\.(m3u8?|txt)$/i, ""));
      setName("");
      finish();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Dosya okunamadı");
    } finally {
      setBusy(false);
    }
  };

  const startDemo = async () => {
    setBusy(true);
    setSubmitted(true);
    setLocalError(null);
    try {
      await loadDemo();
      finish();
    } catch {
      setLocalError("Örnek liste yüklenemedi");
    } finally {
      setBusy(false);
    }
  };

  const stageMessage =
    load.stage === "parsing"
      ? `${load.message} (${load.parsed.toLocaleString("tr-TR")} kayıt)`
      : load.message;

  return (
    <div>
      {/* Giriş seçenekleri — mobilde 2x2, masaüstünde tek sıra */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setLocalError(null);
              }}
              aria-pressed={active}
              className={`flex min-h-[62px] flex-col items-start justify-center gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                active
                  ? "border-accent/50 bg-accent/12 text-fg"
                  : "border-white/8 bg-white/[0.03] text-fg-muted hover:border-white/16 hover:text-fg"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] ${active ? "text-accent" : ""}`} />
              <span className="text-[13px] font-semibold leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className={compact ? "mt-4" : "mt-5"}>
        {tab !== "demo" && (
          <div className="mb-4">
            <label htmlFor="source-name" className="mb-1.5 block text-[12.5px] font-medium text-fg-muted">
              Liste adı (opsiyonel)
            </label>
            <input
              id="source-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Örn. Ana Liste"
              className={INPUT}
            />
          </div>
        )}

        {tab === "url" && (
          <form onSubmit={submitUrl}>
            <label htmlFor="source-url" className="mb-1.5 block text-[12.5px] font-medium text-fg-muted">
              M3U adresi
            </label>
            <input
              id="source-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="http://sunucu.net:8080/get.php?username=…"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={INPUT}
            />
            <p className="mt-2 text-[12px] leading-relaxed text-fg-dim">
              Liste tarayıcıdan değil, sunucu üzerinden indirilir — bu sayede CORS engeline takılmaz.
              Adresin sadece bu cihazda saklanır.
            </p>

            {/output=ts/i.test(url) && (
              <p className="mt-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-[12px] leading-relaxed text-fg-muted">
                Bu adres <code className="text-fg">output=ts</code> istiyor: kanallar ham MPEG-TS gelir ve
                tarayıcıda daha yavaş açılır. <code className="text-fg">output=m3u8</code> yaparsan sağlayıcı
                HLS verir, oynatma anında başlar. (Oynatıcı yine de ikisini de dener.)
              </p>
            )}

            <SubmitButton busy={busy} disabled={!url.trim()}>
              {busy ? "İşleniyor…" : "Ekle ve Analiz Et"}
            </SubmitButton>
          </form>
        )}

        {tab === "xtream" && (
          <form onSubmit={submitXtream} className="space-y-4">
            <div>
              <label htmlFor="xtream-host" className="mb-1.5 block text-[12.5px] font-medium text-fg-muted">
                Sunucu adresi (DNS)
              </label>
              <input
                id="xtream-host"
                value={host}
                onChange={(event) => setHost(event.target.value)}
                placeholder="http://ornek-sunucu.net:8080"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className={INPUT}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="xtream-user" className="mb-1.5 block text-[12.5px] font-medium text-fg-muted">
                  Kullanıcı adı
                </label>
                <input
                  id="xtream-user"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor="xtream-pass" className="mb-1.5 block text-[12.5px] font-medium text-fg-muted">
                  Şifre
                </label>
                <div className="relative">
                  <input
                    id="xtream-pass"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className={`${INPUT} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-fg-dim transition-colors hover:text-fg"
                    aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[12px] leading-relaxed text-fg-dim">
              Bilgiler yalnızca panele bağlanmak için kullanılır ve bu cihazda saklanır. Panel destekliyorsa
              liste <code className="text-fg">m3u8</code> olarak istenir — kanallar tarayıcıda çok daha hızlı
              açılır. Sunucu adresini bilmiyorsan sağlayıcının verdiği M3U bağlantısını da yapıştırabilirsin.
            </p>

            {account && <AccountSummary account={account} />}

            <SubmitButton busy={busy} disabled={!host.trim() || !username.trim() || !password.trim()}>
              {busy ? "Bağlanılıyor…" : "Bağlan ve İçerikleri Getir"}
            </SubmitButton>
          </form>
        )}

        {tab === "file" && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".m3u,.m3u8,.txt,audio/x-mpegurl,application/x-mpegurl"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void submitFile(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-fg-muted transition-colors hover:border-accent/40 hover:text-fg disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
              <span className="text-[14px] font-medium">
                {busy ? "İşleniyor…" : ".m3u / .m3u8 dosyası seç"}
              </span>
              <span className="text-[12px] text-fg-dim">Dosya cihazından çıkmaz</span>
            </button>
          </div>
        )}

        {tab === "demo" && (
          <div>
            <p className="text-[13.5px] leading-relaxed text-fg-muted">
              Kendi listen yokken arayüzü denemek için örnek bir kütüphane yükler. İçerikler gerçek yayın
              değildir; kendi M3U listeni eklediğinde demo tamamen kaldırılır.
            </p>
            <button
              type="button"
              onClick={() => void startDemo()}
              disabled={busy}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 text-[15px] font-bold transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Yükleniyor…" : "Örnek kütüphaneyi yükle"}
            </button>
          </div>
        )}

        {submitted && (busy || load.stage === "done") && stageMessage && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[13.5px]">
            {load.stage === "done" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
            )}
            <span className={load.stage === "done" ? "text-emerald-300" : "text-fg-muted"}>
              {stageMessage}
            </span>
          </div>
        )}

        {(localError || (submitted && load.error)) && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-accent/25 bg-accent/8 px-4 py-3 text-[13.5px] leading-relaxed text-accent-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{localError ?? load.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { id: "url" as const, label: "M3U URL", icon: Link2 },
  { id: "xtream" as const, label: "Panel Girişi", icon: KeyRound },
  { id: "file" as const, label: "Dosya Yükle", icon: FileUp },
  { id: "demo" as const, label: "Demo İçerik", icon: Sparkles },
];

/** 16px yazı boyutu bilinçli: altında iOS Safari odaklanınca sayfayı yakınlaştırıyor. */
const INPUT =
  "h-12 w-full rounded-xl border border-white/8 bg-white/[0.04] px-3.5 text-[16px] outline-none transition-colors placeholder:text-fg-dim focus:border-accent/40 sm:text-[14px]";

function SubmitButton({
  busy,
  disabled,
  children,
}: {
  busy: boolean;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-600 text-[15px] font-bold text-white transition-opacity disabled:opacity-40"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

function AccountSummary({ account }: { account: XtreamAccount }) {
  return (
    <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/8 p-4">
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-emerald-300">
        <CheckCircle2 className="h-4 w-4" /> Bağlantı kuruldu
      </p>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
        <dt className="text-fg-dim">Durum</dt>
        <dd className="text-fg">
          {account.status}
          {account.isTrial ? " (deneme)" : ""}
        </dd>
        <dt className="text-fg-dim">Bitiş</dt>
        <dd className="text-fg">{formatExpiry(account.expiresAt)}</dd>
        <dt className="text-fg-dim">Eşzamanlı bağlantı</dt>
        <dd className="text-fg">
          {account.activeConnections ?? "?"} / {account.maxConnections ?? "?"}
        </dd>
        <dt className="text-fg-dim">Liste formatı</dt>
        <dd className="text-fg">{account.outputFormat}</dd>
      </dl>
    </div>
  );
}

/** "12.09.2026 · 31 gün" — abonelik bitişini hem tarih hem kalan gün olarak gösterir. */
export function formatExpiry(expiresAt: number | null): string {
  if (!expiresAt) return "Bilinmiyor";
  const date = new Date(expiresAt);
  const days = Math.round((expiresAt - Date.now()) / 86_400_000);
  const formatted = date.toLocaleDateString("tr-TR");
  if (days < 0) return `${formatted} · süresi dolmuş`;
  return `${formatted} · ${days} gün`;
}
