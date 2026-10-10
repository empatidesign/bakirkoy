namespace Nexora.Application.Common.Interfaces;

/// <summary>
/// Kullanıcı isteği (2026-09-07): uygulamaya giriş yapmış kullanıcılar 5 dakikalık
/// pencerede "online" sayılsın, sistem performansı bozulmadan toplam online sayısı
/// takip edilsin ve panel dashboard'ında gösterilsin.
/// <para>
/// <b>Tasarım:</b> her istekte veritabanına yazmak yerine Redis'te 1 dakikalık
/// "kova" (bucket) SET'leri tutulur: <c>online:{tip}:{yyyyMMddHHmm}</c>. Online
/// sayısı son 5 kovanın birleşiminin eleman sayısıdır. Kovalar 6 dakikada kendi
/// kendine düşer, temizlik işi gerekmez.
/// </para>
/// </summary>
public interface IOnlineUserTracker
{
    /// <summary>
    /// Kullanıcıyı "şu an aktif" olarak işaretler. Her istekte çağrılacak kadar
    /// ucuzdur (tek SADD + EXPIRE) ve istemci tarafında throttle edilir.
    /// </summary>
    /// <param name="platform">
    /// Kullanıcı isteği (2026-10-04): "mobil uygulamada kaç kişi online, kaçı iOS
    /// kaçı Android" takibi — yalnız userType="citizen" için anlamlıdır (ios/android/web),
    /// diğer tipler için yoksayılır. Bilinmeyen/boş değer "web" sayılır.
    /// </param>
    Task TouchAsync(Guid userId, string userType, string? platform = null, CancellationToken ct = default);

    /// <summary>Son 5 dakikada aktif olan benzersiz kullanıcı sayılarını verir.</summary>
    Task<OnlineSnapshot> GetSnapshotAsync(CancellationToken ct = default);
}

/// <summary>Anlık online kullanıcı dağılımı.</summary>
public record OnlineSnapshot(int Total, int Admin, int Citizen, int Company, int CitizenIos, int CitizenAndroid, int CitizenWeb)
{
    public static readonly OnlineSnapshot Empty = new(0, 0, 0, 0, 0, 0, 0);
}
