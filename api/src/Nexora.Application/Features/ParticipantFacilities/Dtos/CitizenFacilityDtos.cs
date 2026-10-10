namespace Nexora.Application.Features.ParticipantFacilities.Dtos;

public static class FacilityModuleLabels
{
    public static readonly IReadOnlyDictionary<string, string> Map = new Dictionary<string, string>
    {
        ["sports"] = "Spor Salonu",
        ["pool"] = "Yüzme Havuzu",
        ["youth-camp"] = "Gençlik Kampı",
        ["scout-camp"] = "İzcilik Kampı",
        ["science-center"] = "Bilim Merkezi",
        ["kasif"] = "Kaşif Çocuk",
        ["accessible-life"] = "Engelsiz Yaşam",
        ["women-family"] = "Kadın ve Aile",
    };

    public static string For(string module) => Map.TryGetValue(module, out var label) ? label : module;
}

public record CitizenTurnstileQrDto(
    Guid RegistrationId,
    string Module,
    string ModuleLabel,
    string FacilityName,
    string GroupName,
    string Token,
    int WindowSeconds);

public record CitizenFacilityGroupDto(
    Guid Id,
    string Module,
    string ModuleLabel,
    string FacilityName,
    string BranchName,
    string Name,
    string Type,
    string Gender,
    int AgeMin,
    int AgeMax,
    int Capacity,
    int RegisteredCount,
    int ReserveCapacity,
    int WaitlistCount,
    DateTime? PeriodStart,
    DateTime? PeriodEnd,
    string ScheduleSummary,
    string? FeeText,
    bool Eligible,
    bool AlreadyApplied,
    string? InstructorName,
    string? ServiceFacilityName,
    string? ServiceFacilityAddress,
    double? ServiceFacilityLatitude,
    double? ServiceFacilityLongitude,
    bool HasParking,
    int? ParkingCapacity,
    string? ParkingType,
    bool ApplicationOpen = true,
    string? ApplicationClosedReason = null,
    DateTime? ApplicationStartDate = null,
    DateTime? ApplicationEndDate = null,
    string? ImageUrl = null,
    List<string>? Images = null
);

public record CitizenFacilityBranchDto(string BranchName, int Count, int EligibleCount);

public record CitizenFacilityFacilityOptionDto(Guid Id, string Name, int Count);

public record CitizenFacilityGenderOptionDto(string Value, string Label, int Count);

public record CitizenFacilityAgeGroupOptionDto(int AgeMin, int AgeMax, string Label, int Count);

public record CitizenFacilityFiltersDto(
    List<CitizenFacilityFacilityOptionDto> Facilities,
    List<CitizenFacilityBranchDto> Branches,
    List<CitizenFacilityGenderOptionDto> Genders,
    List<CitizenFacilityAgeGroupOptionDto> AgeGroups,
    int AvailableCount,
    int TotalCount,
    int WithParkingCount);

public record CitizenFacilityDiscoverResultDto(
    List<CitizenFacilityGroupDto> Items,
    int Total,
    int Page,
    int Limit,
    int EligibleCount,
    int TotalCount);

public record CitizenFacilitySessionDto(
    Guid Id,
    DateTime Date,
    string Day,
    string StartTime,
    string EndTime,
    bool IsCancelled
);

public record CitizenFacilityApplicantDto(
    Guid ParticipantId,
    string FullName,
    bool IsSelf,
    int Age,
    string Gender,
    bool Eligible,
    string? IneligibleReason,
    bool AlreadyApplied
);

public record CitizenFacilityGroupDetailDto(
    Guid Id,
    string Module,
    string ModuleLabel,
    string FacilityName,
    string BranchName,
    string Name,
    string Type,
    string Gender,
    int AgeMin,
    int AgeMax,
    int Capacity,
    int RegisteredCount,
    int ReserveCapacity,
    int WaitlistCount,
    DateTime? PeriodStart,
    DateTime? PeriodEnd,
    string ScheduleSummary,
    string? FeeText,
    bool Eligible,
    bool AlreadyApplied,
    string? InstructorName,
    string? ServiceFacilityName,
    string? ServiceFacilityAddress,
    double? ServiceFacilityLatitude,
    double? ServiceFacilityLongitude,
    bool HasParking,
    int? ParkingCapacity,
    string? ParkingType,
    string? DescriptionHtml,
    string? Conditions,
    List<CitizenFacilitySessionDto> Sessions,
    List<CitizenFacilityApplicantDto> Applicants,
    bool DocumentsRequired,
    string? DocumentsMessage,
    List<CitizenFacilityDocumentTypeDto> RequiredDocuments,
    string? ParticipationLimitText = null,
    string? Requirements = null,
    string? ApplicationConditions = null,
    string? AboutHtml = null,
    string? ImageUrl = null,
    List<string>? Images = null,
    bool ApplicationOpen = true,
    string? ApplicationClosedReason = null,
    DateTime? ApplicationStartDate = null,
    DateTime? ApplicationEndDate = null,
    // Kullanıcı isteği (2026-10-04): önkoşul kurs ("Arapça Seviye 2" yalnızca "Arapça Seviye 1"i
    // tamamlamış kişilere açık) ve grup bazında özel evet/hayır soruları (örn. Havuz'da "Yüzme
    // biliyor musunuz?"). PrerequisiteMet=false iken citizen UI başvuru butonunu kilitleyip
    // PrerequisiteGroupName'i gösterir; backend ApplyAsync'te de AYRICA (UI bypass edilse bile)
    // zorunlu olarak kontrol edilir — bkz. ParticipantFacilityService.ApplyAsync.
    Guid? PrerequisiteGroupId = null,
    string? PrerequisiteGroupName = null,
    bool PrerequisiteMet = true,
    List<CitizenFacilityCustomQuestionDto>? CustomQuestions = null
);

public record CitizenFacilityCustomQuestionDto(string Id, string Question, bool Required);


public record CitizenFacilityDocumentTypeDto(
    string Key,
    string Label,
    bool Required,
    IReadOnlyList<string>? AllowedFormats = null
);

public record CitizenFacilityApplicationDocumentDto(string Type, string FileName, string? Label);

public record CitizenFacilityApplicationDto(
    Guid Id,
    string Module,
    string ModuleLabel,
    Guid? GroupId,
    string GroupName,
    string BranchName,
    string FacilityName,
    string Status,
    bool CanCancel,
    DateTime? PeriodStart,
    DateTime? PeriodEnd,
    string ScheduleSummary,
    Guid? PersonId,
    string PersonName,
    bool IsSelf,
    DateTime AppliedAt,
    string? InstructorName,
    string? ServiceFacilityName,
    string? ServiceFacilityAddress,
    double? ServiceFacilityLatitude,
    double? ServiceFacilityLongitude,
    bool HasParking,
    int? ParkingCapacity,
    string? ParkingType,
    List<CitizenFacilityApplicationDocumentDto>? Documents = null,
    // Bulgu (2026-10-03, canlı QA denetimi — nihai prod-öncesi tur): admin
    // reddettiğinde FacilityApplication.RejectReason DB'de doğru
    // saklanıyordu (bkz. FacilityApplication.cs), ama bu DTO hiç
    // taşımıyordu — reddedilen bir vatandaş, Event/Travel'daki aksine,
    // reddedilme sebebini mobilde ASLA görmüyordu. Tüm 9 facility modülünü
    // (Pool, Sports, YouthCamp, ScoutCamp, ScienceCenter, WomenFamily, Seda,
    // Kasif, Engelsiz) etkileyen tek, paylaşılan kök neden.
    string? RejectionReason = null
);
