namespace Nexora.Application.Features.CitizenSubmissions.Dtos;

public record SubmissionMapPointDto(
    Guid Id,
    string Title,
    string Neighborhood,
    double Latitude,
    double Longitude,
    string SubmissionType,
    string Priority,
    string Status,
    bool NotifyMuhtar);

public record SubmissionSummaryDto(
    int Total,
    int New,
    int InReview,
    int Forwarded,
    int Resolved,
    int Rejected,
    int Urgent,
    int NotifyMuhtar);
