using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Nexora.Application.Common;
using Nexora.Application.Configuration;
using Nexora.Application.Features.Participants;
using Nexora.Application.Features.Participants.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Persistence;

namespace Nexora.Infrastructure.Services;

public class ParticipantDemographicsService(AppDbContext db, IOptionsMonitor<ParticipantSettings> participantSettings) : IParticipantDemographicsService
{
    private bool MaskEnabled() => participantSettings.CurrentValue.MaskIdentity;

    private sealed record Row(Guid Id, string FullName, string Tckn, string? Phone, DateTime BirthDate, Gender Gender, string? Address, ParticipantStatus Status, bool IsVerified, DateTime RegisteredAt, bool HasChildren);

    private static readonly (string Band, int MinAge, int MaxAge)[] AgeBands =
    [
        ("0-12", 0, 12),
        ("13-17", 13, 17),
        ("18-25", 18, 25),
        ("26-40", 26, 40),
        ("41-60", 41, 60),
        ("60+", 61, 200),
    ];

    private async Task<List<Row>> LoadAsync(ParticipantDemographicsParams p, CancellationToken ct)
    {
        var query = db.Participants.AsNoTracking().Where(x => !x.IsDeleted);

        if (Enum.TryParse<ParticipantStatus>(p.Status, out var status))
            query = query.Where(x => x.Status == status);
        if (p.Verified.HasValue)
            query = query.Where(x => x.IsVerified == p.Verified.Value);
        if (p.StartDate.HasValue)
            query = query.Where(x => x.RegisteredAt >= DateTime.SpecifyKind(p.StartDate.Value.Date, DateTimeKind.Utc));
        if (p.EndDate.HasValue)
            query = query.Where(x => x.RegisteredAt < DateTime.SpecifyKind(p.EndDate.Value.Date.AddDays(1), DateTimeKind.Utc));

        var raw = await query
            .Select(x => new
            {
                x.Id, x.FullName, x.Tckn, x.Phone, x.BirthDate, x.Gender, x.Address,
                x.Status, x.IsVerified, x.RegisteredAt,
                HasChildren = db.Set<Nexora.Domain.Entities.Participants.ParticipantGuardian>().Any(g => g.GuardianId == x.Id),
            })
            .ToListAsync(ct);

        return raw.Select(x => new Row(x.Id, x.FullName, x.Tckn, x.Phone, x.BirthDate, x.Gender, x.Address, x.Status, x.IsVerified, x.RegisteredAt, x.HasChildren)).ToList();
    }

    private static int Age(DateTime birth)
    {
        var today = TurkeyTime.TodayDate();
        var age = today.Year - birth.Year;
        if (birth.Date > today.AddYears(-age)) age--;
        return age;
    }

    private static string BandFor(int age) => AgeBands.FirstOrDefault(b => age >= b.MinAge && age <= b.MaxAge).Band ?? "60+";

    public async Task<ParticipantDemographicsOverviewDto> GetOverviewAsync(ParticipantDemographicsParams p, CancellationToken ct)
    {
        var rows = await LoadAsync(p, ct);
        var total = rows.Count;

        var male = rows.Count(r => r.Gender == Gender.Male);
        var female = rows.Count(r => r.Gender == Gender.Female);

        var ages = rows.Select(r => Age(r.BirthDate)).ToList();
        var minors = ages.Count(a => a < 18);
        var adults = total - minors;
        var avgAge = ages.Count > 0 ? ages.Average() : 0;

        var neighborhoods = rows
            .GroupBy(r => BakirkoyNeighborhoods.Classify(r.Address))
            .Select(g =>
            {
                var items = g.Select(r => (r.Gender, Age: Age(r.BirthDate))).ToList();
                var count = items.Count;
                var youth = items.Where(x => x.Age >= 15 && x.Age <= 29).ToList();
                var bands = AgeBands.Select(b =>
                {
                    var inBand = items.Where(x => x.Age >= b.MinAge && x.Age <= b.MaxAge).ToList();
                    return new AgeBandStatDto(
                        b.Band, inBand.Count,
                        inBand.Count(x => x.Gender == Gender.Male),
                        inBand.Count(x => x.Gender == Gender.Female),
                        count > 0 ? Math.Round(inBand.Count * 100.0 / count, 1) : 0);
                }).ToList();
                return new NeighborhoodStatDto(
                    g.Key,
                    count,
                    items.Count(x => x.Gender == Gender.Male),
                    items.Count(x => x.Gender == Gender.Female),
                    items.Count(x => x.Age < 18),
                    items.Count(x => x.Age >= 18),
                    total > 0 ? Math.Round(count * 100.0 / total, 1) : 0,
                    bands,
                    youth.Count,
                    youth.Count(x => x.Gender == Gender.Male),
                    youth.Count(x => x.Gender == Gender.Female),
                    count > 0 ? Math.Round(youth.Count * 100.0 / count, 1) : 0);
            })
            .OrderByDescending(n => n.Total)
            .ToList();

        var ageBands = AgeBands.Select(b =>
        {
            var inBand = rows.Where(r => { var a = Age(r.BirthDate); return a >= b.MinAge && a <= b.MaxAge; }).ToList();
            return new AgeBandStatDto(
                b.Band, inBand.Count,
                inBand.Count(r => r.Gender == Gender.Male),
                inBand.Count(r => r.Gender == Gender.Female),
                total > 0 ? Math.Round(inBand.Count * 100.0 / total, 1) : 0);
        }).ToList();

        return new ParticipantDemographicsOverviewDto(
            total,
            rows.Count(r => r.Status == ParticipantStatus.Active),
            rows.Count(r => r.Status == ParticipantStatus.Passive),
            rows.Count(r => r.Status == ParticipantStatus.Blocked),
            rows.Count(r => r.IsVerified),
            rows.Count(r => !r.IsVerified),
            minors, adults,
            rows.Count(r => r.HasChildren),
            Math.Round(avgAge, 1),
            new GenderStatDto(male, female, total > 0 ? Math.Round(male * 100.0 / total, 1) : 0, total > 0 ? Math.Round(female * 100.0 / total, 1) : 0),
            neighborhoods,
            ageBands,
            ageBands);
    }

    public async Task<NeighborhoodDetailDto> GetNeighborhoodDetailAsync(string neighborhood, ParticipantDemographicsParams p, int page, int limit, CancellationToken ct)
    {
        var rows = await LoadAsync(p, ct);
        var filtered = rows.Where(r => BakirkoyNeighborhoods.Classify(r.Address) == neighborhood)
            .OrderByDescending(r => r.RegisteredAt)
            .ToList();

        page = Math.Max(1, page);
        limit = Math.Clamp(limit, 1, 100);
        var total = filtered.Count;
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)limit));
        var mask = MaskEnabled();
        var pageItems = filtered.Skip((page - 1) * limit).Take(limit)
            .Select(r => new NeighborhoodParticipantRowDto(
                r.Id,
                mask ? IdentityMask.MaskName(r.FullName) : r.FullName,
                mask ? IdentityMask.MaskTckn(r.Tckn) : r.Tckn,
                Age(r.BirthDate),
                r.Gender.ToString(),
                mask ? IdentityMask.MaskPhoneStrict(r.Phone) : r.Phone,
                r.Status.ToString(),
                r.RegisteredAt))
            .ToList();

        return new NeighborhoodDetailDto(neighborhood, total, pageItems, page, limit, totalPages);
    }
}
