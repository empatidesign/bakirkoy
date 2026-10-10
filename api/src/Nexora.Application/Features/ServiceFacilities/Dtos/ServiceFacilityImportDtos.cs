namespace Nexora.Application.Features.ServiceFacilities.Dtos;

public record ServiceFacilityImportRowResultDto(int Row, string Name, string Outcome, string? Reason);

public record ServiceFacilityImportResultDto(
    int TotalRows,
    int Added,
    int Skipped,
    int FailedRows,
    List<ServiceFacilityImportRowResultDto> Rows);
