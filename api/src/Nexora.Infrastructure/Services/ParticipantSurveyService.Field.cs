using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.ParticipantSurveys.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Surveys;
using Nexora.Domain.Enums;
using ValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Kullanıcı isteği (2026-09-01): saha görevlisi olarak atanmış vatandaşlar (Participant
/// anketörler) citizen-portal (:3100) üzerinden kendilerine atanmış görevleri tablo hâlinde
/// görür ve görüştükleri kişinin TC kimlik numarasıyla anketi doldurur. Admin panelde zaten
/// var olan saha görevi (SurveyFieldTask) altyapısının "anketör tarafı" burada uygulanıyor.
///
/// Güvenlik kuralları (admin uçlarından farklı, bilinçli olarak daha dar):
/// - Yalnızca InterviewerType == "participant" && InterviewerId == oturumdaki vatandaş görevleri.
/// - Görev penceresi (StartDate..EndDate) ve durumu (assigned/in_progress) kontrol edilir.
/// - Anketin kendisi aktif ve yanıt penceresinde olmalı.
/// - Günlük hedef (DailyTarget) ve toplam hedef (TargetCount) aşımı engellenir.
/// - Cevap doğrulaması vatandaş akışıyla birebir aynı (ValidateAnswers) — saha kanalı için
///   ayrı ve gevşek bir doğrulama yolu açılmaz.
/// - Kayıt SurveyResponse.CreateFieldResponse ile Channel="field" olarak yazılır; böylece
///   admin analitik/kota ekranları saha kayıtlarını doğru kırılımda görür.
/// </summary>
public partial class ParticipantSurveyService
{
    private const int MaxFieldResponseListTake = 100;

    public async Task<List<FieldTaskDto>> GetMyFieldTasksAsync(CancellationToken ct)
    {
        var interviewerId = RequireInterviewerId();

        var tasks = await db.SurveyFieldTasks.AsNoTracking()
            .Where(t => !t.IsDeleted
                && t.InterviewerType == "participant"
                && t.InterviewerId == interviewerId
                && t.Status != "cancelled")
            .OrderBy(t => t.Status == "completed")
            .ThenBy(t => t.EndDate)
            .ToListAsync(ct);

        return await MapFieldTasksAsync(tasks, ct);
    }

    public async Task<FieldTaskDetailDto> GetMyFieldTaskDetailAsync(Guid taskId, CancellationToken ct)
    {
        var (task, survey) = await LoadOwnedTaskAsync(taskId, ct);
        var dto = (await MapFieldTasksAsync([task], ct))[0];
        var questions = await uow.Surveys.GetQuestionsAsync(survey.Id, ct);

        return new FieldTaskDetailDto(
            dto,
            survey.Description,
            survey.IsAnonymous,
            questions
                .OrderBy(q => q.Order)
                .Select(q => new CitizenSurveyQuestionDto(
                    q.Id, q.Order, q.Type, q.Question, q.Description,
                    q.Required, q.Options, q.ScaleMin, q.ScaleMax,
                    q.MinLabel, q.MaxLabel, q.RatingCount))
                .ToList());
    }

    public async Task<FieldRespondentLookupDto> LookupFieldRespondentAsync(Guid taskId, string tckn, CancellationToken ct)
    {
        var (task, survey) = await LoadOwnedTaskAsync(taskId, ct);
        var normalized = NormalizeTckn(tckn);

        var participant = await uow.Participants.GetByTcknAsync(normalized, ct);
        var identity = survey.IsAnonymous ? HashTckn(normalized) : normalized;
        var responded = await uow.Surveys.ResponseExistsAsync(survey.Id, identity, ct);

        // Mahalle kısıtlı bir görevde, kayıtlı vatandaşın mahallesi görevin mahallesiyle
        // uyuşmuyorsa anketör bunu kayıttan ÖNCE görsün diye lookup'ta uyarı amaçlı
        // mahalle bilgisi döner (blokaj değil: sahada kişi orada yaşamasa da görüşülebilir).
        return new FieldRespondentLookupDto(
            normalized,
            participant is not null,
            participant is not null ? IdentityMask.MaskName(participant.FullName) : null,
            participant?.Neighborhood ?? task.Neighborhood,
            participant is not null ? AgeGroupOf(participant.BirthDate) : null,
            participant is not null ? GenderOf(participant.Gender) : null,
            responded,
            // Kullanıcı isteği (2026-09-07): "kişinin bilgisi adresi vs hepsi ilk harf
            // görünür gerisi yıldız" — ad-soyad gibi adres de anketöre EKRANDA maskeli
            // gösterilir (KVKK: anketör TC'nin gerçek sahibini teşhis edip başka amaçla
            // kullanmasın diye). Gerçek adres form gönderiminde (CreateFieldCitizenSubmission
            // -> Participant tekrar TC ile sorgulanır) backend tarafında kullanılır; burada
            // maskelenmiş hali döner.
            participant?.Address is { Length: > 0 } addr ? IdentityMask.MaskNameStrict(addr) : null,
            participant?.Phone is { Length: > 0 } ph ? IdentityMask.MaskPhoneStrict(ph) : null);
    }

    public async Task<FieldSurveySubmitResultDto> SubmitFieldResponseAsync(Guid taskId, FieldSurveySubmitRequest req, CancellationToken ct)
    {
        var interviewerId = RequireInterviewerId();
        var (task, survey) = await LoadOwnedTaskAsync(taskId, ct);

        var now = DateTime.UtcNow; // UAT 2026-09-24: EndDate/StartDate UTC saklanır
        if (survey.EndDate.HasValue && survey.EndDate.Value < now)
            throw new ConflictException("Bu anketin yanıtlama süresi doldu.", "SURVEY_EXPIRED");
        if (survey.StartDate.HasValue && survey.StartDate.Value > now)
            throw new ConflictException("Bu anket henüz başlamadı.", "SURVEY_NOT_STARTED");

        // Kullanıcı isteği (2026-09-01): görüşülen kişi "İsimsiz / Anonim" seçtiyse TC
        // istenmez — sunucu tarafında benzersiz bir anonim kimlik üretilir (idempotency
        // ve tekrar-yanıt kontrolü için hâlâ bir "identity" gerekir, ama gerçek bir TC
        // değildir ve asla 11 haneli bir sayı biçiminde olmaz — CitizenTc alanının 11
        // haneli görünmesi TC sanılmasına yol açmasın diye harf önekli üretilir).
        var isAnonymousRespondent = req.IsAnonymousRespondent || string.IsNullOrWhiteSpace(req.Tckn);
        var tcknNormalized = isAnonymousRespondent ? null : NormalizeTckn(req.Tckn);

        var questions = await uow.Surveys.GetQuestionsAsync(survey.Id, ct);
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

        if (survey.RequireLocation && (!req.Latitude.HasValue || !req.Longitude.HasValue))
            throw new ConflictException("Bu anket için konum bilgisi zorunludur.", "LOCATION_REQUIRED");

        var respondent = tcknNormalized is not null ? await uow.Participants.GetByTcknAsync(tcknNormalized, ct) : null;
        string identity;
        if (isAnonymousRespondent)
        {
            // "ANON-" öneki: 11 haneli olmadığı için hiçbir yerde gerçek TC ile
            // karıştırılamaz; FieldResponseSummaryDto zaten TcknMasked hesaplamasında
            // 11 hane kontrolü yapıyor, bu değer otomatik olarak kısa referans gösterir.
            identity = $"ANON-{(string.IsNullOrWhiteSpace(req.LocalUuid) ? Guid.NewGuid().ToString("N") : req.LocalUuid)}";
        }
        else
        {
            identity = survey.IsAnonymous ? HashTckn(tcknNormalized!) : tcknNormalized!;
        }
        var responseParticipantId = survey.IsAnonymous || isAnonymousRespondent ? null : respondent?.Id;

        var neighborhood = FirstNonEmpty(req.Neighborhood, respondent?.Neighborhood, task.Neighborhood);
        var ageGroup = FirstNonEmpty(req.AgeGroup, respondent is not null ? AgeGroupOf(respondent.BirthDate) : null);
        var gender = FirstNonEmpty(req.Gender, respondent is not null ? GenderOf(respondent.Gender) : null);

        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        SurveyResponse response;
        try
        {
            // Hata bulgusu (Task 10, SurveyQuotaConcurrencyTests — 100% reproducible race,
            // not flaky): SurveyResponseLockKey is keyed per (surveyId, identity), so it only
            // serializes "has THIS PERSON already responded" for a given respondent. Two
            // DIFFERENT respondents submitting to the SAME field task concurrently took two
            // DIFFERENT lock keys and ran the count-then-insert TargetCount/DailyTarget check
            // fully in parallel — both observed count=0 before either committed, so BOTH were
            // accepted against a TargetCount=1 task (measured: 2 real 201s, not 1+1 conflict,
            // reproduced identically across repeated real-Postgres runs). A second lock keyed
            // on the field task itself serializes the TargetCount/DailyTarget decision across
            // ALL respondents of that task, closing the race without weakening the existing
            // per-identity ALREADY_RESPONDED guarantee (both locks are held for the same
            // transaction and both release together at commit/rollback).
            await uow.AcquireAdvisoryLockAsync(FieldTaskLockKey(task.Id), ct);
            await uow.AcquireAdvisoryLockAsync(SurveyResponseLockKey(survey.Id, identity), ct);

            // Idempotency: tablet/telefon offline kuyruğu aynı kaydı iki kez gönderebilir.
            if (!string.IsNullOrWhiteSpace(req.LocalUuid))
            {
                var existing = await db.SurveyResponses.AsNoTracking()
                    .FirstOrDefaultAsync(r => !r.IsDeleted && r.LocalUuid == req.LocalUuid && r.FieldTaskId == task.Id, ct);
                if (existing is not null)
                {
                    if (ownsTransaction) await uow.RollbackAsync(ct);
                    var (existTotal, existToday) = await CountTaskResponsesAsync(task.Id, ct);
                    return new FieldSurveySubmitResultDto(existing.Id, existing.SubmittedAt, existTotal, existToday);
                }
            }

            if (!survey.AllowMultipleResponses && await uow.Surveys.ResponseExistsAsync(survey.Id, identity, ct))
                throw new ConflictException("Bu kişi ankete zaten yanıt vermiş.", "ALREADY_RESPONDED");

            var (total, today) = await CountTaskResponsesAsync(task.Id, ct);
            if (task.TargetCount > 0 && total >= task.TargetCount)
                throw new ConflictException("Bu görevin toplam hedefine ulaşıldı.", "FIELD_TASK_TARGET_REACHED");
            if (task.DailyTarget > 0 && today >= task.DailyTarget)
                throw new ConflictException("Bugünkü hedefinize ulaştınız.", "FIELD_TASK_DAILY_TARGET_REACHED");

            var answersJson = JsonSerializer.Serialize(req.Answers.Select(a => new
            {
                questionId = a.QuestionId,
                answer = a.Answer,
            }));

            response = SurveyResponse.CreateFieldResponse(
                survey.Id, identity, responseParticipantId, answersJson,
                interviewerId, task.Id, neighborhood, null,
                req.Latitude, req.Longitude, req.DurationSeconds,
                ageGroup, gender, req.LocalUuid, "field", "participant");

            await uow.Surveys.AddResponseAsync(response, ct);
            survey.IncrementResponses();
            uow.Surveys.Update(survey);

            var tracked = await db.SurveyFieldTasks.FirstAsync(t => t.Id == task.Id, ct);
            if (tracked.Status == "assigned") tracked.SetStatus("in_progress", currentUser.Name);
            tracked.TouchSync();

            await uow.SaveChangesAsync(ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        var (newTotal, newToday) = await CountTaskResponsesAsync(task.Id, ct);
        return new FieldSurveySubmitResultDto(response.Id, response.SubmittedAt, newTotal, newToday);
    }

    public async Task<List<FieldResponseSummaryDto>> GetMyFieldResponsesAsync(Guid taskId, int take, CancellationToken ct)
    {
        var (task, _) = await LoadOwnedTaskAsync(taskId, ct, requireOpenWindow: false);
        var limit = Math.Clamp(take <= 0 ? 20 : take, 1, MaxFieldResponseListTake);

        var rows = await db.SurveyResponses.AsNoTracking()
            .Where(r => !r.IsDeleted && r.FieldTaskId == task.Id)
            .OrderByDescending(r => r.SubmittedAt)
            .Take(limit)
            .ToListAsync(ct);

        return rows.Select(r => new FieldResponseSummaryDto(
            r.Id,
            // Anonim ankette CitizenTc bir SHA-256 hash'idir; ham hash'i saha ekranına
            // sızdırmamak için yalnızca kısa bir referans gösterilir.
            r.CitizenTc.Length == 11 ? IdentityMask.MaskTckn(r.CitizenTc) : $"#{r.CitizenTc[..Math.Min(6, r.CitizenTc.Length)]}",
            r.Neighborhood,
            r.AgeGroup,
            r.Gender,
            r.DurationSeconds,
            r.SubmittedAt)).ToList();
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-01): "nvi entegrasyonu da yap" — sahada TC yerel Participant
    /// tablosunda kayıtlı değilse, anketör TC + doğum tarihi girerek gerçek NVI (MERNİS)
    /// sorgusuyla kişinin var olup olmadığını ve verdiği bilgilerin tutarlılığını doğrulayabilir.
    /// Sonuç KVKK gereği maskeli döner (anketör tam adı görmez).
    /// </summary>
    public async Task<FieldNviLookupResultDto> NviLookupFieldRespondentAsync(Guid taskId, FieldNviLookupRequest req, CancellationToken ct)
    {
        var (task, _) = await LoadOwnedTaskAsync(taskId, ct, requireOpenWindow: false);
        var tckn = NormalizeTckn(req.Tckn);

        var res = await nvi.GetPersonAndChildrenAsync(tckn, req.BirthDate, 0, ct);
        if (!res.Success || res.Person is null)
            return new FieldNviLookupResultDto(false, res.ErrorMessage ?? "Kimlik doğrulanamadı.", null, null, null, null);

        var person = res.Person;
        var fullName = $"{person.FirstName} {person.LastName}".Trim();

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.View,
            EntityType = "FieldNviLookup",
            Module = "Surveys",
            Description = $"Saha NVI sorgusu: görev {task.Id}, TC {IdentityMask.MaskTckn(tckn)}",
        }, ct);

        return new FieldNviLookupResultDto(
            true, null,
            IdentityMask.MaskName(fullName),
            GenderOf(person.Gender),
            AgeGroupOf(person.BirthDate),
            task.Neighborhood);
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-01): "talep istek öneri şikayet durumundan direkt o kişi
    /// için başvurabilirsin" — saha görevlisi, görüştüğü vatandaş adına doğrudan Muhtarlık
    /// modülüne (CitizenSubmission) talep/öneri/şikayet kaydı açabilir. FieldTaskId ile
    /// anketörün gerçekten kendisine atanmış bir görev üzerinden işlem yaptığı doğrulanır
    /// (yetkisiz/rastgele kullanım engeli); kayıt normal vatandaş başvurularıyla aynı
    /// tabloya, "field_survey" kanalı ile düşer ki Muhtarlık ekranında ayırt edilebilsin.
    /// </summary>
    public async Task<FieldCitizenSubmissionResultDto> CreateFieldCitizenSubmissionAsync(FieldCitizenSubmissionRequest req, CancellationToken ct)
    {
        var (task, _) = await LoadOwnedTaskAsync(req.FieldTaskId, ct, requireOpenWindow: false);

        if (string.IsNullOrWhiteSpace(req.Title))
            throw new ConflictException("Başlık zorunludur.", "TITLE_REQUIRED");
        if (string.IsNullOrWhiteSpace(req.Description))
            throw new ConflictException("Açıklama zorunludur.", "DESCRIPTION_REQUIRED");
        if (!Nexora.Application.Features.CitizenSubmissions.MuhtarlikReference.CategoryOptions.Any(o => o.Value == req.CategoryId))
            throw new ConflictException("Geçersiz kategori.", "INVALID_CATEGORY");
        if (!Nexora.Application.Features.CitizenSubmissions.MuhtarlikReference.SubmissionTypes.Contains(req.SubmissionType))
            throw new ConflictException("Geçersiz başvuru türü.", "INVALID_SUBMISSION_TYPE");

        var citizenTc = string.IsNullOrWhiteSpace(req.CitizenTc) ? "" : NormalizeTckn(req.CitizenTc);

        // Kullanıcı isteği (2026-09-07): "anonim ankete katılmış biri talep formunu
        // doldurmak istediğinde TC kimlik doğum tarihi giriş zorunlu" — kişi kimliğini
        // vermeden (TC boş) bir talep açılamaz; en azından TC + doğum tarihi (kimlik teyidi
        // için) zorunludur. Tamamen anonim (isimsiz, iletişimsiz) talep artık kabul edilmez.
        if (string.IsNullOrWhiteSpace(citizenTc))
            throw new ConflictException(
                "Talep/öneri/şikayet oluşturmak için T.C. kimlik numarası ve doğum tarihi girilmesi zorunludur.",
                "CITIZEN_TC_REQUIRED");
        if (!req.CitizenBirthDate.HasValue)
            throw new ConflictException(
                "Talep/öneri/şikayet oluşturmak için doğum tarihi girilmesi zorunludur.",
                "CITIZEN_BIRTHDATE_REQUIRED");

        // Kullanıcı isteği (2026-09-07): "TC'li kişide adres mahalle sokak ev daire vs
        // girmeden de işlem yapabilir zaten kişinin tc si ile ilgili bilgi tüm bilgiler
        // arka planda geliyordur" — TC sistemde kayıtlı bir Participant'a aitse, anketörün
        // elle girdiği adres/mahalle boşsa kayıtlı gerçek bilgilerle doldurulur. Anketör
        // "başka bir adres" girdiyse (req.Address doluysa) bu ezilmez — talebin konusu
        // ikametten farklı bir yer olabilir (bkz. CitizenSubmission.AddressType).
        var participant = await uow.Participants.GetByTcknAsync(citizenTc, ct);

        var neighborhood = !string.IsNullOrWhiteSpace(req.Neighborhood)
            ? req.Neighborhood
            : participant?.Neighborhood ?? task.Neighborhood ?? "";
        var address = !string.IsNullOrWhiteSpace(req.Address)
            ? req.Address
            : participant?.Address ?? neighborhood;
        // Güvenlik düzeltmesi (2026-09-07): Ad-soyad ve telefon TC KAYITLIYSA HER ZAMAN
        // Participant kaydından alınır, req.CitizenName/req.CitizenPhone burada YOK
        // SAYILIR. Sebep: /respondent (lookup) ucu KVKK gereği bu alanları anketöre
        // MASKELİ döndürür (IdentityMask.MaskName/MaskPhoneStrict, örn. "ME** ÖM** AS**",
        // "507****77"); istemci tarafı bu maskeli değeri form input'una yazıp kaydetmeye
        // çalışırsa, req.CitizenName/req.CitizenPhone dolu göründüğü için önceki kod
        // bunu "anketörün elle girdiği gerçek değer" sanıp maskeli metni GERÇEK ad/telefon
        // olarak kaydediyordu (veri bozulması: muhtar/çağrı merkezi maskeli isimle
        // karşılaşır). TC sistemde kayıtlı değilse (participant null) hâlâ anketörün elle
        // girdiği req değerleri kullanılır — o durumda maskeleme söz konusu değildir.
        var citizenPhone = participant is not null
            ? participant.Phone ?? ""
            : req.CitizenPhone?.Trim() ?? "";
        var citizenName = participant is not null
            ? participant.FullName
            : (string.IsNullOrWhiteSpace(req.CitizenName) ? "Sahada Görüşülen Vatandaş" : req.CitizenName.Trim());

        var submission = Domain.Entities.CitizenSubmissions.CitizenSubmission.Create(
            citizenName, citizenPhone, citizenTc,
            neighborhood, address,
            req.CategoryId, req.SubmissionType, "normal",
            req.Title, req.Description);
        submission.SetGeo(req.Latitude, req.Longitude);
        submission.SetMeta(false, null, 0, "field_survey");
        submission.SetLocationContext(req.AddressType ?? "residence", "neighborhood");
        // Kullanıcı isteği (2026-09-05): "TC kimlik doğum tarihi sorgulaması olacak ...
        // başlangıçta vermişse o bilgilere göre doldurulacak" — anket kimlik adımında
        // NVI ile doğrulanmış doğum tarihi (veya anketörün elle girdiği) burada saklanır.
        submission.SetCitizenBirthDate(req.CitizenBirthDate);
        // ULAK-04: takip numarası tek kaynaktan (SubmissionTrackingNo) üretilir — tüm kanallarda ortak,
        // çakışmaya dayanıklı (ms + kriptografik rastgele son ek) biçim. Bu metot ayrı bir transaction
        // içinde değildir; unique-ihlalinde sınırlı yeniden üretim + insert retry uygulanır.
        submission.SetTrackingNo(Nexora.Domain.Common.SubmissionTrackingNo.Generate());

        await uow.CitizenSubmissions.AddAsync(submission, ct);
        await Nexora.Infrastructure.Persistence.TrackingNoRetry.SaveWithRetryAsync(
            uow, () => submission.SetTrackingNo(Nexora.Domain.Common.SubmissionTrackingNo.Generate()), ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "CitizenSubmission",
            EntityId = submission.Id,
            Module = "Surveys",
            Description = $"Saha görevlisi başvuru oluşturdu (görev {task.Id}): {submission.Title}",
        }, ct);

        return new FieldCitizenSubmissionResultDto(submission.Id, submission.TrackingNo, submission.SubmittedAt);
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-01): "sistem icinde o kişinin telefon numarasına sms olarak
    /// kaıtldığı anket soruları gönderilebilir" — vatandaş anketi sahada değil kendi
    /// telefonundan doldurmak isterse, anketör en azından telefon numarasını girip SMS ile
    /// anket linki gönderebilir. TC/ad/doğum tarihi zorunlu değildir (sadece telefonla da
    /// gönderilebilir).
    /// </summary>
    public async Task<FieldSurveySmsLinkResultDto> SendFieldSurveySmsLinkAsync(Guid taskId, FieldSurveySmsLinkRequest req, CancellationToken ct)
    {
        var (task, survey) = await LoadOwnedTaskAsync(taskId, ct, requireOpenWindow: false);

        var phoneDigits = new string((req.Phone ?? "").Where(char.IsDigit).ToArray());
        if (phoneDigits.Length < 10)
            throw new ValidationException("Geçerli bir telefon numarası giriniz.", new Dictionary<string, string[]>
            {
                ["phone"] = ["Telefon numarası en az 10 haneli olmalıdır."],
            });

        var portalUrl = (config["TravelSettings:CitizenPortalUrl"] ?? "").TrimEnd('/');
        if (portalUrl.Length == 0)
            throw new ConflictException("Anket bağlantısı için portal adresi tanımlı değil. Lütfen sistem yöneticisine bildirin.", "PORTAL_URL_NOT_CONFIGURED");

        var link = $"{portalUrl}/anketler/{survey.Id}";
        var message = $"Sultanşehir Belediyesi: \"{survey.Title}\" anketine katılmak için: {link}";

        bool sent;
        try
        {
            sent = await sms.SendOneAsync(phoneDigits, message, ct);
        }
        catch
        {
            sent = false;
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "FieldSurveySmsLink",
            Module = "Surveys",
            Description = $"Saha görevlisi anket linki SMS gönderdi (görev {task.Id}, anket {survey.Title}): {(sent ? "başarılı" : "başarısız")}",
        }, ct);

        return new FieldSurveySmsLinkResultDto(sent, sent ? null : "SMS gönderilemedi.");
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-01): saha görevlisinin GPS izi. Yalnızca aktif (assigned/
    /// in_progress ve tarih penceresi açık) bir görevi varken kabul edilir — görev dışı
    /// zamanlarda konum saklanmaz (KVKK: amaçla sınırlılık). Mesafe sunucuda, bir önceki
    /// ping'e göre haversine ile hesaplanır; cihazın bildirdiği mesafeye güvenilmez.
    /// </summary>
    public async Task<FieldLocationPingResultDto> RecordFieldLocationAsync(FieldLocationPingRequest req, CancellationToken ct)
    {
        var interviewerId = RequireInterviewerId();

        if (double.IsNaN(req.Latitude) || double.IsNaN(req.Longitude)
            || req.Latitude is < -90 or > 90 || req.Longitude is < -180 or > 180)
            throw new ValidationException("Geçersiz konum bilgisi.", new Dictionary<string, string[]>
            {
                ["latitude"] = ["Enlem/boylam değerleri geçerli aralıkta olmalıdır."],
            });

        var openTasks = await db.SurveyFieldTasks.AsNoTracking()
            .Where(t => !t.IsDeleted
                && t.InterviewerType == "participant"
                && t.InterviewerId == interviewerId
                && (t.Status == "assigned" || t.Status == "in_progress"))
            .ToListAsync(ct);
        var activeTask = openTasks.FirstOrDefault(IsWindowOpen)
            ?? throw new ConflictException("Aktif bir saha göreviniz yok; konum kaydedilmedi.", "NO_ACTIVE_FIELD_TASK");

        var todayStartUtc = TurkeyTime.TodayStartUtc();
        var todayPings = await db.SurveyFieldLocationPings.AsNoTracking()
            .Where(x => x.InterviewerId == interviewerId && x.RecordedAt >= todayStartUtc)
            .OrderBy(x => x.RecordedAt)
            .ToListAsync(ct);

        var previous = todayPings.Count > 0 ? todayPings[^1] : null;
        var distance = 0.0;
        if (previous is not null)
        {
            var raw = GeoDistance.HaversineMeters(previous.Latitude, previous.Longitude, req.Latitude, req.Longitude);
            // GPS gürültüsü: 10 m altındaki oynamalar sayılmaz; 2 km üzeri tek sıçrama
            // (kapalı alan/ağ konumu hatası) mesafeye eklenmez.
            distance = raw is >= 10 and <= 2000 ? raw : 0;
        }

        var ping = SurveyFieldLocationPing.Create(
            interviewerId,
            req.FieldTaskId ?? activeTask.Id,
            req.Latitude, req.Longitude,
            req.AccuracyMeters, req.SpeedMps, req.RecordedAt, distance);

        db.SurveyFieldLocationPings.Add(ping);
        await db.SaveChangesAsync(ct);

        return new FieldLocationPingResultDto(
            true,
            Math.Round(todayPings.Sum(x => x.DistanceFromPreviousMeters) + distance, 1),
            30);
    }

    // --- yardımcılar ---

    private Guid RequireInterviewerId()
        => currentUser.Id ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

    private async Task<(SurveyFieldTask Task, Survey Survey)> LoadOwnedTaskAsync(
        Guid taskId, CancellationToken ct, bool requireOpenWindow = true)
    {
        var interviewerId = RequireInterviewerId();

        var task = await db.SurveyFieldTasks.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId
                && !t.IsDeleted
                && t.InterviewerType == "participant"
                && t.InterviewerId == interviewerId, ct)
            ?? throw new NotFoundException("Saha görevi bulunamadı.", "FIELD_TASK_NOT_FOUND");

        if (requireOpenWindow)
        {
            if (task.Status is "cancelled")
                throw new ConflictException("Bu görev iptal edilmiş.", "FIELD_TASK_CANCELLED");
            if (task.Status is "completed")
                throw new ConflictException("Bu görev tamamlanmış.", "FIELD_TASK_COMPLETED");
            if (!IsWindowOpen(task))
                throw new ConflictException("Bu görev için tanımlı tarih aralığının dışındasınız.", "FIELD_TASK_WINDOW_CLOSED");
        }

        var survey = await uow.Surveys.GetByIdAsync(task.SurveyId, ct)
            ?? throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");
        if (requireOpenWindow && !survey.IsActive)
            throw new ConflictException("Bu anket artık aktif değil.", "SURVEY_NOT_ACTIVE");

        return (task, survey);
    }

    /// <summary>
    /// Görev anketör tarafından başlatılamıyorsa nedenini döner; başlatılabiliyorsa null.
    /// Sıra, kullanıcıya en anlamlı sebebi göstermek için bilinçlidir: görevin kendi durumu
    /// (iptal/tamamlandı) → anketin pasifliği → tarih penceresi → kotalar.
    /// </summary>
    private static string? ClosedReasonOf(SurveyFieldTask t, Survey? s, int done, int today)
    {
        if (t.Status == "cancelled") return "task_cancelled";
        if (t.Status == "completed") return "task_completed";
        if (s is null || !s.IsActive) return "survey_inactive";
        if (!IsWindowOpen(t)) return "out_of_window";
        if (t.TargetCount > 0 && done >= t.TargetCount) return "target_reached";
        if (t.DailyTarget > 0 && today >= t.DailyTarget) return "daily_quota_reached";
        return null;
    }

    private static bool IsWindowOpen(SurveyFieldTask t)
    {
        var today = TurkeyTime.TodayDate();
        var start = DateTime.SpecifyKind(t.StartDate, DateTimeKind.Utc);
        var end = DateTime.SpecifyKind(t.EndDate, DateTimeKind.Utc);
        return TurkeyTime.ToTurkey(start).Date <= today && today <= TurkeyTime.ToTurkey(end).Date;
    }

    private async Task<(int Total, int Today)> CountTaskResponsesAsync(Guid taskId, CancellationToken ct)
    {
        var todayUtc = TurkeyTime.TodayStartUtc();
        var rows = await db.SurveyResponses.AsNoTracking()
            .Where(r => !r.IsDeleted && r.FieldTaskId == taskId)
            .Select(r => r.SubmittedAt)
            .ToListAsync(ct);
        return (rows.Count, rows.Count(d => d >= todayUtc));
    }

    /// <summary>
    /// Task 10 bugfix: serializes the TargetCount/DailyTarget count-then-insert decision across
    /// ALL respondents of the SAME field task, independent of respondent identity. Distinct from
    /// SurveyResponseLockKey (per survey+identity — "has THIS PERSON already responded"), which
    /// does not prevent two different respondents from racing the shared task-level counters.
    /// </summary>
    private static long FieldTaskLockKey(Guid taskId)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes($"field-task:{taskId}");
        var hash = System.Security.Cryptography.SHA256.HashData(bytes);
        return BitConverter.ToInt64(hash, 0);
    }

    private async Task<List<FieldTaskDto>> MapFieldTasksAsync(List<SurveyFieldTask> tasks, CancellationToken ct)
    {
        if (tasks.Count == 0) return [];

        var surveyIds = tasks.Select(t => t.SurveyId).Distinct().ToList();
        var taskIds = tasks.Select(t => t.Id).ToList();

        var surveys = await db.Surveys.AsNoTracking()
            .Where(s => surveyIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, ct);

        var todayUtc = TurkeyTime.TodayStartUtc();
        var counts = await db.SurveyResponses.AsNoTracking()
            .Where(r => !r.IsDeleted && r.FieldTaskId != null && taskIds.Contains(r.FieldTaskId!.Value))
            .GroupBy(r => r.FieldTaskId!.Value)
            .Select(g => new { TaskId = g.Key, Total = g.Count(), Today = g.Count(x => x.SubmittedAt >= todayUtc) })
            .ToDictionaryAsync(x => x.TaskId, ct);

        return tasks.Select(t =>
        {
            var s = surveys.GetValueOrDefault(t.SurveyId);
            var c = counts.GetValueOrDefault(t.Id);
            var done = c?.Total ?? 0;
            return new FieldTaskDto(
                t.Id,
                t.SurveyId,
                s?.Title ?? "—",
                s?.Category ?? "",
                s?.QuestionCount ?? 0,
                s?.EstimatedDuration ?? 0,
                t.Neighborhood ?? "Tüm Mahalleler",
                t.StartDate,
                t.EndDate,
                t.TargetCount,
                t.DailyTarget,
                done,
                c?.Today ?? 0,
                t.TargetCount > 0 ? Math.Round(100.0 * done / t.TargetCount, 1) : 0,
                t.Status,
                t.Note,
                s?.RequireLocation ?? false,
                // Kullanıcı deneyimi bulgusu (2026-09-01, E2E): hedefi dolmuş ya da günlük
                // kotası bitmiş görevde "Anket doldur" butonu aktif kalıyordu; anketör 10
                // soruyu doldurup ancak kaydederken hata alıyor ve emeği boşa gidiyordu.
                // Bu yüzden kota durumu da "açık mı" hesabına dahil edildi.
                IsWindowOpen(t)
                    && t.Status is "assigned" or "in_progress"
                    && (s?.IsActive ?? false)
                    && (t.TargetCount <= 0 || done < t.TargetCount)
                    && (t.DailyTarget <= 0 || (c?.Today ?? 0) < t.DailyTarget),
                // Kullanıcı isteği (2026-09-02): "pasif anket başlamıyor, sebep nedir".
                // Kapalıysa gerçek sebep döner; anketör ekranı artık "Tarih dışı" gibi
                // yanlış bir varsayım göstermez.
                ClosedReasonOf(t, s, done, c?.Today ?? 0));
        }).ToList();
    }

    private static string NormalizeTckn(string? raw)
    {
        var digits = new string((raw ?? "").Where(char.IsDigit).ToArray());
        if (digits.Length != 11 || digits[0] == '0')
            throw new ValidationException("Geçersiz T.C. kimlik numarası.", new Dictionary<string, string[]>
            {
                ["tckn"] = ["T.C. kimlik numarası 11 haneli olmalı ve 0 ile başlamamalıdır."],
            });

        // Standart TCKN algoritması — sahada hatalı/uydurma numara girilmesini engeller.
        var d = digits.Select(c => c - '0').ToArray();
        var oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
        var evenSum = d[1] + d[3] + d[5] + d[7];
        var digit10 = ((oddSum * 7) - evenSum) % 10;
        if (digit10 < 0) digit10 += 10;
        var digit11 = d.Take(10).Sum() % 10;
        if (digit10 != d[9] || digit11 != d[10])
            throw new ValidationException("Geçersiz T.C. kimlik numarası.", new Dictionary<string, string[]>
            {
                ["tckn"] = ["Girilen T.C. kimlik numarası doğrulanamadı."],
            });

        return digits;
    }

    private static string? FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim();

    private static string AgeGroupOf(DateTime birthDate)
    {
        var today = TurkeyTime.TodayDate();
        var age = today.Year - birthDate.Year;
        if (birthDate.Date > today.AddYears(-age)) age--;
        return age switch
        {
            < 18 => "0-17",
            < 25 => "18-24",
            < 35 => "25-34",
            < 45 => "35-44",
            < 55 => "45-54",
            < 65 => "55-64",
            _ => "65+",
        };
    }

    private static string GenderOf(Gender g) => g switch
    {
        Gender.Male => "male",
        Gender.Female => "female",
        _ => "other",
    };
}
