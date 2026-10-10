using System.Text.Json;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Integrations;
using Nexora.Application.Features.Reports;
using Nexora.Application.Features.Reports.Dtos;

namespace Nexora.Api.Endpoints.Reports;

public static class ReportsEndpoints
{
    public static IEndpointRouteBuilder MapReportsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/reports")
            .WithTags("Reports")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/overview", GetOverview).RequirePermission("reports.view");
        group.MapGet("/participant", GetParticipant).RequirePermission("reports.view");

        group.MapGet("/participant-activity", GetParticipantActivityReport).RequirePermission("reports.view");
        group.MapGet("/participant-activity/detail", GetParticipantActivityDetail).RequirePermission("reports.view");

        group.MapPost("/overview/ai-summary", GetAiSummary).RequirePermission("reports.view");

        return app;
    }

    private static async Task<IResult> GetOverview(
        [AsParameters] ReportsOverviewParams p,
        IReportsService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOverviewAsync(p, ct)));

    private static async Task<IResult> GetParticipant(
        Guid? participantId,
        string? tckn,
        string? fullName,
        [AsParameters] ReportsParticipantDetailParams p,
        IReportsService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetParticipantDetailAsync(participantId, tckn, fullName, p, ct)));

    private static async Task<IResult> GetParticipantActivityReport(
        [AsParameters] ParticipantActivityReportParams p,
        IParticipantActivityReportService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetReportAsync(p, ct)));

    private static async Task<IResult> GetParticipantActivityDetail(
        Guid? participantId,
        string? tckn,
        [AsParameters] ParticipantActivityReportParams p,
        IParticipantActivityReportService service,
        CancellationToken ct)
    {
        var detail = await service.GetDetailAsync(participantId, tckn, p, ct);
        return detail is null
            ? Results.NotFound(ApiResponse.Fail(404, "Seçili dönemde katılımcı aktivitesi bulunamadı.", "NOT_FOUND"))
            : Results.Ok(ApiResponse.Ok(detail));
    }

    private static async Task<IResult> GetAiSummary(
        [AsParameters] ReportsOverviewParams p,
        string? provider,
        IReportsService reportsService,
        IAiQueryService aiService,
        CancellationToken ct)
    {
        var overview = await reportsService.GetOverviewAsync(p, ct);
        var contextJson = JsonSerializer.Serialize(new
        {
            overview.Range,
            overview.Kpis,
            overview.Modules,
            overview.TopDemand,
            overview.TopRated,
            overview.StatusBreakdown,
            overview.Gender,
            overview.Nationality,
            overview.AgeBuckets,
            overview.Rating,
        });

        const string prompt =
            "Aşağıdaki JSON, bir belediye yönetim panelinin katılım/başvuru raporlama " +
            "verisidir (etkinlik, gezi, kütüphane, spor vb. tüm modüller birleşik). " +
            "Bu veriye dayanarak kısa (en fazla 6-8 madde), yöneticiye yönelik, " +
            "Türkçe bir özet ve dikkat çekici bulgular/öneriler listesi hazırla. " +
            "Sayısal değerleri olduğu gibi kullan, uydurma bilgi ekleme.";

        var summary = await aiService.AskAsync(prompt, contextJson, provider, ct);
        return Results.Ok(ApiResponse.Ok(new { summary }));
    }
}

