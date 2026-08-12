/**
 * Detay sayfalarında açıklama yerine gösterilecek dürüst mesajlar.
 * "Eşleşme yok" ile "anahtar tanımlı değil" birbirinden ayrılır — kullanıcı
 * neyi düzeltmesi gerektiğini bilmeli.
 */
export function fallbackOverview(
  state: "idle" | "loading" | "ready" | "unmatched" | "disabled",
  tmdbConfigured: boolean | null,
  kind: "film" | "dizi",
): string {
  if (state === "loading") return "Metadata yükleniyor…";
  if (state === "disabled") {
    return "TMDB eşleştirmesi ayarlardan kapatılmış. Açıklama ve posterler için tekrar açabilirsin.";
  }
  if (tmdbConfigured === false) {
    return "TMDB API anahtarı tanımlı değil; açıklama, poster ve puan gösterilemiyor. Ayarlar sayfasında nasıl ekleneceği yazıyor.";
  }
  return `Bu ${kind} TMDB'de eşleştirilemedi. İçerik playlistindeki bilgilerle gösteriliyor.`;
}
