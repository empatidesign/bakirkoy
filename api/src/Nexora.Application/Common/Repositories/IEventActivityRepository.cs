using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Domain.Entities.Events;

namespace Nexora.Application.Common.Repositories;

public interface IEventActivityRepository : IRepository<EventActivity>
{
    // DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR export/import denetimi, madde #4): scopedEventIds
    // eklendi — diğer tüm kardeş modüller (EventApplicationService, TravelApplicationService,
    // FacilityApplicationService) kapsam bazlı yetkilendirme uygularken EventAttendanceService
    // bunu atlıyordu; kapsamı dışındaki etkinliklerin check-in/check-out kayıtlarını (TCKN, ad-soyad
    // dahil) filtresiz export edebiliyordu.
    Task<PagedResult<EventActivity>> GetPagedAsync(ActivityListParams p, IReadOnlyCollection<Guid>? scopedEventIds, CancellationToken ct);
    Task<(int CheckIn, int CheckOut, int Kiosk, int WalkIn)> GetSummaryAsync(ActivityListParams p, IReadOnlyCollection<Guid>? scopedEventIds, CancellationToken ct);
    Task<bool> HasCheckedInAsync(Guid eventId, Guid participantId, CancellationToken ct);
    Task<HashSet<Guid>> GetCheckedInEventIdsAsync(Guid participantId, List<Guid> eventIds, CancellationToken ct);

    /// <summary>
    /// Denetim bulgusu (2026-09-05, canlı test): CheckInAsync hiçbir yerde katılımcının aynı
    /// etkinlik/seans için EN SON attığı hareketi (check_in/check_out) kontrol etmiyordu —
    /// aynı kişi art arda sınırsız "check_in" atabiliyor (her seferinde ayrı EventActivity
    /// kaydı oluşuyor, katılım özet sayıları abartılı çıkıyor) ve hiç check-in yapmamış biri
    /// doğrudan "check_out" kaydı oluşturabiliyordu. Bu, giriş/çıkışın birbirini takip etmesini
    /// (alternation) zorlamak için en son hareketin türünü döner (yoksa null).
    /// </summary>
    Task<string?> GetLastKindAsync(Guid eventId, Guid? sessionId, Guid participantId, CancellationToken ct);

    // Kullanıcı isteği (2026-10-06): sabit QR min-exit-seconds/reentry-cooldown mantığı (Facility/
    // Library'deki aynı özellik) son hareketin ZAMANINA da ihtiyaç duyar, GetLastKindAsync sadece
    // Kind döner.
    Task<EventActivity?> GetLastAsync(Guid eventId, Guid? sessionId, Guid participantId, CancellationToken ct);

    // Kullanıcı isteği (2026-08-12): katılım sonrası zorunlu anket otomasyonu — her etkinlik için
    // en güncel gerçek check-in zamanını döner (katılımcıdan bağımsız). 24 saatlik bekleme süresi
    // bu zaman baz alınarak hesaplanır.
    Task<Dictionary<Guid, DateTime>> GetMostRecentCheckInAtByEventAsync(CancellationToken ct);
}
