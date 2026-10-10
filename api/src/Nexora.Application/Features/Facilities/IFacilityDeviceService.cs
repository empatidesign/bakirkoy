using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities;

public interface IFacilityDeviceService
{
    Task<List<FacilityDeviceDto>> GetByFacilityAsync(string module, Guid facilityId, CancellationToken ct);
    Task<List<FacilityDeviceDto>> GetByServiceFacilityAsync(string module, Guid serviceFacilityId, CancellationToken ct);
    Task<FacilityDeviceDto> GetByIdAsync(string module, Guid id, CancellationToken ct);
    Task<FacilityDeviceDto> CreateAsync(string module, CreateFacilityDeviceRequest req, CancellationToken ct);
    Task<FacilityDeviceDto> UpdateAsync(string module, Guid id, UpdateFacilityDeviceRequest req, CancellationToken ct);
    Task DeleteAsync(string module, Guid id, CancellationToken ct);
    Task<FacilityDeviceDto> ToggleStatusAsync(string module, Guid id, CancellationToken ct);
    Task<FacilityDeviceDto> RotateKeyAsync(string module, Guid id, CancellationToken ct);
    Task<FacilityDeviceTestResultDto> TestLockAsync(string module, Guid id, CancellationToken ct);
    Task<FacilityDeviceOpenResultDto> ManualOpenAsync(string module, Guid id, CancellationToken ct);

    Task<List<FacilityDeviceDto>> GetByHallAsync(Guid hallId, CancellationToken ct);
    Task<FacilityDeviceDto> CreateForHallAsync(Guid hallId, CreateHallDeviceRequest req, CancellationToken ct);
    Task<FacilityDeviceDto> UpdateHallDeviceAsync(Guid id, UpdateFacilityDeviceRequest req, CancellationToken ct);
    Task DeleteHallDeviceAsync(Guid id, CancellationToken ct);
    Task<FacilityDeviceDto> ToggleHallDeviceAsync(Guid id, CancellationToken ct);
    Task<FacilityDeviceDto> RotateHallDeviceKeyAsync(Guid id, CancellationToken ct);
    Task<FacilityDeviceTestResultDto> TestHallDeviceLockAsync(Guid id, CancellationToken ct);
    Task<FacilityDeviceOpenResultDto> ManualOpenHallDeviceAsync(Guid id, CancellationToken ct);
}
