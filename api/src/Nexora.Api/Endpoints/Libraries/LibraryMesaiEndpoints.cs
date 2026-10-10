using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Application.Features.LibraryStaffIdentity;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Libraries;

public static class LibraryMesaiEndpoints
{
    public static IEndpointRouteBuilder MapLibraryMesaiEndpoints(this IEndpointRouteBuilder app)
    {
        var staff = app.MapGroup("/api/v1/library-staff").WithTags("LibraryMesai").RequireAuthorization("AdminOrAbove");
        staff.MapGet("/", GetStaff).RequirePermission("library-mesai.view");
        staff.MapGet("/eligible", GetEligible).RequirePermission("library-mesai.view");
        staff.MapGet("/me/libraries", GetMyLibraries);
        staff.MapGet("/me/door-qr", GetMyDoorQr);
        staff.MapPost("/me/auto-start", AutoStartMine);
        staff.MapPatch("/me/location-consent", SetLocationConsent);
        staff.MapPost("/", CreateStaff).RequirePermission("library-mesai.edit");
        staff.MapPut("/{id:guid}", UpdateStaff).RequirePermission("library-mesai.edit");
        staff.MapDelete("/{id:guid}", DeleteStaff).RequirePermission("library-mesai.edit");
        staff.MapPatch("/{id:guid}/toggle-status", ToggleStaff).RequirePermission("library-mesai.edit");
        staff.MapGet("/{id:guid}/shifts", GetStaffShifts).RequirePermission("library-mesai.view");

        var shifts = app.MapGroup("/api/v1/libraries").WithTags("LibraryMesai").RequireAuthorization("AdminOrAbove");
        shifts.MapGet("/{libraryId:guid}/shifts", GetShifts).RequirePermission("library-mesai.view");
        shifts.MapGet("/{libraryId:guid}/shifts/active", GetActiveShifts).RequirePermission("library-mesai.view");
        shifts.MapGet("/{libraryId:guid}/shifts/summary", GetSummary).RequirePermission("library-mesai.view");
        shifts.MapGet("/{libraryId:guid}/shifts/me", GetMine);
        shifts.MapPost("/{libraryId:guid}/shifts", StartShift).RequirePermission("library-mesai.edit");
        shifts.MapPost("/{libraryId:guid}/shifts/me/start", StartMine);
        shifts.MapPost("/{libraryId:guid}/shifts/me/end", EndMine);

        var mesai = app.MapGroup("/api/v1/mesai").WithTags("LibraryMesai").RequireAuthorization("AdminOrAbove");
        mesai.MapGet("/shifts/active", GetAllActiveShifts).RequirePermission("library-mesai.view");
        mesai.MapGet("/summary", GetOverviewSummary).RequirePermission("library-mesai.view");
        mesai.MapGet("/shifts", GetOverviewShifts).RequirePermission("library-mesai.view");
        mesai.MapGet("/report-summary", GetReportSummary).RequirePermission("library-mesai.view");
        mesai.MapGet("/leaderboard", GetLeaderboard).RequirePermission("library-mesai.view");
        mesai.MapGet("/staff/{staffId:guid}/period-totals", GetStaffPeriodTotals).RequirePermission("library-mesai.view");

        var mine = app.MapGroup("/api/v1/mesai/mine").WithTags("LibraryMesai").RequireAuthorization("AdminOrAbove");
        mine.MapGet("/shifts", GetMyShifts);
        mine.MapGet("/summary", GetMyMonthSummary);
        mesai.MapGet("/monthly-report", GetMonthlyReport).RequirePermission("library-mesai.view");
        mesai.MapGet("/monthly-report/export", ExportMonthlyReport).RequirePermission("library-mesai.view");
        mine.MapPost("/shifts/{shiftId:guid}/edit", EditMineShift);

        var single = app.MapGroup("/api/v1/library-shifts").WithTags("LibraryMesai").RequireAuthorization("AdminOrAbove");
        single.MapPost("/{shiftId:guid}/end", EndShift).RequirePermission("library-mesai.edit");
        single.MapPost("/{shiftId:guid}/edit", EditShift).RequirePermission("library-mesai.edit");

        return app;
    }

    private static async Task<IResult> GetStaff([AsParameters] LibraryStaffListParams p, ILibraryStaffService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetMyLibraries(ILibraryStaffService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetMyLibrariesAsync(ct)));

    // Personelin kendi kapı QR'ını üretir (kütüphane-görevlisi-kapı-erişimi işi, kullanıcı
    // onayıyla kuruldu). Personel kaydı bulunmayan veya library-mesai.door-access yetkisi
    // olmayan biri için de QR üretilir — üretim aşamasında yetki kontrolü YAPILMAZ, çünkü
    // asıl kontrol kapı okutulduğunda (LibraryWebhookService.HandleStaffDoorAsync) canlı
    // yapılır. Bunun nedeni: bir yöneticinin rolden yetkiyi kaldırması anında etkili olsun
    // isteniyor (bkz. plan) — QR üretimini de kısıtlarsak, "QR ekranını daha önce açık
    // bırakmış" biri yine de eski token'ıyla girebilir sanılabilir; oysa doğrulama her
    // zaman TryVerifyAsync + canlı rol kontrolüyle yapıldığı için üretim aşaması engelsiz
    // bırakılması davranışı DEĞİŞTİRMEZ, sadece kullanıcı deneyimini karmaşıklaştırmaz.
    private static async Task<IResult> GetMyDoorQr(IStaffIdentityQrService qr, IUnitOfWork uow, ICurrentUser currentUser, CancellationToken ct)
    {
        var adminUserId = currentUser.Id ?? throw new ForbiddenException("Oturum bulunamadı.", "NO_SESSION");
        var staffRecord = await uow.LibraryStaff.GetByAdminUserAsync(adminUserId, ct)
            ?? throw new ConflictException("Personel kaydınız bulunmuyor.", "NOT_STAFF");
        return Results.Ok(ApiResponse.Ok(await qr.GenerateAsync(staffRecord.Id, ct)));
    }

    private static async Task<IResult> AutoStartMine(ILibraryShiftService s, CancellationToken ct)
    {
        var result = await s.TryAutoStartMineAsync(ct);
        return result is null ? Results.Ok(ApiResponse.Ok<LibraryShiftDto?>(null)) : Results.Ok(ApiResponse.Created(result));
    }

    private static async Task<IResult> SetLocationConsent(LocationConsentRequest req, ILibraryStaffService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.SetMyLocationConsentAsync(req.Status, ct)));

    private static async Task<IResult> GetEligible(Guid libraryId, ILibraryStaffService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetEligibleAsync(libraryId, ct)));

    private static async Task<IResult> CreateStaff(LibraryStaffRequest req, ILibraryStaffService s, IValidator<LibraryStaffRequest> v, CancellationToken ct)
    {
        var validation = await v.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        return Results.Ok(ApiResponse.Created(await s.CreateAsync(req, ct)));
    }

    private static async Task<IResult> UpdateStaff(Guid id, LibraryStaffRequest req, ILibraryStaffService s, IValidator<LibraryStaffRequest> v, CancellationToken ct)
    {
        var validation = await v.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        return Results.Ok(ApiResponse.Ok(await s.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> DeleteStaff(Guid id, ILibraryStaffService s, CancellationToken ct)
    {
        await s.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStaff(Guid id, ILibraryStaffService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.ToggleStatusAsync(id, ct)));

    private static async Task<IResult> GetStaffShifts(Guid id, ILibraryStaffService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetStaffShiftsAsync(id, ct)));

    private static async Task<IResult> GetShifts(Guid libraryId, [AsParameters] LibraryShiftListParams p, ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetPagedAsync(libraryId, p, ct)));

    private static async Task<IResult> GetActiveShifts(Guid libraryId, ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetActiveAsync(libraryId, ct)));

    private static async Task<IResult> GetAllActiveShifts(ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetAllActiveAsync(ct)));

    private static async Task<IResult> GetOverviewSummary(ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetOverviewSummaryAsync(ct)));

    private static async Task<IResult> GetSummary(Guid libraryId, ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetSummaryAsync(libraryId, ct)));

    private static async Task<IResult> StartShift(Guid libraryId, StartShiftRequest req, ILibraryShiftService s, IValidator<StartShiftRequest> v, CancellationToken ct)
    {
        var validation = await v.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        return Results.Ok(ApiResponse.Created(await s.StartAsync(libraryId, req, ct)));
    }

    private static async Task<IResult> EndShift(Guid shiftId, ILibraryShiftService s, CancellationToken ct)
    {
        await s.EndAsync(shiftId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> EditShift(Guid shiftId, EditShiftRequest req, ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.EditAsync(shiftId, req, ct)));

    private static async Task<IResult> GetMine(Guid libraryId, ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetMineAsync(libraryId, ct)));

    private static async Task<IResult> StartMine(Guid libraryId, SelfShiftRequest req, ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Created(await s.StartMineAsync(libraryId, req, ct)));

    private static async Task<IResult> EndMine(Guid libraryId, ILibraryShiftService s, CancellationToken ct)
    {
        await s.EndMineAsync(libraryId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GetMyShifts([AsParameters] LibraryShiftListParams p, ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetMyShiftsAsync(p, ct)));

    private static async Task<IResult> GetMyMonthSummary(int? year, int? month, ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetMyMonthSummaryAsync(year, month, ct)));

    private static async Task<IResult> GetMonthlyReport([AsParameters] MesaiMonthlyReportParams p, ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetMonthlyReportAsync(p, ct)));

    private static async Task<IResult> ExportMonthlyReport([AsParameters] MesaiMonthlyReportParams p, ILibraryShiftService s, CancellationToken ct)
    {
        var bytes = await s.ExportMonthlyReportAsync(p, ct);
        var y = p.Year ?? Nexora.Domain.Common.TurkeyTime.TodayDate().Year;
        var m = p.Month ?? Nexora.Domain.Common.TurkeyTime.TodayDate().Month;
        return Results.File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"mesai-raporu-{y}-{m:00}.xlsx");
    }

    private static async Task<IResult> EditMineShift(Guid shiftId, EditShiftRequest req, ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.EditMineAsync(shiftId, req, ct)));

    private static async Task<IResult> GetOverviewShifts([AsParameters] LibraryShiftListParams p, ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetOverviewPagedAsync(p, ct)));

    private static async Task<IResult> GetReportSummary([AsParameters] LibraryShiftListParams p, ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetReportSummaryAsync(p, ct)));

    private static async Task<IResult> GetLeaderboard([AsParameters] MesaiLeaderboardParams p, ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetLeaderboardAsync(p, ct)));

    private static async Task<IResult> GetStaffPeriodTotals(Guid staffId, DateTime startDate, DateTime endDate, ILibraryShiftService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetStaffPeriodTotalsAsync(staffId, startDate, endDate, ct)));
}
