using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Application.Features.Travels;

public interface ITravelAttendanceService
{
    Task<TravelAttendanceRosterDto> GetRosterAsync(Guid travelId, CancellationToken ct);
    Task<(byte[] Content, string FileName)> ExportAsync(Guid travelId, CancellationToken ct);
    Task<SaveTravelAttendanceResultDto> SaveAsync(Guid travelId, SaveTravelAttendanceRequest req, CancellationToken ct);
    Task ReopenAsync(Guid travelId, CancellationToken ct);
}
