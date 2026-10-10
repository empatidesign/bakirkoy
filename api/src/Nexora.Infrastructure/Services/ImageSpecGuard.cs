using Nexora.Application.Common.Exceptions;
using Nexora.Application.Features.Events.Dtos;
using SixLabors.ImageSharp;

namespace Nexora.Infrastructure.Services;

public static class ImageSpecGuard
{
    public static readonly IReadOnlyList<EventImageRatioSpecDto> ActiveRatioSpecs =
    [
        new("16:9", 1920, 1080, 800, "16:9 — Geniş (web kapak)"),
        new("4:3", 1200, 900, 400, "4:3 — Yatay (kart)"),
        new("9:16", 1080, 1920, 600, "9:16 — Dikey (mobil/story)"),
    ];

    public static readonly IReadOnlyList<EventImageRatioSpecDto> LegacyRatioSpecs =
    [
        new("1:1", 900, 900, 300, "1:1 — Kare (eski)"),
    ];

    private static readonly ImageSpecDto[] RatioSpecs =
        [.. ActiveRatioSpecs.Concat(LegacyRatioSpecs).Select(r => new ImageSpecDto(r.Width, r.Height, r.MaxSizeKb))];

    public static void Validate(byte[] bytes, string? purpose, ImageSettingsDto settings)
    {
        var (width, height) = Identify(bytes);

        if (string.Equals(purpose, "gallery", StringComparison.OrdinalIgnoreCase))
            return;

        // RatioSpecs, gerçek etkinlik formunun (EventForm.tsx) kullandığı üretim oranlarıdır.
        // Aktif oranlar: 16:9, 4:3, 9:16. 900x900 (1:1) artık yeni etkinliklerde sunulmuyor
        // (EVENT_IMAGE_RATIOS'tan çıkarıldı) ama DB'de 158 mevcut etkinlikte kayıtlı olduğu için
        // geriye dönük uyumluluk adına kabul edilmeye devam ediyor. Admin panelindeki
        // "Görsel Ayarları" (Web/Mobil boyutları,
        // enforceWebSpecs/enforceMobileSpecs) bu üretim akışından tamamen bağımsız, ayrı bir
        // sistemdir. Önceden enforceWebSpecs=false + enforceMobileSpecs=false yapıldığında kod
        // erken dönüyor ve RatioSpecs dahil HİÇBİR kontrol uygulanmıyordu (ham/işlenmemiş her
        // boyuttaki görsel kabul ediliyordu). Artık RatioSpecs her zaman zorunlu taban kontrolü,
        // admin ayarları (Web/Mobil) bunun ÜZERİNE ek olarak izin verilen boyutları genişletir.
        var specs = new List<ImageSpecDto>(RatioSpecs);
        if (settings.EnforceWebSpecs)
            specs.AddRange([settings.Web.Cover, settings.Web.Card, settings.Web.Thumb]);
        if (settings.EnforceMobileSpecs)
            specs.AddRange([settings.Mobile.Cover, settings.Mobile.Card, settings.Mobile.Thumb]);

        var sizeKb = (int)Math.Ceiling(bytes.Length / 1024.0);
        var matches = specs.Any(s => width == s.Width && height == s.Height && sizeKb <= s.MaxSizeKb);
        if (!matches)
            throw new ConflictException(
                "Yüklenen görsel izin verilen ölçü ya da boyutla uyuşmuyor. Lütfen formdaki kırpma aracıyla yükleyin.",
                "IMAGE_SPEC_MISMATCH");
    }

    private static (int Width, int Height) Identify(byte[] bytes)
    {
        try
        {
            var info = Image.Identify(bytes);
            return (info.Width, info.Height);
        }
        catch
        {
            throw new ConflictException(
                "Görsel okunamadı. Lütfen geçerli bir JPG, PNG veya WEBP dosyası yükleyin.",
                "IMAGE_INVALID");
        }
    }
}
