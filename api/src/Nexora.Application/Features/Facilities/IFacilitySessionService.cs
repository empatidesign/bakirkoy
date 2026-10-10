using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities;

public interface IFacilitySessionService
{
    Task<List<FacilitySessionDto>> GetCalendarAsync(string module, Guid facilityId, int year, int month, CancellationToken ct);
    Task<List<FacilitySessionDto>> GetByDayAsync(string module, Guid facilityId, DateTime date, CancellationToken ct);
    Task<List<FacilitySessionDto>> GetByGroupAsync(string module, Guid groupId, CancellationToken ct);
    Task<GenerateSessionsResult> GenerateAsync(string module, Guid groupId, CancellationToken ct);
    Task<FacilitySessionDto> CreateManualAsync(string module, CreateManualSessionRequest req, CancellationToken ct);
    Task<GenerateSessionsResult> GenerateIfEligibleAsync(string module, Guid groupId, CancellationToken ct);
    Task<FacilitySessionDto> CancelAsync(string module, Guid id, string? reason, CancellationToken ct);
    Task<FacilitySessionDto> ReopenAsync(string module, Guid id, CancellationToken ct);
    Task<BulkSessionsResult> BulkCancelAsync(string module, BulkCancelSessionsRequest req, CancellationToken ct);
    Task<BulkSessionsResult> BulkReopenAsync(string module, BulkReopenSessionsRequest req, CancellationToken ct);

    // Kullanıcı isteği: Program (grup) güncellendiğinde henüz günü gelmemiş gelecek seanslar yeni
    // programa göre senkronize edilmeli. Yoklaması olan seanslar sessizce silinmemeli — onay
    // istenmeli. Bkz. spor_salonu_kapsamli_revize_test_gorevi.md madde 3.
    Task<ScheduleSyncResult> SyncAfterScheduleChangeAsync(string module, Guid groupId, bool confirmAttendanceDeletion, CancellationToken ct);
}

