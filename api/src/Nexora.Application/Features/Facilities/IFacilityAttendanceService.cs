using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;

namespace Nexora.Application.Features.Facilities;

public interface IFacilityAttendanceService
{
    Task<List<AttendanceRosterItemDto>> GetRosterAsync(string module, Guid sessionId, CancellationToken ct);
    Task<SaveAttendanceResult> SaveAsync(string module, SaveAttendanceRequest req, CancellationToken ct);
    Task<SaveAttendanceResult> CorrectAsync(string module, SaveAttendanceRequest req, CancellationToken ct);
    Task<List<AttendanceHistoryItemDto>> GetHistoryByRegistrationAsync(string module, Guid registrationId, CancellationToken ct);
    Task<SaveAttendanceResult> ReviseByRegistrationAsync(string module, Guid registrationId, ReviseAttendanceRequest req, CancellationToken ct);
    Task<AttendanceRosterItemDto> CheckInAsync(string module, Guid sessionId, string tckn, CancellationToken ct);
    Task<AttendanceCheckInResultDto> CheckInByFacilityAsync(string module, Guid facilityId, string code, string method, CancellationToken ct);
    Task<DeviceCheckInResultDto> DeviceCheckInAsync(string module, string deviceCode, string apiKey, string code, CancellationToken ct);
    Task<DeviceCheckInResultDto> DeviceCheckInByDeviceAsync(FacilityDevice device, string code, CancellationToken ct);
    Task<bool> RecordQrEntryAsync(string module, Guid serviceFacilityId, Guid participantId, CancellationToken ct);
    Task<int> EnforceAbsencesForSessionAsync(string module, Guid sessionId, CancellationToken ct);

    Task<FacilityStaticQrDto> GetStaticQrAsync(string module, Guid facilityId, CancellationToken ct);
    Task<FacilityStaticQrDto> ToggleStaticQrAsync(string module, Guid facilityId, bool enabled, CancellationToken ct);
    Task<FacilityStaticQrDto> SetStaticQrModeAsync(string module, Guid facilityId, string mode, CancellationToken ct);
    Task<FacilityStaticQrDto> SetStaticQrTimingAsync(string module, Guid facilityId, int minExitMinutes, int reentryCooldownMinutes, CancellationToken ct);
    Task<FacilityStaticQrDto> RotateStaticQrAsync(string module, Guid facilityId, CancellationToken ct);
    Task<StaticQrScanResultDto> ScanStaticQrAsync(string staticCode, Guid participantId, CancellationToken ct, double? latitude = null, double? longitude = null);
}
