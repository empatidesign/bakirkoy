namespace Nexora.Application.Features.Bakkart.Dtos;

public record BakkartDocumentDto(string Name, string Url);

public record BakkartApplicationDto(
    Guid Id,
    string TrackingNo,
    Guid? ParticipantId,
    string FullName,
    string Tckn,
    string TcknLast4,
    string Phone,
    string District,
    string CardType,
    string DeliveryType,
    string Status,
    List<BakkartDocumentDto> Documents,
    DateTime AppliedAt,
    string? ReviewedBy,
    DateTime? ReviewedAt,
    string? RejectReason,
    string? Notes,
    Guid? CardId,
    string? CardNo,
    decimal? CardBalance,
    int? CardPoints,
    string? CardStatus);

public record BakkartApplicationSummaryDto(
    int Total,
    int Pending,
    int Approved,
    int Rejected,
    int TotalActiveCards,
    int TotalMerchants);

public record BakkartApplicationListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Status { get; init; }
    public string? CardType { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record CreateBakkartApplicationRequest(
    string FullName,
    string Tckn,
    string Phone,
    string District,
    string CardType,
    string DeliveryType,
    List<BakkartDocumentDto>? Documents,
    string? Notes);

public record AdminCreateBakkartApplicationRequest(
    string FullName,
    string Tckn,
    string Phone,
    string District,
    string CardType);

public record RejectBakkartApplicationRequest(string? Reason);

public record UpdateBakkartDocumentsRequest(List<BakkartDocumentDto> Documents);

public record AdjustBakkartCardRequest(decimal? BalanceDelta, int? PointsDelta, string? Note);

public record BakkartCardDto(
    Guid Id,
    Guid ApplicationId,
    string CardNo,
    string CardType,
    string Status,
    decimal Balance,
    int Points,
    DateTime IssuedAt,
    string HolderName,
    string TcknLast4,
    string Phone,
    string District);

public record BakkartTransactionDto(
    Guid Id,
    string Type,
    decimal AmountDelta,
    int PointsDelta,
    decimal BalanceAfter,
    int PointsAfter,
    string? Description,
    string? PerformedBy,
    DateTime OccurredAt);

public record BakkartCardStatsDto(
    decimal CurrentBalance,
    int CurrentPoints,
    decimal TotalLoaded,
    decimal TotalSpent,
    int TotalPointsEarned,
    int TotalPointsSpent,
    int TransactionCount,
    DateTime? LastTransactionAt);

public record MyBakkartStatusDto(
    string? TrackingNo,
    string? Status,
    DateTime? AppliedAt,
    string? RejectReason,
    BakkartCardDto? Card);
