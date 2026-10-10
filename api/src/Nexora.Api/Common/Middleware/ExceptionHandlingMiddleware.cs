using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Domain.Common;
using Serilog.Context;
using ValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Common.Middleware;

public class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Kullanıcı sayfayı kapattı/yeniledi (istemci bağlantıyı kesti). Sunucu hatası değildir;
            // ELK'da HasError=true ile 500 olarak görünüp izlemeyi kirletiyordu (UAT 2026-09-24).
            // Yanıt gönderilemez (bağlantı yok) — yalnızca 499 olarak işaretlenir.
            if (!context.Response.HasStarted) context.Response.StatusCode = 499;
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        var correlationId = context.Items["CorrelationId"]?.ToString();

        // UYE-REG-002 canlı testinde bulundu: EF Core'un yeniden-deneme (retry) execution strategy'si,
        // geçici Postgres hatalarını (deadlock 40P01 dahil) bir InvalidOperationException/DbUpdateException
        // sarmalayıcısının İÇİNE gömüyor — doğrudan `ex is DbUpdateException` eşleşmesi bu durumda
        // ÇALIŞMIYORDU (gerçek DbUpdateException, InvalidOperationException'ın InnerException'ı oluyor).
        // Bu yüzden zincirin TAMAMINI gezip gerçek Postgres SqlState'i buluyoruz.
        var pgSqlState = FindPostgresSqlState(ex);

        var (statusCode, errorCode, message, errors) = ex switch
        {
            ValidationException ve => (400, "VALIDATION_ERROR",
                ve.Errors.SelectMany(kv => kv.Value).FirstOrDefault(m => !string.IsNullOrWhiteSpace(m)) ?? "Girilen bilgilerde hata var. Lütfen kontrol edin.",
                ve.Errors),
            NotFoundException nfe => (404, nfe.ErrorCode, nfe.Message, (Dictionary<string, string[]>?)null),
            ConflictException ce => (409, ce.ErrorCode, ce.Message, null),
            ForbiddenException fe => (403, fe.ErrorCode, fe.Message, null),
            DomainException de => (409, de.ErrorCode ?? "DOMAIN_RULE_VIOLATION", de.Message, null),
            Nexora.Application.Features.Integrations.AiNotConfiguredException ance
                => (409, "AI_NOT_CONFIGURED", ance.Message, (Dictionary<string, string[]>?)null),
            UnauthorizedAccessException => (401, "UNAUTHORIZED", "Kimlik doğrulama gerekli.", null),
            _ when pgSqlState == "23505"
                => (409, "DUPLICATE_RECORD", "Bu işlem az önce yapılmış olabilir. Lütfen sayfayı yenileyip tekrar deneyin.", (Dictionary<string, string[]>?)null),
            _ when pgSqlState == "40P01"
                => (409, "CONCURRENT_CONFLICT", "Bu işlem az önce yapılmış olabilir. Lütfen sayfayı yenileyip tekrar deneyin.", (Dictionary<string, string[]>?)null),
            JsonException => (400, "MALFORMED_REQUEST_BODY",
                "Gönderilen veri formatı geçersiz. Lütfen alan tiplerini kontrol edin.", (Dictionary<string, string[]>?)null),
            Microsoft.AspNetCore.Http.BadHttpRequestException bhre when bhre.InnerException is JsonException
                => (400, "MALFORMED_REQUEST_BODY",
                    "Gönderilen veri formatı geçersiz. Lütfen alan tiplerini kontrol edin.", (Dictionary<string, string[]>?)null),
            // Hata #33: minimal API'de bir endpoint zorunlu bir query/route parametresi bekliyorsa
            // (ör. [AsParameters] olmadan doğrudan `Guid groupId` parametresi) ve istemci bunu
            // göndermezse, ASP.NET Core bunu 400 değil bir BadHttpRequestException olarak fırlatıyor —
            // yukarıdaki JsonException özel durumuna girmediği için buraya kadar düşüp 500 dönüyordu
            // (Spor/Kaşif/Havuz/Kamp modüllerinde canlı doğrulandı: groupId eksik roster/waitlist
            // isteği 500 döndürüyordu). Artık bu genel BadHttpRequestException durumu da 400'e eşleniyor.
            Microsoft.AspNetCore.Http.BadHttpRequestException bhre2
                => (400, "MISSING_REQUIRED_PARAMETER", "Zorunlu bir parametre eksik veya geçersiz.", (Dictionary<string, string[]>?)null),
            _ => (500, "INTERNAL_SERVER_ERROR", "Beklenmedik bir hata oluştu.", null)
        };

        var exceptionType = ex.GetType().Name;
        var requestMethod = context.Request.Method;
        var requestPath = context.Request.Path.Value ?? string.Empty;

        using (LogContext.PushProperty("HasError", true))
        using (LogContext.PushProperty("ErrorCode", errorCode))
        using (LogContext.PushProperty("ErrorStatusCode", statusCode))
        using (LogContext.PushProperty("ExceptionType", exceptionType))
        using (LogContext.PushProperty("RequestMethod", requestMethod))
        using (LogContext.PushProperty("RequestPath", requestPath))
        {
            if (statusCode >= 500)
                logger.LogError(ex, "[API-ERROR] {RequestMethod} {RequestPath} -> {ErrorCode} ({ErrorStatusCode}): {ErrorDetail}",
                    requestMethod, requestPath, errorCode, statusCode, ex.Message);
            else
                logger.LogWarning("[API-ERROR] {RequestMethod} {RequestPath} -> {ErrorCode} ({ErrorStatusCode}): {ErrorDetail}",
                    requestMethod, requestPath, errorCode, statusCode, message);
        }

        object response = errors is not null
            ? ApiResponse.ValidationFail(errors, correlationId)
            : ApiResponse.Fail(statusCode, message, errorCode, correlationId);

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(JsonSerializer.Serialize(response,
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
    }

    // İstisna zincirini (InnerException dahil, en fazla 10 seviye) gezip ilk Postgres DbException'ın
    // SqlState'ini döndürür. EF Core'un ExecutionStrategy'si geçici hataları sarmalıyor, bu yüzden
    // üst seviye tip kontrolü (ex is DbUpdateException) tek başına yeterli değil.
    private static string? FindPostgresSqlState(Exception? ex)
    {
        for (var i = 0; ex is not null && i < 10; i++, ex = ex.InnerException)
        {
            if (ex is System.Data.Common.DbException dbEx && !string.IsNullOrEmpty(dbEx.SqlState))
                return dbEx.SqlState;
        }
        return null;
    }
}

