namespace Nexora.Domain.Common;

public class DomainException(string message, string? errorCode = null) : Exception(message)
{
    public string? ErrorCode { get; } = errorCode;
}
