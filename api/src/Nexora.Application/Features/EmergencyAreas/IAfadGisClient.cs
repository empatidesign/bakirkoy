namespace Nexora.Application.Features.EmergencyAreas;

public interface IAfadGisClient
{
    /// Tüm AFAD toplanma alanı kayıtlarını sayfalayarak çeker. Bağlantı/oturum hatasında exception fırlatır.
    Task<IReadOnlyList<AfadGisAreaItem>> FetchAllAsync(CancellationToken ct);
}

public record AfadGisAreaItem(
    long ObjectId,
    string? Name,
    string? Neighborhood,
    string? Address,
    double? Latitude,
    double? Longitude,
    int? Capacity,
    int? AreaSizeM2);

public record AfadGisSyncResultDto(
    bool Success,
    int Fetched,
    int Created,
    int Updated,
    int Removed,
    string? Error);

public record AfadGisSyncStatusDto(
    bool Configured,
    DateTime? LastSyncedAt,
    int SyncedCount);
