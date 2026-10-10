using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Application.Common.Repositories;

public interface ITravelRepository : IRepository<Travel>
{
    Task<PagedResult<Travel>> GetPagedAsync(TravelListParams p, IReadOnlyCollection<Guid>? scopedRefIds, CancellationToken ct);
    Task<PagedResult<Travel>> GetTrashAsync(TravelListParams p, CancellationToken ct);
    Task<Travel?> GetAnyByIdAsync(Guid id, CancellationToken ct);
    Task<int> NextCodeNumberAsync(CancellationToken ct);
    // Kullanıcı bulgusu (2026-08-07): bir Gezi'nin (Route) altındaki Seferler sayfasına
    // girildiğinde üstteki istatistik kartları (Toplam Sefer/Aktif/Pasif/Kayıt/Kontenjan)
    // TÜM sistemdeki seferlerin toplamını gösteriyordu — o gezi grubuna özel değildi (frontend
    // routeId parametresi gönderiyordu ama backend'de hiç okunmuyordu). routeId eklendi;
    // null ise eski (global) davranış korunur.
    Task<(int Total, int Active, int TotalRegistered, int TotalCapacity, int HeldToDate, int Upcoming)> GetSummaryAsync(Guid? routeId, CancellationToken ct);
    // Kullanıcı isteği (2026-08-07): Geziler ana sayfasında (RoutesTab) ve bir Gezi grubuna
    // girildiğinde anlamlı istatistik kartları gösterilsin — ortalama puan ve toplam yorum
    // sayısı, routeId varsa o gruba, yoksa tüm sisteme özet verir.
    Task<(double AverageRating, int TotalReviews)> GetRatingSummaryAsync(Guid? routeId, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountByCategoriesAsync(List<Guid> categoryIds, CancellationToken ct);
    Task<Dictionary<Guid, (int Count, int Capacity, int Registered)>> GetStatsByCategoriesAsync(List<Guid> categoryIds, CancellationToken ct);
    Task<int> CountByCategoryAsync(Guid categoryId, CancellationToken ct);
    Task<Dictionary<Guid, (int Total, int Active)>> GetStatsByRoutesAsync(List<Guid> routeIds, CancellationToken ct);
    Task<int> CountByRouteAsync(Guid routeId, CancellationToken ct);
    Task<List<Travel>> GetOptionsAsync(string? search, bool includeInactive, CancellationToken ct);
    void HardRemove(Travel entity);
}
