using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.CompanyStaffAuth;
using Nexora.Application.Features.CompanyStaffAuth.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.CompanyStaffAuth;

public static class CompanyStaffAuthEndpoints
{
    public static IEndpointRouteBuilder MapCompanyStaffAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/auth/company-staff").WithTags("CompanyStaffAuth");

        group.MapPost("/login", Login).AllowAnonymous().RequireRateLimiting("auth");
        group.MapPost("/refresh", Refresh).AllowAnonymous().RequireRateLimiting("auth");
        group.MapGet("/me", Me).RequireAuthorization("CompanyStaff");
        group.MapPost("/me/accept-kvkk", AcceptKvkk).RequireAuthorization("CompanyStaff");
        group.MapPost("/me/accept-notification-consent", AcceptNotificationConsent).RequireAuthorization("CompanyStaff");
        group.MapPost("/logout", Logout).RequireAuthorization("CompanyStaff");

        return app;
    }

    private static async Task<IResult> Login(
        CompanyStaffLoginRequest req,
        ICompanyStaffAuthService service,
        CancellationToken ct)
    {
        var result = await service.LoginAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Refresh(
        CompanyStaffRefreshRequest req,
        ICompanyStaffAuthService service,
        CancellationToken ct)
    {
        var result = await service.RefreshAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Me(ICompanyStaffAuthService service, ICurrentUser currentUser, CancellationToken ct)
    {
        var staffId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        return Results.Ok(ApiResponse.Ok(await service.GetMeAsync(staffId, ct)));
    }

    private static async Task<IResult> AcceptKvkk(ICompanyStaffAuthService service, ICurrentUser currentUser, CancellationToken ct)
    {
        var staffId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        return Results.Ok(ApiResponse.Ok(await service.AcceptKvkkAsync(staffId, ct)));
    }

    private static async Task<IResult> AcceptNotificationConsent(ICompanyStaffAuthService service, ICurrentUser currentUser, CancellationToken ct)
    {
        var staffId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        return Results.Ok(ApiResponse.Ok(await service.AcceptNotificationConsentAsync(staffId, ct)));
    }

    private static async Task<IResult> Logout(ICompanyStaffAuthService service, ICurrentUser currentUser, CancellationToken ct)
    {
        var staffId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        await service.LogoutAsync(staffId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }
}
