namespace Nexora.Application.Common.ApiResponse;

public class ApiResponse<T>
{
    public bool Success { get; init; }
    public int StatusCode { get; init; }
    public string? Message { get; init; }
    public string? ErrorCode { get; init; }
    public T? Data { get; init; }
    public Dictionary<string, string[]>? Errors { get; init; }
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
    public string? CorrelationId { get; init; }
}

public static class ApiResponse
{
    public static ApiResponse<T> Ok<T>(T data, string? correlationId = null) => new()
    {
        Success = true,
        StatusCode = 200,
        Data = data,
        CorrelationId = correlationId
    };

    public static ApiResponse<T> Created<T>(T data, string? correlationId = null) => new()
    {
        Success = true,
        StatusCode = 201,
        Message = "Resource created successfully.",
        Data = data,
        CorrelationId = correlationId
    };

    public static ApiResponse<object> NoContent(string? correlationId = null) => new()
    {
        Success = true,
        StatusCode = 204,
        CorrelationId = correlationId
    };

    public static ApiResponse<object> Fail(int statusCode, string message, string errorCode, string? correlationId = null) => new()
    {
        Success = false,
        StatusCode = statusCode,
        Message = message,
        ErrorCode = errorCode,
        CorrelationId = correlationId
    };

    public static ApiResponse<object> ValidationFail(Dictionary<string, string[]> errors, string? correlationId = null) => new()
    {
        Success = false,
        StatusCode = 400,
        Message = errors.SelectMany(kv => kv.Value).FirstOrDefault(m => !string.IsNullOrWhiteSpace(m)) ?? "Girilen bilgilerde hata var. Lütfen kontrol edin.",
        ErrorCode = "VALIDATION_ERROR",
        Errors = errors,
        CorrelationId = correlationId
    };
}
