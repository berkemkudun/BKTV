import { containerLabel, isRiskyContainer, isUnsupportedContainer } from "@/lib/player/stream";

/**
 * Oynatma neden başarısız oldu?
 *
 * Üç bilgi birleştirilir:
 *  1. Adresin konteyneri (.mkv/.avi tarayıcıda hiç açılmaz)
 *  2. Tarayıcının MediaError mesajı (Chrome kodek hatasını açıkça yazar)
 *  3. Sunucudan yapılan probe (sağlayıcı gerçekten yanıt veriyor mu, CORS var mı)
 *
 * Amaç: kullanıcıya "bilinmeyen hata" yerine ne yapması gerektiğini söylemek.
 */

export interface ProbeResult {
  reachable: boolean;
  timedOut?: boolean;
  status: number;
  ok: boolean;
  contentType?: string | null;
  cors?: string | null;
}

/** Tanının doğru olabilmesi için gereken bağlam. */
export interface DiagnoseContext {
  /** Uygulama uzak bir sunucuda mı çalışıyor (localhost değil)? */
  hosted: boolean;
  /** Sayfa https, yayın adresi http mü? */
  mixedContent: boolean;
}

export interface Diagnosis {
  /** Kısa başlık */
  title: string;
  /** Kullanıcıya açıklama */
  detail: string;
  /** Proxy denemek anlamlı mı? */
  suggestProxy: boolean;
  /** Harici oynatıcı (VLC) önerilsin mi? */
  suggestExternal: boolean;
}

export async function probeStream(url: string): Promise<ProbeResult | null> {
  try {
    const response = await fetch(`/api/probe?url=${encodeURIComponent(url)}`);
    if (!response.ok) return null;
    return (await response.json()) as ProbeResult;
  } catch {
    return null;
  }
}

export function diagnose(
  url: string,
  mediaErrorMessage: string | undefined,
  probe: ProbeResult | null,
  context: DiagnoseContext = { hosted: false, mixedContent: false },
): Diagnosis {
  // 1. Tarayıcının hiç açamayacağı konteyner (AVI, FLV, WMV…)
  //    .mkv burada değil: içindeki kodek H.264/AAC ise Chrome oynatabiliyor.
  if (isUnsupportedContainer(url)) {
    return {
      title: "Bu format tarayıcıda açılmaz",
      detail: `İçerik ${containerLabel(url)} konteynerinde. Tarayıcılar bu formatı desteklemiyor — bağlantıyı kopyalayıp VLC gibi bir oynatıcıda açman gerekir.`,
      suggestProxy: false,
      suggestExternal: true,
    };
  }

  // 2. Sağlayıcı yanıt veriyor mu?
  if (probe) {
    if (!probe.reachable) {
      return {
        title: probe.timedOut ? "Sağlayıcı yanıt vermedi" : "Sağlayıcıya ulaşılamadı",
        detail:
          (probe.timedOut
            ? "Adres zamanında yanıt vermedi. Sunucu aşırı yüklü olabilir ya da bu yayın kapalı olabilir."
            : "Sunucu adrese hiç bağlanamadı. Sağlayıcı kapalı olabilir veya adres artık geçerli değil.") +
          (context.hosted
            ? " Uygulama bir bulut sunucusunda (ör. Vercel) çalışıyor; sağlayıcı veri merkezi IP'lerini " +
              "engelliyor olabilir. Aynı liste kendi bilgisayarındaki kopyada açılıyorsa sebep budur."
            : ""),
        suggestProxy: false,
        suggestExternal: true,
      };
    }

    if (probe.status === 503) {
      return {
        title: "Sağlayıcı bu yayını vermiyor (503)",
        detail:
          "Yayın sağlayıcının kendisinde kapalı. Genelde şu üç sebepten olur: kanal/film o an yayında değil, " +
          "aynı hesapla başka bir cihazda izleme açık (bağlantı limiti) ya da bu içerik paketinde yok. " +
          "Uygulamanın yapabileceği bir şey yok — başka bir kanal dene.",
        suggestProxy: false,
        suggestExternal: false,
      };
    }

    if (probe.status === 401 || probe.status === 403) {
      /*
       * Kritik ayrım: uygulama uzak bir sunucuda çalışıyorsa bu 403 neredeyse
       * her zaman "sağlayıcı veri merkezi IP'lerini engelliyor" demektir —
       * hesap gayet geçerlidir. Aynı liste kendi cihazında açılıyorsa kanıt budur.
       * Kullanıcıya "hesabın süresi dolmuş" demek yanlış yönlendirmeydi.
       */
      if (context.hosted) {
        return {
          title: "Sağlayıcı bu sunucuyu engelliyor",
          detail:
            `Yayın isteği ${probe.status} ile reddedildi. Liste senin cihazında açılıyorsa hesabında ` +
            "sorun yok: IPTV panelleri Vercel gibi veri merkezi IP'lerini engelliyor ve yayını yalnızca " +
            "ev/mobil bağlantılardan veriyor." +
            (context.mixedContent
              ? " Yayın adresi http, bu sayfa https olduğu için tarayıcı doğrudan da bağlanamıyor — " +
                "tek yol sunucu üzerinden geçmekti, o da engellendi."
              : "") +
            " Çözüm: uygulamayı kendi bilgisayarında çalıştır (npm run dev) ya da bağlantıyı kopyalayıp " +
            "VLC'de aç.",
          suggestProxy: false,
          suggestExternal: true,
        };
      }

      return {
        title: "Sağlayıcı erişimi reddetti",
        detail: `Sunucu ${probe.status} döndü. Hesabın süresi dolmuş, şifre değişmiş ya da bu içerik paketinde olmayabilir.`,
        suggestProxy: false,
        suggestExternal: true,
      };
    }

    if (probe.status === 404) {
      return {
        title: "Yayın bulunamadı (404)",
        detail:
          "Bu adres sağlayıcıda artık yok. Playlisti yenilemek adresleri güncelleyebilir." +
          (context.hosted
            ? " Bazı paneller engelledikleri sunuculara da 404 döndürüyor; aynı yayın kendi cihazında " +
              "açılıyorsa sebep adres değil, engeldir."
            : ""),
        suggestProxy: false,
        suggestExternal: false,
      };
    }

    // Sağlayıcı içeriği veriyor ama tarayıcı oynatamadı
    if (probe.ok) {
      if (
        (mediaErrorMessage && /codec|demuxer|decode|format/i.test(mediaErrorMessage)) ||
        isRiskyContainer(url)
      ) {
        return {
          title: "Tarayıcı bu kodeki açamıyor",
          detail:
            `Sağlayıcı dosyayı veriyor (${containerLabel(url)}) ama içindeki video/ses kodeki tarayıcıda ` +
            "desteklenmiyor — genelde H.265/HEVC video ya da AC3/DTS ses olur. Chrome yerine Edge işe " +
            "yarayabilir; kesin çözüm bağlantıyı VLC'de açmak." +
            (mediaErrorMessage ? ` Tarayıcı mesajı: “${mediaErrorMessage}”` : ""),
          suggestProxy: false,
          suggestExternal: true,
        };
      }

      if (!probe.cors) {
        return {
          title: "Kaynak tarayıcı isteğini engelliyor",
          detail:
            "Sağlayıcı içeriği sunucuya veriyor ama tarayıcıya CORS izni göndermiyor. " +
            "Yayını sunucu üzerinden geçirerek (proxy) açabilirsin.",
          suggestProxy: true,
          suggestExternal: false,
        };
      }

      return {
        title: "Yayın açılamadı",
        detail:
          `Sağlayıcı ${probe.status} ile yanıt veriyor ve CORS izni de var; sorun büyük ihtimalle dosyanın ` +
          "kendisinde (bozuk kayıt ya da desteklenmeyen kodek). Bağlantıyı VLC'de açarak doğrulayabilirsin." +
          (mediaErrorMessage ? ` Tarayıcı mesajı: “${mediaErrorMessage}”` : ""),
        suggestProxy: false,
        suggestExternal: true,
      };
    }

    return {
      title: `Sağlayıcı hatası (${probe.status})`,
      detail: "Sunucu bu adres için hata döndürdü. Başka bir kaynak ya da kanal deneyebilirsin.",
      suggestProxy: false,
      suggestExternal: true,
    };
  }

  // 3. Probe yapılamadı
  return {
    title: "Yayın açılamadı",
    detail:
      "Doğrudan bağlantı, HLS varyantı ve proxy denendi; hiçbiri yanıt vermedi." +
      (mediaErrorMessage ? ` Tarayıcı mesajı: “${mediaErrorMessage}”` : ""),
    suggestProxy: true,
    suggestExternal: true,
  };
}
