using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.Auth;
using Nexora.Application.Features.Auth.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/auth").WithTags("Auth");

        group.MapPost("/login", Login).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/resend-otp", ResendOtp).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/verify-otp", VerifyOtp).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/refresh", Refresh).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/forgot-password", ForgotPassword).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/verify-reset-otp", VerifyResetOtp).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/reset-password", ResetPassword).AllowAnonymous().RequireRateLimiting("auth");
        group.MapGet("/me", Me).RequireAuthorization();
        group.MapGet("/session-check", () => Results.Ok()).RequireAuthorization();
        group.MapPost("/logout", Logout).RequireAuthorization();
        group.MapPost("/change-initial-password", ChangeInitialPassword).RequireAuthorization();
        group.MapPut("/profile", UpdateProfile).RequireAuthorization();
        group.MapPost("/change-password", ChangePassword).RequireAuthorization();
        // Kullanıcı isteği (2026-09-07): "muhtar yönetimi sayfasında bypass ederek girsin" —
        // bkz. IAuthService.GenerateBypassCodeAsync.
        group.MapPost("/{id:guid}/bypass-code", GenerateBypassCode).RequireAuthorization("AdminOrAbove").RequirePermission("admins.impersonate");
        group.MapPost("/exchange-bypass-code", ExchangeBypassCode).AllowAnonymous().RequireRateLimiting("auth");

        return app;
    }

    private static async Task<IResult> GenerateBypassCode(
        Guid id,
        IAuthService service,
        CancellationToken ct)
    {
        var code = await service.GenerateBypassCodeAsync(id, ct);
        return Results.Ok(ApiResponse.Ok(new { code }));
    }

    private static async Task<IResult> ExchangeBypassCode(
        ExchangeAdminBypassCodeRequest req,
        IAuthService service,
        CancellationToken ct)
    {
        var result = await service.ExchangeBypassCodeAsync(req.Code, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> ChangeInitialPassword(
        ChangeInitialPasswordRequest req,
        IAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var userId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        await service.ChangeInitialPasswordAsync(userId, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> Login(
        LoginRequest req,
        IAuthService service,
        IValidator<LoginRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.LoginAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> ResendOtp(
        ResendOtpRequest req,
        IAuthService service,
        IValidator<ResendOtpRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.ResendOtpAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> VerifyOtp(
        VerifyOtpRequest req,
        IAuthService service,
        IValidator<VerifyOtpRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.VerifyOtpAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Refresh(
        RefreshRequest req,
        IAuthService service,
        CancellationToken ct)
    {
        var result = await service.RefreshAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> ForgotPassword(
        ForgotPasswordRequest req,
        IAuthService service,
        IValidator<ForgotPasswordRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.ForgotPasswordAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> VerifyResetOtp(
        AdminVerifyResetOtpRequest req,
        IAuthService service,
        CancellationToken ct)
    {
        await service.VerifyResetOtpAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(new { verified = true }));
    }

    private static async Task<IResult> ResetPassword(
        AdminResetPasswordRequest req,
        IAuthService service,
        CancellationToken ct)
    {
        await service.ResetPasswordAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(new { reset = true }));
    }

    private static async Task<IResult> Me(
        IAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var userId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.GetMeAsync(userId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }


    private static async Task<IResult> Logout(
        IAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var userId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        await service.LogoutAsync(userId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> UpdateProfile(
        UpdateProfileRequest req,
        IAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var userId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.UpdateProfileAsync(userId, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> ChangePassword(
        ChangePasswordRequest req,
        IAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var userId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        await service.ChangePasswordAsync(userId, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }
}

public record ExchangeAdminBypassCodeRequest(string Code);
