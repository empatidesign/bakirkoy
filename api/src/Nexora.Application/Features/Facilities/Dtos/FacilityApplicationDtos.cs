using System.Text.Json;

namespace Nexora.Application.Features.Facilities.Dtos;

public record FacilityApplicationDto(
    Guid Id,
    string Module,
    Guid FacilityId,
    string? FacilityName,
    Guid BranchId,
    string? BranchName,
    Guid? GroupId,
    string? GroupName,
    Guid? ParticipantId,
    string FullName,
    string Tckn,
    string Phone,
    string? Email,
    DateTime? BirthDate,
    string? GuardianPhone,
    JsonElement Documents,
    DateTime AppliedAt,
    string Status,
    string? RejectReason,
    bool HasMissingDocuments
);

public record FacilityApplicationStatsDto(int Total, int Pending, int Approved, int Rejected);

public record CreateFacilityApplicationRequest(
    Guid FacilityId,
    Guid BranchId,
    Guid? GroupId,
    Guid? ParticipantId,
    string FullName,
    string Tckn,
    string Phone,
    string? Email,
    DateTime? BirthDate,
    string? GuardianPhone,
    JsonElement Documents,
    /// <summary>
    /// KRİTİK BUG DÜZELTMESİ (2026-08-05, kullanıcı bulgusu — canlı testte kanıtlandı):
    /// ParticipantId boş bırakılıp (bağlı bir Participant kaydı olmadan, serbest TCKN/ad-soyad ile)
    /// manuel başvuru açıldığında cinsiyet kontrolü TAMAMEN atlanıyordu — "Kız Gençlik Kampı"na
    /// gerçek testte "BUGTEST Erkek Kişi" adıyla, hiçbir hata olmadan (201, status=waitlist)
    /// eklenebildi. Sebep: eski kontrol yalnızca `participant is not null` iken çalışıyordu
    /// (bkz. FacilityApplicationService.CreateAsync); ParticipantId olmayan başvurularda hiçbir
    /// cinsiyet kaynağı yoktu. Artık bu alan (opsiyonel, "male"/"female"/"unknown") frontend'den
    /// gönderiliyor; ParticipantId yoksa VE grup cinsiyet kısıtlıysa bu alan zorunlu hale geliyor.
    /// </summary>
    string? Gender = null
);

public record RejectApplicationRequest(string? Reason);

public record ApproveFacilityApplicationRequest(Guid? GroupId);

public record FacilityBulkApproveRequest(List<Guid> Ids, bool Preview = false);

public record FacilityBulkApproveResultDto(int Approved, int Waitlisted, int Rejected, int Skipped);
