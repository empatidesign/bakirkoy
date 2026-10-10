using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.CitizenSubmissions.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.CitizenSubmissions;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Kullanıcı isteği (2026-08-28): "muhtarda bu ekranda ... tüm süreci görmesi gerek ... fakat
/// burdaki kimin gönderdiği isim vs görünmeyecek ve muhtar ekranında en çok hangi konularda
/// istek öneri şikayetler gönderiyor".
///
/// GİZLİLİK KURALI (tek noktada uygulanır): bu servisin döndürdüğü hiçbir DTO'da CitizenName,
/// CitizenTc, CitizenPhone, Address veya kişiyi işaret eden serbest metin YOKTUR. Metinde
/// kişiye yönelik ifade tespit edilmiş kayıtlarda (ContainsPersonReference) başlık ve açıklama
/// da gizlenir; muhtar yalnızca konu/kategori düzeyinde bilgi görür.
///
/// KAPSAM: scope'lu bir muhtar yalnızca kendi mahallesinin kayıtlarını görür. Scope'suz
/// (belediye yöneticisi) kullanıcı tüm mahalleleri görür — bu durumda da kimlik gösterilmez,
/// çünkü bu ekran "muhtar görünümü" ekranıdır.
/// </summary>
public class MuhtarDashboardService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IUserScopeService scopeService,
    Nexora.Application.Features.CitizenSubmissions.ISubmissionContentAnalyzer contentAnalyzer,
    IAuditService audit) : IMuhtarDashboardService
{
    public async Task<MuhtarDashboardDto> GetDashboardAsync(string? neighborhood, string? dateRange, CancellationToken ct)
    {
        var scope = await GetScopeAsync(ct);
        var all = await uow.CitizenSubmissions.GetForReportsAsync(ct);

        if (scope is not null)
            all = all.Where(x => scope.Contains(x.Neighborhood)).ToList();

        if (!string.IsNullOrWhiteSpace(neighborhood))
            all = all.Where(x => x.Neighborhood == neighborhood).ToList();

        var from = ResolveFrom(dateRange);
        if (from is DateTime f)
            all = all.Where(x => x.SubmittedAt >= f).ToList();

        var neighborhoods = (scope is not null
            ? scope.OrderBy(x => x, StringComparer.CurrentCulture).ToList()
            : MuhtarlikReference.Neighborhoods.ToList());

        return Build(all, neighborhoods);
    }

    public async Task<MuhtarSubmissionDetailDto> GetDetailAsync(Guid submissionId, CancellationToken ct)
    {
        var s = await LoadAccessibleAsync(submissionId, ct);
        var events = await uow.CitizenSubmissionEvents.GetBySubmissionAsync(s.Id, ct);
        return new MuhtarSubmissionDetailDto(
            ToAnonymousItem(s),
            s.ResolutionNote,
            SubmissionTimelineBuilder.Build(events, forCitizen: false));
    }

    /// <summary>
    /// Kullanıcı isteği (2026-08-28): "muhtarda bu ekranda kendisi de gerekli kaydı
    /// oluşturabilir olumlu olumsuz yönde istek önerileri iletebilir" — muhtar mevcut bir
    /// kayda kendi görüşünü (destekliyorum / itiraz ediyorum / bilgi) ekler; bu görüş süreç
    /// zaman çizelgesine "muhtar_note" olarak yazılır ve belediye tarafında görünür.
    /// </summary>
    public async Task<MuhtarSubmissionDetailDto> AddOpinionAsync(Guid submissionId, MuhtarOpinionRequest req, CancellationToken ct)
    {
        var s = await LoadAccessibleAsync(submissionId, ct);

        var opinion = req.Opinion?.Trim().ToLowerInvariant();
        if (opinion is not ("positive" or "negative" or "info"))
            throw new ConflictException("Geçersiz görüş türü.", "INVALID_OPINION");

        if (string.IsNullOrWhiteSpace(req.Note))
            throw new ConflictException("Görüş açıklaması zorunludur.", "NOTE_REQUIRED");

        var label = opinion switch
        {
            "positive" => "Muhtar görüşü: Destekliyor",
            "negative" => "Muhtar görüşü: İtiraz / olumsuz",
            _ => "Muhtar bilgi notu",
        };

        var admin = currentUser.Id is Guid uid ? await uow.AdminUsers.GetByIdAsync(uid, ct) : null;

        var ev = CitizenSubmissionEvent.Create(
            s.Id, "muhtar_note", s.Status, label, req.Note.Trim(),
            actorType: "muhtar",
            actorName: admin?.FullName,
            actorId: admin?.Id,
            visibleToCitizen: false,
            visibleToMuhtar: true);

        await uow.CitizenSubmissionEvents.AddAsync(ev, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = Domain.Enums.AuditAction.Update,
            EntityType = "CitizenSubmission",
            EntityId = s.Id,
            Module = "Muhtarlik",
            Description = $"Muhtar görüşü eklendi ({opinion}): {s.TrackingNo ?? s.Id.ToString()[..8]}",
        }, ct);

        var events = await uow.CitizenSubmissionEvents.GetBySubmissionAsync(s.Id, ct);
        return new MuhtarSubmissionDetailDto(
            ToAnonymousItem(s), s.ResolutionNote,
            SubmissionTimelineBuilder.Build(events, forCitizen: false));
    }

    private async Task<CitizenSubmission> LoadAccessibleAsync(Guid id, CancellationToken ct)
    {
        var s = await uow.CitizenSubmissions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "CITIZEN_SUBMISSION_NOT_FOUND");

        var scope = await GetScopeAsync(ct);
        if (scope is not null && !scope.Contains(s.Neighborhood))
            throw new ForbiddenException("Bu başvuruya erişim yetkiniz yok.", "FORBIDDEN_NEIGHBORHOOD");

        return s;
    }

    private async Task<HashSet<string>?> GetScopeAsync(CancellationToken ct)
    {
        if (currentUser.Id is not Guid userId) return null;
        return await scopeService.GetScopedNamesAsync(userId, "muhtarlik", ct);
    }

    private static DateTime? ResolveFrom(string? dateRange) => dateRange switch
    {
        "today" => TurkeyTime.TodayStartUtc(),
        "week" => DateTime.UtcNow.AddDays(-7),
        "month" => DateTime.UtcNow.AddDays(-30),
        "quarter" => DateTime.UtcNow.AddDays(-90),
        "year" => DateTime.UtcNow.AddDays(-365),
        _ => null,
    };

    private MuhtarDashboardDto Build(List<CitizenSubmission> all, IReadOnlyList<string> neighborhoods)
    {
        var now = DateTime.UtcNow;
        var open = all.Where(x => x.Status is "new" or "in_review" or "forwarded").ToList();
        var resolved = all.Where(x => x.Status == "resolved" && x.ResolvedAt != null).ToList();

        var totals = new MuhtarDashboardTotalsDto(
            all.Count,
            all.Count(x => x.Status == "new"),
            all.Count(x => x.Status == "in_review"),
            all.Count(x => x.Status == "forwarded"),
            all.Count(x => x.Status == "resolved"),
            all.Count(x => x.Status == "rejected"),
            all.Count(x => x.Priority == "urgent"),
            open.Count,
            all.Count(x => x.SubmittedAt >= now.AddDays(-7)),
            all.Count(x => x.SubmittedAt >= now.AddDays(-30)),
            all.Count(x => x.SubmittedVia == "muhtar_panel"));

        var firstResponses = all.Where(x => x.FirstResponseAt != null).ToList();
        var forwarded = all.Where(x => x.ForwardedAt != null).ToList();
        var resolutionHoursList = resolved
            .Select(x => (x.ResolvedAt!.Value - x.SubmittedAt).TotalHours)
            .OrderBy(x => x)
            .ToList();

        var overdue = all.Where(IsOverdue).ToList();
        var onTimeResolved = resolved.Count(x =>
            (x.ResolvedAt!.Value - x.SubmittedAt).TotalHours <= MuhtarlikReference.SlaTargetsFor(x.Priority).ResolutionHours);

        var timings = new MuhtarDashboardTimingsDto(
            firstResponses.Count > 0
                ? Math.Round(firstResponses.Average(x => (x.FirstResponseAt!.Value - x.SubmittedAt).TotalHours), 1) : 0,
            forwarded.Count > 0
                ? Math.Round(forwarded.Average(x => (x.ForwardedAt!.Value - x.SubmittedAt).TotalHours), 1) : 0,
            resolutionHoursList.Count > 0 ? Math.Round(resolutionHoursList.Average(), 1) : 0,
            Median(resolutionHoursList),
            all.Count > 0 ? Math.Round((double)resolved.Count / all.Count * 100, 1) : 0,
            overdue.Count,
            onTimeResolved,
            resolved.Count > 0 ? Math.Round((double)onTimeResolved / resolved.Count * 100, 1) : 0);

        var topCategories = all
            .GroupBy(x => x.CategoryId)
            .Select(g => new SubmissionDistributionItemDto(g.Key, MuhtarlikReference.CategoryLabel(g.Key), g.Count()))
            .OrderByDescending(x => x.Count)
            .ToList();

        var byType = MuhtarlikReference.SubmissionTypes
            .Select(t => new SubmissionDistributionItemDto(t, MuhtarlikReference.SubmissionTypeLabel(t), all.Count(x => x.SubmissionType == t)))
            .ToList();

        var byStatus = MuhtarlikReference.AllowedStatuses
            .Select(st => new SubmissionDistributionItemDto(st, MuhtarlikReference.StatusLabel(st), all.Count(x => x.Status == st)))
            .ToList();

        var byPriority = MuhtarlikReference.Priorities
            .Select(p => new SubmissionDistributionItemDto(p, MuhtarlikReference.PriorityLabel(p), all.Count(x => x.Priority == p)))
            .ToList();

        var byScope = MuhtarlikReference.Scopes
            .Select(s => new SubmissionDistributionItemDto(s, MuhtarlikReference.ScopeLabel(s), all.Count(x => x.Scope == s)))
            .ToList();

        var byAddressType = MuhtarlikReference.AddressTypes
            .Select(t => new SubmissionDistributionItemDto(t, MuhtarlikReference.AddressTypeLabel(t), all.Count(x => x.AddressType == t)))
            .ToList();

        var byRoutedUnit = all
            .Select(x => x.RoutedUnit ?? x.UlakbelUnit ?? MuhtarlikReference.UlakbelUnitFor(x.CategoryId))
            .GroupBy(x => x)
            .Select(g => new SubmissionDistributionItemDto(g.Key, g.Key, g.Count()))
            .OrderByDescending(x => x.Count)
            .ToList();

        var today = TurkeyTime.TodayDate();
        var trend30d = Enumerable.Range(0, 30)
            .Select(i =>
            {
                var day = today.AddDays(-(29 - i));
                return new SubmissionTrendPointDto(day.ToString("yyyy-MM-dd"), all.Count(x => TurkeyTime.ToTurkey(x.SubmittedAt).Date == day));
            })
            .ToList();

        var neighborhoodStats = neighborhoods
            .Select(n =>
            {
                var items = all.Where(x => x.Neighborhood == n).ToList();
                var nResolved = items.Where(x => x.Status == "resolved" && x.ResolvedAt != null).ToList();
                return new MuhtarNeighborhoodStatDto(
                    n,
                    items.Count,
                    items.Count(x => x.Status is "new" or "in_review" or "forwarded"),
                    nResolved.Count,
                    items.Count(x => x.Priority == "urgent"),
                    nResolved.Count > 0 ? Math.Round(nResolved.Average(x => (x.ResolvedAt!.Value - x.SubmittedAt).TotalHours), 1) : 0,
                    items.Count > 0 ? Math.Round((double)nResolved.Count / items.Count * 100, 1) : 0,
                    items.GroupBy(x => x.CategoryId)
                        .Select(g => new SubmissionDistributionItemDto(g.Key, MuhtarlikReference.CategoryLabel(g.Key), g.Count()))
                        .OrderByDescending(x => x.Count).Take(5).ToList(),
                    items.Count(x => x.SubmissionType == "request"),
                    items.Count(x => x.SubmissionType == "suggestion"),
                    items.Count(x => x.SubmissionType == "complaint"));
            })
            .OrderByDescending(x => x.Total)
            .ToList();

        var pipeline = new List<MuhtarPipelineStageDto>
        {
            new("new", "Yeni (işleme alınmayı bekliyor)", all.Count(x => x.Status == "new"),
                AvgHours(all.Where(x => x.Status == "new"), x => now - x.SubmittedAt)),
            new("in_review", "İncelemede", all.Count(x => x.Status == "in_review"),
                AvgHours(all.Where(x => x.Status == "in_review"), x => now - x.SubmittedAt)),
            new("forwarded", "İlgili müdürlükte", all.Count(x => x.Status == "forwarded"),
                AvgHours(all.Where(x => x.Status == "forwarded"), x => now - (x.ForwardedAt ?? x.SubmittedAt))),
            new("resolved", "Çözüldü", all.Count(x => x.Status == "resolved"),
                AvgHours(resolved, x => x.ResolvedAt!.Value - x.SubmittedAt)),
            new("rejected", "Reddedildi", all.Count(x => x.Status == "rejected"),
                AvgHours(all.Where(x => x.Status == "rejected"), x => (x.UpdatedAt ?? now) - x.SubmittedAt)),
        };

        var recent = all
            .OrderByDescending(x => x.SubmittedAt)
            .Take(25)
            .Select(x => ToAnonymousItem(x))
            .ToList();

        var overdueItems = overdue
            .OrderByDescending(x => (now - x.SubmittedAt).TotalHours)
            .Take(25)
            .Select(x => ToAnonymousItem(x))
            .ToList();

        return new MuhtarDashboardDto(
            neighborhoods, totals, timings, topCategories, byType, byStatus, byPriority,
            byScope, byAddressType, byRoutedUnit, trend30d, neighborhoodStats, pipeline,
            recent, overdueItems);
    }

    private static bool IsOverdue(CitizenSubmission x)
    {
        if (x.Status is "resolved" or "rejected") return false;
        var target = MuhtarlikReference.SlaTargetsFor(x.Priority).ResolutionHours;
        return (DateTime.UtcNow - x.SubmittedAt).TotalHours > target;
    }

    private static double AvgHours(IEnumerable<CitizenSubmission> items, Func<CitizenSubmission, TimeSpan> selector)
    {
        var list = items.ToList();
        return list.Count == 0 ? 0 : Math.Round(list.Average(x => selector(x).TotalHours), 1);
    }

    private static double Median(List<double> sorted)
    {
        if (sorted.Count == 0) return 0;
        var mid = sorted.Count / 2;
        return Math.Round(sorted.Count % 2 == 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2, 1);
    }

    /// <summary>
    /// Muhtara gösterilecek ANONİM özet. Kimlik alanları hiç maplenmez.
    ///
    /// Düzeltme (2026-09-07, kullanıcı isteği): "birini şikayet etmişse veya şahıs isimleri
    /// varsa bunları *** olarak muhtar görsün sadece genel metni görsün" — önceden
    /// ContainsPersonReference=true olan kayıtlarda başlık/açıklama TAMAMEN null dönüyordu
    /// (muhtar konuyu bile göremiyordu). Artık şahıs adları *** ile maskelenip genel metin
    /// (konu/şikayet özeti) gösterilir; ContentVisible her zaman true'dur (ayrı bir
    /// gizleme bayrağına gerek kalmadı, maskeleme metnin içinde yapılıyor).
    /// </summary>
    private MuhtarRecentItemDto ToAnonymousItem(CitizenSubmission s)
    {
        var target = MuhtarlikReference.SlaTargetsFor(s.Priority).ResolutionHours;
        var end = s.ResolvedAt ?? DateTime.UtcNow;
        var elapsed = Math.Round((end - s.SubmittedAt).TotalHours, 1);

        return new MuhtarRecentItemDto(
            s.Id,
            s.TrackingNo,
            s.Neighborhood,
            s.CategoryId,
            MuhtarlikReference.CategoryLabel(s.CategoryId),
            s.SubmissionType,
            MuhtarlikReference.SubmissionTypeLabel(s.SubmissionType),
            s.Priority,
            s.Status,
            MuhtarlikReference.StatusLabel(s.Status),
            s.Scope,
            s.AddressType,
            s.SubmittedAt,
            s.ForwardedAt,
            s.ResolvedAt,
            elapsed,
            target,
            IsOverdue(s),
            s.RoutedUnit ?? s.UlakbelUnit,
            true,
            contentAnalyzer.MaskPersonNames(s.Title),
            contentAnalyzer.MaskPersonNames(s.Description),
            s.SubmittedVia);
    }
}
