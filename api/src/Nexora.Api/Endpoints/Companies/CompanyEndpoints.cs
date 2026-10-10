using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies;
using Nexora.Application.Features.Companies.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Companies;

public static class CompanyEndpoints
{
    public static IEndpointRouteBuilder MapCompanyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/companies")
            .WithTags("Companies")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("companies.view");
        group.MapGet("/summary", GetSummary).RequirePermission("companies.view");
        group.MapGet("/dashboard", GetDashboard).RequirePermission("companies.view");
        group.MapGet("/options", GetOptions).RequirePermission("companies.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("companies.view");
        group.MapGet("/{id:guid}/services", GetServices).RequirePermission("companies.view");
        group.MapPost("/", Create).RequirePermission("companies.create");
        group.MapPost("/images", UploadImage).DisableAntiforgery().RequirePermission("companies.create");
        group.MapPost("/import", Import).DisableAntiforgery().RequirePermission("companies.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("companies.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("companies.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("companies.edit");
        group.MapPatch("/{id:guid}/approve", Approve).RequirePermission("companies.approve");
        group.MapPatch("/{id:guid}/reject", Reject).RequirePermission("companies.approve");
        group.MapPatch("/{id:guid}/revert-approval", RevertApproval).RequirePermission("companies.approve");
        group.MapPost("/{id:guid}/unlock", Unlock).RequirePermission("companies.edit");

        group.MapPost("/{id:guid}/send-password-reset", SendPasswordReset).RequirePermission("companies.edit");
        group.MapPost("/{id:guid}/set-password", SetManualPassword).RequirePermission("companies.edit");
        group.MapPost("/messages/send", SendManualMessage).RequirePermission("companies.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] CompanyListParams p, ICompanyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(string? search, string? status, ICompanyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(new CompanyListParams { Search = search, Status = status }, ct)));

    private static async Task<IResult> GetDashboard(ICompanyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDashboardAsync(ct)));

    private static async Task<IResult> GetOptions(ICompanyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsAsync(ct)));

    private static async Task<IResult> GetById(Guid id, ICompanyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static Task<IResult> GetServices(Guid id, CancellationToken ct)
        => Task.FromResult(Results.Ok(ApiResponse.Ok(Array.Empty<object>())));

    private static async Task<IResult> Create(
        CreateCompanyRequest req,
        ICompanyService service,
        IValidator<CreateCompanyRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/companies/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> UploadImage(IFormFile file, ICompanyService service, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        var url = await service.UploadImageAsync(stream, file.FileName, file.ContentType, ct);
        return Results.Ok(ApiResponse.Ok(new { url }));
    }

    private static async Task<IResult> Import(IFormFile? file, ICompanyService service, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new AppValidationException("Doğrulama hatası.", new Dictionary<string, string[]> { ["file"] = ["Yüklenecek dosya zorunludur."] });
        if (!string.Equals(Path.GetExtension(file.FileName), ".xlsx", StringComparison.OrdinalIgnoreCase))
            throw new AppValidationException("Doğrulama hatası.", new Dictionary<string, string[]> { ["file"] = ["Yalnızca .xlsx uzantılı dosya yüklenebilir."] });

        await using var stream = file.OpenReadStream();
        var result = await service.ImportAsync(stream, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateCompanyRequest req,
        ICompanyService service,
        IValidator<UpdateCompanyRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.UpdateAsync(id, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Delete(Guid id, ICompanyService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(Guid id, ICompanyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));

    private static async Task<IResult> Unlock(Guid id, ICompanyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.UnlockAsync(id, ct)));

    private static async Task<IResult> Approve(Guid id, ICompanyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ApproveAsync(id, ct)));

    private static async Task<IResult> Reject(Guid id, RejectCompanyRequest req, ICompanyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.RejectAsync(id, req ?? new RejectCompanyRequest(null), ct)));

    private static async Task<IResult> RevertApproval(Guid id, ICompanyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.RevertApprovalAsync(id, ct)));

    private static async Task<IResult> SendPasswordReset(
        Guid id,
        CompanySendPasswordResetRequest req,
        ICompanyService service,
        IValidator<CompanySendPasswordResetRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        await service.SendPasswordResetAsync(id, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> SetManualPassword(
        Guid id,
        CompanySetManualPasswordRequest req,
        ICompanyService service,
        IValidator<CompanySetManualPasswordRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        await service.SetManualPasswordAsync(id, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> SendManualMessage(
        CompanyManualMessageRequest req,
        ICompanySettingsService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SendManualMessageAsync(req, ct)));
}
