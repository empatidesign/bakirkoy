using Nexora.Domain.Entities.Travels;

namespace Nexora.Application.Common.Repositories;

public interface ITravelAttendanceRepository : IRepository<TravelAttendance>
{
    Task<List<TravelAttendance>> GetByTravelAsync(Guid travelId, CancellationToken ct);

    /// <summary>
    /// Katılımcının, kalkışı bugünden önce olan seferler arasındaki en güncel yoklama
    /// kaydını döner (attended/absent). No-show engeli kontrolü için kullanılır.
    /// </summary>
    Task<TravelAttendance?> GetMostRecentPastByParticipantAsync(Guid participantId, DateTime beforeUtc, CancellationToken ct);

    // Kullanıcı isteği (2026-08-12): katılım sonrası zorunlu anket otomasyonu — her sefer için
    // en güncel "geldi/geç geldi" yoklama zamanını döner.
    Task<Dictionary<Guid, DateTime>> GetMostRecentPresentMarkedAtByTravelAsync(CancellationToken ct);
}
