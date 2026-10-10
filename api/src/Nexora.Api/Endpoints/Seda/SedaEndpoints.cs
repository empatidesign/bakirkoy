using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Seda;
using Nexora.Application.Features.Seda.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Seda;

public static class SedaEndpoints
{
    public static IEndpointRouteBuilder MapSedaEndpoints(this IEndpointRouteBuilder app)
    {
        MapApplications(app);
        MapEducationRecords(app);
        MapSchools(app);
        MapDefinitions(app);
        MapPeriods(app);
        MapSettings(app);
        return app;
    }

    private static void MapApplications(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/seda/applications")
            .WithTags("Seda")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", async ([AsParameters] SedaApplicationListParams p, ISedaApplicationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetPagedAsync(p, ct)))).RequirePermission("seda.view");

        group.MapGet("/summary", async (string? schoolName, ISedaApplicationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetSummaryAsync(schoolName, ct)))).RequirePermission("seda.view");

        // Kullanıcı isteği (2026-10-05): eski sistemden içe aktarılan 2018-2026 arası veri +
        // bugünden sonraki yeni başvurular için "yıllara göre kaç kişi başvurmuş" detaylı
        // rapor sistemi.
        group.MapGet("/yearly-report", async ([AsParameters] SedaYearlyReportParams p, ISedaApplicationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetYearlyReportAsync(p, ct)))).RequirePermission("seda.view");

        group.MapGet("/{id:guid}", async (Guid id, ISedaApplicationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetByIdAsync(id, ct)))).RequirePermission("seda.view");

        group.MapPost("/", async (SedaApplicationFormRequest req, ISedaApplicationService svc, IValidator<SedaApplicationFormRequest> validator, CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await svc.CreateAsync(req, ct);
            return Results.Created($"/api/v1/seda/applications/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("seda.create");

        group.MapPut("/{id:guid}", async (Guid id, SedaApplicationFormRequest req, ISedaApplicationService svc, IValidator<SedaApplicationFormRequest> validator, CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.UpdateAsync(id, req, ct)));
        }).RequirePermission("seda.edit");

        group.MapPatch("/{id:guid}/status", async (Guid id, SetSedaApplicationStatusRequest req, ISedaApplicationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.SetStatusAsync(id, req.Status, req.Reason, ct)))).RequirePermission("seda.edit");

        group.MapPost("/send-message", async (SedaManualMessageRequest req, ISedaApplicationService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.SendManualMessageAsync(req, ct)))).RequirePermission("seda.edit");

        group.MapDelete("/{id:guid}", async (Guid id, ISedaApplicationService svc, CancellationToken ct) =>
        {
            await svc.DeleteAsync(id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("seda.delete");

        group.MapGet("/export", async ([AsParameters] SedaApplicationListParams p, ISedaApplicationService svc, CancellationToken ct) =>
        {
            var (bytes, fileName) = await svc.ExportExcelAsync(p, ct);
            return Results.File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }).RequirePermission("seda.export");
    }

    private static void MapEducationRecords(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/seda/education-records")
            .WithTags("Seda")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", async ([AsParameters] SedaEducationRecordListParams p, ISedaEducationRecordService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetPagedAsync(p, ct)))).RequirePermission("seda.view");

        group.MapGet("/years", async (ISedaEducationRecordService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetYearsAsync(ct)))).RequirePermission("seda.view");

        group.MapGet("/export", async ([AsParameters] SedaEducationRecordListParams p, ISedaEducationRecordService svc, CancellationToken ct) =>
        {
            var (bytes, fileName) = await svc.ExportExcelAsync(p, ct);
            return Results.File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }).RequirePermission("seda.export");

        group.MapPost("/import", async (IFormFile? file, [FromForm] string? academicYear, [FromForm] Guid? periodId, [FromForm] DateTime? periodStartDate, [FromForm] DateTime? periodEndDate, ISedaEducationRecordService svc, CancellationToken ct) =>
        {
            var errors = new Dictionary<string, string[]>();
            if (file is null || file.Length == 0)
                errors["file"] = ["Yüklenecek dosya zorunludur."];
            else if (!string.Equals(Path.GetExtension(file.FileName), ".xlsx", StringComparison.OrdinalIgnoreCase))
                errors["file"] = ["Yalnızca .xlsx uzantılı dosya yüklenebilir."];
            // Kullanıcı isteği (2026-08-12): "hangi tarihler aralığında alınacak dediğinde zaten
            // başlangıç ve bitiş yılı dönemi verecek bize" — periodId veya serbest academicYear
            // yerine (ya da onlarla birlikte) doğrudan bir tarih aralığı da geçerli bir dönem
            // kaynağı sayılır.
            var hasDateRange = periodStartDate.HasValue && periodEndDate.HasValue;
            if (!periodId.HasValue && !hasDateRange && (string.IsNullOrWhiteSpace(academicYear) || !System.Text.RegularExpressions.Regex.IsMatch(academicYear.Trim(), @"^\d{4}-\d{4}$")))
                errors["academicYear"] = ["Eğitim yılı 2025-2026 biçiminde olmalıdır ya da bir dönem/tarih aralığı seçin."];
            if (hasDateRange && periodEndDate!.Value.Date < periodStartDate!.Value.Date)
                errors["periodEndDate"] = ["Bitiş tarihi başlangıç tarihinden önce olamaz."];
            if (errors.Count > 0)
                throw new AppValidationException("Doğrulama hatası.", errors);

            await using var stream = file!.OpenReadStream();
            var result = await svc.ImportAsync(stream, academicYear?.Trim() ?? string.Empty, periodId, periodStartDate, periodEndDate, ct);
            return Results.Ok(ApiResponse.Ok(result));
        }).DisableAntiforgery().RequirePermission("seda.edit");

        // Denetim bulgusu (docs/tesis-spor-egitim-derin-test-2026-08-31.md P1-1/P1-2, 2026-09-05
        // canlı testle doğrulandı): bu uç hiç doğrulayıcı almıyordu — Score=-999.99/9999.99
        // sessizce kabul ediliyor, uzun ResultNote 500 Internal Server Error'a yol açıyordu.
        group.MapPut("/{id:guid}/result", async (Guid id, SedaEducationRecordResultRequest req, ISedaEducationRecordService svc, IValidator<SedaEducationRecordResultRequest> validator, CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.UpdateResultAsync(id, req.Score, req.ResultNote, ct)));
        }).RequirePermission("seda.edit");

        group.MapDelete("/{id:guid}", async (Guid id, ISedaEducationRecordService svc, CancellationToken ct) =>
        {
            await svc.DeleteAsync(id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("seda.delete");
    }

    private static void MapSchools(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/seda/schools")
            .WithTags("Seda")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", async ([AsParameters] SedaSchoolListParams p, ISedaSchoolService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetPagedAsync(p, ct)))).RequirePermission("seda.view");

        group.MapGet("/options", async (ISedaSchoolService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetOptionsAsync(ct)))).RequirePermission("seda.view");

        group.MapPost("/", async (SedaSchoolFormRequest req, ISedaSchoolService svc, IValidator<SedaSchoolFormRequest> validator, CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await svc.CreateAsync(req, ct);
            return Results.Created($"/api/v1/seda/schools/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("seda.create");

        group.MapPut("/{id:guid}", async (Guid id, SedaSchoolFormRequest req, ISedaSchoolService svc, IValidator<SedaSchoolFormRequest> validator, CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.UpdateAsync(id, req, ct)));
        }).RequirePermission("seda.edit");

        group.MapDelete("/{id:guid}", async (Guid id, ISedaSchoolService svc, CancellationToken ct) =>
        {
            await svc.DeleteAsync(id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("seda.delete");

        group.MapPatch("/{id:guid}/toggle-status", async (Guid id, ISedaSchoolService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ToggleStatusAsync(id, ct)))).RequirePermission("seda.edit");
    }

    private static void MapDefinitions(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/seda/definitions")
            .WithTags("Seda")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", async ([AsParameters] SedaDefinitionListParams p, ISedaDefinitionService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetPagedAsync(p, ct)))).RequirePermission("seda.view");

        group.MapGet("/options", async (string? type, ISedaDefinitionService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(string.IsNullOrWhiteSpace(type) ? [] : await svc.GetOptionsAsync(type, ct)))).RequirePermission("seda.view");

        group.MapPost("/", async (CreateSedaDefinitionRequest req, ISedaDefinitionService svc, IValidator<CreateSedaDefinitionRequest> validator, CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await svc.CreateAsync(req, ct);
            return Results.Created($"/api/v1/seda/definitions/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("seda.create");

        group.MapPut("/{id:guid}", async (Guid id, UpdateSedaDefinitionRequest req, ISedaDefinitionService svc, IValidator<UpdateSedaDefinitionRequest> validator, CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.UpdateAsync(id, req, ct)));
        }).RequirePermission("seda.edit");

        group.MapDelete("/{id:guid}", async (Guid id, ISedaDefinitionService svc, CancellationToken ct) =>
        {
            await svc.DeleteAsync(id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("seda.delete");

        group.MapPatch("/{id:guid}/toggle-status", async (Guid id, ISedaDefinitionService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ToggleStatusAsync(id, ct)))).RequirePermission("seda.edit");
    }

    private static void MapPeriods(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/seda/periods")
            .WithTags("Seda")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", async ([AsParameters] SedaPeriodListParams p, ISedaPeriodService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetPagedAsync(p, ct)))).RequirePermission("seda.view");

        group.MapPost("/", async (CreateSedaPeriodRequest req, ISedaPeriodService svc, IValidator<CreateSedaPeriodRequest> validator, CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await svc.CreateAsync(req, ct);
            return Results.Created($"/api/v1/seda/periods/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("seda.create");

        group.MapPut("/{id:guid}", async (Guid id, UpdateSedaPeriodRequest req, ISedaPeriodService svc, IValidator<UpdateSedaPeriodRequest> validator, CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await svc.UpdateAsync(id, req, ct)));
        }).RequirePermission("seda.edit");

        group.MapDelete("/{id:guid}", async (Guid id, ISedaPeriodService svc, CancellationToken ct) =>
        {
            await svc.DeleteAsync(id, ct);
            return Results.Ok(ApiResponse.NoContent());
        }).RequirePermission("seda.delete");

        group.MapPatch("/{id:guid}/activate", async (Guid id, ISedaPeriodService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ActivateAsync(id, ct)))).RequirePermission("seda.edit");
    }

    private static void MapSettings(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/seda/settings")
            .WithTags("Seda")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", async (ISedaSettingsService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetAsync(ct)))).RequirePermission("seda.view");

        group.MapPut("/", async (UpdateSedaSettingsRequest req, ISedaSettingsService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.UpdateAsync(req, ct)))).RequirePermission("seda.edit");
    }
}
