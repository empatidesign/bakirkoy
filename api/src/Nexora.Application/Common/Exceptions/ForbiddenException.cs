namespace Nexora.Application.Common.Exceptions;

public class ForbiddenException(string message = "Bu işlem için yetkiniz yok.", string errorCode = "FORBIDDEN")
    : Exception(message)
{
    public string ErrorCode { get; } = errorCode;
}
