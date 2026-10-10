namespace Nexora.Application.Configuration;

/// Sultangazi Belediyesi Netcad GIS API (BELNET/gisapi) üzerinden AFAD toplanma alanı senkronizasyonu.
/// Spesifikasyon: "AFAD Toplanma Alanları Gisapi Servis" (Netcad 2026).
public class AfadGisSettings
{
    public bool Enabled { get; set; }
    public string BaseUrl { get; set; } = "";
    public string UserName { get; set; } = "";
    public string Password { get; set; } = "";
    public string QueryName { get; set; } = "ext_afad_3.servis";
    public int PageSize { get; set; } = 500;
    public int TimeoutSeconds { get; set; } = 60;
    public string SyncCron { get; set; } = "30 4 * * *";

    /// Servis koordinatları projeksiyonlu (metre) dönerse kullanılacak Transverse Mercator merkez meridyeni.
    /// İstanbul için ITRF96 / TM30 (EPSG:5254) → 30. UTM 35N için 27.
    public double CentralMeridian { get; set; } = 30;
    /// TM 3° dilim için 1.0, UTM için 0.9996.
    public double ScaleFactor { get; set; } = 1.0;

    /// Belediye iç ağındaki sunucu kurum içi sertifika kullanıyorsa açılır.
    public bool AllowInvalidCertificate { get; set; }

    /// Doluysa BaseUrl'deki host bu IP'ye bağlanır (DNS atlanır, TLS/SNI için host adı korunur).
    /// Örn. iç ağ: 192.168.0.154. Sunucunun DNS'i iç IP'yi çözmüyorsa kullanılır.
    public string? ResolveIp { get; set; }

    public bool IsConfigured => Enabled && !string.IsNullOrWhiteSpace(BaseUrl)
        && !string.IsNullOrWhiteSpace(UserName) && !string.IsNullOrWhiteSpace(QueryName);
}
