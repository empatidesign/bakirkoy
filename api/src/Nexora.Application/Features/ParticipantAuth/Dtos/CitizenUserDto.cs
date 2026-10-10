using Nexora.Domain.Enums;

namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenUserDto(
    Guid Id,
    string FullName,
    string Tckn,
    string? Email,
    string? Phone,
    string? PhotoUrl,
    bool IsMinor,
    ParticipantStatus Status,
    bool MustChangePassword,
    DateTime? LastLoginAt,
    DateTime BirthDate,
    Gender Gender,
    string? Address,
    string? City,
    string? District,
    string? Neighborhood,
    string? DistrictCode,
    int Age,
    bool KvkkAccepted,
    bool NotificationConsentAccepted);
