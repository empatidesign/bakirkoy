using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Travels;

public record TravelRouteData(
    string Name,
    Guid CategoryId,
    string Destination,
    double? Latitude,
    double? Longitude,
    string Description,
    string Conditions,
    string InternalNote,
    string Gender,
    int MinAge,
    int MaxAge,
    string RestrictionsJson,
    string ImagesJson,
    string PricingJson,
    string PointsJson,
    bool SultangaziResidentOnly,
    // Kullanıcı isteği (2026-08-07): birleşik mesaj şablonu sisteminde "{{kalkis_noktasi}}"
    // değişkeni için gerçek bir veri kaynağı yoktu (Destination = varış noktası). Route
    // seviyesinde tutulup Travel'a SyncFromRoute() ile kopyalanıyor — aynı güzergahın tüm
    // seferleri varsayılan olarak aynı yerden kalkar.
    string DeparturePoint = "",
    // SORUN 4 düzeltmesi (2026-08-07, kullanıcı bulgusu — canlı testte kanıtlandı): bu alan
    // önceden hiç tanımlı değildi, bu yüzden RouteForm'daki "Aktif" toggle'ı PUT update ile
    // gönderilse bile backend'de sessizce yok sayılıyordu (Apply() bu alana hiç dokunmuyordu).
    // Nullable: opsiyonel — çağıran taraf mevcut durumu korumak isterse null geçebilir.
    bool? IsActive = null
);

/// <summary>
/// "Gezi" — bir lokasyon/rota (ör. Çanakkale) ve ona ait tüm içerik bilgisi
/// (isim, açıklama, kural, görsel, fiyat, yaş/cinsiyet kısıtı). Bir Route altında
/// birden çok Travel ("Sefer" — belirli tarihli somut kalkış) bulunabilir.
/// İçerik alanları sefer bazında override edilmez, Route'tan miras alınır.
/// </summary>
public class TravelRoute : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public Guid CategoryId { get; private set; }
    public string Destination { get; private set; } = string.Empty;
    public double? Latitude { get; private set; }
    public double? Longitude { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public string Conditions { get; private set; } = string.Empty;
    public string InternalNote { get; private set; } = string.Empty;
    public string Gender { get; private set; } = "mixed";
    public int MinAge { get; private set; }
    public int MaxAge { get; private set; }
    public string RestrictionsJson { get; private set; } = "{}";
    public string ImagesJson { get; private set; } = "{}";
    public string PricingJson { get; private set; } = "{}";
    public string PointsJson { get; private set; } = "{}";
    public string DeparturePoint { get; private set; } = string.Empty;
    public bool SultangaziResidentOnly { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string? CreatedBy { get; private set; }
    public string? UpdatedBy { get; private set; }

    public static TravelRoute Create(TravelRouteData d, string? actor)
    {
        var r = new TravelRoute { CreatedBy = actor };
        r.Apply(d);
        return r;
    }

    public void Update(TravelRouteData d, string? actor)
    {
        Apply(d);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    private void Apply(TravelRouteData d)
    {
        Name = d.Name.Trim();
        CategoryId = d.CategoryId;
        Destination = d.Destination?.Trim() ?? string.Empty;
        Latitude = d.Latitude;
        Longitude = d.Longitude;
        Description = d.Description ?? string.Empty;
        Conditions = d.Conditions ?? string.Empty;
        InternalNote = d.InternalNote ?? string.Empty;
        Gender = string.IsNullOrWhiteSpace(d.Gender) ? "mixed" : d.Gender;
        MinAge = d.MinAge < 0 ? 0 : d.MinAge;
        MaxAge = d.MaxAge < 0 ? 0 : d.MaxAge;
        RestrictionsJson = string.IsNullOrWhiteSpace(d.RestrictionsJson) ? "{}" : d.RestrictionsJson;
        ImagesJson = string.IsNullOrWhiteSpace(d.ImagesJson) ? "{}" : d.ImagesJson;
        PricingJson = string.IsNullOrWhiteSpace(d.PricingJson) ? "{}" : d.PricingJson;
        PointsJson = string.IsNullOrWhiteSpace(d.PointsJson) ? "{}" : d.PointsJson;
        DeparturePoint = d.DeparturePoint?.Trim() ?? string.Empty;
        SultangaziResidentOnly = d.SultangaziResidentOnly;
        if (d.IsActive.HasValue) IsActive = d.IsActive.Value;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    public void MarkDeleted(string? actor)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
    }
}
