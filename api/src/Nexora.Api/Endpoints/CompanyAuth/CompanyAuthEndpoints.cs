using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.Companies;
using Nexora.Application.Features.CompanyAuth;
using Nexora.Application.Features.CompanyAuth.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.CompanyAuth;

public static class CompanyAuthEndpoints
{
    public static IEndpointRouteBuilder MapCompanyAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/auth/company").WithTags("CompanyAuth");

        group.MapPost("/register", Register).AllowAnonymous().RequireRateLimiting("auth");
        group.MapGet("/service-categories", GetServiceCategoryOptions).AllowAnonymous();
        group.MapPost("/login", Login).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/verify-otp", VerifyOtp).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/resend-otp", ResendOtp).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/refresh", Refresh).AllowAnonymous().RequireRateLimiting("auth");
        group.MapGet("/me", Me).RequireAuthorization("Company");
        group.MapPost("/me/accept-kvkk", AcceptKvkk).RequireAuthorization("Company");
        group.MapPost("/me/accept-notification-consent", AcceptNotificationConsent).RequireAuthorization("Company");
        group.MapPost("/change-initial", ChangeInitial).RequireAuthorization("Company");
        group.MapPost("/change-password", ChangePassword).RequireAuthorization("Company");
        group.MapPost("/logout", Logout).RequireAuthorization("Company");
        group.MapPost("/forgot-password", ForgotPassword).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/verify-reset-otp", VerifyResetOtp).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/reset-password", ResetPassword).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/{id:guid}/bypass-code", GenerateBypassCode).RequireAuthorization("AdminOrAbove").RequirePermission("companies.impersonate");
        group.MapPost("/exchange-bypass-code", ExchangeBypassCode).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/me/handoff-code", GenerateHandoffCode).RequireAuthorization("Company").RequireRateLimiting("auth");
        group.MapPost("/exchange-handoff-code", ExchangeHandoffCode).AllowAnonymous().RequireRateLimiting("auth");

        return app;
    }

    private static async Task<IResult> Register(
        CompanyRegisterRequest req,
        ICompanyAuthService service,
        IValidator<CompanyRegisterRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.RegisterAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Login(
        CompanyLoginRequest req,
        ICompanyAuthService service,
        IValidator<CompanyLoginRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.LoginAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> VerifyOtp(
        CompanyVerifyOtpRequest req,
        ICompanyAuthService service,
        CancellationToken ct)
    {
        var result = await service.VerifyOtpAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> ResendOtp(
        CompanyResendOtpRequest req,
        ICompanyAuthService service,
        CancellationToken ct)
    {
        var result = await service.ResendOtpAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Refresh(
        CompanyRefreshRequest req,
        ICompanyAuthService service,
        CancellationToken ct)
    {
        var result = await service.RefreshAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Me(
        ICompanyAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var companyId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.GetMeAsync(companyId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> AcceptKvkk(
        ICompanyAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var companyId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.AcceptKvkkAsync(companyId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> AcceptNotificationConsent(
        ICompanyAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var companyId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.AcceptNotificationConsentAsync(companyId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> ChangeInitial(
        CompanyChangeInitialPasswordRequest req,
        ICompanyAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var companyId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        await service.ChangeInitialPasswordAsync(companyId, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ChangePassword(
        CompanyChangePasswordRequest req,
        ICompanyAuthService service,
        IValidator<CompanyChangePasswordRequest> validator,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var companyId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        await service.ChangePasswordAsync(companyId, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> Logout(
        ICompanyAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var companyId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        await service.LogoutAsync(companyId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ForgotPassword(
        CompanyForgotPasswordRequest req,
        ICompanyAuthService service,
        CancellationToken ct)
    {
        var result = await service.ForgotPasswordAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> VerifyResetOtp(
        CompanyVerifyResetOtpRequest req,
        ICompanyAuthService service,
        IValidator<CompanyVerifyResetOtpRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        await service.VerifyResetOtpAsync(req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ResetPassword(
        CompanyResetPasswordRequest req,
        ICompanyAuthService service,
        CancellationToken ct)
    {
        await service.ResetPasswordAsync(req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GetServiceCategoryOptions(
        IServiceCategoryService service,
        CancellationToken ct)
    {
        var result = await service.GetOptionsAsync(ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GenerateBypassCode(
        Guid id,
        ICompanyAuthService service,
        CancellationToken ct)
    {
        var code = await service.GenerateBypassCodeAsync(id, ct);
        return Results.Ok(ApiResponse.Ok(new { code }));
    }

    private static async Task<IResult> ExchangeBypassCode(
        ExchangeCompanyBypassCodeRequest req,
        ICompanyAuthService service,
        CancellationToken ct)
    {
        var result = await service.ExchangeBypassCodeAsync(req.Code, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GenerateHandoffCode(
        ICompanyAuthService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var companyId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var code = await service.GenerateHandoffCodeAsync(companyId, ct);
        return Results.Ok(ApiResponse.Ok(new { code }));
    }

    private static async Task<IResult> ExchangeHandoffCode(
        ExchangeCompanyBypassCodeRequest req,
        ICompanyAuthService service,
        CancellationToken ct)
    {
        var result = await service.ExchangeHandoffCodeAsync(req.Code, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }
}

public record ExchangeCompanyBypassCodeRequest(string Code);
