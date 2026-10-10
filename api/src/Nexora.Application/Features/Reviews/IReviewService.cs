using Nexora.Application.Features.Reviews.Dtos;

namespace Nexora.Application.Features.Reviews;

public interface IReviewService
{
    Task<CitizenReviewsDto> GetEventReviewsAsync(Guid eventId, CancellationToken ct);
    Task<CitizenReviewDto> SubmitEventReviewAsync(Guid eventId, SubmitReviewRequest req, CancellationToken ct);
    Task<CitizenReviewsDto> GetTravelReviewsAsync(Guid travelId, CancellationToken ct);
    Task<CitizenReviewDto> SubmitTravelReviewAsync(Guid travelId, SubmitReviewRequest req, CancellationToken ct);

    Task<AdminReviewsDto> GetEventReviewsAdminAsync(Guid eventId, CancellationToken ct);
    Task<AdminReviewsDto> GetTravelReviewsAdminAsync(Guid travelId, CancellationToken ct);
}
