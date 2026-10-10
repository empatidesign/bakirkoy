namespace Nexora.Application.Features.Scan;

public record FacilityEntryScanRequest(string Token, Guid ServiceFacilityId, double? Latitude = null, double? Longitude = null);
public record FacilityEntryScanResultDto(bool Granted, string Reason, string? Module, string? ParticipantName);
