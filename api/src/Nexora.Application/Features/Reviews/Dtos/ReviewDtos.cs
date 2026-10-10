namespace Nexora.Application.Features.Reviews.Dtos;

public record CitizenReviewDto(
    Guid Id,
    int Rating,
    string? Comment,
    DateTime SubmittedAt);

public record CitizenReviewsDto(
    List<CitizenReviewDto> Reviews,
    bool CanReview,
    bool AlreadyReviewed,
    bool CheckedIn,
    double? AverageRating,
    int ReviewCount,
    int WindowDays);

public record AdminReviewDto(
    Guid Id,
    string ParticipantName,
    int Rating,
    string? Comment,
    DateTime SubmittedAt);

public record AdminReviewsDto(
    List<AdminReviewDto> Reviews,
    double? AverageRating,
    int ReviewCount);

public record SubmitReviewRequest(int Rating, string? Comment);
