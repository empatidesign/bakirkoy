using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Loyalty;
using Nexora.Application.Features.Loyalty.Requests;
using Nexora.Application.Features.ParticipantQuizzes;
using Nexora.Application.Features.ParticipantQuizzes.Dtos;
using Nexora.Application.Features.Quizzes.Dtos;
using Nexora.Domain.Entities.Quizzes;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class ParticipantQuizService(IUnitOfWork uow, ICurrentUser currentUser, ILoyaltyService loyalty, IRedisService redis, IConfiguration config, IAuditService audit) : IParticipantQuizService
{
    private string SultangaziDistrictCode => config["Residency:SultangaziDistrictCode"] ?? Nexora.Domain.Common.ResidencyPolicy.DefaultSultangaziDistrictCode;

    public async Task<PagedResult<CitizenQuizDto>> GetListAsync(CitizenQuizListParams p, CancellationToken ct)
    {
        var participant = currentUser.Id.HasValue
            ? await uow.Participants.GetByIdAsync(currentUser.Id.Value, ct)
            : null;

        var ageGroups = await uow.QuizAgeGroups.GetActiveAsync(ct);
        var ageGroupNames = ageGroups.ToDictionary(g => g.Id, g => g.Name);

        Guid[]? myAgeGroupIds = null;
        if (participant is not null)
        {
            var age = CalculateAge(participant.BirthDate);
            myAgeGroupIds = ageGroups.Where(g => g.Contains(age)).Select(g => g.Id).ToArray();
        }

        var listParams = new QuizListParams
        {
            Page = p.PageResolved.ToString(),
            Limit = p.LimitResolved.ToString(),
            Search = p.Search,
            Status = p.Status,
            IsActive = true,
            ActiveWindowOnly = true,
            EligibleForAgeGroupIds = myAgeGroupIds,
            OnlyAllAges = participant is not null && myAgeGroupIds!.Length == 0,
            Sort = p.Sort,
            Order = p.Order,
        };

        var paged = await uow.Quizzes.GetPagedAsync(listParams, ct);

        var quizIds = paged.Items.Select(q => q.Id).ToList();
        var counts = await uow.Quizzes.ParticipantCountsAsync(quizIds, ct);
        var catIds = paged.Items.Select(q => q.CategoryId).Distinct().ToList();
        var cats = catIds.Count == 0
            ? new Dictionary<Guid, (string Name, string? Color)>()
            : (await uow.QuizCategories.FindAsync(c => catIds.Contains(c.Id), ct))
                .ToDictionary(c => c.Id, c => (c.Name, Color: (string?)c.Color));

        var tckn = participant?.Tckn;

        var participatedIds = !string.IsNullOrWhiteSpace(tckn)
            ? await uow.Quizzes.GetParticipatedQuizIdsAsync(quizIds, tckn, ct)
            : new HashSet<Guid>();

        var items = new List<CitizenQuizDto>();
        foreach (var q in paged.Items)
        {
            cats.TryGetValue(q.CategoryId, out var cat);
            var participated = participatedIds.Contains(q.Id);
            var ageGroupName = q.AgeGroupId.HasValue
                ? ageGroupNames.GetValueOrDefault(q.AgeGroupId.Value)
                : null;
            items.Add(new CitizenQuizDto(
                q.Id, q.Title, q.Description,
                cat.Name ?? "", cat.Color, ageGroupName,
                q.StartDate, q.EndDate, q.Status,
                q.QuestionCount, q.DurationMinutes,
                counts.GetValueOrDefault(q.Id, 0),
                q.IsActive, participated));
        }

        return new PagedResult<CitizenQuizDto>
        {
            Items = items,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<CitizenQuizDetailDto> GetDetailAsync(Guid quizId, CancellationToken ct)
    {
        var quiz = await uow.Quizzes.GetByIdAsync(quizId, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        if (!quiz.IsActive)
            throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        // Liste ekranı ActiveWindowOnly ile EndDate < now olan yarışmaları gizliyor
        // (bkz. QuizRepository.GetPagedAsync). Detay ucu aynı kontrolü yapmıyordu; bu da
        // vatandaşın süresi dolmuş bir yarışmayı direkt linkle açıp soruları görebilmesine,
        // hatta bir Redis attempt oturumu başlatabilmesine yol açıyordu — sadece en sonda
        // Submit() reddediyordu (QUIZ_EXPIRED/QUIZ_NOT_OPEN). Liste ile detay arasındaki bu
        // tutarsızlık, vatandaşın zaman kaybetmesine neden oluyordu
        // (bkz. loyalty-ecosystem-audit-2026-08-04, canlı curl testiyle doğrulandı: expired
        // quiz detail → 200, submit → 409 QUIZ_NOT_OPEN).
        var nowForWindow = DateTime.UtcNow; // UAT 2026-09-24: alan UTC saklanır; duvar saati (UTC+3) ile kıyas pencereyi 3 saat kaydırıyordu
        if (quiz.EndDate < nowForWindow)
            throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        // Bulgu (NEXORA_ISLEVSEL_DOGRULUK_KONSOLIDE_2026-08-31, böl. 3.2): yukarıdaki kontrol
        // yalnızca "süresi dolmuş" (EndDate < now) durumunu engelliyordu, "henüz başlamamış"
        // (StartDate > now, Status="upcoming") durumunu hiç kontrol etmiyordu. Detay ucu
        // sorularıyla birlikte doğrudan 200 dönüyordu — vatandaş quiz id'sini bilip linki
        // erkenden açtığında, henüz başlamamış bir yarışmanın tüm sorularını (ve doğru
        // cevap dışındaki tüm alanlarını) görebiliyordu. Liste ekranı "upcoming" quiz'i
        // ayrı bir bölümde gösterip tıklanamaz bırakıyor ama bu sadece istemci tarafı bir
        // kısıtlama — id doğrudan bilinirse/tahmin edilirse atlatılabiliyordu. Artık
        // başlangıç zamanı gelmemiş bir quiz için detay ucu da 404 dönüyor (canlı test:
        // 2 gün sonra başlayan quiz → GET detay 404 QUIZ_NOT_STARTED_YET).
        if (quiz.StartDate > nowForWindow)
            throw new NotFoundException("Yarışma henüz başlamadı.", "QUIZ_NOT_STARTED_YET");

        if (quiz.AgeGroupId.HasValue && currentUser.Id.HasValue)
        {
            var participantForAge = await uow.Participants.GetByIdAsync(currentUser.Id.Value, ct);
            if (participantForAge is not null)
            {
                var ageGroup = await uow.QuizAgeGroups.GetByIdAsync(quiz.AgeGroupId.Value, ct);
                var age = CalculateAge(participantForAge.BirthDate);
                if (ageGroup is null || !ageGroup.Contains(age))
                    throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");
            }
        }

        var questions = await uow.Quizzes.GetQuestionsAsync(quizId, ct);
        var cats = await uow.QuizCategories.FindAsync(c => c.Id == quiz.CategoryId, ct);
        var cat = cats.FirstOrDefault();

        var tckn = await GetTcknAsync(ct);
        var participated = !string.IsNullOrWhiteSpace(tckn)
            && await uow.Quizzes.ParticipationExistsAsync(quizId, tckn, ct);

        var orderedQuestions = quiz.RandomizeQuestions
            ? questions.OrderBy(_ => Guid.NewGuid()).ToList()
            : questions.OrderBy(q => q.Order).ToList();

        var questionDtos = orderedQuestions
            .Select(q => new CitizenQuizQuestionDto(
                q.Id, q.Order, q.Question, q.Options,
                q.Difficulty, q.Points, q.TimeLimit))
            .ToList();

        if (!string.IsNullOrWhiteSpace(tckn))
        {
            var attemptKey = AttemptKey(quizId, tckn);
            var existingAttempt = await redis.GetAsync<QuizAttemptState>(attemptKey, ct);
            if (existingAttempt is null)
            {
                var attempt = new QuizAttemptState(
                    DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                    orderedQuestions.Select(q => q.Id).ToList());
                var attemptTtl = TimeSpan.FromMinutes((quiz.DurationMinutes > 0 ? quiz.DurationMinutes : 60) + 120);
                await redis.SetAsync(attemptKey, attempt, attemptTtl, ct);
            }
            else
            {
                orderedQuestions = ResolveServedOrder(questions, existingAttempt);
                questionDtos = orderedQuestions
                    .Select(q => new CitizenQuizQuestionDto(
                        q.Id, q.Order, q.Question, q.Options,
                        q.Difficulty, q.Points, q.TimeLimit))
                    .ToList();
            }
        }

        return new CitizenQuizDetailDto(
            quiz.Id, quiz.Title, quiz.Description,
            cat?.Name ?? "", cat?.Color,
            quiz.StartDate, quiz.EndDate, quiz.Status,
            quiz.DurationMinutes, participated, questionDtos, quiz.PassRights);
    }

    public async Task<CitizenQuizSubmitResultDto> SubmitAsync(Guid quizId, CitizenQuizSubmitRequest req, CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var participant = await uow.Participants.GetByIdAsync(actorId, ct)
            ?? throw new NotFoundException("Vatandaş kaydı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var quiz = await uow.Quizzes.GetByIdAsync(quizId, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        if (!quiz.IsActive)
            throw new ConflictException("Bu yarışma artık aktif değil.", "QUIZ_NOT_ACTIVE");

        if (quiz.Status != "ongoing" && quiz.Status != "upcoming")
            throw new ConflictException("Bu yarışmaya artık katılamaz veya cevap gönderemezsiniz.", "QUIZ_NOT_OPEN");

        var now = DateTime.UtcNow; // UAT 2026-09-24: alan UTC saklanır; duvar saati (UTC+3) ile kıyas pencereyi 3 saat kaydırıyordu
        if (now < quiz.StartDate)
            throw new ConflictException("Bu yarışma henüz başlamadı.", "QUIZ_NOT_STARTED");
        if (now > quiz.EndDate)
            throw new ConflictException("Bu yarışmanın süresi doldu.", "QUIZ_EXPIRED");

        var residencyViolation = Nexora.Domain.Common.EligibilityRules.CheckResidency(
            quiz.ResidencyMode, participant, null, SultangaziDistrictCode);
        if (residencyViolation is not null)
            throw new ConflictException(residencyViolation.Message, residencyViolation.ErrorCode);

        // Kilit her zaman alınır (MaxParticipants=0 dahil) — sadece MaxParticipants>0 iken kilit
        // almak, limitsiz quiz'lerde aynı katılımcının eşzamanlı ilk-katılım isteklerinin
        // "daha önce katıldı mı" kontrolü ile katılım ekleme arasında yarışa girip iki ayrı
        // sadakat puanı ödülü almasına yol açıyordu (bkz. quiz-race-condition-2026-07-30, P0).
        // Redis kilidi katılımcı+quiz bazlı olduğu için farklı katılımcılar birbirini bloklamaz.
        var lockKey = $"quiz:submit-lock:{quizId}:{participant.Tckn}";
        string? lockToken = null;
        for (var attempt = 0; attempt < 100 && lockToken is null; attempt++)
        {
            lockToken = await redis.TryAcquireLockAsync(lockKey, TimeSpan.FromSeconds(3), ct);
            if (lockToken is null) await Task.Delay(150, ct);
        }
        if (lockToken is null)
            throw new ConflictException("İşleminiz işleniyor, lütfen birkaç saniye sonra tekrar deneyin.", "OPERATION_IN_PROGRESS");

        // Hata #8 düzeltmesi (2026-08-26): Yukarıdaki kilit katılımcı+quiz bazlı olduğu için
        // MaxParticipants kontrolünü hiç korumuyordu — farklı katılımcılar birbirini bloklamadan
        // paralel olarak "henüz dolmadı" görüp aynı anda INSERT edebiliyordu (kapasite limiti
        // tamamen atlatılabiliyordu, canlı 2-eşzamanlı-istek testiyle doğrulandı). MaxParticipants>0
        // olan quiz'lerde ek olarak quiz-genelinde paylaşılan bir kilit alınıyor; bu kilit kapasite
        // kontrolünden INSERT'in tamamlanmasına kadar (SubmitLockedAsync içindeki SaveChangesAsync
        // dahil) elde tutulur, böylece kapasite kontrolü + kayıt tek bir katılımcı için serileşir.
        var maxParticipantsLockKey = quiz.MaxParticipants > 0 ? $"quiz:max-participants-lock:{quizId}" : null;
        string? maxParticipantsLockToken = null;

        try
        {
            if (maxParticipantsLockKey is not null)
            {
                for (var attempt = 0; attempt < 100 && maxParticipantsLockToken is null; attempt++)
                {
                    maxParticipantsLockToken = await redis.TryAcquireLockAsync(maxParticipantsLockKey, TimeSpan.FromSeconds(5), ct);
                    if (maxParticipantsLockToken is null) await Task.Delay(150, ct);
                }
                if (maxParticipantsLockToken is null)
                    throw new ConflictException("İşleminiz işleniyor, lütfen birkaç saniye sonra tekrar deneyin.", "OPERATION_IN_PROGRESS");
            }

            // isRetry kontrolü kilit ALINDIKTAN SONRA (tekrar) yapılır. Önceden kilit dışında
            // yapılıyordu — aynı katılımcının gerçekten eşzamanlı (paralel, art arda değil) iki
            // ilk-katılım isteği, her ikisi de "henüz katılmamış" görüp kilide sırayla girdiğinde,
            // ikinci istek INSERT sırasında IX_QuizParticipations_QuizId_Tckn unique constraint'ine
            // çarpıp ham bir 23505/DUPLICATE_RECORD hatası veriyordu (canlı 5-eşzamanlı-istek testiyle
            // doğrulandı, bkz. quiz-true-concurrency-first-submit-2026-07-30 bulgusu). Puan çoğaltma
            // olmuyordu (constraint ikinci satırı engelliyordu) ama kullanıcıya anlamsız bir hata
            // dönüyordu. Kontrol kilit içinde tekrarlanınca ikinci istek artık ya temiz bir
            // ALREADY_PARTICIPATED (AllowRetry=false) alır ya da eski katılımı temizleyip normal
            // devam eder (AllowRetry=true) — DB'ye asla çakışan iki INSERT gitmez.
            var isRetry = await uow.Quizzes.ParticipationExistsAsync(quizId, participant.Tckn, ct);
            if (isRetry)
            {
                if (!quiz.AllowRetry)
                    throw new ConflictException("Bu yarışmaya daha önce katıldınız, tekrar katılamazsınız.", "ALREADY_PARTICIPATED");

                await uow.Quizzes.RemoveParticipationAsync(quizId, participant.Tckn, ct);
            }

            if (quiz.MaxParticipants > 0)
            {
                var currentCount = (await uow.Quizzes.ParticipantCountsAsync([quizId], ct)).GetValueOrDefault(quizId, 0);
                if (currentCount >= quiz.MaxParticipants)
                    throw new ConflictException("Bu yarışma için maksimum katılımcı sayısına ulaşıldı.", "QUIZ_MAX_PARTICIPANTS_REACHED");
            }

            return await SubmitLockedAsync(quiz, participant, req, ct);
        }
        finally
        {
            if (maxParticipantsLockToken is not null) await redis.ReleaseLockAsync(maxParticipantsLockKey!, maxParticipantsLockToken, ct);
            await redis.ReleaseLockAsync(lockKey, lockToken, ct);
        }
    }

    private async Task<CitizenQuizSubmitResultDto> SubmitLockedAsync(Quiz quiz, Domain.Entities.Participants.Participant participant, CitizenQuizSubmitRequest req, CancellationToken ct)
    {
        var quizId = quiz.Id;

        if (quiz.AgeGroupId.HasValue)
        {
            var ageGroup = await uow.QuizAgeGroups.GetByIdAsync(quiz.AgeGroupId.Value, ct);
            var participantAge = CalculateAge(participant.BirthDate);
            if (ageGroup is null || !ageGroup.Contains(participantAge))
                throw new ForbiddenException("Bu yarışma yaş grubunuza uygun değil.", "AGE_GROUP_NOT_ELIGIBLE");
        }

        var questions = await uow.Quizzes.GetQuestionsAsync(quizId, ct);

        var attempt = await redis.GetAsync<QuizAttemptState>(AttemptKey(quizId, participant.Tckn), ct);

        if (quiz.DurationMinutes > 0)
        {
            if (attempt is null)
                throw new ConflictException("Yarışma oturumunuz bulunamadı. Lütfen yarışmayı yeniden açıp tekrar deneyin.", "QUIZ_ATTEMPT_NOT_FOUND");

            var elapsedSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - attempt.StartedAtUnix;
            var graceSeconds = config.GetValue("QuizSettings:SubmitGraceSeconds", 30);
            if (elapsedSeconds > quiz.DurationMinutes * 60 + graceSeconds)
                throw new ConflictException("Süre doldu.", "QUIZ_TIME_EXCEEDED");
        }

        var orderedQuestions = ResolveServedOrder(questions, attempt);

        var submitted = req.Answers ?? [];
        var seenIndexes = new HashSet<int>();
        foreach (var a in submitted)
        {
            if (a.QuestionIndex < 0 || a.QuestionIndex >= orderedQuestions.Count)
                throw new ConflictException("Gönderilen cevaplar bu yarışmanın sorularıyla eşleşmiyor.", "ANSWER_INDEX_INVALID");
            if (!seenIndexes.Add(a.QuestionIndex))
                throw new ConflictException("Aynı soru için birden fazla cevap gönderilemez.", "ANSWER_DUPLICATE");
        }

        // Pas hakkı (PassRights): quiz.PassRights kadar soru "pas geçildi" işaretlenebilir.
        // Pas geçilen soru toplam soru sayısına dahildir ama doğru/yanlış sayılmaz ve
        // NegativeMarking cezasına tabi değildir (bkz. loyalty-ecosystem-audit-2026-08-04,
        // PassRights alanı önceden hiçbir yerde okunmuyordu — dead config field'dı).
        var passedCount = submitted.Count(a => a.IsPassed);
        if (passedCount > quiz.PassRights)
            throw new ConflictException($"En fazla {quiz.PassRights} soru pas geçilebilir.", "PASS_RIGHTS_EXCEEDED");

        var answerByIndex = submitted.ToDictionary(a => a.QuestionIndex);

        var correctAnswers = 0;
        var totalScore = 0;

        // Kullanıcı bulgusu (2026-08-09): admin panelde her soru için ayrı bir süre
        // limiti (TimeLimit) yapılandırılabiliyor ("Soru Süresi") ama bu limit hiçbir
        // yerde sunucu tarafında uygulanmıyordu — istemci ne gönderirse gönderilsin
        // kabul ediliyordu. Süre limiti artık istemcide de (QuizPlayModal.tsx, per-
        // question countdown) uygulanıyor, ama istemciye güvenilemez (biri isteği
        // elle/araçla değiştirip süresiz cevap gönderebilir). Bu yüzden burada da
        // TimeSpent, sorunun TimeLimit'ini (+ kısa bir tolerans payı) aşıyorsa cevap
        // doğru olsa bile "süresi geçti" sayılır: puan verilmez, doğru sayılmaz —
        // tıpkı hiç cevaplanmamış gibi (ama yanlış/negatif puan cezası da almaz).
        var perQuestionGraceSeconds = config.GetValue("QuizSettings:PerQuestionGraceSeconds", 3);

        var answersForJson = orderedQuestions.Select((q, idx) =>
        {
            answerByIndex.TryGetValue(idx, out var a);
            var isPassed = a?.IsPassed ?? false;
            var correctOption = q.CorrectAnswer >= 0 && q.CorrectAnswer < q.Options.Count
                ? q.Options[q.CorrectAnswer]
                : string.Empty;
            var timedOut = !isPassed && q.TimeLimit > 0 && a is not null && a.TimeSpent > q.TimeLimit + perQuestionGraceSeconds;
            var hasSelection = !isPassed && !timedOut && a is not null && !string.IsNullOrWhiteSpace(a.SelectedAnswer);
            var isCorrect = hasSelection && string.Equals(a!.SelectedAnswer, correctOption, StringComparison.Ordinal);
            if (isCorrect)
            {
                correctAnswers++;
                totalScore += q.Points;
            }
            else if (quiz.NegativeMarking && hasSelection)
            {
                totalScore -= q.Points;
            }
            return new { questionIndex = idx, selectedAnswer = (isPassed || timedOut) ? "" : (a?.SelectedAnswer ?? ""), isCorrect, isPassed, timeSpent = a?.TimeSpent ?? 0 };
        }).ToList();

        if (totalScore < 0) totalScore = 0;

        var answersJson = JsonSerializer.Serialize(answersForJson);

        var age = CalculateAge(participant.BirthDate);
        var ageGroupId = quiz.AgeGroupId ?? await ResolveAgeGroupIdAsync(age, ct);

        var serverTimeSpent = attempt is not null
            ? (int)Math.Max(0, DateTimeOffset.UtcNow.ToUnixTimeSeconds() - attempt.StartedAtUnix)
            : Math.Max(0, req.TotalTimeSpent);

        var participation = QuizParticipation.Create(
            quizId,
            participant.FullName,
            participant.Tckn,
            totalScore,
            orderedQuestions.Count,
            correctAnswers,
            serverTimeSpent,
            DateTime.UtcNow,
            answersJson,
            age,
            ageGroupId,
            quiz.CategoryId,
            passedCount);

        await uow.Quizzes.AddParticipationAsync(participation, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "QuizParticipation",
            EntityId = participation.Id,
            Module = "Quiz",
            Description = $"Yarışma cevabı gönderildi: {quiz.Title} — {participant.FullName} ({correctAnswers}/{orderedQuestions.Count} doğru, {totalScore} puan)",
            NewValues = JsonSerializer.Serialize(new { participation.Id, quizId, totalScore, correctAnswers, totalQuestions = orderedQuestions.Count, timeSpent = serverTimeSpent }),
        }, ct);

        await redis.RemoveAsync(AttemptKey(quizId, participant.Tckn), ct);

        // ReferenceId olarak participation.Id (retry'de her seferinde yeni GUID) DEĞİL,
        // sabit quizId kullanılıyor — böylece LoyaltyService.AwardPointsAsync'teki
        // idempotency kontrolü aynı katılımcının aynı quiz'e AllowRetry=true ile tekrar tekrar
        // (ardışık veya eşzamanlı) cevap gönderip puanı çoğaltmasını engeller
        // (bkz. quiz-allowretry-puan-coklama-2026-07-30 bulgusu, P0).
        await loyalty.AwardPointsAsync(new AwardPointsRequest(participant.Id, "quiz_complete", quizId.ToString()), ct);

        var ranked = await uow.Quizzes.GetRankedParticipationsAsync(quizId, ct);
        var rank = ranked.FindIndex(p => p.Tckn == participant.Tckn) + 1;
        if (rank == 0) rank = ranked.Count + 1;

        var successRate = orderedQuestions.Count == 0 ? 0
            : (int)Math.Round((double)correctAnswers / orderedQuestions.Count * 100);

        var isPassed = quiz.PassingScore <= 0 || totalScore >= quiz.PassingScore;

        return new CitizenQuizSubmitResultDto(
            participation.Id,
            totalScore,
            orderedQuestions.Count,
            correctAnswers,
            orderedQuestions.Count - correctAnswers - passedCount,
            passedCount,
            successRate,
            rank,
            ranked.Count,
            isPassed,
            quiz.PassingScore);
    }

    public async Task<CitizenQuizCheckAnswerResultDto> CheckAnswerAsync(Guid quizId, CitizenQuizCheckAnswerRequest req, CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var participant = await uow.Participants.GetByIdAsync(actorId, ct)
            ?? throw new NotFoundException("Vatandaş kaydı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var quiz = await uow.Quizzes.GetByIdAsync(quizId, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        if (!quiz.IsActive)
            throw new ConflictException("Bu yarışma artık aktif değil.", "QUIZ_NOT_ACTIVE");

        var attempt = await redis.GetAsync<QuizAttemptState>(AttemptKey(quizId, participant.Tckn), ct)
            ?? throw new ConflictException("Yarışma oturumu bulunamadı. Lütfen yarışmayı yeniden başlatın.", "QUIZ_ATTEMPT_NOT_FOUND");

        var questions = await uow.Quizzes.GetQuestionsAsync(quizId, ct);
        var ordered = ResolveServedOrder(questions, attempt);

        if (req.QuestionIndex < 0 || req.QuestionIndex >= ordered.Count)
            throw new ConflictException("Gönderilen cevap bu yarışmanın sorularıyla eşleşmiyor.", "ANSWER_INDEX_INVALID");

        var q = ordered[req.QuestionIndex];
        var correctOption = q.CorrectAnswer >= 0 && q.CorrectAnswer < q.Options.Count
            ? q.Options[q.CorrectAnswer]
            : string.Empty;

        var isCorrect = !string.IsNullOrWhiteSpace(req.SelectedAnswer)
            && string.Equals(req.SelectedAnswer, correctOption, StringComparison.Ordinal);

        return new CitizenQuizCheckAnswerResultDto(req.QuestionIndex, isCorrect);
    }

    private static List<QuizQuestion> ResolveServedOrder(IReadOnlyList<QuizQuestion> questions, QuizAttemptState? attempt)
    {
        if (attempt is null || attempt.QuestionOrder.Count == 0)
            return questions.OrderBy(q => q.Order).ToList();

        var byId = questions.ToDictionary(q => q.Id);
        var ordered = attempt.QuestionOrder
            .Where(byId.ContainsKey)
            .Select(id => byId[id])
            .ToList();

        foreach (var q in questions.OrderBy(q => q.Order))
            if (!attempt.QuestionOrder.Contains(q.Id))
                ordered.Add(q);

        return ordered;
    }

    private static string AttemptKey(Guid quizId, string tckn) => $"quiz:attempt:{quizId}:{tckn}";

    private sealed record QuizAttemptState(long StartedAtUnix, List<Guid> QuestionOrder);

    public async Task<CitizenQuizLeaderboardDto> GetLeaderboardAsync(Guid quizId, string? scope, CancellationToken ct)
    {
        var quiz = await uow.Quizzes.GetByIdAsync(quizId, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        var normalizedScope = string.IsNullOrWhiteSpace(scope) ? "general" : scope.Trim().ToLowerInvariant();

        List<Domain.Entities.Quizzes.QuizParticipation> ranked;
        if (normalizedScope == "age")
        {
            var myTckn = await GetTcknAsync(ct);
            var myAgeGroupId = quiz.AgeGroupId;
            if (myTckn is not null)
            {
                var mine = (await uow.Quizzes.GetRankedParticipationsAsync(quizId, ct))
                    .FirstOrDefault(p => p.Tckn == myTckn);
                if (mine?.AgeGroupId is not null) myAgeGroupId = mine.AgeGroupId;
            }
            ranked = myAgeGroupId.HasValue
                ? await uow.Quizzes.GetRankedByAgeGroupAsync(quizId, myAgeGroupId.Value, ct)
                : await uow.Quizzes.GetRankedParticipationsAsync(quizId, ct);
        }
        else if (normalizedScope == "category")
        {
            ranked = await uow.Quizzes.GetRankedByCategoryAsync(quiz.CategoryId, ct);
        }
        else
        {
            ranked = await uow.Quizzes.GetRankedParticipationsAsync(quizId, ct);
        }

        var rankings = ranked.Select((p, idx) => new CitizenQuizRankingDto(
            idx + 1,
            AnonymizeName(p.ParticipantName),
            p.Score,
            p.CorrectAnswers,
            p.TimeSpent,
            p.CompletedAt)).ToList();

        return new CitizenQuizLeaderboardDto(
            quiz.Id, quiz.Title, ranked.Count, quiz.QuestionCount, rankings);
    }

    private static int CalculateAge(DateTime birthDate)
    {
        var today = TurkeyTime.TodayDate();
        var age = today.Year - birthDate.Year;
        if (birthDate.Date > today.AddYears(-age)) age--;
        return age < 0 ? 0 : age;
    }

    private async Task<Guid?> ResolveAgeGroupIdAsync(int age, CancellationToken ct)
    {
        var groups = await uow.QuizAgeGroups.GetActiveAsync(ct);
        var match = groups.FirstOrDefault(g => g.Contains(age));
        return match?.Id;
    }

    private async Task<string?> GetTcknAsync(CancellationToken ct)
    {
        if (!currentUser.Id.HasValue) return null;
        var p = await uow.Participants.GetByIdAsync(currentUser.Id.Value, ct);
        return p?.Tckn;
    }

    private static string AnonymizeName(string fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName)) return "***";
        var parts = fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 1) return parts[0][0] + "***";
        return parts[0] + " " + parts[^1][0] + "***";
    }
}
