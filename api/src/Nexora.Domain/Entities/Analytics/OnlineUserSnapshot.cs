using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Analytics;

/// <summary>
/// Online kullanıcı sayısının 5 dakikada bir alınan kalıcı anlık görüntüsü.
/// Kullanıcı isteği (2026-09-07): "5 dk'da bir kayıt tutabiliriz, bunu panelde
/// dashboard'da" — Redis yalnız anlık durumu tutar (kovalar 6 dk sonra silinir),
/// geçmiş/trend grafiği için bu tablo kullanılır.
/// <para>
/// Günde 288 satır üretir; hacim sorunu oluşturmaz.
/// </para>
/// </summary>
public class OnlineUserSnapshot : BaseEntity
{
    /// <summary>Ölçümün alındığı an (UTC), 5 dakikalık dilime yuvarlanmış.</summary>
    public DateTime CapturedAt { get; private set; }

    public int TotalOnline { get; private set; }
    public int AdminOnline { get; private set; }
    public int CitizenOnline { get; private set; }
    public int CompanyOnline { get; private set; }

    public static OnlineUserSnapshot Create(DateTime capturedAt, int total, int admin, int citizen, int company)
        => new()
        {
            CapturedAt = capturedAt,
            TotalOnline = total,
            AdminOnline = admin,
            CitizenOnline = citizen,
            CompanyOnline = company,
        };
}
