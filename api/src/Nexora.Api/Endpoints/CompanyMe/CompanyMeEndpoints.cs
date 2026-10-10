using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Application.Features.CompanyMe;
using Nexora.Application.Features.CompanyStaffAuth.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.CompanyMe;

public static class CompanyMeEndpoints
{
    public static IEndpointRouteBuilder MapCompanyMeEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/company/me")
            .WithTags("CompanyMe")
            .RequireAuthorization("Company");

        group.MapGet("/profile", GetProfile);
        group.MapPut("/profile", UpdateProfile);
        group.MapPost("/images", UploadImage).DisableAntiforgery();
        group.MapGet("/campaigns", GetCampaigns);
        group.MapGet("/service-categories", GetServiceCategories);
        group.MapPost("/service-categories", CreateServiceCategory);
        group.MapPut("/categories", SetCategories);

        group.MapGet("/staff", GetStaff);
        group.MapPost("/staff", CreateStaff);
        group.MapPut("/staff/{id:guid}", UpdateStaff);
        group.MapPost("/staff/{id:guid}/reset-password", ResetStaffPassword);
        group.MapPost("/staff/{id:guid}/set-password", SetStaffPassword);
        group.MapPatch("/staff/{id:guid}/activate", ActivateStaff);
        group.MapPatch("/staff/{id:guid}/deactivate", DeactivateStaff);
        group.MapDelete("/staff/{id:guid}", DeleteStaff);

        var redeemGroup = app.MapGroup("/api/v1/company/me")
            .WithTags("CompanyMe")
            .RequireAuthorization("CompanyOrStaff");
        redeemGroup.MapGet("/redeem/campaigns", GetRedeemableCampaigns);
        redeemGroup.MapPost("/redeem/qr", RedeemByQr);
        redeemGroup.MapPost("/campaigns/{id:guid}/redeem/manual", RedeemManual);
        redeemGroup.MapPost("/campaigns", CreateCampaign);
        redeemGroup.MapPut("/campaigns/{id:guid}", UpdateCampaign);
        redeemGroup.MapDelete("/campaigns/{id:guid}", DeleteCampaign);
        redeemGroup.MapPatch("/campaigns/{id:guid}/toggle-status", ToggleCampaign);
        redeemGroup.MapGet("/campaign-usages", GetCampaignUsages);

        return app;
    }

    private static async Task<IResult> GetRedeemableCampaigns(
        ICompanyMeService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var companyId = ResolveRedeemCompanyId(currentUser);
        var p = new CampaignListParams { Page = "1", Limit = "100", Sort = "createdat", Order = "desc" };
        var result = await service.GetMyCampaignsAsync(companyId, p, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> RedeemByQr(
        RedeemByQrRequest req,
        ICompanyMeService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req?.Token))
            throw new ConflictException("QR kodu okunamadı.", "INVALID_QR");
        var result = await service.RedeemByQrAsync(ResolveRedeemCompanyId(currentUser), req.Token, req.OrderAmount, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> RedeemManual(
        Guid id,
        RedeemManualRequest req,
        ICompanyMeService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var result = await service.RedeemManualAsync(ResolveRedeemCompanyId(currentUser), id, req?.Tckn, req?.Phone, req?.OrderAmount, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static Guid CompanyId(ICurrentUser currentUser)
        => currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");

    private static Guid ResolveRedeemCompanyId(ICurrentUser currentUser)
    {
        if (!currentUser.CanRedeem)
            throw new ForbiddenException("Kampanya kullandırma yetkiniz bulunmuyor. Firma yetkilinizle iletişime geçin.", "REDEEM_NOT_ALLOWED");

        return currentUser.CompanyStaffCompanyId ?? CompanyId(currentUser);
    }

    private static Guid ResolveCampaignManagerCompanyId(ICurrentUser currentUser)
    {
        if (!currentUser.CanManageCampaigns)
            throw new ForbiddenException("Kampanya yönetme yetkiniz bulunmuyor. Firma yetkilinizle iletişime geçin.", "CAMPAIGN_MANAGE_NOT_ALLOWED");

        return currentUser.CompanyStaffCompanyId ?? CompanyId(currentUser);
    }

    private static async Task<IResult> GetServiceCategories(ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
    {
        _ = CompanyId(currentUser);
        return Results.Ok(ApiResponse.Ok(await service.GetServiceCategoryOptionsAsync(ct)));
    }

    private static async Task<IResult> CreateServiceCategory(
        CompanyServiceCategoryCreateRequest req,
        ICompanyMeService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req?.Name))
            throw new ConflictException("Kategori adı zorunludur.", "SERVICE_CATEGORY_NAME_REQUIRED");
        var result = await service.CreateServiceCategoryAsync(CompanyId(currentUser), req.Name, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> SetCategories(
        SetCompanyCategoriesRequest req,
        ICompanyMeService service,
        ICurrentUser currentUser,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SetServiceCategoryAsync(CompanyId(currentUser), req?.ServiceCategoryId, ct)));

    private static async Task<IResult> GetProfile(ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetProfileAsync(CompanyId(currentUser), ct)));

    private static async Task<IResult> UpdateProfile(
        UpdateCompanyRequest req,
        ICompanyMeService service,
        IValidator<UpdateCompanyRequest> validator,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.UpdateProfileAsync(CompanyId(currentUser), req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> UploadImage(IFormFile file, ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
    {
        _ = CompanyId(currentUser);
        if (file is null || file.Length == 0)
            throw new ConflictException("Lütfen bir görsel seçin.", "FILE_REQUIRED");

        await using var stream = file.OpenReadStream();
        var url = await service.UploadImageAsync(stream, file.FileName, file.ContentType, ct);
        return Results.Ok(ApiResponse.Ok(new { url }));
    }

    private static async Task<IResult> GetCampaigns(
        [AsParameters] CampaignListParams p,
        ICompanyMeService service,
        ICurrentUser currentUser,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyCampaignsAsync(CompanyId(currentUser), p, ct)));

    private static async Task<IResult> GetCampaignUsages(
        [AsParameters] CompanyCampaignUsageListParams p,
        ICompanyMeService service,
        ICurrentUser currentUser,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyCampaignUsagesAsync(ResolveRedeemCompanyId(currentUser), p, ct)));

    private static async Task<IResult> CreateCampaign(
        CreateMyCampaignRequest req,
        ICompanyMeService service,
        IValidator<CreateMyCampaignRequest> validator,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.CreateCampaignAsync(ResolveCampaignManagerCompanyId(currentUser), req, ct);
        return Results.Created($"/api/v1/company/me/campaigns/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> UpdateCampaign(
        Guid id,
        UpdateCampaignRequest req,
        ICompanyMeService service,
        IValidator<UpdateCampaignRequest> validator,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.UpdateCampaignAsync(ResolveCampaignManagerCompanyId(currentUser), id, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> DeleteCampaign(Guid id, ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
    {
        await service.DeleteCampaignAsync(ResolveCampaignManagerCompanyId(currentUser), id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleCampaign(Guid id, ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleCampaignAsync(ResolveCampaignManagerCompanyId(currentUser), id, ct)));


    private static async Task<IResult> GetStaff(ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetStaffAsync(CompanyId(currentUser), ct)));

    private static async Task<IResult> CreateStaff(
        CreateCompanyStaffRequest req,
        ICompanyMeService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var result = await service.CreateStaffAsync(CompanyId(currentUser), req, ct);
        return Results.Created($"/api/v1/company/me/staff/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> UpdateStaff(
        Guid id,
        UpdateCompanyStaffRequest req,
        ICompanyMeService service,
        ICurrentUser currentUser,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.UpdateStaffAsync(CompanyId(currentUser), id, req, ct)));

    private static async Task<IResult> ResetStaffPassword(Guid id, ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ResetStaffPasswordAsync(CompanyId(currentUser), id, ct)));

    private static async Task<IResult> SetStaffPassword(
        Guid id,
        SetStaffPasswordRequest req,
        ICompanyMeService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req?.NewPassword))
            throw new ConflictException("Şifre zorunludur.", "STAFF_PASSWORD_REQUIRED");

        await service.SetStaffPasswordAsync(CompanyId(currentUser), id, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ActivateStaff(Guid id, ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SetStaffActiveAsync(CompanyId(currentUser), id, true, ct)));

    private static async Task<IResult> DeactivateStaff(Guid id, ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SetStaffActiveAsync(CompanyId(currentUser), id, false, ct)));

    private static async Task<IResult> DeleteStaff(Guid id, ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
    {
        await service.DeleteStaffAsync(CompanyId(currentUser), id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }
}
