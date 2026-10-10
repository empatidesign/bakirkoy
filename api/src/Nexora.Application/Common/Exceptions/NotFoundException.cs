namespace Nexora.Application.Common.Exceptions;

public class NotFoundException(string message, string errorCode = "NOT_FOUND")
    : Exception(message)
{
    public string ErrorCode { get; } = errorCode;
}
