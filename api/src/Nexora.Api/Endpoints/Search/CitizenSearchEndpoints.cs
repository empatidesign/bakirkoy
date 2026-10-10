using System.Text;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.ParticipantFacilities.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Api.Endpoints.Search;

/// <summary>
/// Mobil uygulamanın genel araması: etkinlik, program (tüm tesis modülleri), gezi,
/// SEDA eğitimi, kütüphane ve kampanya kataloğunu tek çağrıda tarar. Girişsiz de
/// çalışır; yalnız vatandaşa zaten açık katalog alanlarını döner (kişisel veri yok —
/// yönetici araması için bkz. GlobalSearchEndpoints).
/// </summary>
public static class CitizenSearchEndpoints
{
    public static IEndpointRouteBuilder MapCitizenSearchEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/me/search", Search)
            .WithTags("MeSearch")
            .AllowAnonymous();
        return app;
    }

    private static async Task<IResult> Search(string? q, int? limit, IUnitOfWork uow, CancellationToken ct)
    {
        var term = Fold(q);
        if (term.Length < 2)
            return Results.Ok(ApiResponse.Ok(new List<CitizenSearchHit>()));

        var take = Math.Clamp(limit ?? 8, 1, 30);
        var today = TurkeyTime.TodayDate();
        bool Match(params string?[] fields) => fields.Any(f => f is not null && Fold(f).Contains(term));

        // ponytail: aktif kayıtlar belleğe alınıp süzülür (Türkçe katlama SQL'e çevrilmiyor);
        // katalog büyürse unaccent/ILIKE ile DB tarafına taşınmalı.
        var hits = new List<CitizenSearchHit>();

        var events = await uow.Events.FindAsync(e => e.IsActive && e.EndDate >= today, ct);
        hits.AddRange(events.Where(e => Match(e.Name, e.Description))
            .OrderBy(e => e.StartDate).Take(take)
            .Select(e => new CitizenSearchHit("event", e.Id, e.Name, $"Etkinlik · {e.StartDate:dd.MM.yyyy}", null)));

        var groups = await uow.FacilityGroups.FindAsync(g => g.IsActive, ct);
        hits.AddRange(groups.Where(g => Match(g.Name, g.Description, g.InstructorName, FacilityModuleLabels.For(g.Module)))
            .Take(take)
            .Select(g => new CitizenSearchHit("program", g.Id, g.Name, FacilityModuleLabels.For(g.Module), g.Module)));

        var travels = await uow.Travels.FindAsync(t => t.IsActive && t.EndDate >= today, ct);
        hits.AddRange(travels.Where(t => Match(t.Name, t.Destination))
            .OrderBy(t => t.StartDate).Take(take)
            .Select(t => new CitizenSearchHit("travel", t.Id, t.Name, $"Kültür Gezisi · {t.Destination} · {t.StartDate:dd.MM.yyyy}", null)));

        var seda = await uow.SedaDefinitions.FindAsync(s => s.IsActive, ct);
        hits.AddRange(seda.Where(s => Match(s.Name, s.Type)).Take(take)
            .Select(s => new CitizenSearchHit("seda", s.Id, s.Name, "SEDA Eğitim", null)));

        var libraries = await uow.Libraries.FindAsync(l => l.IsActive, ct);
        hits.AddRange(libraries.Where(l => Match(l.Name, l.Description, l.District)).Take(take)
            .Select(l => new CitizenSearchHit("library", l.Id, l.Name, $"Kütüphane{(string.IsNullOrWhiteSpace(l.District) ? "" : " · " + l.District)}", null)));

        var now = DateTime.UtcNow;
        var campaigns = await uow.Campaigns.FindAsync(c => c.Status == CampaignStatus.Active && c.EndDate >= now, ct);
        hits.AddRange(campaigns.Where(c => Match(c.Name, c.Description)).Take(take)
            .Select(c => new CitizenSearchHit("campaign", c.Id, c.Name, "Kampanya", null)));

        return Results.Ok(ApiResponse.Ok(hits));
    }

    /// <summary>Türkçe büyük/küçük harf ve aksan farkını yok sayar: "cocuk" ~ "Çocuk", "istanbul" ~ "İSTANBUL".</summary>
    private static string Fold(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return string.Empty;
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s.Trim())
            sb.Append(ch switch
            {
                'İ' or 'I' or 'ı' or 'i' => 'i',
                'Ş' or 'ş' => 's',
                'Ç' or 'ç' => 'c',
                'Ğ' or 'ğ' => 'g',
                'Ö' or 'ö' => 'o',
                'Ü' or 'ü' => 'u',
                _ => char.ToLowerInvariant(ch),
            });
        return sb.ToString();
    }
}

/// <param name="Type">event | program | travel | seda | library | campaign</param>
/// <param name="Module">Yalnız program için tesis modülü (sports, pool, kasif …).</param>
public record CitizenSearchHit(string Type, Guid Id, string Title, string Subtitle, string? Module);
