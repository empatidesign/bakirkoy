using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Enums;

namespace Nexora.Api.Endpoints.SmsSend;

/// <summary>
/// Kullanıcı isteği (2026-09-19, güncelleme 2026-09-20): manuel SMS gönderiminde admin
/// kendi telefonuna gönderilecek tek kullanımlık bir SMS doğrulama kodu (OTP) isteyebilir.
/// PIN yöntemi tamamen kaldırıldı — OTP artık TEK doğrulama yoludur. Bu uç nokta yalnızca
/// "kendi" telefon numarasına gönderim yapar (ICurrentUser.Id üzerinden çözülür) — başka bir
/// kullanıcı adına OTP istenemez.
/// </summary>
public static class SmsSendEndpoints
{
    public static IEndpointRouteBuilder MapSmsSendEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/sms-send")
            .WithTags("SmsSend")
            .RequireAuthorization("AdminOrAbove");

        group.MapPost("/request-otp", RequestOtp);

        return app;
    }

    private static async Task<IResult> RequestOtp(
        ICurrentUser currentUser,
        IUnitOfWork uow,
        IOtpService otpService,
        CancellationToken ct)
    {
        var adminUserId = currentUser.Id
            ?? throw new UnauthorizedAccessException();

        var admin = await uow.AdminUsers.GetByIdAsync(adminUserId, ct)
            ?? throw new NotFoundException("Kullanıcı bulunamadı.", "ADMIN_NOT_FOUND");

        if (string.IsNullOrWhiteSpace(admin.Phone))
            throw new ConflictException(
                "Hesabınızda kayıtlı bir telefon numarası yok. Doğrulama kodu gönderilemiyor, lütfen profilinize telefon numarası ekleyin ya da yöneticinizden eklenmesini isteyin.",
                "SMS_OTP_NO_PHONE");

        await otpService.EnsureCanResendAsync(adminUserId, OtpPurpose.SmsSendConfirmation, ct);
        await otpService.SendAsync(adminUserId, admin.Phone, "sms", OtpPurpose.SmsSendConfirmation, ct);

        return Results.Ok(ApiResponse.Ok(new
        {
            maskedPhone = MaskPhone(admin.Phone),
            resendCooldownSeconds = otpService.ResendCooldownSeconds,
        }));
    }

    private static string MaskPhone(string phone)
        => phone.Length <= 4 ? phone : new string('*', phone.Length - 4) + phone[^4..];
}
