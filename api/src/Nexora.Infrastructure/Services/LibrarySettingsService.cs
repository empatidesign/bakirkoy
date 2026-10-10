using System.Text.Json;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class LibrarySettingsService(IUnitOfWork uow, IAuditService audit, ICurrentUser currentUser, IUserScopeService userScope) : ILibrarySettingsService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public static readonly IReadOnlyList<LibraryNotificationTemplateDto> DefaultNotificationTemplates =
    [
        new("application_received", true, "Sayın {{ad}} {{soyad}}, {{kutuphane}} üyelik başvurunuz alındı.", true, "{{kutuphane}} üyelik başvurunuz alındı."),
        new("approved", true, "Sayın {{ad}} {{soyad}}, {{kutuphane}} üyelik başvurunuz onaylandı.", true, "{{kutuphane}} üyelik başvurunuz onaylandı."),
        new("rejected", true, "Sayın {{ad}} {{soyad}}, {{kutuphane}} üyelik başvurunuz reddedildi.", true, "{{kutuphane}} üyelik başvurunuz reddedildi."),
        new("exit_notification", true, "{{ad}} {{soyad}} {{kutuphane}} kıraathaneden {{saat}} saatinde çıkış yaptı.", false, "{{ad}} {{soyad}} {{kutuphane}} kıraathaneden çıkış yaptı."),
        new("overdue_reminder", false, "{{ad}} {{soyad}} için {{kitap_sayisi}} gecikmiş emanet var.", true, "{{ad}} {{soyad}} giriş yaptı; teslim tarihi geçmiş {{kitap_sayisi}} kitabı var."),
        new("break_nudge", true, "Sayın {{ad}} {{soyad}}, uzun süredir aralıksız çalışıyorsunuz; lütfen bir mola verin.", true, "Uzun süredir aralıksız çalışıyorsunuz; lütfen bir mola verin."),
        new("study_time_warning", true, "Sayın {{ad}} {{soyad}}, çıkış süreniz dolmak üzere; son 5 dakikadasınız.", true, "Çıkış süreniz dolmak üzere; son 5 dakikadasınız."),
        // Mobil QA bulgusu (2026-09-22, madde 70): inaktivite kaynaklı otomatik çıkış
        // öncesinde hiç uyarı gönderilmiyordu (bkz. LibraryMaintenanceJob.inactivityWarnings).
        new("inactivity_warning", true, "Sayın {{ad}} {{soyad}}, oturumunuz birazdan otomatik olarak sonlandırılacak; devam edecekseniz uygulamadan işlem yapın.", true, "Oturumunuz birazdan otomatik olarak sonlandırılacak; devam edecekseniz uygulamadan işlem yapın."),
        new("break_warning", true, "Sayın {{ad}} {{soyad}}, molanız bitmek üzere; son 5 dakika içinde yerinize dönün.", true, "Molanız bitmek üzere; son 5 dakika içinde yerinize dönün."),
        new("reservation_warning", true, "Sayın {{ad}} {{soyad}}, rezervasyon giriş süreniz dolmak üzere; son 5 dakika içinde giriş yapın.", true, "Rezervasyon giriş süreniz dolmak üzere; son 5 dakika içinde giriş yapın."),
        new("reservation_cancelled", true, "Sayın {{ad}} {{soyad}}, {{kutuphane}} kıraathanesindeki rezervasyonunuz iptal edildi.", true, "{{kutuphane}} kıraathanesindeki rezervasyonunuz iptal edildi."),
        new("reservation_expired", true, "Sayın {{ad}} {{soyad}}, {{kutuphane}} kıraathanesindeki rezervasyonunuzun süresi doldu.", true, "{{kutuphane}} kıraathanesindeki rezervasyonunuzun süresi doldu."),
        new("emergency", true, "ACİL: Sayın {{ad}} {{soyad}}, {{kutuphane}} hakkında önemli duyuru: {{mesaj}}", true, "ACİL: {{kutuphane}} hakkında önemli duyuru: {{mesaj}}"),
        new("manual", true, "Sayın {{ad}} {{soyad}}, {{kutuphane}} hakkında bilgilendirme: {{mesaj}}", true, "{{kutuphane}} hakkında bilgilendirme: {{mesaj}}"),
    ];

    private async Task EnsureWriteInScopeAsync(Guid? libraryId, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return;
        var scopedRefIds = await userScope.GetScopedRefIdsAsync(uid, "library", ct);
        if (scopedRefIds is null) return;
        if (libraryId is null)
            throw new ForbiddenException("Genel kıraathane ayarlarını yalnızca kapsam kısıtı olmayan yöneticiler değiştirebilir.", "GLOBAL_SETTINGS_FORBIDDEN");
        if (!scopedRefIds.Contains(libraryId.Value))
            throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");
    }

    public async Task<LibrarySettingsDto> GetAsync(Guid? libraryId, CancellationToken ct)
    {
        var row = await uow.LibrarySettings.GetForLibraryAsync(libraryId, ct);
        if (row is null && libraryId is not null)
            row = await uow.LibrarySettings.GetForLibraryAsync(null, ct);
        return WithDefaultTemplates(Deserialize(row?.SettingsJson));
    }

    public async Task<IReadOnlyDictionary<Guid, LibrarySettingsDto>> GetForLibrariesAsync(IReadOnlyCollection<Guid> libraryIds, CancellationToken ct)
    {
        var rows = await uow.LibrarySettings.GetSettingsForLibrariesAsync(libraryIds, ct);
        var globalDto = Deserialize(rows.FirstOrDefault(r => r.LibraryId == null)?.SettingsJson);
        var byLib = rows.Where(r => r.LibraryId != null).ToDictionary(r => r.LibraryId!.Value, r => Deserialize(r.SettingsJson));
        var result = new Dictionary<Guid, LibrarySettingsDto>(libraryIds.Count);
        foreach (var id in libraryIds)
            result[id] = WithDefaultTemplates(byLib.TryGetValue(id, out var dto) ? dto : globalDto);
        return result;
    }

    public async Task<LibrarySettingsDto> SaveAsync(Guid? libraryId, LibrarySettingsDto dto, CancellationToken ct)
    {
        await EnsureWriteInScopeAsync(libraryId, ct);
        var json = JsonSerializer.Serialize(dto, JsonOpts);
        var row = await uow.LibrarySettings.GetForLibraryAsync(libraryId, ct);
        var oldJson = row?.SettingsJson;
        if (row is null)
        {
            row = LibrarySettings.Create(libraryId, json);
            await uow.LibrarySettings.AddAsync(row, ct);
        }
        else
        {
            row.SetJson(json);
            uow.LibrarySettings.Update(row);
        }

        var changedKeys = DiffKeys(oldJson, json);
        if (changedKeys.Count > 0)
        {
            var changedBy = currentUser.Name ?? currentUser.Email;
            await uow.LibrarySettingsHistory.AddAsync(
                LibrarySettingsHistory.Create(libraryId, oldJson, json, changedBy), ct);
        }

        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SystemConfig,
            EntityType = "LibrarySettings",
            EntityId = row.Id,
            Module = "Library",
            Description = libraryId is null ? "Genel kıraathane ayarları güncellendi." : "Kıraathane ayarları güncellendi.",
            NewValues = json,
        }, ct);

        return dto;
    }

    public async Task<List<LibrarySettingsHistoryDto>> GetHistoryAsync(Guid? libraryId, int limit, CancellationToken ct)
    {
        var rows = await uow.LibrarySettingsHistory.GetForLibraryAsync(libraryId, Math.Clamp(limit, 1, 200), ct);
        return rows.Select(r => new LibrarySettingsHistoryDto
        {
            Id = r.Id,
            LibraryId = r.LibraryId,
            OldSettings = r.OldJson is null ? null : Deserialize(r.OldJson),
            NewSettings = Deserialize(r.NewJson),
            ChangedBy = r.ChangedBy,
            ChangedAt = r.CreatedAt,
            ChangedKeys = DiffKeys(r.OldJson, r.NewJson),
        }).ToList();
    }

    private static List<string> DiffKeys(string? oldJson, string newJson)
    {
        if (string.IsNullOrWhiteSpace(oldJson)) return ["*"];
        using var oldDoc = JsonDocument.Parse(oldJson);
        using var newDoc = JsonDocument.Parse(newJson);
        var oldProps = oldDoc.RootElement.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetRawText());
        var changed = new List<string>();
        foreach (var prop in newDoc.RootElement.EnumerateObject())
        {
            if (!oldProps.TryGetValue(prop.Name, out var oldVal) || oldVal != prop.Value.GetRawText())
                changed.Add(prop.Name);
        }
        return changed;
    }

    public async Task ApplyLibraryOperationalAsync(Guid libraryId, LibraryRequest req, CancellationToken ct)
    {
        var c = await GetAsync(libraryId, ct);
        var merged = new LibrarySettingsDto
        {
            PointsEnabled = c.PointsEnabled,
            PointsPerVisit = c.PointsPerVisit,
            DailyVisitCap = c.DailyVisitCap,
            DailyPointCap = c.DailyPointCap,
            WeeklyPointCap = c.WeeklyPointCap,
            QrRequired = c.QrRequired,
            RequiresEntryAndExit = c.RequiresEntryAndExit,
            BreakDurationMinutes = req.UseCustomBreakSettings ? req.BreakDurationMinutes : c.BreakDurationMinutes,
            MaxDailyBreaks = req.UseCustomBreakSettings ? req.MaxDailyBreaks : c.MaxDailyBreaks,
            LongBreakDurationMinutes = req.UseCustomBreakSettings ? req.LongBreakDurationMinutes : c.LongBreakDurationMinutes,
            ShortBreakCooldownMinutes = c.ShortBreakCooldownMinutes,
            MaxDailyLongBreaks = c.MaxDailyLongBreaks,
            MaxSessionMinutes = c.MaxSessionMinutes,
            MaxStudyHoursPerDay = req.UseCustomBreakSettings ? req.MaxStudyHoursPerDay : c.MaxStudyHoursPerDay,
            RequireBreakAfterHours = req.UseCustomBreakSettings ? req.RequireBreakAfterHours : c.RequireBreakAfterHours,
            HourlyBreakEnabled = c.HourlyBreakEnabled,
            HourlyBreakMinutesPerHour = c.HourlyBreakMinutesPerHour,
            HourlyBreakMaxPerDay = c.HourlyBreakMaxPerDay,
            BreakReturnGraceMinutes = c.BreakReturnGraceMinutes,
            QueueCallWindowMinutes = c.QueueCallWindowMinutes,
            AutoQueueCallEnabled = c.AutoQueueCallEnabled,
            ReservationHoldWindowMinutes = c.ReservationHoldWindowMinutes,
            DailyReservationLimitPerLibrary = c.DailyReservationLimitPerLibrary,
            AutoCheckOutAfterMinutes = req.AutoCheckOutAfterMinutes,
            MinCheckoutAfterMinutes = c.MinCheckoutAfterMinutes,
            WalkInHoldMinutes = c.WalkInHoldMinutes,
            MinEntryBeforeBreakMinutes = c.MinEntryBeforeBreakMinutes,
            BreakSystemEnabled = req.BreakSystemEnabled ?? c.BreakSystemEnabled,
            NotificationTemplates = c.NotificationTemplates,
        };
        await SaveAsync(libraryId, merged, ct);
    }

    private static LibrarySettingsDto Deserialize(string? json)
        => string.IsNullOrWhiteSpace(json)
            ? new LibrarySettingsDto()
            : JsonSerializer.Deserialize<LibrarySettingsDto>(json, JsonOpts) ?? new LibrarySettingsDto();

    private static LibrarySettingsDto WithDefaultTemplates(LibrarySettingsDto dto)
    {
        var incoming = dto.NotificationTemplates ?? [];
        var merged = DefaultNotificationTemplates
            .Select(def => incoming.FirstOrDefault(t => t.Event == def.Event) ?? def)
            .ToList();
        return dto with { NotificationTemplates = merged };
    }
}
