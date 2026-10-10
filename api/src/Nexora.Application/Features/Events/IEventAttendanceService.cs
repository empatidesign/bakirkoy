using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events.Dtos;

namespace Nexora.Application.Features.Events;

public interface IEventAttendanceService
{
    Task<PagedResult<ActivityDto>> GetActivityAsync(ActivityListParams p, CancellationToken ct);
    Task<ActivitySummaryDto> GetActivitySummaryAsync(ActivityListParams p, CancellationToken ct);
    Task<(byte[] Content, string FileName)> ExportAsync(ActivityListParams p, CancellationToken ct);
    Task<ActivityDto> CheckInAsync(CheckInRequest req, CancellationToken ct);

    // Kullanıcı isteği (2026-10-06): cihazsız (vatandaşın kendi kamerasıyla okuttuğu) sabit QR —
    // Facility/Library'deki IFacilityAttendanceService.GetStaticQrAsync/.../ScanStaticQrAsync ile
    // aynı sözleşme.
    Task<EventStaticQrDto> GetStaticQrAsync(Guid eventId, CancellationToken ct);
    Task<EventStaticQrDto> ToggleStaticQrAsync(Guid eventId, bool enabled, CancellationToken ct);
    Task<EventStaticQrDto> SetStaticQrModeAsync(Guid eventId, string mode, CancellationToken ct);
    Task<EventStaticQrDto> SetStaticQrTimingAsync(Guid eventId, int minExitSeconds, int reentryCooldownSeconds, CancellationToken ct);
    Task<EventStaticQrDto> RotateStaticQrAsync(Guid eventId, CancellationToken ct);
    Task<EventStaticQrScanResultDto> ScanStaticQrAsync(string staticCode, Guid participantId, CancellationToken ct, double? latitude = null, double? longitude = null);
}
