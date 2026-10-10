using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Entities.Reports;
using Nexora.Infrastructure.Persistence;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface IParticipantActivitySyncJob
{
    Task RunAsync(CancellationToken ct);
}

public class ParticipantActivitySyncJob(AppDbContext db) : IParticipantActivitySyncJob
{
    private static readonly string[] AllModules =
    [
        "events", "sports", "kasif", "pool", "youth-camp", "scout-camp",
        "science-center", "accessible-life", "women-family", "travels", "seda", "library",
        "muhtarlik", "quiz", "survey", "wheel", "companies",
    ];

    private static readonly string[] FacilitySubModules =
        ["sports", "kasif", "pool", "youth-camp", "scout-camp", "science-center", "accessible-life", "women-family"];

    public async Task RunAsync(CancellationToken ct)
    {
        foreach (var module in AllModules)
        {
            var upserts = module switch
            {
                "events" => await SyncEventsAsync(ct),
                var m when FacilitySubModules.Contains(m) => await SyncFacilityModuleAsync(m, ct),
                "travels" => await SyncTravelsAsync(ct),
                "seda" => await SyncSedaAsync(ct),
                "library" => await SyncLibraryAsync(ct),
                "muhtarlik" => await SyncMuhtarlikAsync(ct),
                "quiz" => await SyncQuizAsync(ct),
                "survey" => await SyncSurveyAsync(ct),
                "wheel" => await SyncWheelAsync(ct),
                "companies" => await SyncCompaniesAsync(ct),
                _ => 0,
            };
            if (upserts > 0) await db.SaveChangesAsync(ct);
        }
    }

    private readonly Dictionary<string, ParticipantActivitySyncCursor> _cursorCache = [];

    private async Task<DateTime> GetCursorAsync(string module, CancellationToken ct)
    {
        if (_cursorCache.TryGetValue(module, out var cached)) return cached.LastSyncedUpTo;

        var cursor = await db.ParticipantActivitySyncCursors.FirstOrDefaultAsync(x => x.Module == module, ct);
        if (cursor is null)
        {
            cursor = ParticipantActivitySyncCursor.Create(module, DateTime.MinValue);
            db.ParticipantActivitySyncCursors.Add(cursor);
        }
        _cursorCache[module] = cursor;
        return cursor.LastSyncedUpTo;
    }

    private Task AdvanceCursorAsync(string module, DateTime upTo, int upserts, CancellationToken ct)
    {
        if (_cursorCache.TryGetValue(module, out var cursor))
        {
            cursor.Advance(upTo, upserts);
        }
        return Task.CompletedTask;
    }

    private sealed record SyncRow(
        Guid SourceId,
        Guid? ParticipantId,
        string? Tckn,
        string? FullName,
        string? Phone,
        string? ItemName,
        DateTime ActivityDate,
        string? Status,
        DateTime SourceUpdatedAt);

    private async Task<int> UpsertBatchAsync(
        string module, string sourceTable,
        List<SyncRow> rows,
        CancellationToken ct)
    {
        if (rows.Count == 0) return 0;

        rows = rows
            .GroupBy(r => r.SourceId)
            .Select(g => g.OrderByDescending(r => r.SourceUpdatedAt).First())
            .ToList();

        var sourceIds = rows.Select(r => r.SourceId).ToList();
        var existing = await db.ParticipantActivityRecords
            .Where(x => x.Module == module && sourceIds.Contains(x.SourceId))
            .ToDictionaryAsync(x => x.SourceId, ct);

        var candidateParticipantIds = rows
            .Where(r => r.ParticipantId.HasValue)
            .Select(r => r.ParticipantId!.Value)
            .Distinct()
            .ToList();
        var knownParticipantIds = candidateParticipantIds.Count == 0
            ? new HashSet<Guid>()
            : (await db.Participants.IgnoreQueryFilters()
                .Where(p => candidateParticipantIds.Contains(p.Id))
                .Select(p => p.Id)
                .ToListAsync(ct)).ToHashSet();

        foreach (var r in rows)
        {
            var tckn = NormalizeTckn(r.Tckn);
            var fullName = !string.IsNullOrWhiteSpace(r.FullName) ? r.FullName : "—";
            var status = !string.IsNullOrWhiteSpace(r.Status) ? r.Status : "active";
            var participantId = r.ParticipantId.HasValue && knownParticipantIds.Contains(r.ParticipantId.Value)
                ? r.ParticipantId
                : null;

            if (existing.TryGetValue(r.SourceId, out var rec))
            {
                rec.Refresh(participantId, tckn, fullName, r.Phone, r.ItemName, r.ActivityDate, status, r.SourceUpdatedAt);
            }
            else
            {
                db.ParticipantActivityRecords.Add(ParticipantActivityRecord.Create(
                    module, sourceTable, r.SourceId, participantId, tckn, fullName, r.Phone, r.ItemName,
                    r.ActivityDate, status, r.SourceUpdatedAt));
            }
        }

        var maxUpdatedAt = rows.Max(r => r.SourceUpdatedAt);
        await AdvanceCursorAsync(module, maxUpdatedAt, rows.Count, ct);
        return rows.Count;
    }

    private static string? NormalizeTckn(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = raw.Trim();
        return digits.Length == 11 && digits.All(char.IsAsciiDigit) ? digits : null;
    }

    private async Task<int> SyncEventsAsync(CancellationToken ct)
    {
        var since = await GetCursorAsync("events", ct);
        var raw = await (
            from a in db.EventApplications.AsNoTracking()
            where (a.UpdatedAt ?? a.CreatedAt) > since
            join e in db.Events.AsNoTracking() on a.EventId equals e.Id into ej
            from e in ej.DefaultIfEmpty()
            join pt in db.Participants.AsNoTracking() on a.ParticipantId equals pt.Id into pj
            from pt in pj.DefaultIfEmpty()
            select new
            {
                a.Id, a.ParticipantId, Tckn = pt != null ? pt.Tckn : null,
                FullName = pt != null ? pt.FullName : "—", Phone = pt != null ? pt.Phone : null,
                ItemName = e != null ? e.Name : null, a.CreatedAt, a.Status,
                SourceUpdatedAt = a.UpdatedAt ?? a.CreatedAt,
            }).ToListAsync(ct);

        var rows = raw.Select(x => new SyncRow(x.Id, x.ParticipantId, x.Tckn, x.FullName, x.Phone, x.ItemName, x.CreatedAt, x.Status, x.SourceUpdatedAt)).ToList();
        return await UpsertBatchAsync("events", "EventApplications", rows, ct);
    }

    private async Task<int> SyncFacilityModuleAsync(string module, CancellationToken ct)
    {
        var since = await GetCursorAsync(module, ct);
        var raw = await (
            from a in db.FacilityApplications.AsNoTracking()
            where a.Module == module && (a.UpdatedAt ?? a.CreatedAt) > since
            join g in db.FacilityGroups.AsNoTracking() on a.GroupId equals g.Id into gj
            from g in gj.DefaultIfEmpty()
            join pt in db.Participants.AsNoTracking() on a.ParticipantId equals pt.Id into pj
            from pt in pj.DefaultIfEmpty()
            select new
            {
                a.Id, a.ParticipantId,
                Tckn = pt != null ? pt.Tckn : a.Tckn, FullName = pt != null ? pt.FullName : a.FullName,
                Phone = pt != null ? pt.Phone : a.Phone, ItemName = g != null ? g.Name : null,
                a.CreatedAt, a.Status, SourceUpdatedAt = a.UpdatedAt ?? a.CreatedAt,
            }).ToListAsync(ct);

        var rows = raw.Select(x => new SyncRow(x.Id, x.ParticipantId, x.Tckn, x.FullName, x.Phone, x.ItemName, x.CreatedAt, x.Status, x.SourceUpdatedAt)).ToList();
        return await UpsertBatchAsync(module, "FacilityApplications", rows, ct);
    }

    private async Task<int> SyncTravelsAsync(CancellationToken ct)
    {
        var since = await GetCursorAsync("travels", ct);
        var raw = await (
            from a in db.TravelApplications.AsNoTracking()
            where (a.UpdatedAt ?? a.CreatedAt) > since
            join t in db.Travels.AsNoTracking() on a.TravelId equals t.Id into tj
            from t in tj.DefaultIfEmpty()
            join pt in db.Participants.AsNoTracking() on a.ParticipantId equals pt.Id into pj
            from pt in pj.DefaultIfEmpty()
            select new
            {
                a.Id, a.ParticipantId, Tckn = pt != null ? pt.Tckn : a.GuestTckn,
                FullName = pt != null ? pt.FullName : (a.GuestFullName ?? "—"),
                Phone = pt != null ? pt.Phone : a.GuestPhone,
                ItemName = t != null ? t.Name : null, a.CreatedAt, a.Status,
                SourceUpdatedAt = a.UpdatedAt ?? a.CreatedAt,
            }).ToListAsync(ct);

        var rows = raw.Select(x => new SyncRow(x.Id, x.ParticipantId, x.Tckn, x.FullName, x.Phone, x.ItemName, x.CreatedAt, x.Status, x.SourceUpdatedAt)).ToList();
        return await UpsertBatchAsync("travels", "TravelApplications", rows, ct);
    }

    private async Task<int> SyncSedaAsync(CancellationToken ct)
    {
        var since = await GetCursorAsync("seda", ct);
        var raw = await db.SedaApplications.AsNoTracking()
            .Where(a => (a.UpdatedAt ?? a.CreatedAt) > since)
            .Select(a => new
            {
                a.Id, Tckn = a.Tckn, FullName = a.StudentName + " " + a.StudentSurname, Phone = a.StudentPhone,
                ItemName = (string?)a.SchoolName, a.CreatedAt, a.Status, SourceUpdatedAt = a.UpdatedAt ?? a.CreatedAt,
            }).ToListAsync(ct);

        var rows = raw.Select(x => new SyncRow(x.Id, null, x.Tckn, x.FullName, x.Phone, x.ItemName, x.CreatedAt, x.Status, x.SourceUpdatedAt)).ToList();
        return await UpsertBatchAsync("seda", "SedaApplications", rows, ct);
    }

    private async Task<int> SyncLibraryAsync(CancellationToken ct)
    {
        var since = await GetCursorAsync("library", ct);

        var apps = await (
            from a in db.LibraryApplications.AsNoTracking()
            where (a.UpdatedAt ?? a.CreatedAt) > since
            join l in db.Libraries.AsNoTracking() on a.LibraryId equals l.Id into lj
            from l in lj.DefaultIfEmpty()
            select new
            {
                a.Id, FullName = a.ApplicantName + " " + a.ApplicantSurname, Phone = (string?)a.Phone,
                ItemName = l != null ? l.Name : null, a.CreatedAt, a.Status, SourceUpdatedAt = a.UpdatedAt ?? a.CreatedAt,
            }).ToListAsync(ct);
        var appRows = apps.Select(x => new SyncRow(x.Id, null, null, x.FullName, x.Phone, x.ItemName, x.CreatedAt, x.Status, x.SourceUpdatedAt)).ToList();
        var n1 = await UpsertBatchAsync("library", "LibraryApplications", appRows, ct);

        var sessions = await (
            from s in db.LibrarySessions.AsNoTracking()
            where (s.UpdatedAt ?? s.CreatedAt) > since
            join l in db.Libraries.AsNoTracking() on s.LibraryId equals l.Id into lj
            from l in lj.DefaultIfEmpty()
            select new
            {
                s.Id, s.ParticipantId, s.Tckn, s.MemberName, Phone = (string?)s.Phone,
                ItemName = l != null ? l.Name : null, s.CreatedAt, s.Status, SourceUpdatedAt = s.UpdatedAt ?? s.CreatedAt,
            }).ToListAsync(ct);
        var sessionRows = sessions.Select(x => new SyncRow(x.Id, x.ParticipantId, x.Tckn, x.MemberName, x.Phone, x.ItemName, x.CreatedAt, x.Status, x.SourceUpdatedAt)).ToList();
        var n2 = await UpsertBatchAsync("library", "LibrarySessions", sessionRows, ct);

        return n1 + n2;
    }

    private async Task<int> SyncMuhtarlikAsync(CancellationToken ct)
    {
        var since = await GetCursorAsync("muhtarlik", ct);
        var raw = await db.CitizenSubmissions.AsNoTracking()
            .Where(a => (a.UpdatedAt ?? a.CreatedAt) > since)
            .Select(a => new
            {
                a.Id, a.CitizenTc, a.CitizenName, a.CitizenPhone, ItemName = (string?)a.Title,
                a.CreatedAt, a.Status, SourceUpdatedAt = a.UpdatedAt ?? a.CreatedAt,
            }).ToListAsync(ct);

        var rows = raw.Select(x => new SyncRow(x.Id, null, x.CitizenTc, x.CitizenName, x.CitizenPhone, x.ItemName, x.CreatedAt, x.Status, x.SourceUpdatedAt)).ToList();
        return await UpsertBatchAsync("muhtarlik", "CitizenSubmissions", rows, ct);
    }

    private async Task<int> SyncQuizAsync(CancellationToken ct)
    {
        var since = await GetCursorAsync("quiz", ct);
        var raw = await (
            from q in db.QuizParticipations.AsNoTracking()
            where (q.UpdatedAt ?? q.CreatedAt) > since
            join qz in db.Quizzes.AsNoTracking() on q.QuizId equals qz.Id into qzj
            from qz in qzj.DefaultIfEmpty()
            select new
            {
                q.Id, q.Tckn, q.ParticipantName, ItemName = qz != null ? qz.Title : null,
                q.CreatedAt, SourceUpdatedAt = q.UpdatedAt ?? q.CreatedAt,
            }).ToListAsync(ct);

        var rows = raw.Select(x => new SyncRow(x.Id, null, x.Tckn, x.ParticipantName, null, x.ItemName, x.CreatedAt, "completed", x.SourceUpdatedAt)).ToList();
        return await UpsertBatchAsync("quiz", "QuizParticipations", rows, ct);
    }

    private async Task<int> SyncSurveyAsync(CancellationToken ct)
    {
        var since = await GetCursorAsync("survey", ct);
        var raw = await (
            from r in db.SurveyResponses.AsNoTracking()
            where (r.UpdatedAt ?? r.CreatedAt) > since
            join sv in db.Surveys.AsNoTracking() on r.SurveyId equals sv.Id into svj
            from sv in svj.DefaultIfEmpty()
            join pt in db.Participants.AsNoTracking() on r.ParticipantId equals pt.Id into pj
            from pt in pj.DefaultIfEmpty()
            select new
            {
                r.Id, r.ParticipantId, Tckn = r.CitizenTc, FullName = pt != null ? pt.FullName : "—",
                Phone = pt != null ? pt.Phone : null, ItemName = sv != null ? sv.Title : null,
                r.CreatedAt, SourceUpdatedAt = r.UpdatedAt ?? r.CreatedAt,
            }).ToListAsync(ct);

        var rows = raw.Select(x => new SyncRow(x.Id, x.ParticipantId, x.Tckn, x.FullName, x.Phone, x.ItemName, x.CreatedAt, "completed", x.SourceUpdatedAt)).ToList();
        return await UpsertBatchAsync("survey", "SurveyResponses", rows, ct);
    }

    private async Task<int> SyncWheelAsync(CancellationToken ct)
    {
        var since = await GetCursorAsync("wheel", ct);
        var raw = await db.GiftRequests.AsNoTracking()
            .Where(g => (g.UpdatedAt ?? g.CreatedAt) > since)
            .Select(g => new
            {
                g.Id, g.ParticipantId, g.CitizenTc, g.CitizenName, g.CitizenPhone, ItemName = (string?)g.GiftName,
                g.CreatedAt, Status = g.Status.ToString(), SourceUpdatedAt = g.UpdatedAt ?? g.CreatedAt,
            }).ToListAsync(ct);

        var rows = raw.Select(x => new SyncRow(x.Id, x.ParticipantId, x.CitizenTc, x.CitizenName, x.CitizenPhone, x.ItemName, x.CreatedAt, x.Status.ToLowerInvariant(), x.SourceUpdatedAt)).ToList();
        return await UpsertBatchAsync("wheel", "GiftRequests", rows, ct);
    }

    private async Task<int> SyncCompaniesAsync(CancellationToken ct)
    {
        var since = await GetCursorAsync("companies", ct);
        var raw = await db.DiscountUsages.AsNoTracking()
            .Where(u => (u.UpdatedAt ?? u.CreatedAt) > since)
            .Select(u => new
            {
                u.Id, u.UserId, u.UserName, u.UserPhone, ItemName = (string?)u.DiscountCode,
                u.CreatedAt, Status = u.Status.ToString(), SourceUpdatedAt = u.UpdatedAt ?? u.CreatedAt,
            }).ToListAsync(ct);

        var rows = raw.Select(x => new SyncRow(x.Id, x.UserId, null, x.UserName, x.UserPhone, x.ItemName, x.CreatedAt, x.Status.ToLowerInvariant(), x.SourceUpdatedAt)).ToList();
        return await UpsertBatchAsync("companies", "DiscountUsages", rows, ct);
    }
}
