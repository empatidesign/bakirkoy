using Nexora.Application.Features.Public.Dtos;

namespace Nexora.Application.Features.Public;

public record PublicFacilityQuery(
    string? Search = null,
    string? Type = null,
    string? District = null,
    string? ServiceModule = null,
    int Page = 1,
    int Limit = 50);

public record PublicEventQuery(
    string? Search = null,
    Guid? CategoryId = null,
    Guid? FacilityId = null,
    string? District = null,
    DateTime? From = null,
    DateTime? To = null,
    bool IncludePast = false,
    int Page = 1,
    int Limit = 50);

public interface IPublicCatalogService
{
    Task<IReadOnlyList<PublicServiceFacilityDto>> GetFacilitiesAsync(PublicFacilityQuery query, CancellationToken ct);
    Task<PublicServiceFacilityDto?> GetFacilityAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<PublicFacilityMapPointDto>> GetFacilityMapPointsAsync(CancellationToken ct);

    Task<IReadOnlyList<PublicEventDto>> GetEventsAsync(PublicEventQuery query, CancellationToken ct);
    Task<PublicEventDto?> GetEventAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<PublicEventSessionDto>> GetEventSessionsAsync(Guid eventId, CancellationToken ct);
    Task<IReadOnlyList<PublicEventCategoryDto>> GetEventCategoriesAsync(CancellationToken ct);
    Task<IReadOnlyList<PublicEventCalendarDayDto>> GetEventCalendarAsync(DateTime from, DateTime to, CancellationToken ct);
}
