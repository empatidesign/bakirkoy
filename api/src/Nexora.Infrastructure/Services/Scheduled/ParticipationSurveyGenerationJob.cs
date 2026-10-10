using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Surveys;
using Microsoft.Extensions.Configuration;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface IParticipationSurveyGenerationJob
{
    Task RunAsync(CancellationToken ct);
}

// Kullanıcı isteği (2026-08-12): "vatandaş katıldığı bütün modüllerdeki bütün katıldığı
// programlar için katıldıktan sonra, katılmış ise 24 saat sonra... zorunlu olarak katıldığı
// anket değerlendirme yapılması lazım" — bu job, her modülün STANDART değerlendirme anketini
// (bkz. StandardSurveyTemplates), gerçek katılımı (yoklama/check-in/tamamlanmış oturum) tespit
// edilen HER kaynak (Event/Travel/Facility grubu/Library) için OTOMATİK ve TEK SEFERLİK üretir.
//
// Algoritma:
// 1. Her modül türü için "gerçekten katılım gerçekleşmiş" kaynakları bul (en az bir present/
//    check-in/completed kaydı).
// 2. O kaynak için daha önce anket üretilmiş mi kontrol et (ISurveyRepository.
//    GetSourceIdsByTypeAsync ile, sourceType+sourceId eşleşmesi) — varsa atla (tek seferlik
//    üretim, tekrar tekrar anket oluşturulmaz).
// 3. Kaynağın "tamamlanma" anı (etkinlik/sefer bitişi VEYA en son yoklama/oturum zamanı,
//    hangisi daha güncelse) üzerinden SurveySettings:MandatorySurveyDelayHours (varsayılan 24
//    saat) geçmiş mi kontrol et — geçmemişse bu kaynağı bu çalıştırmada atla, sonraki
//    çalıştırmada tekrar denenir.
// 4. Koşullar sağlanınca modülün standart şablonundan IsRequired=true, IsActive=true bir Survey
//    + sorular üretilir, SourceType/SourceId ile o kaynağa bağlanır. Vatandaş tarafında bu anket
//    otomatik olarak PendingSurveyGate'te (bkz. ParticipantSurveyService.GetPendingAsync)
//    "zorunlu" olarak belirir — CheckAudienceAsync zaten kaynağa özel katılım kontrolü yaptığı
//    için yalnızca gerçekten o kaynağa katılmış kişiye gösterilir.
//
// Zamanlamayı "rahatsız etmeyecek" hale getiren asıl mekanizma burada DEĞİL,
// ParticipantSurveyService.GetPendingSummaryAsync + Participant.LastMandatorySurveyPromptAt
// çiftinde: birden fazla zorunlu anket birikse bile, bloklayıcı modal olarak AYNI ANDA sadece
// biri sunulur ve bir sonraki en az MinMandatoryPromptIntervalMinutes (varsayılan 60dk) sonra
// gösterilir.
public class ParticipationSurveyGenerationJob(IUnitOfWork uow, IConfiguration config) : IParticipationSurveyGenerationJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        var delayHours = config.GetValue("SurveySettings:MandatorySurveyDelayHours", 24);
        var now = DateTime.UtcNow;
        var cutoff = now.AddHours(-delayHours);

        await GenerateForEventsAsync(cutoff, ct);
        await GenerateForTravelsAsync(cutoff, ct);
        await GenerateForFacilitiesAsync(cutoff, ct);
        await GenerateForLibrariesAsync(cutoff, ct);
    }

    private async Task GenerateForEventsAsync(DateTime cutoff, CancellationToken ct)
    {
        var checkIns = await uow.EventActivities.GetMostRecentCheckInAtByEventAsync(ct);
        if (checkIns.Count == 0) return;

        var alreadyLinked = await uow.Surveys.GetSourceIdsByTypeAsync("Event", ct);
        var candidateIds = checkIns.Keys.Where(id => !alreadyLinked.Contains(id)).ToList();
        if (candidateIds.Count == 0) return;

        var events = await uow.Events.FindAsync(e => candidateIds.Contains(e.Id), ct);
        var created = 0;
        foreach (var ev in events)
        {
            var lastCheckIn = checkIns[ev.Id];
            var completedAt = ev.EndDate > lastCheckIn ? ev.EndDate : lastCheckIn;
            if (completedAt > cutoff) continue;

            var survey = BuildSurvey(
                StandardSurveyTemplates.EventTemplate(ev.Name),
                "Event", ev.Id);
            await uow.Surveys.AddAsync(survey, ct);
            created++;
        }
        if (created > 0) await uow.SaveChangesAsync(ct);
    }

    private async Task GenerateForTravelsAsync(DateTime cutoff, CancellationToken ct)
    {
        var attendances = await uow.TravelAttendances.GetMostRecentPresentMarkedAtByTravelAsync(ct);
        if (attendances.Count == 0) return;

        var alreadyLinked = await uow.Surveys.GetSourceIdsByTypeAsync("Travel", ct);
        var candidateIds = attendances.Keys.Where(id => !alreadyLinked.Contains(id)).ToList();
        if (candidateIds.Count == 0) return;

        var travels = await uow.Travels.FindAsync(t => candidateIds.Contains(t.Id), ct);
        var created = 0;
        foreach (var travel in travels)
        {
            var lastMark = attendances[travel.Id];
            var completedAt = travel.EndDate > lastMark ? travel.EndDate : lastMark;
            if (completedAt > cutoff) continue;

            var survey = BuildSurvey(
                StandardSurveyTemplates.TravelTemplate(travel.Name),
                "Travel", travel.Id);
            await uow.Surveys.AddAsync(survey, ct);
            created++;
        }
        if (created > 0) await uow.SaveChangesAsync(ct);
    }

    private async Task GenerateForFacilitiesAsync(DateTime cutoff, CancellationToken ct)
    {
        var alreadyLinked = await uow.Surveys.GetSourceIdsByTypeAsync("Facility", ct);
        var created = 0;

        foreach (var module in FacilityModuleRegistry.All)
        {
            var attendances = await uow.FacilityAttendances.GetMostRecentPresentMarkedAtByFacilityAsync(module, ct);
            if (attendances.Count == 0) continue;

            var candidateIds = attendances.Keys.Where(id => !alreadyLinked.Contains(id)).ToList();
            if (candidateIds.Count == 0) continue;

            var facilities = await uow.Facilities.FindAsync(f => candidateIds.Contains(f.Id) && f.Module == module, ct);
            foreach (var facility in facilities)
            {
                var lastMark = attendances[facility.Id];
                if (lastMark > cutoff) continue;

                var survey = BuildSurvey(
                    StandardSurveyTemplates.FacilityTemplate(module, facility.Name),
                    "Facility", facility.Id);
                await uow.Surveys.AddAsync(survey, ct);
                created++;
            }
        }
        if (created > 0) await uow.SaveChangesAsync(ct);
    }

    private async Task GenerateForLibrariesAsync(DateTime cutoff, CancellationToken ct)
    {
        var exits = await uow.LibrarySessions.GetMostRecentCompletedExitAtByLibraryAsync(ct);
        if (exits.Count == 0) return;

        var alreadyLinked = await uow.Surveys.GetSourceIdsByTypeAsync("Library", ct);
        var candidateIds = exits.Keys.Where(id => !alreadyLinked.Contains(id)).ToList();
        if (candidateIds.Count == 0) return;

        var libraries = await uow.Libraries.FindAsync(l => candidateIds.Contains(l.Id), ct);
        var created = 0;
        foreach (var library in libraries)
        {
            var lastExit = exits[library.Id];
            if (lastExit > cutoff) continue;

            var survey = BuildSurvey(
                StandardSurveyTemplates.LibraryTemplate(library.Name),
                "Library", library.Id);
            await uow.Surveys.AddAsync(survey, ct);
            created++;
        }
        if (created > 0) await uow.SaveChangesAsync(ct);
    }

    private static Survey BuildSurvey(SurveyTemplate template, string sourceType, Guid sourceId)
    {
        // Kullanıcı isteği/gerçek bulgu (2026-08-12): TargetAudience="all" verilirse
        // ParticipantSurveyService.CheckAudienceAsync doğrudan true döner — yani bu anketi
        // GERÇEKTEN katılmamış HERHANGİ bir vatandaş da görüp doldurabilir. GetPendingAsync
        // bunu SourceType'tan türetilen bir denetim kitlesiyle telafi ediyordu ama GetDetailAsync/
        // GetListAsync/SubmitAsync bunu yapmıyor — TargetAudience'ı burada, üretim anında doğru
        // (kaynağa özel) değerle vermek zorunlu, "all" YASAK.
        var targetAudience = sourceType switch
        {
            "Event" => "event_attendees",
            "Travel" => "travel_participants",
            "Facility" => "facility_attendees",
            "Library" => "library_users",
            _ => "all",
        };

        var data = new SurveyData(
            template.Title,
            template.Description,
            template.Category,
            targetAudience,
            null,
            null,
            template.EstimatedDuration,
            "active",
            true,
            false,
            false,
            true,
            false,
            false,
            sourceType,
            sourceId,
            true);

        var survey = Survey.Create(data, "system/participation-survey");
        var questions = template.Questions
            .Select((q, i) => SurveyQuestion.Create(
                survey.Id, i, q.Type, q.Question, q.Description, q.Required,
                q.Options, q.ScaleMin, q.ScaleMax, q.MinLabel, q.MaxLabel, q.RatingCount))
            .ToList();
        survey.ReplaceQuestions(questions);
        return survey;
    }
}
