using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities;

public interface IFacilitySettingsService
{
    Task<FacilitySettingsDto> GetGeneralAsync(string module, CancellationToken ct);
    Task<FacilitySettingsDto> SaveGeneralAsync(string module, SaveGeneralSettingsRequest req, CancellationToken ct);
    Task<FacilitySettingsDto> GetForFacilityAsync(string module, Guid facilityId, CancellationToken ct);
    Task<FacilitySettingsDto> SaveForFacilityAsync(string module, Guid facilityId, SaveFacilitySettingsRequest req, CancellationToken ct);
}
