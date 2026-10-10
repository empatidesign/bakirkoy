namespace Nexora.Application.Features.Scan;

public interface IFacilityEntryScanService
{
    Task<FacilityEntryScanResultDto> ScanEntryAsync(FacilityEntryScanRequest req, CancellationToken ct);
}
