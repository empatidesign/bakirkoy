using System.Text.Json;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Seda;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Entities.Seda;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class SedaPeriodService(IUnitOfWork uow, IActivityLogger log, IAuditService audit) : ISedaPeriodService
{
    private static void EnsureValidPeriod(DateTime startDate, DateTime endDate, int maxApplications)
    {
        if (endDate.Date < startDate.Date)
            throw new ConflictException("Dönem bitiş tarihi başlangıç tarihinden önce olamaz.", "SEDA_PERIOD_INVALID_RANGE");
        if (maxApplications < 0)
            throw new ConflictException("Kontenjan negatif olamaz.", "SEDA_PERIOD_INVALID_QUOTA");
    }

    public async Task<PagedResult<SedaPeriodDto>> GetPagedAsync(SedaPeriodListParams p, CancellationToken ct)
    {
        var paged = await uow.SedaPeriods.GetPagedAsync(p, ct);
        var dtos = new List<SedaPeriodDto>();
        foreach (var period in paged.Items)
            dtos.Add(await ToDtoAsync(period, ct));

        return new PagedResult<SedaPeriodDto>
        {
            Items = dtos,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<SedaPeriodDto> CreateAsync(CreateSedaPeriodRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Name });

        if (await uow.SedaPeriods.ExistsByNameAsync(req.Name, null, ct))
            throw new ConflictException("Bu dönem adı zaten kayıtlı.", "DUPLICATE_SEDA_PERIOD");

        EnsureValidPeriod(req.StartDate, req.EndDate, req.MaxApplications);

        var period = SedaPeriod.Create(req.Name.Trim(), req.StartDate, req.EndDate, req.MaxApplications, req.Description);
        await uow.SedaPeriods.AddAsync(period, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "SedaPeriod",
            EntityId = period.Id,
            Module = "Seda",
            Description = $"SEDA dönemi oluşturuldu: {period.Name} ({period.StartDate:dd.MM.yyyy} - {period.EndDate:dd.MM.yyyy})",
        }, ct);

        return await ToDtoAsync(period, ct);
    }

    public async Task<SedaPeriodDto> UpdateAsync(Guid id, UpdateSedaPeriodRequest req, CancellationToken ct)
    {
        var period = await uow.SedaPeriods.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Dönem bulunamadı.", "SEDA_PERIOD_NOT_FOUND");

        if (await uow.SedaPeriods.ExistsByNameAsync(req.Name, id, ct))
            throw new ConflictException("Bu dönem adı zaten kayıtlı.", "DUPLICATE_SEDA_PERIOD");

        EnsureValidPeriod(req.StartDate, req.EndDate, req.MaxApplications);

        var oldValues = JsonSerializer.Serialize(new { period.Name, period.StartDate, period.EndDate, period.MaxApplications, period.Description });

        period.Update(req.Name.Trim(), req.StartDate, req.EndDate, req.MaxApplications, req.Description);
        uow.SedaPeriods.Update(period);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "SedaPeriod",
            EntityId = period.Id,
            Module = "Seda",
            Description = $"SEDA dönemi güncellendi: {period.Name}",
            OldValues = oldValues,
            NewValues = JsonSerializer.Serialize(new { period.Name, period.StartDate, period.EndDate, period.MaxApplications, period.Description }),
        }, ct);

        return await ToDtoAsync(period, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var period = await uow.SedaPeriods.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Dönem bulunamadı.", "SEDA_PERIOD_NOT_FOUND");

        if (period.IsActive)
            throw new ConflictException("Aktif dönem silinemez. Önce başka bir dönemi aktif edin.", "SEDA_PERIOD_ACTIVE");

        uow.SedaPeriods.Delete(period);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SoftDelete,
            EntityType = "SedaPeriod",
            EntityId = period.Id,
            Module = "Seda",
            Description = $"SEDA dönemi silindi: {period.Name}",
        }, ct);
    }

    public async Task<SedaPeriodDto> ActivateAsync(Guid id, CancellationToken ct)
    {
        var period = await uow.SedaPeriods.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Dönem bulunamadı.", "SEDA_PERIOD_NOT_FOUND");

        var currentlyActive = await uow.SedaPeriods.FindAsync(x => x.IsActive, ct);
        foreach (var active in currentlyActive)
        {
            active.Deactivate();
            uow.SedaPeriods.Update(active);
        }

        period.Activate();
        uow.SedaPeriods.Update(period);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "SedaPeriod",
            EntityId = period.Id,
            Module = "Seda",
            Description = $"SEDA dönemi aktif edildi: {period.Name}",
        }, ct);

        return await ToDtoAsync(period, ct);
    }

    private async Task<SedaPeriodDto> ToDtoAsync(SedaPeriod p, CancellationToken ct)
    {
        var current = await uow.SedaApplications.CountByPeriodAsync(p.Id, ct);
        return new SedaPeriodDto(p.Id, p.Name, p.StartDate, p.EndDate, p.MaxApplications, current, p.Description, p.IsActive);
    }

    public async Task<SedaPeriodDto> FindOrCreateByDateRangeAsync(DateTime startDate, DateTime endDate, CancellationToken ct)
    {
        EnsureValidPeriod(startDate, endDate, 0);

        var name = DeriveAcademicYearName(startDate, endDate);

        var existing = await uow.SedaPeriods.FindAsync(x => x.StartDate.Date == startDate.Date && x.EndDate.Date == endDate.Date, ct);
        var match = existing.FirstOrDefault();
        if (match is not null)
            return await ToDtoAsync(match, ct);

        // Kullanıcı isteği (2026-08-12): aynı ada sahip ama farklı tarihli bir dönem varsa (örn.
        // daha önce elle "2026-2027" oluşturulmuş) çakışan isimli ikinci bir dönem yaratmak yerine
        // mevcut olanı kullan — DUPLICATE_SEDA_PERIOD hatasına düşmeden sorunsuz devam etsin.
        var byName = await uow.SedaPeriods.FindAsync(x => x.Name == name, ct);
        var nameMatch = byName.FirstOrDefault();
        if (nameMatch is not null)
            return await ToDtoAsync(nameMatch, ct);

        var period = SedaPeriod.Create(name, startDate, endDate, 0, "Kazananlar içe aktarımından otomatik oluşturuldu.");
        await uow.SedaPeriods.AddAsync(period, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "SedaPeriod",
            EntityId = period.Id,
            Module = "Seda",
            Description = $"SEDA dönemi otomatik oluşturuldu (kazananlar içe aktarımı): {period.Name} ({period.StartDate:dd.MM.yyyy} - {period.EndDate:dd.MM.yyyy})",
        }, ct);

        return await ToDtoAsync(period, ct);
    }

    private static string DeriveAcademicYearName(DateTime startDate, DateTime endDate)
    {
        // Kullanıcı isteği (2026-08-12): "hangi tarihler aralığında alınacak dediğinde zaten
        // başlangıç ve bitiş yılı dönemi verecek bize" — Türkiye eğitim-öğretim yılı tipik olarak
        // Eylül'de başlar, izleyen yılın Haziran/Temmuz'unda biter (örn. 01.09.2026-30.06.2027 →
        // "2026-2027"). Farklı takvim yılları kapsayan her aralık için basitçe
        // "başlangıçYılı-bitişYılı" adlandırması kullanılır; aynı yıl içindeyse tek yıl.
        return startDate.Year == endDate.Year
            ? $"{startDate.Year}"
            : $"{startDate.Year}-{endDate.Year}";
    }
}
