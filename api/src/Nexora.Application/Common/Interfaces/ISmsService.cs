namespace Nexora.Application.Common.Interfaces;

public interface ISmsService
{
    Task<bool> SendAsync(string message, IReadOnlyCollection<string> phones, CancellationToken ct = default);
    Task<bool> SendOneAsync(string phone, string message, CancellationToken ct = default);

    bool IsMockMode { get; }
}
