namespace Nexora.Application.Features.Libraries.Dtos;

public record LibraryApplicationDto(
    Guid Id,
    string ApplicantName,
    string ApplicantSurname,
    string? Email,
    string Phone,
    string MembershipType,
    string? Documents,
    Guid? LibraryId,
    string Status,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record LibraryApplicationRequest(
    string ApplicantName,
    string ApplicantSurname,
    string? Email,
    string Phone,
    string MembershipType,
    string? Documents,
    Guid? LibraryId);

public record LibraryApplicationSummaryDto(int Total, int Pending, int Approved, int Rejected);

public record LibraryApplicationListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Status { get; init; }
    public string? MembershipType { get; init; }
    public Guid? LibraryId { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}
