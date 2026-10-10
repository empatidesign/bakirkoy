using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries.Dtos;

namespace Nexora.Application.Features.Libraries;

public interface ILibraryStaffService
{
    Task<PagedResult<LibraryStaffDto>> GetPagedAsync(LibraryStaffListParams p, CancellationToken ct);
    Task<List<LibraryStaffDto>> GetEligibleAsync(Guid libraryId, CancellationToken ct);
    Task<LibraryStaffDto> CreateAsync(LibraryStaffRequest req, CancellationToken ct);
    Task<LibraryStaffDto> UpdateAsync(Guid id, LibraryStaffRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<LibraryStaffDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<List<LibraryShiftDto>> GetStaffShiftsAsync(Guid staffId, CancellationToken ct);
    Task<List<LibraryOptionDto>> GetMyLibrariesAsync(CancellationToken ct);
    Task<LibraryStaffDto> SetMyLocationConsentAsync(string status, CancellationToken ct);
}

public interface ILibraryShiftService
{
    Task<List<LibraryShiftDto>> GetActiveAsync(Guid libraryId, CancellationToken ct);
    Task<List<LibraryShiftDto>> GetAllActiveAsync(CancellationToken ct);
    Task<PagedResult<LibraryShiftDto>> GetPagedAsync(Guid libraryId, LibraryShiftListParams p, CancellationToken ct);
    Task<MesaiSummaryDto> GetSummaryAsync(Guid libraryId, CancellationToken ct);
    Task<MesaiOverviewSummaryDto> GetOverviewSummaryAsync(CancellationToken ct);
    Task<LibraryShiftDto> StartAsync(Guid libraryId, StartShiftRequest req, CancellationToken ct);
    Task EndAsync(Guid shiftId, CancellationToken ct);
    Task<LibraryShiftDto> EditAsync(Guid shiftId, EditShiftRequest req, CancellationToken ct);

    Task<MyMesaiDto> GetMineAsync(Guid libraryId, CancellationToken ct);
    Task<LibraryShiftDto> StartMineAsync(Guid libraryId, SelfShiftRequest req, CancellationToken ct);
    Task EndMineAsync(Guid libraryId, CancellationToken ct);

    /// <summary>
    /// Personelin bağlı olduğu ağın (IP) tanımlı olduğu kendi çalışma kıraathanelerinden birine
    /// ait olup olmadığını kontrol eder; eşleşirse mesaiyi otomatik başlatır (buton tıklamaya
    /// gerek kalmadan). Eşleşme yoksa (5G/mobil ağ, IP kısıtlaması tanımlı olmayan kıraathane vb.)
    /// null döner — çağıran taraf mevcut manuel kıraathane seçimi akışına düşmelidir.
    /// </summary>
    Task<LibraryShiftDto?> TryAutoStartMineAsync(CancellationToken ct);

    Task<PagedResult<LibraryShiftDto>> GetMyShiftsAsync(LibraryShiftListParams p, CancellationToken ct);
    Task<MyMesaiMonthSummaryDto> GetMyMonthSummaryAsync(int? year, int? month, CancellationToken ct);
    Task<MesaiMonthlyReportDto> GetMonthlyReportAsync(MesaiMonthlyReportParams p, CancellationToken ct);
    Task<byte[]> ExportMonthlyReportAsync(MesaiMonthlyReportParams p, CancellationToken ct);

    Task<LibraryShiftDto> EditMineAsync(Guid shiftId, EditShiftRequest req, CancellationToken ct);

    Task<PagedResult<LibraryShiftDto>> GetOverviewPagedAsync(LibraryShiftListParams p, CancellationToken ct);

    Task<StaffMesaiPeriodTotalsDto> GetStaffPeriodTotalsAsync(Guid staffId, DateTime startUtc, DateTime endUtc, CancellationToken ct);

    Task<List<TopMesaiStaffDto>> GetLeaderboardAsync(MesaiLeaderboardParams p, CancellationToken ct);

    Task<MesaiReportSummaryDto> GetReportSummaryAsync(LibraryShiftListParams p, CancellationToken ct);

    /// <summary>
    /// Kapı QR cihazından tetiklenen mesai başlat/bitir — kütüphane-görevlisi-kapı-erişimi
    /// işi. Personel kendi kişisel QR'ını okuttuğunda: aktif mesaisi yoksa başlatır (giriş),
    /// varsa ve OKUTULAN kıraathanede ise bitirir (çıkış). Farklı bir kıraathanede aktif
    /// mesaisi varsa StartCoreAsync'teki mevcut "otomatik kapat + yenisini başlat" davranışı
    /// aynen uygulanır. Yetki kontrolü (library-mesai.door-access) çağıran tarafta
    /// (LibraryWebhookService) yapılır — bu metod yalnızca zaten yetkili olduğu doğrulanmış
    /// bir staffId ile çağrılmalıdır.
    /// </summary>
    Task<DoorQrToggleResultDto> ToggleDoorQrAsync(Guid staffId, Guid libraryId, CancellationToken ct);
}
