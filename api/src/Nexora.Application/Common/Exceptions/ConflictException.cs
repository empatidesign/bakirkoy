namespace Nexora.Application.Common.Exceptions;

public class ConflictException(string message, string errorCode = "CONFLICT")
    : Exception(message)
{
    public string ErrorCode { get; } = errorCode;
}
