namespace Nexora.Application.Features.AiCatalog.Dtos;

/// <summary>
/// Kullanıcı isteği: dış bir yapay zeka asistanı, belediyenin TÜM modüllerindeki
/// (kütüphane, kurs/program, salon, gezi, acil toplanma alanı, hizmet tesisi)
/// programlara "hangi program nerede var, nerede boşluk var" gibi sorularla
/// erişebilsin — ama kayıt/başvuru/iptal gibi hiçbir yazma işlemi YAPAMASIN.
/// Bu yüzden bu DTO'lar ve bunları besleyen servis salt-okunurdur; hiçbir
/// AiCatalog endpoint'i mutasyon içermez (bkz. AiCatalogEndpoints.cs).
/// </summary>
public record AiCatalogProgramDto(
    string Module,
    string ModuleLabel,
    Guid Id,
    string Name,
    string? Type,
    string? Gender,
    int? AgeMin,
    int? AgeMax,
    int Capacity,
    int RegisteredCount,
    int AvailableSlots,
    bool HasAvailability,
    DateTime? PeriodStart,
    DateTime? PeriodEnd,
    string? ScheduleSummary,
    string? FeeText,
    string? InstructorName,
    string FacilityName,
    string? BranchName,
    string? Address,
    string? District,
    double? Latitude,
    double? Longitude,
    bool ApplicationOpen);

public record AiCatalogLibraryDto(
    Guid Id,
    string Name,
    string? Description,
    string? Address,
    string? District,
    double? Latitude,
    double? Longitude,
    int Capacity,
    int CurrentOccupancy,
    int AvailableSeats,
    bool HasAvailability,
    string AreaType,
    string SeatingMode,
    bool ReservationEnabled,
    bool QueueEnabled,
    int? ParkingCapacity,
    string? ParkingType,
    string? NearestEmergencyAreaName,
    double? NearestEmergencyAreaDistanceKm);

public record AiCatalogHallDto(
    Guid Id,
    string Name,
    string Type,
    string? FacilityName,
    int Capacity,
    int? BuildingFloor,
    string? Description);

public record AiCatalogTravelDto(
    Guid Id,
    string Name,
    string Destination,
    DateTime StartDate,
    DateTime EndDate,
    DateTime RegistrationStartDate,
    DateTime RegistrationEndDate,
    string Gender,
    int MinAge,
    int MaxAge,
    int Capacity,
    int RegisteredCount,
    int AvailableSlots,
    bool HasAvailability,
    bool RegistrationOpen,
    bool SultangaziResidentOnly,
    string? DeparturePoint,
    string? Description);

public record AiCatalogEmergencyAreaDto(
    Guid Id,
    string Name,
    string Neighborhood,
    string? Address,
    double? Latitude,
    double? Longitude,
    int Capacity,
    int AreaSizeM2,
    bool HasToilet,
    bool HasWater,
    bool HasElectricity,
    bool HasGenerator,
    bool HasHeating,
    bool HasTentArea,
    string? EmergencyPhone);

public record AiCatalogFacilityDto(
    Guid Id,
    string Name,
    string Type,
    string LocationType,
    string? Address,
    string? District,
    double? Latitude,
    double? Longitude,
    int? Capacity,
    int? ParkingCapacity,
    string? ParkingType,
    IReadOnlyList<string> Facilities,
    IReadOnlyList<string> AccessibilityFeatures,
    IReadOnlyList<string> ServiceModules,
    IReadOnlyList<string> GalleryImageUrls,
    string? PrimaryImageUrl,
    DateTime? UpdatedAt);

public record AiCatalogSummaryDto(
    int TotalPrograms,
    int ProgramsWithAvailability,
    int TotalLibraries,
    int LibrariesWithAvailability,
    int TotalHalls,
    int TotalUpcomingTravels,
    int TravelsWithAvailability,
    int TotalEmergencyAreas,
    int TotalServiceFacilities,
    IReadOnlyList<string> Modules);

public record AiCatalogSearchParams(
    string? Query = null,
    string? Module = null,
    string? District = null,
    bool? OnlyAvailable = null,
    int Limit = 100);
