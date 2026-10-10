using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Companies;

/// <summary>
/// Firma (Companies) modülü genel ayarları - tek satırlık global config (Event modülündeki
/// EventSettingsRecord deseniyle aynı: JSON blob, tek kayıt, oluşturulma tarihine göre ilk kayıt
/// aktif kabul edilir). İlk kullanım alanı: bildirim şablonları (geçici şifre/onay/şifre sıfırlama SMS'leri).
/// </summary>
public class CompanySettingsRecord : BaseEntity
{
    public string ConfigJson { get; private set; } = string.Empty;

    public static CompanySettingsRecord Create(string configJson) => new() { ConfigJson = configJson };

    public void Update(string configJson) => ConfigJson = configJson;
}
