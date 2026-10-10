using System.Text.Json;

namespace Nexora.Application.Features.ParticipantTravels.Dtos;

public record CitizenTravelDto(
    Guid Id,
    string Code,
    string Name,
    string CategoryName,
    string CategoryColor,
    string Destination,
    double? Latitude,
    double? Longitude,
    DateTime DepartureDate,
    DateTime ReturnDate,
    bool IsSingleDay,
    string Gender,
    int MinAge,
    int MaxAge,
    int Capacity,
    int RegisteredCount,
    int ReserveCapacity,
    int WaitlistCount,
    bool RequiresSeat,
    string? ImageUrl,
    List<string>? Photos,
    string DescriptionPreview,
    bool Eligible,
    bool AlreadyApplied,
    string? GuideName,
    string? DriverName,
    DateTime RegistrationStartDate,
    DateTime RegistrationEndDate,
    bool ApplicationOpen
);

public record CitizenTravelBusSeatMapDto(
    Guid BusId,
    string Name,
    string PlateNumber,
    string TemplateId,
    int Capacity,
    JsonElement SeatStates,
    List<string> LockedSeatIds,
    List<CitizenTravelSeatOccupantDto> Occupants,
    List<CitizenTravelSeatDto> Seats,
    string VehicleType,
    int OccupiedCount
);

public record CitizenTravelSeatOccupantDto(
    string SeatNumber,
    string Gender,
    bool IsOwnAccount = false,
    bool IsSameFamily = false
);

public record CitizenTravelSeatDto(
    string Label,
    string Status,
    string? OccupantGender,
    string? OccupantName = null
);

public record CitizenTravelApplicantDto(
    Guid ParticipantId,
    string FullName,
    bool IsSelf,
    int Age,
    string Gender,
    bool Eligible,
    string? IneligibleReason,
    bool AlreadyApplied,
    bool RequiresGuardian
);

public record CitizenTravelDetailDto(
    Guid Id,
    string Code,
    string Name,
    string CategoryName,
    string CategoryColor,
    string Destination,
    double? Latitude,
    double? Longitude,
    DateTime DepartureDate,
    DateTime ReturnDate,
    bool IsSingleDay,
    string Gender,
    int MinAge,
    int MaxAge,
    int Capacity,
    int RegisteredCount,
    int ReserveCapacity,
    int WaitlistCount,
    bool RequiresSeat,
    string? ImageUrl,
    string DescriptionPreview,
    bool Eligible,
    bool AlreadyApplied,
    string DescriptionHtml,
    string ConditionsHtml,
    List<CitizenTravelApplicantDto> Applicants,
    List<CitizenTravelBusSeatMapDto> Buses,
    string? GuideName,
    string? DriverName,
    DateTime RegistrationStartDate,
    DateTime RegistrationEndDate,
    bool ApplicationOpen,
    List<string>? Photos,
    /// <summary>Tek rezervasyonda seçilebilecek toplam kişi sayısı üst sınırı (kendisi dahil).</summary>
    int MaxGroupSize = 5,
    /// <summary>Kullanıcı isteği (2026-08-07, senaryo 4): otobüslü gezilerde çocuk katılımı ayrı
    /// bir admin ayarıdır — açıksa citizen-portal, çocuğu olmayan/ NVI'dan çekilmemiş kullanıcıya
    /// "çocuklarını NVI'den getir" aksiyonunu ve izin verilen yaş/cinsiyet/sayı bilgisini gösterir.</summary>
    bool AllowChildren = false,
    int MaxChildren = 1,
    int ChildMinAge = 0,
    int ChildMaxAge = 17,
    string ChildGenderMode = "mixed",
    /// <summary>Kullanıcı isteği (2026-09-23): misafir ekleme formu citizen-portalda gezinin
    /// admin ayarına (maxCompanions=0 → misafire hiç izin yok) bakılmaksızın her zaman
    /// gösteriliyordu — kullanıcı formu doldurup gönderdiğinde ancak backend'in GROUP_LIMIT
    /// hatasıyla karşılaşıyordu. MaxGuests burada ayrıca expose edilir ki frontend, admin
    /// tarafından kapatılmış (maxCompanions=0) gezilerde misafir bölümünü hiç göstermesin.</summary>
    int MaxGuests = 4
);

public record CitizenTravelApplicationDto(
    Guid Id,
    string Code,
    Guid TravelId,
    string TravelName,
    string CategoryName,
    string CategoryColor,
    string Destination,
    double? Latitude,
    double? Longitude,
    DateTime DepartureDate,
    DateTime ReturnDate,
    string VenueName,
    string Status,
    Guid PersonId,
    string PersonName,
    bool IsSelf,
    Guid? BusId,
    string? BusName,
    string? PlateNumber,
    string? SeatNumber,
    DateTime AppliedAt,
    int CancellationDeadlineHours,
    string? GuideName,
    bool TravelDeleted,
    string? RejectionReason = null
);
