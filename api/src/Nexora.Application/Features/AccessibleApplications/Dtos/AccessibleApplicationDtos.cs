namespace Nexora.Application.Features.AccessibleApplications.Dtos;

// IDN-Engelsiz (2026-09-11): mobil AccessibleApplicationDetailScreen'in
// beklediği alan adlarıyla birebir eşleşir (bkz. sultansehir-app
// src/services/programs.service.ts — AccessibleApplicationSummary).
public record AccessibleApplicationSummaryDto(
    Guid ApplicationId,
    Guid? GroupId,
    string GroupName,
    string Status,
    bool RequiresMedicalDocument,
    bool MedicalDocumentVerified,
    bool RequiresGuardianConsent,
    bool GuardianConsentRecorded,
    bool IsEligibleForApproval,
    List<string> MissingRequirements,
    string? PrimaryDisabilityType,
    int? DisabilityRate,
    bool HasCaregiver,
    int VisibleProgressNoteCount
);

// Mobil taraf ekstra alanlar (additionalDisabilityTypes, specialNeedsNotes,
// disabilityReportBlobKey/IssueDate/ValidUntil) da gönderebiliyor ama ekran
// bu alanları hiç doldurmuyor (yalnızca aşağıdaki 7 alan UI'da mevcut);
// backend şimdilik yalnız gerçekten kullanılan alanları işler, fazlası
// System.Text.Json tarafından sessizce yok sayılır.
public record SubmitDisabilityInfoRequest(
    string PrimaryDisabilityType,
    int? DisabilityRate,
    string EmergencyContactName,
    string EmergencyContactPhone,
    bool RequiresWheelchairAccess,
    bool RequiresSignLanguage,
    bool RequiresBraille
);

public record GiveKvkkConsentRequest(string Version);

public record AccessibleProgressNoteDto(
    Guid Id,
    Guid ProgramApplicationId,
    DateTime RecordedAt,
    string NoteType,
    string? RecommendedAdjustments
);

public record DefineCaregiverRequest(
    string Name,
    string Tc,
    string Phone,
    string Relation,
    bool IsAuthorizedPickup
);
