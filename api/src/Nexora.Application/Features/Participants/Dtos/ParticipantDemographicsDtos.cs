namespace Nexora.Application.Features.Participants.Dtos;

public record ParticipantDemographicsParams
{
    public string? Status { get; init; }
    public bool? Verified { get; init; }
    public DateTime? StartDate { get; init; }
    public DateTime? EndDate { get; init; }
}

public record NeighborhoodStatDto(
    string Name,
    int Total,
    int Male,
    int Female,
    int Minors,
    int Adults,
    double PercentOfTotal,
    List<AgeBandStatDto> AgeBands,
    int Youth,
    int YouthMale,
    int YouthFemale,
    double YouthPercent);

public record AgeBandStatDto(
    string Band,
    int Total,
    int Male,
    int Female,
    double PercentOfTotal);

public record GenderStatDto(
    int Male,
    int Female,
    double MalePercent,
    double FemalePercent);

public record ParticipantDemographicsOverviewDto(
    int Total,
    int Active,
    int Passive,
    int Blocked,
    int Verified,
    int Unverified,
    int Minors,
    int Adults,
    int WithChildren,
    double AverageAge,
    GenderStatDto Gender,
    List<NeighborhoodStatDto> Neighborhoods,
    List<AgeBandStatDto> AgeBands,
    List<AgeBandStatDto> AgeBandsByGender);

public record NeighborhoodParticipantRowDto(
    Guid Id,
    string FullName,
    string Tckn,
    int Age,
    string Gender,
    string? Phone,
    string Status,
    DateTime RegisteredAt);

public record NeighborhoodDetailDto(
    string Neighborhood,
    int Total,
    List<NeighborhoodParticipantRowDto> Items,
    int Page,
    int Limit,
    int TotalPages);
