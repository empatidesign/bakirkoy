using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.NotificationPreferences.Dtos;
using Nexora.Domain.Entities.Notifications;

namespace Nexora.Infrastructure.Services;

public class NotificationPreferenceService(IUnitOfWork uow) : Nexora.Application.Features.NotificationPreferences.INotificationPreferenceService
{
    public async Task<List<NotificationPreferenceDto>> GetPreferencesAsync(Guid participantId, CancellationToken ct)
    {
        var existing = await uow.ParticipantNotificationPreferences.GetByParticipantAsync(participantId, ct);
        var byCategory = existing.ToDictionary(x => x.Category);

        return NotificationCategories.All.Select(category =>
            byCategory.TryGetValue(category, out var pref)
                ? ToDto(pref)
                : DefaultDto(category)
        ).ToList();
    }

    public async Task<NotificationPreferenceDto> UpsertPreferenceAsync(Guid participantId, UpsertNotificationPreferenceRequest req, CancellationToken ct)
    {
        if (!NotificationCategories.IsValid(req.Category))
            throw new Nexora.Application.Common.Exceptions.ConflictException(
                $"Geçersiz kategori. İzin verilenler: {string.Join(", ", NotificationCategories.All)}",
                "INVALID_CATEGORY");

        var existing = await uow.ParticipantNotificationPreferences.GetAsync(participantId, req.Category, ct);
        var isNew = existing is null;
        existing ??= ParticipantNotificationPreference.Create(participantId, req.Category);

        ValidateQuietHours(req.QuietHoursStart, req.QuietHoursEnd);

        existing.Update(req.PushEnabled, req.SmsEnabled, req.EmailEnabled, req.InAppEnabled, req.QuietHoursStart, req.QuietHoursEnd);

        if (isNew)
            await uow.ParticipantNotificationPreferences.AddAsync(existing, ct);
        else
            uow.ParticipantNotificationPreferences.Update(existing);

        await uow.SaveChangesAsync(ct);

        return ToDto(existing);
    }

    public async Task OptOutAllAsync(Guid participantId, CancellationToken ct)
    {
        var existing = await uow.ParticipantNotificationPreferences.GetByParticipantAsync(participantId, ct);
        var byCategory = existing.ToDictionary(x => x.Category);

        foreach (var category in NotificationCategories.All)
        {
            var isNew = !byCategory.TryGetValue(category, out var pref);
            if (isNew)
                pref = ParticipantNotificationPreference.Create(participantId, category);

            pref!.Update(false, false, false, false, pref.QuietHoursStart, pref.QuietHoursEnd);

            if (isNew)
                await uow.ParticipantNotificationPreferences.AddAsync(pref, ct);
            else
                uow.ParticipantNotificationPreferences.Update(pref);
        }

        await uow.SaveChangesAsync(ct);
    }

    public async Task<bool> IsChannelEnabledAsync(Guid participantId, string category, string channel, CancellationToken ct)
    {
        var pref = await uow.ParticipantNotificationPreferences.GetAsync(participantId, category, ct);
        if (pref is null) return true;

        return channel.ToLowerInvariant() switch
        {
            "push" => pref.PushEnabled,
            "sms" => pref.SmsEnabled,
            "email" => pref.EmailEnabled,
            "inapp" or "in-app" => pref.InAppEnabled,
            _ => true,
        };
    }

    public async Task<NotificationDeliveryDecision> GetDeliveryAsync(Guid participantId, string category, CancellationToken ct)
    {
        var pref = await uow.ParticipantNotificationPreferences.GetAsync(participantId, category, ct);
        if (pref is null)
            return new NotificationDeliveryDecision(true, true, true, false);

        var quiet = IsQuietNow(pref.QuietHoursStart, pref.QuietHoursEnd);
        return new NotificationDeliveryDecision(pref.InAppEnabled, pref.PushEnabled, pref.SmsEnabled, quiet);
    }

    private static readonly TimeZoneInfo TurkeyTz = ResolveTurkeyTz();

    // Hata #28: sessiz saat alanları (QuietHoursStart/End) hiç doğrulanmıyordu — "abc", "25:99"
    // gibi geçersiz değerler sessizce kabul ediliyordu (IsQuietNow TimeOnly.TryParse başarısız
    // olunca sessizce false dönüp özelliği etkisiz kılıyordu, kullanıcı hatasından haberdar olmuyordu).
    // İkisi de boşsa (sessiz saat kapalı) veya ikisi de geçerli "HH:mm" formatındaysa kabul edilir.
    private static void ValidateQuietHours(string? start, string? end)
    {
        var hasStart = !string.IsNullOrWhiteSpace(start);
        var hasEnd = !string.IsNullOrWhiteSpace(end);

        if (!hasStart && !hasEnd) return;

        if (hasStart != hasEnd)
            throw new Nexora.Application.Common.Exceptions.ConflictException(
                "Sessiz saat başlangıç ve bitiş saati birlikte girilmelidir.", "QUIET_HOURS_INCOMPLETE");

        if (!TimeOnly.TryParseExact(start, "HH:mm", out _))
            throw new Nexora.Application.Common.Exceptions.ConflictException(
                "Sessiz saat başlangıcı geçersiz. Format: SS:dd (ör. 22:00).", "QUIET_HOURS_INVALID_START");

        if (!TimeOnly.TryParseExact(end, "HH:mm", out _))
            throw new Nexora.Application.Common.Exceptions.ConflictException(
                "Sessiz saat bitişi geçersiz. Format: SS:dd (ör. 08:00).", "QUIET_HOURS_INVALID_END");
    }

    private static TimeZoneInfo ResolveTurkeyTz()
    {
        foreach (var id in new[] { "Europe/Istanbul", "Turkey Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.CreateCustomTimeZone("TR", TimeSpan.FromHours(3), "TR", "TR");
    }

    private static bool IsQuietNow(string? start, string? end)
    {
        if (!TimeOnly.TryParse(start, out var from) || !TimeOnly.TryParse(end, out var to))
            return false;
        if (from == to) return false;

        var now = TimeOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTime.UtcNow, TurkeyTz));

        return from < to
            ? now >= from && now < to
            : now >= from || now < to;
    }

    private static NotificationPreferenceDto ToDto(ParticipantNotificationPreference p) => new(
        p.Id, p.Category, p.PushEnabled, p.SmsEnabled, p.EmailEnabled, p.InAppEnabled,
        p.QuietHoursStart, p.QuietHoursEnd);

    private static NotificationPreferenceDto DefaultDto(string category) => new(
        null, category, true, true, true, true, null, null);
}
