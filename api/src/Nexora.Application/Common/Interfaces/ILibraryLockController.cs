using Nexora.Domain.Entities.Libraries;
namespace Nexora.Application.Common.Interfaces;

public record LibraryLockResult(bool Opened, string? ErrorCode, string? ErrorMessage)
{
    public static LibraryLockResult Success() => new(true, null, null);
    public static LibraryLockResult Failure(string code, string message) => new(false, code, message);
}

public interface ILibraryLockController
{
    Task<LibraryLockResult> TriggerAsync(LibraryDevice device, string direction, CancellationToken ct = default);
}
