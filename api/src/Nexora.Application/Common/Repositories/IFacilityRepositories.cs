using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;

namespace Nexora.Application.Common.Repositories;

public interface IFacilityRepository : IRepository<Facility>
{
    Task<PagedResult<Facility>> GetPagedAsync(string module, FacilityListParams p, HashSet<Guid>? scopedRefIds, CancellationToken ct);
    Task<List<Facility>> GetActiveByModuleAsync(string module, CancellationToken ct);
    Task<List<Facility>> GetAllByModuleAsync(string module, CancellationToken ct);
    Task<int> NextCodeNumberAsync(string module, CancellationToken ct);
    Task<(int Active, int Total)> GetCountsAsync(string module, CancellationToken ct);
    Task<Facility?> GetByStaticQrCodeAsync(string code, CancellationToken ct);
    Task<bool> ExistsByStaticQrCodeAsync(string code, CancellationToken ct);
    Task<PagedResult<Facility>> GetTrashAsync(string module, FacilityListParams p, CancellationToken ct);
    Task<Facility?> GetAnyByIdAsync(Guid id, CancellationToken ct);
    void HardRemove(Facility entity);
    // Kullanıcı isteği (2026-10-05, manuel sürükle-bırak sıralama): yeni bir tesis, aynı
    // modüldeki mevcut en yüksek SortOrder'ın bir fazlasıyla oluşturulur ki varsayılan sıra
    // oluşturulma kronolojisiyle tutarlı kalsın (manuel sıralama hiç kullanılmamışsa).
    Task<int> GetMaxSortOrderAsync(string module, CancellationToken ct);
    // Reorder endpoint'i: aynı modüldeki TÜM tesisleri (filtre/sayfalama olmadan) döner —
    // ReorderWaitlistAsync'teki aynı desen (gönderilen ID listesindekiler sırayla numaralanır,
    // listede olmayanlar kendi mevcut sırasına göre devam eder).
    Task<List<Facility>> GetAllForReorderAsync(string module, CancellationToken ct);
}

public interface IFacilityBranchRepository : IRepository<FacilityBranch>
{
    Task<PagedResult<FacilityBranch>> GetPagedAsync(string module, FacilityBranchListParams p, CancellationToken ct);
    Task<List<FacilityBranch>> GetActiveByModuleAsync(string module, CancellationToken ct);
    Task<bool> ExistsByNameAsync(string module, string name, Guid? excludeId, CancellationToken ct);
    Task<PagedResult<FacilityBranch>> GetTrashAsync(string module, FacilityBranchListParams p, CancellationToken ct);
    Task<FacilityBranch?> GetAnyByIdAsync(Guid id, CancellationToken ct);
    void HardRemove(FacilityBranch entity);
}

public record DiscoverFilter(
    string Module,
    string? Search,
    Guid? BranchId,
    string? BranchName,
    int? Age,
    string? Gender,
    bool? OnlySubGroups,
    bool OnlyAvailable,
    Guid? FacilityId = null,
    int? AgeMin = null,
    int? AgeMax = null,
    bool OnlyWithParking = false,
    /// <summary>Yalnızca kontenjanı dolmuş gruplar (OnlyAvailable'ın tersi).</summary>
    bool OnlyFull = false);

public record BranchCount(string BranchName, int Count, int EligibleCount);

public record FacilityFilterOption(Guid Id, string Name, int Count);

public record FacilityAgeGroupOption(int AgeMin, int AgeMax, int Count);

public record FacilityDiscoverFilters(
    List<FacilityFilterOption> Facilities,
    List<BranchCount> Branches,
    List<FacilityFilterOption> Genders,
    List<FacilityAgeGroupOption> AgeGroups,
    int AvailableCount,
    int TotalCount,
    int WithParkingCount);

public interface IFacilityGroupRepository : IRepository<FacilityGroup>
{
    Task<PagedResult<FacilityGroup>> GetPagedAsync(string module, FacilityGroupListParams p, HashSet<Guid>? scopedFacilityIds, CancellationToken ct, HashSet<Guid>? scopedGroupIds = null);
    Task<PagedResult<FacilityGroup>> GetActiveDiscoverAsync(DiscoverFilter f, int page, int limit, CancellationToken ct);
    Task<int> CountDiscoverAsync(DiscoverFilter f, CancellationToken ct);
    Task<List<BranchCount>> GetActiveBranchesAsync(string module, int? eligibleAge, string? eligibleGender, CancellationToken ct);
    Task<FacilityDiscoverFilters> GetActiveFiltersAsync(DiscoverFilter f, int? eligibleAge, string? eligibleGender, CancellationToken ct);
    Task<List<FacilityGroup>> GetByFacilityAsync(string module, Guid facilityId, CancellationToken ct);
    Task<int> CountByBranchAsync(Guid branchId, CancellationToken ct);
    Task<(int ActiveGroups, int Courses, int Academies)> GetGroupStatsAsync(string module, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountActiveByFacilitiesAsync(string module, List<Guid> facilityIds, CancellationToken ct);
    Task<Dictionary<Guid, int>> SumActiveCapacityByFacilitiesAsync(string module, List<Guid> facilityIds, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountActiveByBranchesAsync(List<Guid> branchIds, CancellationToken ct);
    Task<int> CountByInstructorAsync(Guid instructorId, CancellationToken ct);
    Task<List<FacilityGroup>> GetActiveWithInstructorByModuleAsync(string module, CancellationToken ct);
    Task<List<FacilityGroup>> GetAllByModuleAsync(string module, CancellationToken ct);
    Task<List<Guid>> GetFacilityIdsByGroupIdsAsync(List<Guid> groupIds, CancellationToken ct);
    Task<PagedResult<FacilityGroup>> GetTrashAsync(string module, FacilityGroupListParams p, CancellationToken ct);
    Task<FacilityGroup?> GetAnyByIdAsync(Guid id, CancellationToken ct);
    void HardRemove(FacilityGroup entity);
    // Kullanıcı isteği (2026-10-05, manuel sürükle-bırak sıralama): yeni grup/seans aynı
    // tesis+üst grup kapsamındaki mevcut en yüksek SortOrder'ın bir fazlasıyla oluşturulur.
    // parentGroupId null ise ana gruplar, doluysa o grubun seansları (alt-kayıt) kapsamıdır —
    // her ikisinin kendi bağımsız sıralaması vardır.
    Task<int> GetMaxSortOrderAsync(Guid facilityId, Guid? parentGroupId, CancellationToken ct);
    Task<List<FacilityGroup>> GetAllForReorderAsync(Guid facilityId, Guid? parentGroupId, CancellationToken ct);
}

public interface IFacilitySessionRepository : IRepository<FacilitySession>
{
    Task<Dictionary<Guid, int>> CountActiveByBranchesAsync(List<Guid> branchIds, CancellationToken ct);
    Task<List<FacilitySession>> GetByMonthAsync(string module, Guid facilityId, int year, int month, CancellationToken ct);
    Task<List<FacilitySession>> GetByDayAsync(string module, Guid facilityId, DateTime date, CancellationToken ct);
    Task<List<FacilitySession>> GetByGroupAsync(Guid groupId, CancellationToken ct);
    Task<List<DateTime>> GetDistinctDatesByGroupAsync(Guid groupId, CancellationToken ct);
    // Kullanıcı bulgusu (2026-08-05): "seans oluştur sekmesi var seans oluşturulmuş ise seans
    // oluştur yerine altındaki seans sayısı yazmalı" — toplu sayım için (N+1 sorgudan kaçınmak
    // için) birden çok grubun aktif (iptal edilmemiş) seans sayısını tek sorguda döner.
    Task<Dictionary<Guid, int>> CountActiveByGroupsAsync(IReadOnlyCollection<Guid> groupIds, CancellationToken ct);
}

public interface IFacilityApplicationRepository : IRepository<FacilityApplication>
{
    Task<Dictionary<Guid, int>> CountByBranchesAsync(List<Guid> branchIds, CancellationToken ct);
    Task<PagedResult<FacilityApplication>> GetPagedAsync(string module, FacilityApplicationListParams p, HashSet<Guid>? scopedFacilityIds, CancellationToken ct, HashSet<Guid>? scopedGroupIds = null);
    /// <summary>
    /// Vatandaşın (ve ailesinin) başvuruları. <paramref name="tckns"/> hata raporu (docs/hata.md
    /// #5/#7/#8) sonrası eklendi: mükerrer/çakışma kontrolü TCKN üzerinden çalışırken bu liste
    /// yalnızca ParticipantId'ye bakıyordu. Admin panelden TCKN ile açılan (ParticipantId'si boş)
    /// bir kayıt yeni başvuruyu engelliyor ama "Başvurularım" ekranında hiç görünmüyordu.
    /// </summary>
    Task<PagedResult<FacilityApplication>> GetByParticipantsAsync(IReadOnlyCollection<Guid> participantIds, string? module, string? status, int page, int limit, CancellationToken ct, string? search = null, IReadOnlyCollection<string>? tckns = null);
    Task<(int Total, int Pending, int Approved, int Rejected)> GetStatusCountsAsync(string module, Guid facilityId, CancellationToken ct);
    Task<List<Guid>> GetParticipantIdsByApplicationIdsAsync(IReadOnlyCollection<Guid> applicationIds, CancellationToken ct);
}

public interface IFacilityRegistrationRepository : IRepository<FacilityRegistration>
{
    Task<List<FacilityRegistration>> GetByGroupAsync(Guid groupId, CancellationToken ct);
    Task<List<FacilityRegistration>> GetWaitlistByGroupAsync(Guid groupId, CancellationToken ct);
    Task<List<FacilityRegistration>> GetActiveMainByTcknAsync(string tckn, CancellationToken ct);
    Task<(int Main, int Waitlist)> GetCountsByGroupAsync(Guid groupId, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountActiveWaitlistByGroupsAsync(IReadOnlyCollection<Guid> groupIds, CancellationToken ct);
    Task<(int MainParticipants, int WaitlistParticipants)> GetModuleParticipantCountsAsync(string module, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountActiveByFacilitiesAsync(List<Guid> facilityIds, string kind, CancellationToken ct);
    Task<List<FacilityRegistration>> GetPeriodExpiredActiveAsync(DateTime today, CancellationToken ct);
    Task<HashSet<Guid>> GetParticipantIdsByGroupsAsync(List<Guid> groupIds, CancellationToken ct);
    Task<HashSet<Guid>> GetParticipantIdsByFacilitiesAsync(List<Guid> facilityIds, CancellationToken ct);
    Task<HashSet<Guid>> GetParticipantIdsByRegistrationIdsAsync(List<Guid> registrationIds, CancellationToken ct);
}

public record GroupAttendanceStat(Guid GroupId, int Present, int Total);

public interface IFacilityAttendanceRepository : IRepository<FacilityAttendance>
{
    Task<List<FacilityAttendance>> GetBySessionAsync(Guid sessionId, CancellationToken ct);
    Task<List<FacilityAttendance>> GetByRegistrationAsync(Guid registrationId, CancellationToken ct);
    Task<List<GroupAttendanceStat>> GetGroupAttendanceStatsAsync(string module, CancellationToken ct);

    // Kullanıcı isteği (2026-08-12): katılım sonrası zorunlu anket otomasyonu — bir tesisteki
    // (modül fark etmeksizin, tüm gruplar/dersler dahil) en güncel "geldi/geç geldi" yoklama
    // zamanını tesis bazında döner. ParticipationSurveyGenerationJob bunu, "bu tesise en son ne
    // zaman katılım oldu" bilgisiyle 24 saatlik bekleme süresini hesaplamak için kullanır.
    Task<Dictionary<Guid, DateTime>> GetMostRecentPresentMarkedAtByFacilityAsync(string module, CancellationToken ct);
}

public interface IFacilityDeviceRepository : IRepository<FacilityDevice>
{
    Task<List<FacilityDevice>> GetByFacilityAsync(string module, Guid facilityId, CancellationToken ct);
    Task<List<FacilityDevice>> GetByServiceFacilityAsync(string module, Guid serviceFacilityId, CancellationToken ct);
    Task<List<FacilityDevice>> GetByHallAsync(Guid hallId, CancellationToken ct);
    Task<bool> ExistsByCodeAsync(string code, CancellationToken ct);
    Task<bool> ExistsBySerialNoAsync(string serialNo, Guid? excludeId, CancellationToken ct);
}

public interface IFacilitySettingsRepository : IRepository<FacilitySettingsRecord>
{
    Task<FacilitySettingsRecord?> GetGeneralAsync(string module, CancellationToken ct);
    Task<FacilitySettingsRecord?> GetForFacilityAsync(Guid facilityId, CancellationToken ct);
}

public interface IFacilityInstructorRepository : IRepository<FacilityInstructor>
{
    Task<PagedResult<FacilityInstructor>> GetPagedAsync(string module, FacilityInstructorListParams p, CancellationToken ct);
    Task<List<FacilityInstructor>> GetActiveByModuleAsync(string module, CancellationToken ct);
    Task<bool> ExistsByNameAsync(string module, string fullName, Guid? excludeId, CancellationToken ct);
}
