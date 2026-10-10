using Nexora.Application.Features.Libraries.Dtos;
namespace Nexora.Application.Features.Libraries;

public interface ILibraryDeviceService
{
    Task<List<LibraryDeviceDto>> GetByLibraryAsync(Guid libraryId, CancellationToken ct);
    Task<LibraryDeviceDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<LibraryDeviceDto> CreateAsync(Guid libraryId, CreateLibraryDeviceRequest req, CancellationToken ct);
    Task<LibraryDeviceDto> UpdateAsync(Guid id, UpdateLibraryDeviceRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<LibraryDeviceDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<LibraryDeviceDto> RotateKeyAsync(Guid id, CancellationToken ct);
    Task<string?> RevealApiKeyAsync(Guid id, CancellationToken ct);
    Task<LibraryDeviceDto> MoveToLibraryAsync(Guid id, Guid targetLibraryId, CancellationToken ct);
    Task<LibraryDeviceTestResultDto> TestLockAsync(Guid id, CancellationToken ct);
}
