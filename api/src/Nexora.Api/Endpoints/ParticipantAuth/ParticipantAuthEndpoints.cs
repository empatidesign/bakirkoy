using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.ParticipantAuth;
using Nexora.Application.Features.ParticipantAuth.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.ParticipantAuth;

public static class ParticipantAuthEndpoints
{
    public static IEndpointRouteBuilder MapParticipantAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/auth/citizen").WithTags("CitizenAuth");

        group.MapPost("/nvi-lookup", NviLookup).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/register", Register).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/login", Login).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/verify-otp", VerifyOtp).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/resend-otp", ResendOtp).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/refresh", Refresh).AllowAnonymous().RequireRateLimiting("auth");
        group.MapGet("/me", Me).RequireAuthorization("Citizen");
        group.MapGet("/introspect", Introspect).RequireAuthorization("Citizen");
        group.MapGet("/children", Children).RequireAuthorization("Citizen");
        group.MapPost("/children/{childId:guid}/switch", SwitchToChild).RequireAuthorization("Citizen");
        group.MapGet("/family-members", Children).RequireAuthorization("Citizen");
        group.MapPost("/family-members/fetch-from-nvi", PreviewFamilyFromNvi).RequireAuthorization("Citizen");
        group.MapPost("/family-members/confirm-from-nvi", ConfirmFamilyFromNvi).RequireAuthorization("Citizen");
        group.MapPost("/logout", Logout).RequireAuthorization("Citizen");
        group.MapPost("/change-initial-password", ChangeInitialPassword).RequireAuthorization("Citizen");
        group.MapPost("/change-password", ChangePassword).RequireAuthorization("Citizen");
        group.MapPost("/delete-account", DeleteAccount).RequireAuthorization("Citizen").RequireRateLimiting("auth");
        // IDN-11 düzeltmesi (2026-09-01): tek istekte OTP'siz PATCH /me/contact
        // kaldırıldı. İki adımlı akış: request-contact-change (yeni değere OTP
        // gönderir) + confirm-contact-change (OTP doğrulanınca uygular).
        group.MapPost("/me/contact/request-change", RequestContactChange).RequireAuthorization("Citizen").RequireRateLimiting("auth");
        group.MapPost("/me/contact/confirm-change", ConfirmContactChange).RequireAuthorization("Citizen").RequireRateLimiting("auth");
        group.MapPost("/me/nvi-refresh", RefreshMeFromNvi).RequireAuthorization("Citizen");
        group.MapPost("/me/accept-kvkk", AcceptKvkk).RequireAuthorization("Citizen");
        group.MapPost("/me/accept-notification-consent", AcceptNotificationConsent).RequireAuthorization("Citizen");
        group.MapPost("/profile-photo", UploadPhoto).RequireAuthorization("Citizen").DisableAntiforgery();
        // Mobil QA bulgusu (2026-09-22, madde 125): yükleme vardı, kaldırma yoktu.
        group.MapDelete("/profile-photo", RemovePhoto).RequireAuthorization("Citizen");
        group.MapPost("/forgot-password", ForgotPassword).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/verify-reset-otp", VerifyResetOtp).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/reset-password", ResetPassword).AllowAnonymous().RequireRateLimiting("auth");
        group.MapGet("/sessions", GetSessions).RequireAuthorization("Citizen");
        group.MapDelete("/sessions/{sessionId}", RevokeSession).RequireAuthorization("Citizen");
        group.MapPost("/{id:guid}/bypass-code", GenerateBypassCode).RequireAuthorization("AdminOrAbove").RequirePermission("participants.impersonate");
        group.MapPost("/exchange-bypass-code", ExchangeBypassCode).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/me/handoff-code", GenerateHandoffCode).RequireAuthorization("Citizen").RequireRateLimiting("auth");
        group.MapPost("/exchange-handoff-code", ExchangeHandoffCode).AllowAnonymous().RequireRateLimiting("auth");

        return app;
    }

    private static async Task<IResult> NviLookup(
        CitizenNviLookupRequest req,
        IParticipantAuthService service,
        IValidator<CitizenNviLookupRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.NviLookupAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Register(
        CitizenRegisterRequest req,
        IParticipantAuthService service,
        IValidator<CitizenRegisterRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.RegisterAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Login(
        CitizenLoginRequest req,
        IParticipantAuthService service,
        IValidator<CitizenLoginRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.LoginAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> VerifyOtp(
        CitizenVerifyOtpRequest req,
        IParticipantAuthService service,
        IValidator<CitizenVerifyOtpRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.VerifyOtpAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> ResendOtp(
        CitizenResendOtpRequest req,
        IParticipantAuthService service,
        IValidator<CitizenResendOtpRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.ResendOtpAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Refresh(
        CitizenRefreshRequest req,
        IParticipantAuthService service,
        IValidator<CitizenRefreshRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.RefreshAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Me(
        IParticipantAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.GetMeAsync(participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    // Yapay zekâ servisi (2026-10-06): dış servis vatandaş token'ını bu uçla doğrular.
    // İmza/süre/oturum-iptali/secver kontrolleri JwtBearer OnTokenValidated'da zaten
    // yapıldı; buraya ulaşmak = token geçerli. KVKK veri minimizasyonu gereği /me'deki
    // TCKN/telefon/adres gibi alanlar DÖNMEZ — yalnız kimlik + oturum bilgisi.
    private static IResult Introspect(ICurrentUser currentUser, HttpContext http)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        long.TryParse(http.User.FindFirst("exp")?.Value, out var exp);
        return Results.Ok(ApiResponse.Ok(new
        {
            active = true,
            sub = participantId,
            userType = currentUser.UserType,
            sessionId = currentUser.SessionId,
            exp,
        }));
    }

    private static async Task<IResult> Children(
        IParticipantAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.GetChildrenAsync(participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> SwitchToChild(
        Guid childId,
        IParticipantAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.SwitchToChildAsync(participantId, childId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> PreviewFamilyFromNvi(
        IParticipantAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.PreviewFamilyFromNviAsync(participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> ConfirmFamilyFromNvi(
        CitizenFamilyConfirmRequest req,
        IParticipantAuthService service,
        IValidator<CitizenFamilyConfirmRequest> validator,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.ConfirmFamilyFromNviAsync(participantId, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Logout(
        IParticipantAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        await service.LogoutAsync(participantId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ChangeInitialPassword(
        CitizenChangeInitialPasswordRequest req,
        IParticipantAuthService service,
        IValidator<CitizenChangeInitialPasswordRequest> validator,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var pair = await service.ChangeInitialPasswordAsync(participantId, req, ct);
        return Results.Ok(ApiResponse.Ok(pair));
    }

    private static async Task<IResult> ChangePassword(
        CitizenChangePasswordRequest req,
        IParticipantAuthService service,
        IValidator<CitizenChangePasswordRequest> validator,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        await service.ChangePasswordAsync(participantId, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> DeleteAccount(
        CitizenDeleteAccountRequest req,
        IParticipantAuthService service,
        IValidator<CitizenDeleteAccountRequest> validator,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        await service.DeleteAccountAsync(participantId, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> RequestContactChange(
        CitizenRequestContactChangeRequest req,
        IParticipantAuthService service,
        IValidator<CitizenRequestContactChangeRequest> validator,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.RequestContactChangeAsync(participantId, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> ConfirmContactChange(
        CitizenConfirmContactChangeRequest req,
        IParticipantAuthService service,
        IValidator<CitizenConfirmContactChangeRequest> validator,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.ConfirmContactChangeAsync(participantId, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> RefreshMeFromNvi(
        IParticipantAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.RefreshFromNviAsync(participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> AcceptKvkk(
        IParticipantAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.AcceptKvkkAsync(participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> AcceptNotificationConsent(
        IParticipantAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.AcceptNotificationConsentAsync(participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> UploadPhoto(
        IFormFile file,
        IParticipantAuthService service,
        ICurrentUser currentUser,
        IConfiguration config,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new ConflictException("Lütfen bir görsel seçin.", "FILE_REQUIRED");

        var maxBytes = config.GetValue("ParticipantSettings:MaxPhotoBytes", 5 * 1024 * 1024);
        if (file.Length > maxBytes)
            throw new ConflictException("Dosya boyutu çok büyük (en fazla 5 MB).", "FILE_TOO_LARGE");

        string[] allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.Contains(file.ContentType))
            throw new ConflictException("Yalnızca JPEG, PNG veya WebP görseli yükleyebilirsiniz.", "INVALID_FILE_TYPE");

        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        await using var stream = file.OpenReadStream();
        var result = await service.UploadProfilePhotoAsync(participantId, stream, file.FileName, file.ContentType, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> RemovePhoto(
        IParticipantAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        return Results.Ok(ApiResponse.Ok(await service.RemoveProfilePhotoAsync(participantId, ct)));
    }

    private static async Task<IResult> VerifyResetOtp(
        CitizenVerifyResetOtpRequest req,
        IParticipantAuthService service,
        IValidator<CitizenVerifyResetOtpRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        await service.VerifyResetOtpAsync(req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ForgotPassword(
        CitizenForgotPasswordRequest req,
        IParticipantAuthService service,
        IValidator<CitizenForgotPasswordRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.ForgotPasswordAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> ResetPassword(
        CitizenResetPasswordRequest req,
        IParticipantAuthService service,
        IValidator<CitizenResetPasswordRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        await service.ResetPasswordAsync(req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GetSessions(
        IParticipantAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.GetSessionsAsync(participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> RevokeSession(
        string sessionId,
        IParticipantAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        await service.RevokeSessionAsync(participantId, sessionId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GenerateBypassCode(
        Guid id,
        IParticipantAuthService service,
        CancellationToken ct)
    {
        var code = await service.GenerateBypassCodeAsync(id, ct);
        return Results.Ok(ApiResponse.Ok(new { code }));
    }

    private static async Task<IResult> ExchangeBypassCode(
        ExchangeBypassCodeRequest req,
        IParticipantAuthService service,
        CancellationToken ct)
    {
        var result = await service.ExchangeBypassCodeAsync(req.Code, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GenerateHandoffCode(
        IParticipantAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var code = await service.GenerateHandoffCodeAsync(participantId, ct);
        return Results.Ok(ApiResponse.Ok(new { code }));
    }

    private static async Task<IResult> ExchangeHandoffCode(
        ExchangeBypassCodeRequest req,
        IParticipantAuthService service,
        CancellationToken ct)
    {
        var result = await service.ExchangeHandoffCodeAsync(req.Code, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }
}

public record ExchangeBypassCodeRequest(string Code);
