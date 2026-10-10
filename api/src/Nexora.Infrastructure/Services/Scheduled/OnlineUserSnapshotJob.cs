using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common.Interfaces;
using Nexora.Domain.Entities.Analytics;
using Nexora.Infrastructure.Persistence;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface IOnlineUserSnapshotJob
{
    Task RunAsync(CancellationToken ct);
}

/// <summary>
/// Kullanıcı isteği (2026-09-07): "5 dk'da bir kayıt tutabiliriz, bunu panelde
/// dashboard'da". Redis yalnızca anlık durumu tutar (dakika kovaları 6 dakikada
/// silinir); dashboard'daki geçmiş/trend grafiği için 5 dakikada bir kalıcı kayıt
/// bu iş tarafından yazılır.
/// <para>
/// Maliyet: 5 dakikada tek INSERT (günde 288 satır). Zaman damgası 5 dakikalık
/// dilime yuvarlanır ve <c>CapturedAt</c> benzersiz indekslidir; iş birden çok
/// sunucuda tetiklense veya yeniden denense bile mükerrer kayıt oluşmaz.
/// </para>
/// </summary>
public class OnlineUserSnapshotJob(
    AppDbContext db,
    IOnlineUserTracker tracker,
    ILogger<OnlineUserSnapshotJob> logger) : IOnlineUserSnapshotJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        var snapshot = await tracker.GetSnapshotAsync(ct);
        var capturedAt = RoundDownTo5Minutes(DateTime.UtcNow);

        if (await db.OnlineUserSnapshots.AnyAsync(x => x.CapturedAt == capturedAt, ct))
            return;

        db.OnlineUserSnapshots.Add(OnlineUserSnapshot.Create(
            capturedAt, snapshot.Total, snapshot.Admin, snapshot.Citizen, snapshot.Company));

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex)
        {
            // Benzersiz indeks ihlali: başka bir sunucu aynı dilimi yazmış. Sorun değil.
            logger.LogDebug(ex, "[ONLINE-SNAPSHOT] {CapturedAt} dilimi zaten kaydedilmiş.", capturedAt);
        }
    }

    private static DateTime RoundDownTo5Minutes(DateTime utc)
        => new(utc.Year, utc.Month, utc.Day, utc.Hour, utc.Minute / 5 * 5, 0, DateTimeKind.Utc);
}
