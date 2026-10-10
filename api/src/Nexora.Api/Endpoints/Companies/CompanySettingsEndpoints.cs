using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies;
using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Api.Endpoints.Companies;

public static class CompanySettingsEndpoints
{
    public static IEndpointRouteBuilder MapCompanySettingsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/company-settings")
            .WithTags("CompanySettings")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", Get).RequirePermission("companies.view");
        group.MapPut("/", Save).RequirePermission("companies.edit");

        return app;
    }

    private static async Task<IResult> Get(ICompanySettingsService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetAsync(ct)));

    private static async Task<IResult> Save(CompanySettingsDto dto, ICompanySettingsService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SaveAsync(dto, ct)));
}
