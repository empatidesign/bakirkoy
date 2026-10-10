using Nexora.Infrastructure.Persistence;
using System.Globalization;
using System.Text.Json;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Surveys;
using Nexora.Application.Features.Surveys.Dtos;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Notifications.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Surveys;
using Nexora.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Infrastructure.Services;

public class SurveyService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IActivityLogger log,
    IAuditService audit,
    IModuleNotificationSettingsService moduleSettings,
    INotificationService notifications,
    INotificationDispatcher dispatcher,
    ISmsService sms,
    ISmsGovernanceService smsGovernance,
    AppDbContext db) : ISurveyService
{
    public async Task<ModuleManualMessageResultDto> SendManualMessageAsync(ModuleManualMessageRequest req, CancellationToken ct)
    {
        // BULGU (2026-09-21 uçtan uca test, K7 ile aynı desen): req.Ids null gönderildiğinde
        // NullReferenceException → çıplak 500 veriyordu. Bkz. CitizenSubmissionService.cs
        // aynı düzeltme notu.
        if (req.Ids is null || req.Ids.Count == 0) throw new ConflictException("En az bir kayıt seçmelisiniz.", "NO_TARGET");
        if (!req.Sms && !req.Notify) throw new ConflictException("En az bir kanal seçin.", "NO_CHANNEL");
        var responses = await uow.Surveys.GetResponsesBySurveyIdsAsync(req.Ids, ct);
        if (responses.Count == 0) return new ModuleManualMessageResultDto(0, 0, 0, false);
        var settings = await moduleSettings.GetAsync("survey", ct);
        var template = settings.NotificationTemplates?.FirstOrDefault(t => t.Event == req.TemplateEvent)
            ?? throw new ConflictException("Şablon bulunamadı.", "TEMPLATE_NOT_FOUND");

        // Şablon/validasyon geçtikten SONRA çağrılır: aksi halde başarısız bir
        // istek (ör. şablon bulunamadı) bile kullanıcının günlük SMS hakkını
        // gereksiz yere tüketirdi (2026-09-19 canlı testte tespit edildi).
        if (req.Sms) await smsGovernance.EnsureCanSendAsync("Survey", req.TemplateEvent, req.Ids.Count, req.SmsOtp, ct);
        var smsTemplate = string.IsNullOrWhiteSpace(req.CustomText) ? template.SmsBody : req.CustomText!;
        var notifyTemplate = string.IsNullOrWhiteSpace(req.CustomText) ? template.NotifyBody : req.CustomText!;
        var surveys = (await uow.Surveys.FindAsync(s => req.Ids.Contains(s.Id), ct)).ToDictionary(s => s.Id, s => s.Title);
        var participantIds = responses.Where(r => r.ParticipantId.HasValue).Select(r => r.ParticipantId!.Value).Distinct().ToList();
        var participants = (await uow.Participants.FindAsync(p => participantIds.Contains(p.Id), ct)).ToDictionary(p => p.Id, p => p);
        var recipients = 0; var smsSent = 0; var notifs = 0;
        foreach (var r in responses)
        {
            if (!r.ParticipantId.HasValue || !participants.TryGetValue(r.ParticipantId.Value, out var participant)) continue;
            recipients++;
            var vars = new Dictionary<string, string?> { ["anket"] = surveys.GetValueOrDefault(r.SurveyId) };
            if (req.Notify && template.NotifyEnabled) { await notifications.CreateAsync(participant.Id, "Anket", ModuleMessageRenderer.Render(notifyTemplate, participant.FullName, vars), "survey-manual", ct); notifs++; }
            if (req.Sms && template.SmsEnabled && !string.IsNullOrWhiteSpace(participant.Phone))
            { try { if (await dispatcher.SendSmsAsync(participant.Phone!, ModuleMessageRenderer.Render(smsTemplate, participant.FullName, vars), ct)) smsSent++; } catch (Exception ex) { log.LogStepResult("SurveyManualSmsFailed", new { participant.Id, ex.Message }); } }
        }
        return new ModuleManualMessageResultDto(recipients, smsSent, notifs, req.Sms && smsSent > 0 && sms.IsMockMode);
    }
    public async Task<PagedResult<SurveyDto>> GetPagedAsync(SurveyListParams p, CancellationToken ct)
    {
        p = await ApplySurveyUserScopeAsync(p, ct);
        var paged = await uow.Surveys.GetPagedAsync(p, ct);
        var counts = await uow.Surveys.GetResponseCountsAsync(paged.Items.Select(s => s.Id).ToList(), ct);
        return new PagedResult<SurveyDto>
        {
            Items = paged.Items.Select(s => ToDto(s, counts.GetValueOrDefault(s.Id))).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    // Kullanıcı isteği (2026-09-01): "Anket Kullanıcısı" yetkisi SurveyOwnSurveysOnly
    // ile işaretliyse, listeleme çağıranın kimliğine göre otomatik olarak yalnızca kendi
    // oluşturduğu anketlerle sınırlandırılır — frontend'in bunu bilmesine/göndermesine
    // gerek yoktur, sızıntıya karşı sunucu tarafında zorunlu kılınır.
    private async Task<SurveyListParams> ApplySurveyUserScopeAsync(SurveyListParams p, CancellationToken ct)
    {
        if (currentUser.IsSuperAdmin || !currentUser.Id.HasValue) return p;
        var admin = await uow.AdminUsers.GetByIdAsync(currentUser.Id.Value, ct);
        if (admin is null || !admin.IsSurveyUser) return p;

        if (admin.SurveyOwnSurveysOnly) p = p with { CreatedByFilter = currentUser.Name };

        // Kullanıcı isteği (2026-09-01): "Geçmiş Anketleri Görsün mü" kapalıysa yalnızca
        // aktif/güncel anketler listelenir — tamamlanmış/arşiv anketler gizlenir. Çağıran
        // zaten belirli bir Status filtresi göndermişse (ör. "completed" görüntülemek
        // istiyorsa) buna dokunmayız; yalnızca hiç filtre yokken varsayılanı daraltırız.
        if (!admin.SurveyCanViewPastSurveys && string.IsNullOrWhiteSpace(p.Status))
            p = p with { ActiveWindowOnly = true, Status = "active" };

        return p;
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-01) + güvenlik açığı düzeltmesi: ApplySurveyUserScopeAsync
    /// yalnızca liste (GetPagedAsync) çağrısını filtreliyordu — "sadece kendi anketleri" veya
    /// "geçmiş anketleri göremez" kısıtlamasındaki bir kullanıcı, anketin ID'sini biliyorsa
    /// GET/PUT/DELETE/toggle/duplicate/questions/analytics/responses uçlarına doğrudan erişip
    /// listede görünmeyen anketleri görüntüleyebiliyor, hatta düzenleyip silebiliyordu. Bu
    /// metod tek bir anket kaydına erişimden önce çağrılır ve aynı kısıtlamayı uygular.
    /// </summary>
    private async Task EnsureSurveyAccessAsync(Survey survey, CancellationToken ct)
    {
        if (currentUser.IsSuperAdmin || !currentUser.Id.HasValue) return;
        var admin = await uow.AdminUsers.GetByIdAsync(currentUser.Id.Value, ct);
        if (admin is null || !admin.IsSurveyUser) return;

        if (admin.SurveyOwnSurveysOnly && !string.Equals(survey.CreatedBy, currentUser.Name, StringComparison.Ordinal))
            throw new ForbiddenException("Bu ankete erişim yetkiniz yok. Yalnızca kendi oluşturduğunuz anketleri görüntüleyebilirsiniz.", "SURVEY_NOT_OWNED");

        if (!admin.SurveyCanViewPastSurveys)
        {
            var isPast = survey.Status is "completed" or "archived"
                || (survey.EndDate.HasValue && survey.EndDate.Value < DateTime.UtcNow); // UAT 2026-09-24: alan UTC saklanır; duvar saati (UTC+3) ile kıyas pencereyi 3 saat kaydırıyordu
            if (isPast)
                throw new ForbiddenException("Bu ankete erişim yetkiniz yok. Geçmiş anketleri görüntüleme yetkiniz bulunmuyor.", "SURVEY_PAST_HIDDEN");
        }
    }
    public async Task<SurveySummaryDto> GetSummaryAsync(CancellationToken ct)
    {
        var (total, active, passive, draft, completed) = await uow.Surveys.GetSummaryCountsAsync(ct);
        var totalResponses = await uow.Surveys.GetTotalResponsesAsync(ct);
        var categoryDistribution = await uow.Surveys.GetCategoryDistributionAsync(ct);
        var recentSurveys = await uow.Surveys.GetRecentAsync(5, ct);
        var recentCounts = await uow.Surveys.GetResponseCountsAsync(recentSurveys.Select(s => s.Id).ToList(), ct);
        var recent = recentSurveys
            .Select(s => new SurveyRecentActivityDto(s.Id, s.Title, recentCounts.GetValueOrDefault(s.Id), s.CreatedAt)).ToList();

        // UYE-ANK-001: Bu metod önceden ortalama puan/tamamlanma oranı/aylık trend/memnuniyet
        // trendi için hep sabit 0/boş liste döndürüyordu — SurveyResponse.AnswersJson'daki
        // gerçek veriye hiç bakmıyordu. Aşağıda son 6 ayın tüm cevapları tek sorguda çekilip
        // (rating/scale/satisfaction/agreement/emoji_rating gibi sayısallaştırılabilir tipler
        // 0-1 ölçeğine normalize edilerek) gerçek ortalama ve trendler hesaplanıyor.
        var sixMonthsAgoTurkey = TurkeyTime.TodayDate().AddMonths(-5);
        var sixMonthsAgoUtc = TurkeyTime.ToUtc(new DateTime(sixMonthsAgoTurkey.Year, sixMonthsAgoTurkey.Month, 1));
        var recentAnswers = await uow.Surveys.GetResponseAnswersSinceAsync(sixMonthsAgoUtc, ct);
        var questionMeta = await uow.Surveys.GetQuestionMetaAsync(ct);
        var questionCounts = await uow.Surveys.GetQuestionCountsAsync(ct);

        var trCulture = new CultureInfo("tr-TR");
        var monthBuckets = new List<(DateTime Start, string Label)>();
        for (var i = 5; i >= 0; i--)
        {
            var m = TurkeyTime.TodayDate().AddMonths(-i);
            var start = new DateTime(m.Year, m.Month, 1);
            monthBuckets.Add((start, start.ToString("MMM yyyy", trCulture)));
        }

        var monthlyResponses = new List<SurveyMonthlyResponseDto>();
        var satisfactionTrends = new List<SurveySatisfactionTrendDto>();
        var allScores = new List<double>();
        var allCompletionRates = new List<double>();

        foreach (var (start, label) in monthBuckets)
        {
            var end = start.AddMonths(1);
            var bucketAnswers = recentAnswers
                .Where(r => TurkeyTime.ToTurkey(r.SubmittedAt) >= start && TurkeyTime.ToTurkey(r.SubmittedAt) < end)
                .ToList();

            monthlyResponses.Add(new SurveyMonthlyResponseDto(label, bucketAnswers.Count));

            var bucketScores = new List<double>();
            foreach (var r in bucketAnswers)
            {
                var (scores, answeredCount) = ScoreAndCoverage(r.AnswersJson, questionMeta);
                bucketScores.AddRange(scores);
                allScores.AddRange(scores);
                if (questionCounts.TryGetValue(r.SurveyId, out var qCount) && qCount > 0)
                    allCompletionRates.Add(100.0 * answeredCount / qCount);
            }
            satisfactionTrends.Add(new SurveySatisfactionTrendDto(label, bucketScores.Count > 0 ? Math.Round(bucketScores.Average() * 5, 1) : 0));
        }

        var averageRating = allScores.Count > 0 ? Math.Round(allScores.Average() * 5, 2) : 0;
        var averageCompletionRate = allCompletionRates.Count > 0 ? Math.Round(allCompletionRates.Average(), 1) : 0;

        return new SurveySummaryDto(
            total, active, passive, draft, completed,
            totalResponses, averageRating, averageCompletionRate,
            monthlyResponses, categoryDistribution, satisfactionTrends, recent);
    }

    /// <summary>
    /// Bir yanıtın AnswersJson'ını okuyup sayısallaştırılabilir sorulardaki 0-1 normalize skorları
    /// ve o yanıtın toplam cevaplanan soru sayısını (tamamlanma oranı için, tip fark etmeksizin) döner.
    /// Sadece sayısallaştırılabilir tipler (rating, scale, satisfaction, agreement, emoji_rating,
    /// yes_no, like_dislike) skor üretir; metin/çoktan seçmeli tipler skora dahil edilmez ama
    /// "cevaplanmış soru" sayımına (tamamlanma oranı) dahildir.
    /// </summary>
    private static (List<double> Scores, int AnsweredCount) ScoreAndCoverage(string answersJson, Dictionary<Guid, SurveyQuestion> questionMeta)
    {
        var raw = ParseAnswersJson(answersJson);
        var answeredCount = raw.Count(a => !string.IsNullOrWhiteSpace(a.Answer));
        var scores = new List<double>();
        foreach (var a in raw)
        {
            if (string.IsNullOrWhiteSpace(a.Answer)) continue;
            questionMeta.TryGetValue(a.QuestionId, out var question);
            var score = NormalizeScore(question, a.Answer);
            if (score.HasValue) scores.Add(score.Value);
        }
        return (scores, answeredCount);
    }

    /// <summary>0-1 aralığında normalize edilmiş skor. Sayısallaştırılamayan tipler için null.</summary>
    private static double? NormalizeScore(SurveyQuestion? question, string rawAnswer)
    {
        if (question is null) return null;
        switch (question.Type)
        {
            case "rating":
            {
                var max = question.RatingCount ?? 5;
                return int.TryParse(rawAnswer, out var v) && max > 0 ? Math.Clamp((double)v / max, 0, 1) : null;
            }
            case "emoji_rating":
                return int.TryParse(rawAnswer, out var e) ? Math.Clamp((e - 1) / 4.0, 0, 1) : null;
            case "satisfaction":
            case "agreement":
                return int.TryParse(rawAnswer, out var s) ? Math.Clamp((s - 1) / 4.0, 0, 1) : null;
            case "scale":
            {
                var min = question.ScaleMin ?? 1;
                var max = question.ScaleMax ?? 10;
                if (max <= min) return null;
                return int.TryParse(rawAnswer, out var v) ? Math.Clamp((double)(v - min) / (max - min), 0, 1) : null;
            }
            case "yes_no":
                return rawAnswer.Trim().Equals("Evet", StringComparison.OrdinalIgnoreCase) ? 1.0 : 0.0;
            case "like_dislike":
                return rawAnswer.Trim().Equals("Beğendim", StringComparison.OrdinalIgnoreCase) ? 1.0 : 0.0;
            default:
                return null;
        }
    }

    public async Task<SurveyDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var survey = await uow.Surveys.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");
        await EnsureSurveyAccessAsync(survey, ct);
        return await ToDtoWithCountAsync(survey, ct);
    }

    public async Task<SurveyDto> CreateAsync(CreateSurveyRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Title });

        var status = req.IsActive ? "active" : "draft";
        var survey = Survey.Create(ToData(req, status), currentUser.Name);
        survey.ReplaceQuestions(BuildQuestions(survey.Id, req.Questions));

        await uow.Surveys.AddAsync(survey, ct);
        await uow.SaveChangesAsync(ct);

        var dto = ToDto(survey, 0);
        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Survey",
            EntityId = survey.Id,
            Module = "Surveys",
            Description = $"Anket oluşturuldu: {survey.Title}",
            NewValues = JsonSerializer.Serialize(dto),
        }, ct);

        return dto;
    }

    public async Task<SurveyDto> UpdateAsync(Guid id, UpdateSurveyRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var survey = await uow.Surveys.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");
        await EnsureSurveyAccessAsync(survey, ct);

        var responseCount = await uow.Surveys.CountResponsesAsync(id, ct);
        var oldValues = JsonSerializer.Serialize(ToDto(survey, responseCount));

        var status = req.IsActive
            ? (survey.Status is "completed" or "archived" ? survey.Status : "active")
            : "draft";

        survey.Update(ToData(req, status), currentUser.Name);

        var questions = BuildQuestions(survey.Id, req.Questions);
        await uow.Surveys.ReplaceQuestionsAsync(survey.Id, questions, ct);
        survey.SetQuestionCount(questions.Count);

        uow.Surveys.Update(survey);
        await uow.SaveChangesAsync(ct);

        var dto = ToDto(survey, responseCount);
        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Survey",
            EntityId = survey.Id,
            Module = "Surveys",
            Description = $"Anket güncellendi: {survey.Title}",
            OldValues = oldValues,
            NewValues = JsonSerializer.Serialize(dto),
        }, ct);

        return dto;
    }

    public async Task<SurveyDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var survey = await uow.Surveys.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");
        await EnsureSurveyAccessAsync(survey, ct);

        if (survey.IsActive)
        {
            survey.Deactivate();
            survey.SetStatus("draft");
        }
        else
        {
            survey.Activate();
            if (survey.Status is not ("completed" or "archived"))
                survey.SetStatus("active");
        }

        uow.Surveys.Update(survey);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Survey",
            EntityId = survey.Id,
            Module = "Surveys",
            Description = $"Anket durumu değişti: {survey.Title} → {(survey.IsActive ? "Aktif" : "Pasif")}",
        }, ct);

        return await ToDtoWithCountAsync(survey, ct);
    }

    public async Task<SurveyDto> DuplicateAsync(Guid id, CancellationToken ct)
    {
        var survey = await uow.Surveys.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");
        await EnsureSurveyAccessAsync(survey, ct);
        var questions = await uow.Surveys.GetQuestionsAsync(id, ct);

        var copy = Survey.Create(new SurveyData(
            $"{survey.Title} (Kopya)", survey.Description, survey.Category, survey.TargetAudience,
            survey.StartDate, survey.EndDate, survey.EstimatedDuration, "draft",
            false, survey.IsAnonymous, survey.AllowMultipleResponses, survey.ShowResults,
            survey.AutoSendAfterEvent, survey.SendReminderSMS, null, null, survey.IsRequired,
            survey.SurveyType, survey.IdentityMode, survey.Topic, survey.TargetNeighborhoods,
            survey.TargetResponseCount, survey.FieldEnabled, survey.RequireLocation), currentUser.Name);

        var copyQuestions = questions.Select((q, i) => SurveyQuestion.Create(
            copy.Id, i, q.Type, q.Question, q.Description, q.Required, q.Options,
            q.ScaleMin, q.ScaleMax, q.MinLabel, q.MaxLabel, q.RatingCount)).ToList();
        copy.ReplaceQuestions(copyQuestions);

        await uow.Surveys.AddAsync(copy, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Survey",
            EntityId = copy.Id,
            Module = "Surveys",
            Description = $"Anket kopyalandı: {copy.Title}",
        }, ct);

        return ToDto(copy, 0);
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-01): "silmek icin mutlaka silmek istiyorum onay gibi birşey
    /// yazıp silmek lazım cünkü birsürü data gider bunun önelimni alt ayrıca silmek süper
    /// yönetici yapbilir". Anket silindiğinde ankete verilmiş TÜM yanıtlar da yok olur; bu
    /// nedenle iki katmanlı koruma uygulanır:
    ///   1) Yalnızca süper yönetici silebilir (survey.delete izni tek başına yetmez).
    ///   2) İstek gövdesinde "silmek istiyorum" onay metni birebir gönderilmelidir.
    /// </summary>
    public async Task<SurveyDeleteImpactDto> GetDeleteImpactAsync(Guid id, CancellationToken ct)
    {
        var survey = await uow.Surveys.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");
        await EnsureSurveyAccessAsync(survey, ct);

        var responseCount = await uow.Surveys.CountResponsesAsync(id, ct);
        var questions = await uow.Surveys.GetQuestionsAsync(id, ct);
        var fieldTaskCount = await db.SurveyFieldTasks.AsNoTracking()
            .CountAsync(t => t.SurveyId == id && !t.IsDeleted, ct);

        return new SurveyDeleteImpactDto(
            survey.Id, survey.Title, responseCount, questions.Count, fieldTaskCount,
            currentUser.IsSuperAdmin, SurveyDeleteRules.ConfirmationPhrase);
    }

    public async Task DeleteAsync(Guid id, SurveyDeleteRequest req, CancellationToken ct)
    {
        var survey = await uow.Surveys.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");
        await EnsureSurveyAccessAsync(survey, ct);

        if (!currentUser.IsSuperAdmin)
            throw new ForbiddenException(
                "Anket silme yetkisi yalnızca süper yöneticidedir. Anketi pasife alabilirsiniz.",
                "SURVEY_DELETE_SUPERADMIN_ONLY");

        if (!SurveyDeleteRules.IsConfirmed(req?.Confirmation))
            throw new ConflictException(
                $"Silme işlemini onaylamak için \"{SurveyDeleteRules.ConfirmationPhrase}\" yazmalısınız.",
                "SURVEY_DELETE_CONFIRMATION_REQUIRED");

        var responseCount = await uow.Surveys.CountResponsesAsync(id, ct);

        uow.Surveys.Delete(survey);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "Survey",
            EntityId = survey.Id,
            Module = "Surveys",
            Description = $"Anket silindi: {survey.Title} (silinen yanıt sayısı: {responseCount})",
        }, ct);
    }

    public async Task<List<SurveyQuestionDto>> GetQuestionsAsync(Guid surveyId, CancellationToken ct)
    {
        var survey = await uow.Surveys.GetByIdAsync(surveyId, ct)
            ?? throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");
        await EnsureSurveyAccessAsync(survey, ct);

        var questions = await uow.Surveys.GetQuestionsAsync(surveyId, ct);
        return questions.Select(ToQuestionDto).ToList();
    }

    public async Task<SurveyAnalyticsDto> GetAnalyticsAsync(Guid surveyId, CancellationToken ct)
    {
        var survey = await uow.Surveys.GetByIdAsync(surveyId, ct)
            ?? throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");
        await EnsureSurveyAccessAsync(survey, ct);
        var questions = await uow.Surveys.GetQuestionsAsync(surveyId, ct);
        var responses = await uow.Surveys.GetAllResponsesAsync(surveyId, ct);
        var responseCount = responses.Count;

        // UYE-ANK-001: Bu metod önceden her soru için TotalAnswers=0/AverageScore=null/boş
        // dağılım döndürüyordu — AnswersJson hiç okunmuyordu. Şimdi her yanıtın AnswersJson'ı
        // parse edilip soru bazında gerçek sayım/ortalama/dağılım hesaplanıyor.
        var parsedResponses = responses.Select(r => ParseAnswersJson(r.AnswersJson)).ToList();

        // Kullanıcı isteği (2026-09-03): "hangi soruya hangi mahalle ne cevap vermiş" —
        // her yanıtı, ait olduğu mahalle ile birlikte tutuyoruz ki soru bazında mahalle
        // kırılımı hesaplanabilsin. Mahallesi boş olan yanıtlar kırılıma dahil edilmez.
        var responsesWithNeighborhood = responses
            .Select((r, i) => (Neighborhood: string.IsNullOrWhiteSpace(r.Neighborhood) ? null : r.Neighborhood.Trim(), Answers: parsedResponses[i]))
            .ToList();

        var questionAnalytics = questions.Select(q =>
        {
            var answersForQuestion = parsedResponses
                .SelectMany(a => a)
                .Where(a => a.QuestionId == q.Id && !string.IsNullOrWhiteSpace(a.Answer))
                .Select(a => a.Answer)
                .ToList();

            var totalAnswers = answersForQuestion.Count;

            double? averageScore = null;
            var numericScores = answersForQuestion
                .Select(ans => NormalizeScore(q, ans))
                .Where(s => s.HasValue)
                .Select(s => s!.Value)
                .ToList();
            if (numericScores.Count > 0)
            {
                averageScore = q.Type switch
                {
                    "rating" => Math.Round(numericScores.Average() * (q.RatingCount ?? 5), 2),
                    "scale" => Math.Round((q.ScaleMin ?? 1) + numericScores.Average() * ((q.ScaleMax ?? 10) - (q.ScaleMin ?? 1)), 2),
                    "emoji_rating" or "satisfaction" or "agreement" => Math.Round(1 + numericScores.Average() * 4, 2),
                    _ => Math.Round(numericScores.Average() * 100, 1),
                };
            }

            var distribution = BuildDistribution(q, answersForQuestion);

            List<string>? textSamples = null;
            if (q.Type == "text")
            {
                textSamples = answersForQuestion
                    .Where(a => a.Trim().Length > 0)
                    .OrderByDescending(a => a.Length)
                    .Take(5)
                    .ToList();
            }

            // Kullanıcı isteği (2026-09-03): bu sorunun MAHALLE BAZLI kırılımı. Her mahalle
            // için o soruya verilen cevapların dağılımı ve (sayısal sorularda) ortalaması
            // ayrı ayrı hesaplanır. En çok yanıtı olan mahalle üstte listelenir.
            var neighborhoodBreakdown = responsesWithNeighborhood
                .Where(rn => rn.Neighborhood is not null)
                .GroupBy(rn => rn.Neighborhood!)
                .Select(g =>
                {
                    var hoodAnswers = g
                        .SelectMany(rn => rn.Answers)
                        .Where(a => a.QuestionId == q.Id && !string.IsNullOrWhiteSpace(a.Answer))
                        .Select(a => a.Answer)
                        .ToList();
                    if (hoodAnswers.Count == 0) return null;

                    double? hoodAvg = null;
                    var hoodScores = hoodAnswers
                        .Select(ans => NormalizeScore(q, ans))
                        .Where(s => s.HasValue)
                        .Select(s => s!.Value)
                        .ToList();
                    double? hoodPositivity = null;
                    if (hoodScores.Count > 0)
                    {
                        hoodAvg = q.Type switch
                        {
                            "rating" => Math.Round(hoodScores.Average() * (q.RatingCount ?? 5), 2),
                            "scale" => Math.Round((q.ScaleMin ?? 1) + hoodScores.Average() * ((q.ScaleMax ?? 10) - (q.ScaleMin ?? 1)), 2),
                            "emoji_rating" or "satisfaction" or "agreement" => Math.Round(1 + hoodScores.Average() * 4, 2),
                            _ => Math.Round(hoodScores.Average() * 100, 1),
                        };
                        // 0-100 normalize memnuniyet skoru (grafik karşılaştırması için tek ölçek).
                        hoodPositivity = Math.Round(hoodScores.Average() * 100, 1);
                    }

                    return new SurveyQuestionNeighborhoodBreakdownDto(
                        g.Key, hoodAnswers.Count, hoodAvg, BuildDistribution(q, hoodAnswers), hoodPositivity);
                })
                .Where(x => x is not null)
                .Select(x => x!)
                .OrderByDescending(x => x.TotalAnswers)
                .ThenBy(x => x.Neighborhood, StringComparer.Ordinal)
                .ToList();

            return new SurveyQuestionAnalyticsDto(q.Id, q.Order, q.Question, q.Type, totalAnswers, averageScore, distribution, textSamples, neighborhoodBreakdown, BuildAssessment(numericScores));
        }).ToList();

        var allNumericScores = questions
            .SelectMany(q => parsedResponses.SelectMany(a => a)
                .Where(a => a.QuestionId == q.Id && !string.IsNullOrWhiteSpace(a.Answer))
                .Select(a => NormalizeScore(q, a.Answer)))
            .Where(s => s.HasValue)
            .Select(s => s!.Value)
            .ToList();
        var averageRating = allNumericScores.Count > 0 ? Math.Round(allNumericScores.Average() * 5, 2) : 0;

        var questionCount = questions.Count;
        var completionRates = parsedResponses
            .Where(_ => questionCount > 0)
            .Select(a => 100.0 * a.Count(x => !string.IsNullOrWhiteSpace(x.Answer)) / questionCount)
            .ToList();
        var completionRate = completionRates.Count > 0 ? Math.Round(completionRates.Average(), 1) : 0;

        SurveyDemographicsDto? demographics = null;
        if (!survey.IsAnonymous)
        {
            var participantIds = responses.Where(r => r.ParticipantId.HasValue).Select(r => r.ParticipantId!.Value).Distinct().ToList();
            if (participantIds.Count > 0)
            {
                var participants = await uow.Participants.FindAsync(x => participantIds.Contains(x.Id), ct);
                demographics = BuildDemographics(participants);
            }
        }

        return new SurveyAnalyticsDto(
            survey.Id, survey.Title, responseCount, completionRate, averageRating, survey.EstimatedDuration,
            survey.IsAnonymous, questionAnalytics, demographics);
    }

    // Kullanıcı isteği (2026-09-03): "her sorunun genel ortalamasını ve sorun tespiti olsun,
    // bunu da global anket değerlendirme kıstaslarına göre olsun." Sorunun tüm yanıtlarından
    // türetilen 0-1 olumluluk skorlarının ortalaması %0-100 memnuniyet skoruna çevrilir ve
    // yaygın CSAT/memnuniyet eşiklerine göre seviye + otomatik sorun tespiti üretilir.
    // Skorlanamayan (serbest metin, saf çoktan seçmeli vb.) sorularda null döner.
    private static SurveyQuestionAssessmentDto? BuildAssessment(List<double> numericScores)
    {
        if (numericScores.Count == 0) return null;

        var score = Math.Round(numericScores.Average() * 100, 1);

        // Global memnuniyet/CSAT eşikleri (bkz. SurveyQuestionAssessmentDto yorumu).
        var (level, label, issue) = score switch
        {
            < 40 => ("critical", "Kritik", true),
            < 55 => ("weak", "Zayıf", true),
            < 70 => ("moderate", "Orta", false),
            < 85 => ("good", "İyi", false),
            _ => ("excellent", "Çok İyi", false),
        };

        var summary = level switch
        {
            "critical" => $"Kritik memnuniyet düzeyi (%{score:0.#}). Bu konu acil müdahale gerektiriyor; en olumsuz mahalleler önceliklendirilmeli.",
            "weak" => $"Düşük memnuniyet (%{score:0.#}). Belirgin bir sorun var; iyileştirme planı oluşturulmalı.",
            "moderate" => $"Orta düzey memnuniyet (%{score:0.#}). İyileştirmeye açık; olumsuz yanıt veren mahalleler incelenmeli.",
            "good" => $"İyi memnuniyet düzeyi (%{score:0.#}). Genel tablo olumlu, mevcut hizmet korunmalı.",
            _ => $"Çok yüksek memnuniyet (%{score:0.#}). Bu alan güçlü; iyi uygulama olarak örnek alınabilir.",
        };

        return new SurveyQuestionAssessmentDto(score, level, label, issue, summary);
    }

    private static List<SurveyAnswerDistributionDto> BuildDistribution(SurveyQuestion q, List<string> answers)
    {
        if (answers.Count == 0) return [];

        // Hata #13: checkbox cevapları artık JSON dizisi olarak saklanıyor (bkz. ParseCheckboxAnswer);
        // eski virgülle-ayrılmış kayıtlar için de geriye uyumlu okuma yapılıyor.
        IEnumerable<string> flat = q.Type == "checkbox"
            ? answers.SelectMany(SurveyAnswerFormatting.ParseCheckboxAnswer)
            : answers;

        Dictionary<string, int> counts;
        switch (q.Type)
        {
            case "multiple_choice":
            case "checkbox":
                counts = flat.GroupBy(x => x).ToDictionary(g => g.Key, g => g.Count());
                break;
            case "yes_no":
                counts = flat.GroupBy(x => x).ToDictionary(g => g.Key, g => g.Count());
                break;
            case "like_dislike":
                counts = flat.GroupBy(x => x).ToDictionary(g => g.Key, g => g.Count());
                break;
            case "satisfaction":
                counts = flat.GroupBy(x => x).ToDictionary(g => LabelFromIndex(g.Key, SatisfactionLabels), g => g.Count());
                break;
            case "agreement":
                counts = flat.GroupBy(x => x).ToDictionary(g => LabelFromIndex(g.Key, AgreementLabels), g => g.Count());
                break;
            case "emoji_rating":
                counts = flat.GroupBy(x => x).ToDictionary(g => EmojiFromIndex(g.Key), g => g.Count());
                break;
            case "rating":
                counts = flat.GroupBy(x => x).ToDictionary(g => $"{g.Key} yıldız", g => g.Count());
                break;
            case "scale":
                counts = flat.GroupBy(x => x).ToDictionary(g => g.Key, g => g.Count());
                break;
            default:
                return [];
        }

        var total = counts.Values.Sum();
        if (total == 0) return [];

        return counts
            .OrderByDescending(kv => kv.Value)
            .Select(kv => new SurveyAnswerDistributionDto(kv.Key, kv.Value, Math.Round(100.0 * kv.Value / total, 1)))
            .ToList();
    }

    private static SurveyDemographicsDto BuildDemographics(List<Domain.Entities.Participants.Participant> participants)
    {
        var now = TurkeyTime.TodayDate();
        int Age(DateTime b) { var a = now.Year - b.Year; if (b.Date > now.AddYears(-a)) a--; return a; }
        string Bucket(int a) => a switch
        {
            <= 12 => "0-12", <= 17 => "13-17", <= 25 => "18-25",
            <= 40 => "26-40", <= 60 => "41-60", _ => "60+",
        };
        var order = new[] { "0-12", "13-17", "18-25", "26-40", "41-60", "60+" };

        var ageCounts = participants
            .GroupBy(p => Bucket(Age(p.BirthDate)))
            .ToDictionary(g => g.Key, g => g.Count());
        var totalAge = Math.Max(1, participants.Count);
        var ageGroups = order
            .Where(o => ageCounts.ContainsKey(o))
            .Select(o => new SurveyAnswerDistributionDto(o, ageCounts[o], Math.Round(100.0 * ageCounts[o] / totalAge, 1)))
            .ToList();

        var male = participants.Count(p => p.Gender == Gender.Male);
        var female = participants.Count(p => p.Gender == Gender.Female);
        var unknown = participants.Count - male - female;
        var totalGender = Math.Max(1, participants.Count);
        var genders = new List<SurveyAnswerDistributionDto>();
        if (male > 0) genders.Add(new SurveyAnswerDistributionDto("Erkek", male, Math.Round(100.0 * male / totalGender, 1)));
        if (female > 0) genders.Add(new SurveyAnswerDistributionDto("Kadın", female, Math.Round(100.0 * female / totalGender, 1)));
        if (unknown > 0) genders.Add(new SurveyAnswerDistributionDto("Bilinmiyor", unknown, Math.Round(100.0 * unknown / totalGender, 1)));

        return new SurveyDemographicsDto(ageGroups, genders);
    }

    public async Task<PagedResult<SurveyResponseListItemDto>> GetResponsesAsync(Guid surveyId, SurveyResponseListParams p, CancellationToken ct)
    {
        var survey = await uow.Surveys.GetByIdAsync(surveyId, ct)
            ?? throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");
        await EnsureSurveyAccessAsync(survey, ct);

        var (responses, total) = await uow.Surveys.GetResponsesPagedAsync(surveyId, p.PageResolved, p.LimitResolved, ct);
        var questions = await uow.Surveys.GetQuestionsAsync(surveyId, ct);
        var questionsById = questions.ToDictionary(q => q.Id);

        var hideIdentity = await ShouldHideParticipantIdentityAsync(ct);
        var participantsById = hideIdentity ? [] : await LoadParticipantsAsync(survey, responses, ct);

        var items = responses.Select(r => ToResponseDto(r, survey, questionsById, questions.Count, participantsById, hideIdentity)).ToList();

        return new PagedResult<SurveyResponseListItemDto>
        {
            Items = items,
            Total = total,
            Page = p.PageResolved,
            Limit = p.LimitResolved,
        };
    }

    public async Task<SurveyResponseListItemDto> GetResponseByIdAsync(Guid surveyId, Guid responseId, CancellationToken ct)
    {
        var survey = await uow.Surveys.GetByIdAsync(surveyId, ct)
            ?? throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");
        await EnsureSurveyAccessAsync(survey, ct);

        var response = await uow.Surveys.GetResponseByIdAsync(surveyId, responseId, ct)
            ?? throw new NotFoundException("Yanıt bulunamadı.", "SURVEY_RESPONSE_NOT_FOUND");

        var questions = await uow.Surveys.GetQuestionsAsync(surveyId, ct);
        var questionsById = questions.ToDictionary(q => q.Id);

        var hideIdentity = await ShouldHideParticipantIdentityAsync(ct);
        var participantsById = hideIdentity ? [] : await LoadParticipantsAsync(survey, [response], ct);

        return ToResponseDto(response, survey, questionsById, questions.Count, participantsById, hideIdentity);
    }

    // Doküman 07 §9 (Anketör yalnızca atanmış anketi görür, eski katılımcı listesini görmez) /
    // kullanıcı isteği (2026-09-01): "Anket Kullanıcısı" yetkisinde SurveyCanViewParticipants
    // kapalıysa, anket anonim olmasa dahi bireysel yanıt ekranında katılımcı kimliği
    // (ad, TC) gösterilmez — SuperAdmin ve normal (Anket Kullanıcısı olmayan) yöneticiler
    // bu kısıtlamadan etkilenmez.
    private async Task<bool> ShouldHideParticipantIdentityAsync(CancellationToken ct)
    {
        if (currentUser.IsSuperAdmin || !currentUser.Id.HasValue) return false;
        var admin = await uow.AdminUsers.GetByIdAsync(currentUser.Id.Value, ct);
        return admin is not null && admin.IsSurveyUser && !admin.SurveyCanViewParticipants;
    }

    private async Task<Dictionary<Guid, Domain.Entities.Participants.Participant>> LoadParticipantsAsync(
        Survey survey, IEnumerable<SurveyResponse> responses, CancellationToken ct)
    {
        // Anket anonim ise gerçek kimliği asla açığa çıkarmayız — katılımcı kaydı hiç çekilmez.
        if (survey.IsAnonymous) return [];

        var participantIds = responses.Where(r => r.ParticipantId.HasValue).Select(r => r.ParticipantId!.Value).Distinct().ToList();
        if (participantIds.Count == 0) return [];

        var participants = await uow.Participants.FindAsync(x => participantIds.Contains(x.Id), ct);
        return participants.ToDictionary(x => x.Id);
    }

    private static readonly string[] SatisfactionLabels = ["Çok Kötü", "Kötü", "Orta", "İyi", "Çok İyi"];
    private static readonly string[] AgreementLabels = ["Kesinlikle Hayır", "Hayır", "Kararsız", "Evet", "Kesinlikle Evet"];
    private static readonly string[] EmojiLabels = ["😢", "😕", "😐", "🙂", "😄"];

    private record RawAnswerJson(Guid QuestionId, string Answer);

    private static SurveyResponseListItemDto ToResponseDto(
        SurveyResponse response,
        Survey survey,
        Dictionary<Guid, SurveyQuestion> questionsById,
        int totalQuestionCount,
        Dictionary<Guid, Domain.Entities.Participants.Participant> participantsById,
        bool hideIdentity = false)
    {
        string? responderName = null;
        string? responderTcLast4 = null;
        string? anonymousLabel = null;

        if (survey.IsAnonymous || hideIdentity)
        {
            // Kimliksiz, stabil bir etiket: response.Id'den türetilir, gerçek kişiyle asla eşlenemez.
            var seed = Math.Abs(BitConverter.ToInt32(response.Id.ToByteArray(), 0)) % 100000;
            anonymousLabel = $"Anonim #{seed:D5}";
        }
        else if (response.ParticipantId.HasValue && participantsById.TryGetValue(response.ParticipantId.Value, out var participant))
        {
            responderName = participant.FullName;
            responderTcLast4 = participant.Tckn.Length >= 4 ? participant.Tckn[^4..] : participant.Tckn;
        }
        else if (!string.IsNullOrWhiteSpace(response.CitizenTc))
        {
            responderTcLast4 = response.CitizenTc.Length >= 4 ? response.CitizenTc[^4..] : response.CitizenTc;
        }

        var rawAnswers = ParseAnswersJson(response.AnswersJson);
        var answers = rawAnswers.Select(a =>
        {
            questionsById.TryGetValue(a.QuestionId, out var question);
            return new SurveyResponseAnswerDto(
                a.QuestionId,
                question?.Question ?? "(Soru silinmiş)",
                question?.Type ?? "text",
                a.Answer,
                FormatAnswerDisplay(question, a.Answer));
        }).ToList();

        return new SurveyResponseListItemDto(
            response.Id,
            response.SurveyId,
            survey.IsAnonymous,
            responderName,
            responderTcLast4,
            anonymousLabel,
            response.SubmittedAt,
            answers.Count,
            totalQuestionCount,
            answers);
    }

    private static List<RawAnswerJson> ParseAnswersJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<RawAnswerJson>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static string FormatAnswerDisplay(SurveyQuestion? question, string rawAnswer)
    {
        if (string.IsNullOrWhiteSpace(rawAnswer)) return "(boş)";

        return question?.Type switch
        {
            "checkbox" => string.Join(", ", SurveyAnswerFormatting.ParseCheckboxAnswer(rawAnswer)),
            "satisfaction" => LabelFromIndex(rawAnswer, SatisfactionLabels),
            "agreement" => LabelFromIndex(rawAnswer, AgreementLabels),
            "emoji_rating" => EmojiFromIndex(rawAnswer),
            "rating" => int.TryParse(rawAnswer, out var stars) ? $"{stars} / {question.RatingCount ?? 5} ⭐" : rawAnswer,
            "scale" => question.ScaleMin.HasValue && question.ScaleMax.HasValue
                ? $"{rawAnswer} (Ölçek: {question.ScaleMin}-{question.ScaleMax})"
                : rawAnswer,
            _ => rawAnswer,
        };
    }

    private static string LabelFromIndex(string rawAnswer, string[] labels)
        => int.TryParse(rawAnswer, out var idx) && idx >= 1 && idx <= labels.Length ? labels[idx - 1] : rawAnswer;

    private static string EmojiFromIndex(string rawAnswer)
        => int.TryParse(rawAnswer, out var idx) && idx >= 1 && idx <= EmojiLabels.Length ? $"{EmojiLabels[idx - 1]} ({idx}/5)" : rawAnswer;

    private static List<SurveyQuestion> BuildQuestions(Guid surveyId, IEnumerable<SurveyQuestionRequest> requests)
        => requests.Select((q, i) => SurveyQuestion.Create(
            surveyId, i, q.Type, q.Question, q.Description, q.Required, q.Options,
            q.Config?.ScaleMin, q.Config?.ScaleMax, q.Config?.MinLabel, q.Config?.MaxLabel, q.Config?.RatingCount)).ToList();

    private static SurveyData ToData(CreateSurveyRequest r, string status)
        => new(r.Title, r.Description, r.Category, r.TargetAudience, r.StartDate, r.EndDate, r.EstimatedDuration, status,
            r.IsActive, r.IsAnonymous, r.AllowMultipleResponses, r.ShowResults, r.AutoSendAfterEvent, r.SendReminderSMS,
            r.SourceType, r.SourceId, r.IsRequired,
            r.SurveyType ?? "standard", r.IdentityMode ?? "identified", r.Topic,
            r.TargetNeighborhoods, r.TargetResponseCount, r.FieldEnabled, r.RequireLocation);

    private static SurveyData ToData(UpdateSurveyRequest r, string status)
        => new(r.Title, r.Description, r.Category, r.TargetAudience, r.StartDate, r.EndDate, r.EstimatedDuration, status,
            r.IsActive, r.IsAnonymous, r.AllowMultipleResponses, r.ShowResults, r.AutoSendAfterEvent, r.SendReminderSMS,
            r.SourceType, r.SourceId, r.IsRequired,
            r.SurveyType ?? "standard", r.IdentityMode ?? "identified", r.Topic,
            r.TargetNeighborhoods, r.TargetResponseCount, r.FieldEnabled, r.RequireLocation);

    private async Task<SurveyDto> ToDtoWithCountAsync(Survey s, CancellationToken ct)
        => ToDto(s, await uow.Surveys.CountResponsesAsync(s.Id, ct));

    // UYE-ANK-001: Survey.TotalResponses denormalize sayacı gerçek veriyle senkron olmadığı
    // (seed/toplu ekleme akışlarında hiç güncellenmediği) için artık çağıran taraf gerçek
    // COUNT sonucunu (responseCount) parametre olarak geçiriyor.
    private static SurveyDto ToDto(Survey s, int responseCount)
        => new(s.Id, s.Title, s.Description, s.Category, s.TargetAudience, s.StartDate, s.EndDate, s.EstimatedDuration,
            s.Status, s.IsActive, s.IsAnonymous, s.AllowMultipleResponses, s.ShowResults, s.AutoSendAfterEvent, s.SendReminderSMS,
            s.SourceType, s.SourceId, s.IsRequired,
            s.SurveyType, s.IdentityMode, s.Topic, s.TargetNeighborhoods, s.TargetResponseCount,
            s.FieldEnabled, s.RequireLocation,
            s.QuestionCount, responseCount, s.AverageRating, s.CreatedAt, s.UpdatedAt);

    private static SurveyQuestionDto ToQuestionDto(SurveyQuestion q)
        => new(q.Id, q.SurveyId, q.Order, q.Type, q.Question, q.Description, q.Required, q.Options,
            new SurveyQuestionConfigDto(q.ScaleMin, q.ScaleMax, q.MinLabel, q.MaxLabel, q.RatingCount));

    // Kullanıcı isteği (2026-09-20): Anketler > Genel Ayarlar — günlük opsiyonel anket
    // yanıtı limiti ve iki yanıt arası bekleme süresi. HasData migration seed'i sayesinde
    // kayıt DB'de her zaman mevcuttur; yine de null gelirse güvenli varsayılana düşülür.
    public async Task<SurveyGlobalSettingsDto> GetGlobalSettingsAsync(CancellationToken ct)
    {
        var settings = await uow.Surveys.GetGlobalSettingsAsync(ct);
        return ToGlobalSettingsDto(settings);
    }

    public async Task<SurveyGlobalSettingsDto> UpdateGlobalSettingsAsync(UpdateSurveyGlobalSettingsRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateGlobalSettingsAsync), new { req.MaxOptionalResponsesPerDay, req.MinMinutesBetweenOptionalResponses });

        var settings = await uow.Surveys.GetGlobalSettingsAsync(ct);
        if (settings is null)
        {
            settings = SurveyGlobalSettings.CreateDefault();
            await uow.Surveys.AddGlobalSettingsAsync(settings, ct);
        }

        settings.Update(req.MaxOptionalResponsesPerDay, req.MinMinutesBetweenOptionalResponses);
        uow.Surveys.UpdateGlobalSettings(settings);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = nameof(SurveyGlobalSettings),
            EntityId = settings.Id,
            Module = "Survey",
            Description = $"Anket genel ayarları güncellendi: günlük en fazla {settings.MaxOptionalResponsesPerDay} opsiyonel anket, "
                + $"yanıtlar arası en az {settings.MinMinutesBetweenOptionalResponses} dakika",
        }, ct);

        return ToGlobalSettingsDto(settings);
    }

    private static SurveyGlobalSettingsDto ToGlobalSettingsDto(SurveyGlobalSettings? s)
        => s is null
            ? new SurveyGlobalSettingsDto(2, 120, null)
            : new SurveyGlobalSettingsDto(s.MaxOptionalResponsesPerDay, s.MinMinutesBetweenOptionalResponses, s.UpdatedAt);
}
