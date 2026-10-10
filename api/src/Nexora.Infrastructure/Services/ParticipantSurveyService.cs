using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Nexora.Domain.Common;
using Nexora.Application.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Loyalty;
using Nexora.Application.Features.Loyalty.Requests;
using Nexora.Application.Features.Nvi;
using Nexora.Application.Features.ParticipantSurveys;
using Nexora.Application.Features.ParticipantSurveys.Dtos;
using Nexora.Application.Features.Surveys;
using Nexora.Application.Features.Surveys.Dtos;
using Nexora.Domain.Entities.Surveys;
using Nexora.Domain.Entities.Participants;
using Nexora.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using ValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Infrastructure.Services;

public partial class ParticipantSurveyService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    ILoyaltyService loyalty,
    IConfiguration config,
    AppDbContext db,
    INviService nvi,
    ISmsService sms,
    IAuditService audit) : IParticipantSurveyService
{
    // Kullanıcı isteği (2026-09-01): saha görevlisi olarak atanmış vatandaşlar giriş
    // yaptığında "Vatandaş Portalı / Anket Sistemi" seçim ekranı gösterilsin diye.
    public async Task<bool> HasActiveFieldAssignmentAsync(CancellationToken ct)
    {
        if (!currentUser.Id.HasValue) return false;
        return await db.SurveyFieldTasks.AsNoTracking().AnyAsync(t =>
            !t.IsDeleted &&
            t.InterviewerType == "participant" &&
            t.InterviewerId == currentUser.Id.Value &&
            (t.Status == "assigned" || t.Status == "in_progress"), ct);
    }

    public async Task<PagedResult<CitizenSurveyDto>> GetListAsync(CitizenSurveyListParams p, CancellationToken ct)
    {
        var paged = await uow.Surveys.GetPagedAsync(new SurveyListParams
        {
            Page = p.PageResolved.ToString(),
            Limit = p.LimitResolved.ToString(),
            Search = p.Search,
            Category = p.Category,
            IsActive = true,
            ActiveWindowOnly = true,
            // Kullanıcı isteği/gerçek bulgu (2026-08-12): açık bir sort verilmediyse
            // "citizen_priority" kullanılır — bkz. SurveyRepository.ApplySort.
            Sort = string.IsNullOrWhiteSpace(p.Sort) ? "citizen_priority" : p.Sort,
            Order = p.Order,
        }, ct);

        var (tckn, participantId) = await GetParticipantInfoAsync(ct);

        // Mahalle hedeflemesi için vatandaşın kayıtlı mahallesi gerekiyor (bkz. MatchesNeighborhood).
        var self = participantId.HasValue ? await uow.Participants.GetByIdAsync(participantId.Value, ct) : null;

        var respondedIds = !string.IsNullOrWhiteSpace(tckn)
            ? await uow.Surveys.GetRespondedSurveyIdsAsync(paged.Items.Select(s => s.Id).ToList(), tckn, ct)
            : new HashSet<Guid>();

        var items = new List<CitizenSurveyDto>();
        foreach (var s in paged.Items)
        {
            if (!MatchesNeighborhood(s, self)) continue;
            if (!await CheckAudienceAsync(s.TargetAudience, participantId, s.SourceId, ct)) continue;
            items.Add(ToDto(s, respondedIds.Contains(s.Id)));
        }

        return new PagedResult<CitizenSurveyDto>
        {
            Items = items,
            Total = items.Count,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<CitizenSurveyDetailDto> GetDetailAsync(Guid surveyId, CancellationToken ct)
    {
        var survey = await uow.Surveys.GetByIdAsync(surveyId, ct)
            ?? throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");

        if (!survey.IsActive)
            throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");

        // Liste ekranı ActiveWindowOnly ile EndDate < now olan anketleri gizliyor
        // (bkz. SurveyRepository.GetPagedAsync). Detay ucu aynı kontrolü yapmıyordu; bu da
        // vatandaşın süresi dolmuş bir anketi direkt linkle açıp soruları görebilmesine yol
        // açıyordu — sadece en sonda Submit() reddediyordu (SURVEY_EXPIRED). Liste ile detay
        // arasındaki bu tutarsızlık, vatandaşın zaman kaybetmesine neden oluyordu
        // (bkz. loyalty-ecosystem-audit-2026-08-04, canlı curl testiyle doğrulandı: expired
        // survey detail → 200, submit → 409 SURVEY_EXPIRED).
        // NOT (2026-09-21): karşılaştırma UTC'ye çevrildi — EndDate DB'de UTC saklanıyor,
        // TR yerel saatiyle (UTC+3) kıyaslamak anketi 3 saat erken "süresi dolmuş" sayıyordu.
        if (survey.EndDate.HasValue && survey.EndDate.Value < DateTime.UtcNow)
            throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");

        var (tckn, participantId) = await GetParticipantInfoAsync(ct);

        var self = participantId.HasValue ? await uow.Participants.GetByIdAsync(participantId.Value, ct) : null;

        // Mahalle hedeflemesi (I2 bulgusu): hedef dışı vatandaş detayı da görememeli,
        // aksi halde anket linki paylaşıldığında sorular sızar.
        if (!MatchesNeighborhood(survey, self))
            throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");

        if (!await CheckAudienceAsync(survey.TargetAudience, participantId, survey.SourceId, ct))
            throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");

        var questions = await uow.Surveys.GetQuestionsAsync(surveyId, ct);
        var responded = !string.IsNullOrWhiteSpace(tckn)
            && await uow.Surveys.ResponseExistsAsync(surveyId, tckn, ct);

        SourceContextDto? sourceContext = null;
        if (survey.SourceId.HasValue)
        {
            if (survey.SourceType == "Event")
            {
                var ev = await uow.Events.GetAnyByIdAsync(survey.SourceId.Value, ct);
                if (ev != null)
                {
                    var facName = ev.FacilityId.HasValue
                        ? (await uow.ServiceFacilities.GetByIdAsync(ev.FacilityId.Value, ct))?.Name
                        : null;
                    var hallName = ev.HallId.HasValue
                        ? (await uow.Halls.GetByIdAsync(ev.HallId.Value, ct))?.Name
                        : null;
                    sourceContext = new SourceContextDto("Event", ev.Name, ev.StartDate, ev.EndDate, facName, hallName, null);
                }
            }
            else if (survey.SourceType == "Travel")
            {
                var travel = await uow.Travels.GetAnyByIdAsync(survey.SourceId.Value, ct);
                if (travel != null)
                    sourceContext = new SourceContextDto("Travel", travel.Name, travel.StartDate, travel.EndDate, null, null, travel.Destination);
            }
            else if (survey.SourceType == "Facility")
            {
                var facility = await uow.Facilities.GetByIdAsync(survey.SourceId.Value, ct);
                if (facility != null)
                    sourceContext = new SourceContextDto(survey.SourceType, facility.Name, default, default, facility.Name, null, null);
            }
            // Kullanıcı isteği (2026-08-12): "Library" sourceType daha önce "Facility" ile aynı
            // kolda uow.Facilities'de arıyordu — ama kütüphaneler ayrı bir Libraries tablosunda
            // (Library entity), Facilities'de hiç satırı yok. Sonuç: kütüphaneye bağlı anketlerde
            // sourceContext her zaman null dönüyordu (yer/isim bilgisi hiç görünmüyordu). Doğru
            // tabloya (uow.Libraries) bakılıyor.
            else if (survey.SourceType == "Library")
            {
                var library = await uow.Libraries.GetByIdAsync(survey.SourceId.Value, ct);
                if (library != null)
                    sourceContext = new SourceContextDto(survey.SourceType, library.Name, default, default, library.Name, null, null);
            }
        }

        return new CitizenSurveyDetailDto(
            survey.Id, survey.Title, survey.Description, survey.Category,
            survey.Status, survey.IsAnonymous, survey.EstimatedDuration,
            survey.StartDate, survey.EndDate, responded, survey.IsRequired,
            questions
                .OrderBy(q => q.Order)
                .Select(q => new CitizenSurveyQuestionDto(
                    q.Id, q.Order, q.Type, q.Question, q.Description,
                    q.Required, q.Options, q.ScaleMin, q.ScaleMax,
                    q.MinLabel, q.MaxLabel, q.RatingCount))
                .ToList(),
            sourceContext,
            // 2026-09-23 test bulgusu: cooldown yalnızca zorunlu OLMAYAN, henüz yanıtlanmamış
            // anketler için anlamlıdır — zorunlu anketler zaten throttle'dan muaf, yanıtlanmış
            // anket ise zaten "Tamamlandı" olarak gösterilip tekrar açılmıyor.
            !responded && !survey.IsRequired ? await GetOptionalSurveyCooldownMinutesAsync(self, ct) : null,
            survey.AllowMultipleResponses,
            responded ? await GetMyAnswersAsync(surveyId, tckn!, ct) : null);
    }

    private async Task<List<CitizenSurveyAnswerDto>?> GetMyAnswersAsync(Guid surveyId, string tckn, CancellationToken ct)
    {
        var hashed = HashTckn(tckn);
        var answersJson = await db.SurveyResponses.AsNoTracking()
            .Where(r => r.SurveyId == surveyId && (r.CitizenTc == tckn || r.CitizenTc == hashed))
            .OrderByDescending(r => r.SubmittedAt)
            .Select(r => r.AnswersJson)
            .FirstOrDefaultAsync(ct);
        if (string.IsNullOrWhiteSpace(answersJson)) return null;
        return JsonSerializer.Deserialize<List<CitizenSurveyAnswerDto>>(
            answersJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }

    public async Task<CitizenSurveySubmitResultDto> SubmitAsync(Guid surveyId, CitizenSurveySubmitRequest req, CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var participant = await uow.Participants.GetByIdAsync(actorId, ct)
            ?? throw new NotFoundException("Vatandaş kaydı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var survey = await uow.Surveys.GetByIdAsync(surveyId, ct)
            ?? throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");

        if (!survey.IsActive)
            throw new ConflictException("Bu anket artık aktif değil.", "SURVEY_NOT_ACTIVE");

        // NOT (2026-09-21): EndDate/StartDate DB'de UTC saklanıyor; TR yerel saatiyle (UTC+3)
        // kıyaslamak aralığı 3 saat kaydırıyordu (liste/detay uçlarıyla aynı düzeltme).
        var now = DateTime.UtcNow;
        if (survey.EndDate.HasValue && survey.EndDate.Value < now)
            throw new ConflictException("Bu anketin yanıtlama süresi doldu.", "SURVEY_EXPIRED");
        if (survey.StartDate.HasValue && survey.StartDate.Value > now)
            throw new ConflictException("Bu anket henüz başlamadı.", "SURVEY_NOT_STARTED");

        // Mahalle hedeflemesi (I2 bulgusu): hedef dışı vatandaşın yanıtı kaydedilmemeli,
        // aksi halde mahalle bazlı anket sonuçları başka mahallelerin yanıtlarıyla kirlenir.
        if (!MatchesNeighborhood(survey, participant))
            throw new ForbiddenException(
                "Bu anket yalnızca belirli mahallelerde ikamet eden vatandaşlara yöneliktir.",
                "NEIGHBORHOOD_NOT_ELIGIBLE");

        if (!await CheckAudienceAsync(survey.TargetAudience, actorId, survey.SourceId, ct))
            throw new ForbiddenException("Bu ankete erişim izniniz yok.", "AUDIENCE_NOT_ELIGIBLE");

        // DÜZELTME (2026-09-27, KAPSAMLI ANKET TESTİ — canlı testte kanıtlandı): mükerrer-yanıt
        // kontrolü (ALREADY_RESPONDED) önceden yalnızca aşağıdaki transaction içinde, throttle
        // kontrolünden SONRA yapılıyordu. Sonuç: bir vatandaş zaten yanıtladığı, tekrar
        // doldurulamayan (AllowMultipleResponses=false) bir ankete tekrar denediğinde, gerçek
        // sorun "zaten yanıtladın" olmasına rağmen önce SURVEY_COOLDOWN_ACTIVE ("120 dakika sonra
        // tekrar deneyin") hatası alıyordu — 120 dakika beklese bile yine ALREADY_RESPONDED ile
        // reddedilecekti, yani mesaj kullanıcıyı anlamsız bir bekleyişe yönlendiriyordu (canlı
        // PoC: aynı opsiyonel anketi ikinci kez dolduran HAMZA, doğru mesaj yerine cooldown
        // mesajı aldı). Bu erken kontrol yalnızca UX netliği içindir — asıl yarış-durumu
        // koruması (advisory lock + transaction) aşağıda değişmeden duruyor.
        if (!survey.AllowMultipleResponses)
        {
            var earlyIdentity = survey.IsAnonymous ? HashTckn(participant.Tckn) : participant.Tckn;
            if (await uow.Surveys.ResponseExistsAsync(surveyId, earlyIdentity, ct))
                throw new ConflictException("Bu ankete zaten yanıt verdiniz.", "ALREADY_RESPONDED");
        }

        // Kullanıcı isteği (2026-09-20): "günde en fazla 2 anket, insanları yormadan" —
        // yalnızca OPSİYONEL (IsRequired=false) anketlere uygulanır. Zorunlu anketler
        // uygulamayı bloke ettiği için bu kısıtlamadan muaftır; onlar zaten kendi ayrı
        // 60dk'lık sunum temposuyla (LastMandatorySurveyPromptAt) seyrekleştirilir.
        if (!survey.IsRequired)
            await EnforceOptionalSurveyThrottleAsync(participant, ct);

        var questions = await uow.Surveys.GetQuestionsAsync(surveyId, ct);

        // FN_ANKET_ISLEVSEL_2026-08-31 (böl. 3.1): cevap içeriği hiç doğrulanmıyordu — rating
        // sorusuna 9/999/serbest metin gönderilip 201 ile kabul ediliyordu. Sonuç: admin
        // analitikte "999 yıldız" gibi anlamsız kategoriler ve ortalama hesabında Math.Clamp'in
        // sessizce kırptığı %14 sapma. Soru tipine göre girdi doğrulaması ekleniyor.
        ValidateAnswers(questions, req.Answers);

        var requiredQuestionIds = questions.Where(q => q.Required).Select(q => q.Id).ToHashSet();
        if (requiredQuestionIds.Count > 0)
        {
            var answeredIds = req.Answers
                .Where(a => !string.IsNullOrWhiteSpace(a.Answer))
                .Select(a => a.QuestionId)
                .ToHashSet();
            if (requiredQuestionIds.Except(answeredIds).Any())
                throw new ConflictException("Zorunlu sorular cevaplanmamış.", "REQUIRED_ANSWERS_MISSING");
        }

        var responseIdentity = survey.IsAnonymous ? HashTckn(participant.Tckn) : participant.Tckn;
        var responseParticipantId = survey.IsAnonymous ? (Guid?)null : actorId;

        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        SurveyResponse response;
        bool hadPriorResponse;
        try
        {
            await uow.AcquireAdvisoryLockAsync(SurveyResponseLockKey(surveyId, responseIdentity), ct);

            hadPriorResponse = await uow.Surveys.ResponseExistsAsync(surveyId, responseIdentity, ct);
            if (!survey.AllowMultipleResponses && hadPriorResponse)
                throw new ConflictException("Bu ankete zaten yanıt verdiniz.", "ALREADY_RESPONDED");

            var answersJson = JsonSerializer.Serialize(req.Answers.Select(a => new
            {
                questionId = a.QuestionId,
                answer = a.Answer,
            }));

            response = SurveyResponse.Create(surveyId, responseIdentity, responseParticipantId, answersJson);
            await uow.Surveys.AddResponseAsync(response, ct);
            survey.IncrementResponses();
            uow.Surveys.Update(survey);
            if (!survey.IsRequired)
            {
                participant.RecordOptionalSurveyResponse(TurkeyTime.TodayDate());
                uow.Participants.Update(participant);
            }
            await uow.SaveChangesAsync(ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        if (!hadPriorResponse)
            await loyalty.AwardPointsAsync(new AwardPointsRequest(participant.Id, "survey_complete", response.Id.ToString()), ct);

        return new CitizenSurveySubmitResultDto(response.Id, response.SubmittedAt);
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-20): admin panelden ayarlanabilir günlük opsiyonel anket
    /// limiti ve iki yanıt arası minimum bekleme süresi. Ayar kaydı yoksa güvenli varsayılan
    /// (günde 2, 120dk) kullanılır — bkz. SurveyGlobalSettings.CreateDefault.
    /// </summary>
    private async Task EnforceOptionalSurveyThrottleAsync(Participant participant, CancellationToken ct)
    {
        var settings = await uow.Surveys.GetGlobalSettingsAsync(ct);
        var maxPerDay = settings?.MaxOptionalResponsesPerDay ?? 2;

        if (maxPerDay > 0)
        {
            var todayCount = participant.OptionalSurveyResponsesForDay(TurkeyTime.TodayDate());
            if (todayCount >= maxPerDay)
                throw new ConflictException(
                    $"Bugün için anket yanıtlama hakkınızı doldurdunuz (günlük en fazla {maxPerDay} anket). Yarın tekrar deneyebilirsiniz.",
                    "SURVEY_DAILY_LIMIT_REACHED");
        }

        var (minMinutesBetween, waitMinutes) = ComputeOptionalSurveyCooldown(participant, settings);
        if (waitMinutes.HasValue)
            throw new ConflictException(
                $"Ardışık anketler arasında en az {minMinutesBetween} dakika beklemeniz gerekiyor. Yaklaşık {waitMinutes} dakika sonra tekrar deneyebilirsiniz.",
                "SURVEY_COOLDOWN_ACTIVE");
    }

    /// <summary>
    /// 2026-09-23 test bulgusu (Satır 87): vatandaş bir OPSİYONEL anketi ilk kez dolduruyor
    /// olsa da, cooldown başka bir opsiyonel ankette bıraktığı LastOptionalSurveyResponseAt
    /// yüzünden Submit() sırasında ("bu anketi daha önce hiç doldurmadım ama bekleme hatası
    /// çıktı" şikayetine yol açacak şekilde) aniden tetikleniyordu — kısıtlama kasıtlı olarak
    /// katılımcı bazlı (bkz. EnforceOptionalSurveyThrottleAsync yorumu), ama vatandaş bunu
    /// formu doldurmaya BAŞLAMADAN önce görmüyordu. GetDetailAsync artık bu değeri submit'e
    /// girmeden hesaplayıp dönerek istemcinin (SurveyDetailScreen) formu açmadan önce net bir
    /// uyarı göstermesini sağlıyor.
    /// </summary>
    private async Task<int?> GetOptionalSurveyCooldownMinutesAsync(Participant? participant, CancellationToken ct)
    {
        if (participant is null) return null;
        var settings = await uow.Surveys.GetGlobalSettingsAsync(ct);
        var (_, waitMinutes) = ComputeOptionalSurveyCooldown(participant, settings);
        return waitMinutes;
    }

    private static (int MinMinutesBetween, int? WaitMinutes) ComputeOptionalSurveyCooldown(
        Participant participant, SurveyGlobalSettings? settings)
    {
        var minMinutesBetween = settings?.MinMinutesBetweenOptionalResponses ?? 120;
        if (minMinutesBetween <= 0 || !participant.LastOptionalSurveyResponseAt.HasValue)
            return (minMinutesBetween, null);

        var nextEligibleAt = participant.LastOptionalSurveyResponseAt.Value.AddMinutes(minMinutesBetween);
        if (DateTime.UtcNow >= nextEligibleAt)
            return (minMinutesBetween, null);

        var waitMinutes = Math.Max(1, (int)Math.Ceiling((nextEligibleAt - DateTime.UtcNow).TotalMinutes));
        return (minMinutesBetween, waitMinutes);
    }

    private static long SurveyResponseLockKey(Guid surveyId, string tckn)
    {
        var combined = $"{surveyId}:{tckn}";
        var bytes = System.Text.Encoding.UTF8.GetBytes(combined);
        var hash = System.Security.Cryptography.SHA256.HashData(bytes);
        return BitConverter.ToInt64(hash, 0);
    }

    private static string HashTckn(string tckn)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(tckn.Trim());
        var hash = System.Security.Cryptography.SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    // FN_ANKET_ISLEVSEL_2026-08-31 (böl. 3.1): soru tipine göre cevap doğrulaması.
    // - rating/emoji_rating/satisfaction/agreement: 1..N (N = RatingCount ?? 5) tam sayı.
    // - scale: ScaleMin..ScaleMax (varsayılan 1..10) tam sayı.
    // - yes_no: sadece "Evet"/"Hayır".
    // - like_dislike: sadece "Beğendim"/"Beğenmedim".
    // - multiple_choice: tanımlı seçeneklerden biri (frontend'in "Diğer: <metin>" kalıbına izin
    //   verilir, ama yalnızca ankette gerçekten "Diğer..." ile başlayan bir seçenek varsa).
    // - checkbox: JSON dizisi (veya eski virgülle ayrılmış biçim), her öğe tanımlı seçeneklerden
    //   biri olmalı (aynı "Diğer" istisnası).
    // - text: boş değilse makul uzunluk sınırı + TextSafetyRules (HTML/markup artefaktı yasak) —
    //   ankette zaten kullanılan MustNotContainHtmlArtifacts deseniyle aynı kural seti.
    private const int TextAnswerMaxLength = 2000;

    private static void ValidateAnswers(List<SurveyQuestion> questions, List<CitizenSurveyAnswerDto> answers)
    {
        var questionMap = questions.ToDictionary(q => q.Id);
        var errors = new Dictionary<string, string[]>();

        foreach (var a in answers)
        {
            if (string.IsNullOrWhiteSpace(a.Answer)) continue;
            if (!questionMap.TryGetValue(a.QuestionId, out var q)) continue;

            var error = ValidateSingleAnswer(q, a.Answer.Trim());
            if (error is not null)
                errors[a.QuestionId.ToString()] = [error];
        }

        if (errors.Count > 0)
            throw new ValidationException("Bir veya daha fazla cevap geçersiz.", errors);
    }

    private static string? ValidateSingleAnswer(SurveyQuestion q, string answer)
    {
        switch (q.Type)
        {
            case "rating":
            {
                var max = q.RatingCount ?? 5;
                if (!int.TryParse(answer, out var v) || v < 1 || v > max)
                    return $"Bu soruya 1 ile {max} arasında bir puan verilmelidir.";
                return null;
            }
            case "emoji_rating":
            case "satisfaction":
            case "agreement":
            {
                if (!int.TryParse(answer, out var v) || v < 1 || v > 5)
                    return "Bu soruya 1 ile 5 arasında bir değer verilmelidir.";
                return null;
            }
            case "scale":
            {
                var min = q.ScaleMin ?? 1;
                var max = q.ScaleMax ?? 10;
                if (!int.TryParse(answer, out var v) || v < min || v > max)
                    return $"Bu soruya {min} ile {max} arasında bir değer verilmelidir.";
                return null;
            }
            case "yes_no":
            {
                if (answer != "Evet" && answer != "Hayır")
                    return "Bu soruya yalnızca \"Evet\" veya \"Hayır\" cevabı verilebilir.";
                return null;
            }
            case "like_dislike":
            {
                if (answer != "Beğendim" && answer != "Beğenmedim")
                    return "Bu soruya yalnızca \"Beğendim\" veya \"Beğenmedim\" cevabı verilebilir.";
                return null;
            }
            case "multiple_choice":
            {
                if (!IsValidChoice(q.Options, answer))
                    return "Bu soru için geçersiz bir seçenek gönderildi.";
                return null;
            }
            case "checkbox":
            {
                var selections = SurveyAnswerFormatting.ParseCheckboxAnswer(answer);
                if (selections.Count == 0)
                    return "En az bir seçenek seçilmelidir.";
                foreach (var s in selections)
                {
                    if (!IsValidChoice(q.Options, s))
                        return "Bu soru için geçersiz bir seçenek gönderildi.";
                }
                return null;
            }
            case "text":
            default:
            {
                if (answer.Length > TextAnswerMaxLength)
                    return $"Cevap {TextAnswerMaxLength} karakteri aşamaz.";
                if (!TextSafetyRules.IsFreeOfHtmlArtifacts(answer))
                    return $"Cevap{TextSafetyRules.ErrorMessageSuffix}";
                return null;
            }
        }
    }

    // Seçenek metinleri birebir eşleşmeli. Frontend'in "Diğer... (Belirtiniz)" seçeneği için
    // ürettiği "<seçenek>: <serbest metin>" kalıbına da izin verilir — ama yalnızca ankette
    // gerçekten "Diğer" ile başlayan bir seçenek tanımlıysa (SurveyFormModal.tsx isOtherOption).
    private static bool IsValidChoice(List<string> options, string value)
    {
        if (options.Contains(value)) return true;

        var otherOption = options.FirstOrDefault(o => o.Trim().StartsWith("Diğer", StringComparison.OrdinalIgnoreCase));
        if (otherOption is not null && value.StartsWith($"{otherOption}:", StringComparison.Ordinal))
            return true;

        return false;
    }

    public async Task<List<CitizenSurveyDto>> GetPendingAsync(CancellationToken ct)
    {
        var (tckn, participantId) = await GetParticipantInfoAsync(ct);
        if (!participantId.HasValue || string.IsNullOrWhiteSpace(tckn))
            return [];

        var now = DateTime.UtcNow; // UAT 2026-09-24: alan UTC saklanır; duvar saati (UTC+3) ile kıyas pencereyi 3 saat kaydırıyordu

        var linked = await uow.Surveys.FindAsync(
            s => s.IsActive
                && s.SourceType != null
                && s.SourceId != null
                && (s.EndDate == null || s.EndDate >= now),
            ct);

        var respondedIds = await uow.Surveys.GetRespondedSurveyIdsAsync(linked.Select(s => s.Id).ToList(), tckn, ct);

        var result = new List<CitizenSurveyDto>();
        foreach (var s in linked)
        {
            var requiredAudience = !string.IsNullOrWhiteSpace(s.TargetAudience) && s.TargetAudience != "all"
                ? s.TargetAudience
                : s.SourceType switch
                {
                    "Travel" => "travel_participants",
                    "Facility" => "facility_attendees",
                    "Library" => "facility_attendees",
                    _ => "event_attendees",
                };
            if (!await CheckAudienceAsync(requiredAudience, participantId, s.SourceId, ct)) continue;

            if (respondedIds.Contains(s.Id)) continue;

            SourceContextDto? sourceContext = null;
            if (s.SourceId.HasValue)
            {
                if (s.SourceType == "Event")
                {
                    var ev = await uow.Events.GetAnyByIdAsync(s.SourceId.Value, ct);
                    if (ev != null)
                    {
                        var facName = ev.FacilityId.HasValue
                            ? (await uow.ServiceFacilities.GetByIdAsync(ev.FacilityId.Value, ct))?.Name
                            : null;
                        var hallName = ev.HallId.HasValue
                            ? (await uow.Halls.GetByIdAsync(ev.HallId.Value, ct))?.Name
                            : null;
                        sourceContext = new SourceContextDto("Event", ev.Name, ev.StartDate, ev.EndDate, facName, hallName, null);
                    }
                }
                else if (s.SourceType == "Travel")
                {
                    var travel = await uow.Travels.GetAnyByIdAsync(s.SourceId.Value, ct);
                    if (travel != null)
                        sourceContext = new SourceContextDto("Travel", travel.Name, travel.StartDate, travel.EndDate, null, null, travel.Destination);
                }
                else if (s.SourceType == "Facility")
                {
                    var facility = await uow.Facilities.GetByIdAsync(s.SourceId.Value, ct);
                    if (facility != null)
                        sourceContext = new SourceContextDto(s.SourceType, facility.Name, default, default, facility.Name, null, null);
                }
                else if (s.SourceType == "Library")
                {
                    var library = await uow.Libraries.GetByIdAsync(s.SourceId.Value, ct);
                    if (library != null)
                        sourceContext = new SourceContextDto(s.SourceType, library.Name, default, default, library.Name, null, null);
                }
            }

            result.Add(ToDto(s, false, sourceContext));
        }

        return result;
    }

    public async Task<PendingSurveySummaryDto> GetPendingSummaryAsync(CancellationToken ct)
    {
        var pending = await GetPendingAsync(ct);
        var items = pending
            .Select(s => new PendingSurveyItemDto(s.Id, s.Title, s.IsRequired, s.SourceType, s.SourceContext?.Name))
            .ToList();
        var requiredCount = items.Count(i => i.IsRequired);

        Guid? nextEligible = null;
        if (requiredCount > 0 && currentUser.Id.HasValue)
        {
            var participant = await uow.Participants.GetByIdAsync(currentUser.Id.Value, ct);
            var minIntervalMinutes = config.GetValue("SurveySettings:MinMandatoryPromptIntervalMinutes", 60);
            var lastPrompt = participant?.LastMandatorySurveyPromptAt;
            var eligibleNow = !lastPrompt.HasValue
                || DateTime.UtcNow >= lastPrompt.Value.AddMinutes(minIntervalMinutes);
            if (eligibleNow)
                nextEligible = items.First(i => i.IsRequired).Id;
        }

        return new PendingSurveySummaryDto(items.Count, requiredCount, requiredCount > 0, items, nextEligible);
    }

    public async Task MarkMandatorySurveyPromptedAsync(CancellationToken ct)
    {
        if (!currentUser.Id.HasValue) return;
        var participant = await uow.Participants.GetByIdAsync(currentUser.Id.Value, ct);
        if (participant is null) return;
        participant.MarkMandatorySurveyPrompted();
        uow.Participants.Update(participant);
        await uow.SaveChangesAsync(ct);
    }

    private async Task<bool> CheckAudienceAsync(string targetAudience, Guid? participantId, Guid? sourceId, CancellationToken ct)
    {
        if (targetAudience == "all" || string.IsNullOrWhiteSpace(targetAudience))
            return true;
        if (!participantId.HasValue)
            return false;

        if (targetAudience == "travel_participants")
        {
            if (sourceId.HasValue)
                return await uow.TravelApplications.AnyAsync(
                    a => a.TravelId == sourceId.Value && a.ParticipantId == participantId.Value && a.Status == "approved", ct);
            return await uow.TravelApplications.AnyApprovedByParticipantAsync(participantId.Value, ct);
        }

        if (targetAudience == "event_participants")
        {
            if (sourceId.HasValue)
                return await uow.EventApplications.AnyAsync(
                    a => a.EventId == sourceId.Value && a.ParticipantId == participantId.Value && a.Status == "approved", ct);
            return await uow.EventApplications.AnyAsync(
                a => a.ParticipantId == participantId.Value && a.Status == "approved", ct);
        }

        if (targetAudience == "event_attendees")
        {
            if (sourceId.HasValue)
                return await uow.EventActivities.HasCheckedInAsync(sourceId.Value, participantId.Value, ct);
            return await uow.EventActivities.AnyAsync(
                a => a.ParticipantId == participantId.Value && a.Kind == "check_in", ct);
        }

        if (targetAudience == "facility_participants")
        {
            if (sourceId.HasValue)
                return await uow.FacilityApplications.AnyAsync(
                    a => a.FacilityId == sourceId.Value && a.ParticipantId == participantId.Value && a.Status == "approved", ct);
            return await uow.FacilityApplications.AnyAsync(
                a => a.ParticipantId == participantId.Value && a.Status == "approved", ct);
        }

        if (targetAudience == "facility_attendees")
        {
            if (sourceId.HasValue)
                return await uow.FacilityAttendances.AnyAsync(
                    a => a.FacilityId == sourceId.Value && a.ParticipantId == participantId.Value
                        && (a.Status == "present" || a.Status == "late"), ct);
            return await uow.FacilityAttendances.AnyAsync(
                a => a.ParticipantId == participantId.Value && (a.Status == "present" || a.Status == "late"), ct);
        }

        if (targetAudience == "sports_participants")
        {
            if (sourceId.HasValue)
                return await uow.FacilityApplications.AnyAsync(
                    a => a.Module == "sports" && a.FacilityId == sourceId.Value && a.ParticipantId == participantId.Value && a.Status == "approved", ct);
            return await uow.FacilityApplications.AnyAsync(
                a => a.Module == "sports" && a.ParticipantId == participantId.Value && a.Status == "approved", ct);
        }

        if (targetAudience == "library_users")
        {
            if (sourceId.HasValue)
                return await uow.LibrarySessions.AnyAsync(
                    s => s.LibraryId == sourceId.Value && s.ParticipantId == participantId.Value, ct);
            return await uow.LibrarySessions.AnyAsync(s => s.ParticipantId == participantId.Value, ct);
        }

        if (targetAudience == "youth")
        {
            if (sourceId.HasValue)
                return await uow.FacilityApplications.AnyAsync(
                    a => a.Module == "youth-camp" && a.FacilityId == sourceId.Value && a.ParticipantId == participantId.Value && a.Status == "approved", ct);
            return await uow.FacilityApplications.AnyAsync(
                a => a.Module == "youth-camp" && a.ParticipantId == participantId.Value && a.Status == "approved", ct);
        }

        return true;
    }

    private async Task<(string? Tckn, Guid? ParticipantId)> GetParticipantInfoAsync(CancellationToken ct)
    {
        if (!currentUser.Id.HasValue) return (null, null);
        var p = await uow.Participants.GetByIdAsync(currentUser.Id.Value, ct);
        return (p?.Tckn, p is not null ? currentUser.Id : null);
    }

    /// <summary>
    /// Anketin mahalle hedeflemesine uygunluk kontrolü.
    /// Hedef listesi boşsa anket herkese açıktır; doluysa yalnızca listedeki
    /// mahallelerde kayıtlı vatandaşlar görebilir/yanıtlayabilir.
    ///
    /// Bulgu (2026-09-21 uçtan uca testi, I2): `TargetNeighborhoods` admin panelde
    /// giriliyor ve DB'ye yazılıyordu, ancak vatandaş tarafındaki hiçbir sorguda
    /// filtre olarak kullanılmıyordu. Sonuç: "Cebeci'ye özel" bir anketi Cumhuriyet
    /// mahallesindeki vatandaş hem listede görüyor, hem detayını açıyor, hem de
    /// yanıtlayabiliyordu (201). Bu, mahalle bazlı raporlamayı kirletiyordu.
    /// Aynı desen Muhtarlık modülünde zaten doğru uygulanmıştı (FORBIDDEN_NEIGHBORHOOD).
    /// </summary>
    private static bool MatchesNeighborhood(Domain.Entities.Surveys.Survey survey, Participant? participant)
    {
        if (survey.TargetNeighborhoods.Count == 0) return true;
        var hood = participant?.Neighborhood;
        if (string.IsNullOrWhiteSpace(hood)) return false;
        return survey.TargetNeighborhoods.Any(n => string.Equals(n, hood, StringComparison.OrdinalIgnoreCase));
    }

    private static CitizenSurveyDto ToDto(Domain.Entities.Surveys.Survey s, bool responded, SourceContextDto? sourceContext = null)
        => new(s.Id, s.Title, s.Description, s.Category, s.Status,
            s.IsActive, s.IsAnonymous, s.EstimatedDuration, s.QuestionCount,
            s.StartDate, s.EndDate, responded, s.SourceType, s.SourceId, s.IsRequired, sourceContext);
}
