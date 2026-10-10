namespace Nexora.Application.Features.Facilities.Dtos;

public record ReportTopGroupDto(string Name, string Branch, int Participants, int Occupancy);

public record ReportInstructorDto(string Name, int GroupCount, int Participants, int AttendanceRate);

public record FacilityReportSummaryDto(
    int TotalParticipants,
    int ActiveGroups,
    int AttendanceRate,
    List<ReportTopGroupDto> TopGroups,
    List<ReportInstructorDto> InstructorPerformance
);
