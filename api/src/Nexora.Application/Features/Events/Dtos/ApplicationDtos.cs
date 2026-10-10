using System.Text.Json;

namespace Nexora.Application.Features.Events.Dtos;

public record ApplicationDto(
    Guid Id,
    string Code,
    Guid EventId,
    string EventName,
    string EventCategoryName,
    string EventCategoryColor,
    Guid? SessionId,
    string? SessionLabel,
    DateTime EventDate,
    string Day,
    Guid ParticipantId,
    string ParticipantName,
    string Tckn,
    string Gender,
    int Age,
    string? Phone,
    string? Email,
    string Status,
    string DocumentStatus,
    string PaymentStatus,
    string? SeatNumber,
    DateTime AppliedAt,
    string? AppliedBy,
    string? RejectionReason = null
);

public record ApplicationSummaryDto(int Total, int Approved, int Pending, int Rejected, int Reviewing, int Waitlist);

public record QrTokenDto(
    string Token,
    int RotationSeconds,
    DateTimeOffset ExpiresAt
);

public record SeatMapDto(
    Guid? HallId,
    string? HallName,
    JsonElement? Layout,
    Dictionary<string, string> States,
    string ReservationType
);
