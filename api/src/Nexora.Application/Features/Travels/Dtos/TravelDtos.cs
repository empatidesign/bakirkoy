using System.Text.Json;

namespace Nexora.Application.Features.Travels.Dtos;

public record TravelDto(
    Guid Id,
    string Code,
    Guid RouteId,
    string Name,
    Guid CategoryId,
    string CategoryName,
    string CategoryColor,
    string Destination,
    double? Latitude,
    double? Longitude,
    string Description,
    string Conditions,
    string InternalNote,
    DateTime StartDate,
    DateTime EndDate,
    DateTime RegistrationStartDate,
    DateTime RegistrationEndDate,
    string Gender,
    int MinAge,
    int MaxAge,
    int Capacity,
    int RegisteredCount,
    int ReserveCount,
    int ReserveCapacity,
    string ParticipationPeriod,
    int ParticipationLimit,
    bool ExemptFromParticipationLimit,
    int CancellationDeadlineHours,
    JsonElement Restrictions,
    JsonElement Images,
    JsonElement Pricing,
    JsonElement Points,
    JsonElement Crew,
    int BusCount,
    bool IsActive,
    bool SultangaziResidentOnly,
    string DeparturePoint,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? DeletedAt,
    string? DeletedBy,
    // Kullanıcı isteği (2026-09-30): admin-panel liste ekranında "Yoklama Al" / "Yoklamayı
    // Görüntüle" satır aksiyonunun ikonunu/başlığını doğru göstermek için — Facility
    // modüllerindeki SessionRecord.attendanceTaken alanıyla aynı amaç.
    bool AttendanceTaken = false
);

public record TravelOptionDto(Guid Id, string Name, string? Destination, string Code, DateTime StartDate, DateTime EndDate);

/// <summary>Kullanıcı isteği (2026-08-07): Geziler ana sayfasında "Seçili Gezi: 0" gibi anlamsız
/// varsayılan kartlar yerine gerçek özet gösterilsin — toplam rota (Gezi) sayısı, ortalama
/// puan ve yorum sayısı da eklendi.</summary>
public record TravelSummaryDto(
    int Total, int Active, int Passive, int TotalRegistered, int TotalCapacity,
    int TotalRoutes = 0, double AverageRating = 0, int TotalReviews = 0,
    int HeldToDate = 0, int Upcoming = 0);

public record TravelAuditEntryDto(Guid Id, string Action, DateTime ChangedAt, string ChangedBy, JsonElement? OldValue, JsonElement? NewValue);
