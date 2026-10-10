using Nexora.Application.Common.Exceptions;

namespace Nexora.Application.Common;

/// <summary>
/// Kullanıcı isteği (2026-10-04): evrak yüklemede "güvenlik kontrolünden geçirilecek" —
/// SafeUploadValidation zaten tehlikeli UZANTI/Content-Type'ları kara listeye alıyor ama
/// dosyanın GERÇEK içeriğinin beyan edilen türle eşleştiğini hiç doğrulamıyordu. Bir saldırgan
/// içi tamamen farklı (örn. bir script/polyglot) bir dosyayı ".pdf" uzantısı ve
/// "application/pdf" Content-Type'ıyla gönderirse SafeUploadValidation bunu sorunsuz kabul
/// ediyordu. Bu sınıf, dosyanın ilk birkaç baytındaki (magic number / file signature) gerçek
/// imzasının, izin verilen evrak formatlarından (pdf/jpg/png) biriyle eşleştiğini doğrular —
/// bir nevi beyaz liste + içerik-doğrulama katmanı, SafeUploadValidation'ın kara listesinin
/// üzerine ikinci bir savunma katmanı (defense in depth).
/// </summary>
public static class FileSignatureValidator
{
    public const string Pdf = "pdf";
    public const string Jpg = "jpg";
    public const string Png = "png";

    public static readonly IReadOnlyList<string> DocumentFormats = [Pdf, Jpg, Png];

    /// <summary>
    /// bytes'ın baş kısmındaki imzaya bakarak gerçek dosya türünü tespit eder; hiçbiriyle
    /// eşleşmezse null döner (bilinmeyen/desteklenmeyen tür).
    /// </summary>
    public static string? DetectFormat(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length >= 4 && bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46) // %PDF
            return Pdf;
        if (bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) // JPEG SOI
            return Jpg;
        if (bytes.Length >= 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47
            && bytes[4] == 0x0D && bytes[5] == 0x0A && bytes[6] == 0x1A && bytes[7] == 0x0A) // PNG
            return Png;
        return null;
    }

    /// <summary>
    /// Evrak yükleme için: dosyanın GERÇEK imzasının pdf/jpg/png'den biri olduğunu VE (verilmişse)
    /// o evrak tipi için izin verilen format listesinde yer aldığını doğrular. Eşleşmezse
    /// ConflictException fırlatır. Zayıf/standart-dışı bir dosya ("boş", "bozuk") da burada elenir.
    /// </summary>
    public static string EnsureValidDocumentFormat(byte[] bytes, IReadOnlyList<string>? allowedFormats)
    {
        var detected = DetectFormat(bytes);
        if (detected is null)
            throw new ConflictException(
                "Yalnızca PDF, JPG veya PNG formatında dosya yüklenebilir. Dosya içeriği bu formatlardan biriyle eşleşmiyor.",
                "DOCUMENT_FORMAT_INVALID");

        if (allowedFormats is { Count: > 0 } && !allowedFormats.Contains(detected, StringComparer.OrdinalIgnoreCase))
            throw new ConflictException(
                $"Bu evrak için yalnızca şu formatlar kabul edilir: {string.Join(", ", allowedFormats).ToUpperInvariant()}.",
                "DOCUMENT_FORMAT_NOT_ALLOWED");

        return detected;
    }
}
