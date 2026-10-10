namespace Nexora.Domain.Entities.Popups;

/// <summary>
/// Kullanıcı isteği (2026-09-20): popup içeriği birden fazla öğeden oluşabilir (birden fazla
/// resim, video, metin) — sırayla gösterilir (karusel). WheelSlice ile aynı "owned collection,
/// ToJson" deseni: ayrı tablo gerekmez, tek satırda saklanır.
/// </summary>
public class PopupMediaItem
{
    public int Order { get; set; }

    /// <summary>image | video | text</summary>
    public string Type { get; set; } = "text";

    /// <summary>image/video için MinIO adresi.</summary>
    public string? Url { get; set; }

    /// <summary>text tipinde ana içerik; image/video'da opsiyonel alt yazı (caption).</summary>
    public string? Text { get; set; }
}
