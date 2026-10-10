using System.Text.Json;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Quizzes;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Notifications.Dtos;
using Nexora.Application.Features.Quizzes.Dtos;
using Nexora.Domain.Entities.Quizzes;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class QuizService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IActivityLogger log,
    IAuditService audit,
    IModuleNotificationSettingsService moduleSettings,
    INotificationService notifications,
    INotificationDispatcher dispatcher,
    ISmsService sms,
    ISmsGovernanceService smsGovernance) : IQuizService
{
    public async Task<ModuleManualMessageResultDto> SendManualMessageAsync(ModuleManualMessageRequest req, CancellationToken ct)
    {
        // BULGU (2026-09-21 uçtan uca test, K7 ile aynı desen): req.Ids null gönderildiğinde
        // NullReferenceException → çıplak 500 veriyordu.
        if (req.Ids is null || req.Ids.Count == 0) throw new ConflictException("En az bir kayıt seçmelisiniz.", "NO_TARGET");
        if (!req.Sms && !req.Notify) throw new ConflictException("En az bir kanal seçin.", "NO_CHANNEL");

        var participations = req.TargetKind == "quiz"
            ? await uow.Quizzes.GetParticipationsByQuizIdsAsync(req.Ids, ct)
            : req.TargetKind == "participation"
                ? await uow.Quizzes.GetParticipationsByIdsAsync(req.Ids, ct)
                : throw new ConflictException("Geçersiz hedef türü.", "INVALID_TARGET");

        if (participations.Count == 0) return new ModuleManualMessageResultDto(0, 0, 0, false);
        var settings = await moduleSettings.GetAsync("quiz", ct);
        var template = settings.NotificationTemplates?.FirstOrDefault(t => t.Event == req.TemplateEvent)
            ?? throw new ConflictException("Şablon bulunamadı.", "TEMPLATE_NOT_FOUND");

        // Şablon/validasyon geçtikten SONRA çağrılır: aksi halde başarısız bir
        // istek (ör. şablon bulunamadı) bile kullanıcının günlük SMS hakkını
        // gereksiz yere tüketirdi (2026-09-19 canlı testte tespit edildi).
        if (req.Sms) await smsGovernance.EnsureCanSendAsync("Quiz", req.TemplateEvent, req.Ids.Count, req.SmsOtp, ct);
        var smsTemplate = string.IsNullOrWhiteSpace(req.CustomText) ? template.SmsBody : req.CustomText!;
        var notifyTemplate = string.IsNullOrWhiteSpace(req.CustomText) ? template.NotifyBody : req.CustomText!;

        var quizIds = participations.Select(p => p.QuizId).Distinct().ToList();
        var quizzes = (await uow.Quizzes.FindAsync(q => quizIds.Contains(q.Id), ct)).ToDictionary(q => q.Id, q => q.Title);
        var tckns = participations.Select(p => p.Tckn).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList();
        var participants = (await uow.Participants.FindAsync(p => tckns.Contains(p.Tckn), ct)).ToDictionary(p => p.Tckn, p => p);

        var recipients = 0; var smsSent = 0; var notifs = 0;
        foreach (var p in participations)
        {
            if (!participants.TryGetValue(p.Tckn, out var participant)) continue;
            recipients++;
            var vars = new Dictionary<string, string?> { ["yarisma"] = quizzes.GetValueOrDefault(p.QuizId), ["puan"] = p.Score.ToString() };
            if (req.Notify && template.NotifyEnabled)
            {
                await notifications.CreateAsync(participant.Id, "Bilgi Yarışması", ModuleMessageRenderer.Render(notifyTemplate, participant.FullName, vars), "quiz-manual", ct);
                notifs++;
            }
            if (req.Sms && template.SmsEnabled && !string.IsNullOrWhiteSpace(participant.Phone))
            {
                try { if (await dispatcher.SendSmsAsync(participant.Phone!, ModuleMessageRenderer.Render(smsTemplate, participant.FullName, vars), ct)) smsSent++; }
                catch (Exception ex) { log.LogStepResult("QuizManualSmsFailed", new { participant.Id, ex.Message }); }
            }
        }
        return new ModuleManualMessageResultDto(recipients, smsSent, notifs, req.Sms && smsSent > 0 && sms.IsMockMode);
    }
    public async Task<PagedResult<QuizDto>> GetPagedAsync(QuizListParams p, CancellationToken ct)
    {
        var paged = await uow.Quizzes.GetPagedAsync(p, ct);
        var categoryIds = paged.Items.Select(q => q.CategoryId).Distinct().ToList();
        var quizIds = paged.Items.Select(q => q.Id).ToList();

        var categories = (await uow.QuizCategories.GetByIdsAsync(categoryIds, ct))
            .ToDictionary(c => c.Id, c => c);
        var participantCounts = await uow.Quizzes.ParticipantCountsAsync(quizIds, ct);

        var ageGroupIds = paged.Items.Where(q => q.AgeGroupId.HasValue).Select(q => q.AgeGroupId!.Value).Distinct().ToList();
        var ageGroups = ageGroupIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await uow.QuizAgeGroups.FindAsync(g => ageGroupIds.Contains(g.Id), ct)).ToDictionary(g => g.Id, g => g.Name);

        var subCategoryIds = paged.Items.Where(q => q.SubCategoryId.HasValue).Select(q => q.SubCategoryId!.Value).Distinct().ToList();
        var subCategories = subCategoryIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await uow.QuizCategories.GetByIdsAsync(subCategoryIds, ct)).ToDictionary(c => c.Id, c => c.Name);

        return new PagedResult<QuizDto>
        {
            Items = paged.Items.Select(q => ToDto(q,
                categories.GetValueOrDefault(q.CategoryId),
                participantCounts.GetValueOrDefault(q.Id),
                q.AgeGroupId.HasValue ? ageGroups.GetValueOrDefault(q.AgeGroupId.Value) : null,
                q.SubCategoryId.HasValue ? subCategories.GetValueOrDefault(q.SubCategoryId.Value) : null)).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<List<QuizOptionDto>> GetOptionsAsync(CancellationToken ct)
    {
        var quizzes = await uow.Quizzes.GetForOptionsAsync(ct);
        return quizzes.Select(q => new QuizOptionDto(q.Id.ToString(), q.Title)).ToList();
    }

    public async Task<QuizSummaryDto> GetSummaryAsync(CancellationToken ct)
    {
        var (total, upcoming, ongoing, completed, active, passive) = await uow.Quizzes.GetSummaryCountsAsync(ct);
        var (totalParticipants, averageScore) = await uow.Quizzes.GetParticipationSummaryAsync(ct);
        return new QuizSummaryDto(total, upcoming, ongoing, completed, active, passive, totalParticipants, averageScore);
    }

    public async Task<QuizDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var quiz = await uow.Quizzes.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        var category = await uow.QuizCategories.GetByIdAsync(quiz.CategoryId, ct);
        var participantCount = (await uow.Quizzes.ParticipantCountsAsync([quiz.Id], ct)).GetValueOrDefault(quiz.Id);
        return ToDto(quiz, category, participantCount, await ResolveAgeGroupNameAsync(quiz.AgeGroupId, ct), await ResolveCategoryNameAsync(quiz.SubCategoryId, ct));
    }

    private async Task<string?> ResolveAgeGroupNameAsync(Guid? id, CancellationToken ct)
        => id.HasValue ? (await uow.QuizAgeGroups.GetByIdAsync(id.Value, ct))?.Name : null;

    private async Task<string?> ResolveCategoryNameAsync(Guid? id, CancellationToken ct)
        => id.HasValue ? (await uow.QuizCategories.GetByIdAsync(id.Value, ct))?.Name : null;

    public async Task<QuizDto> CreateAsync(CreateQuizRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Title });

        var category = await uow.QuizCategories.GetByIdAsync(req.CategoryId, ct)
            ?? throw new NotFoundException("Seçilen kategori bulunamadı.", "QUIZ_CATEGORY_NOT_FOUND");

        if (req.AgeGroupId.HasValue && await uow.QuizAgeGroups.GetByIdAsync(req.AgeGroupId.Value, ct) is null)
            throw new NotFoundException("Seçilen yaş grubu bulunamadı.", "QUIZ_AGE_GROUP_NOT_FOUND");

        var quiz = Quiz.Create(ToData(req), currentUser.Name);

        await uow.Quizzes.AddAsync(quiz, ct);
        await uow.SaveChangesAsync(ct);

        var dto = ToDto(quiz, category, 0, await ResolveAgeGroupNameAsync(quiz.AgeGroupId, ct), await ResolveCategoryNameAsync(quiz.SubCategoryId, ct));

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Quiz",
            EntityId = quiz.Id,
            Module = "Quiz",
            Description = $"Yarışma oluşturuldu: {quiz.Title}",
            NewValues = JsonSerializer.Serialize(dto),
        }, ct);

        return dto;
    }

    public async Task<QuizDto> UpdateAsync(Guid id, UpdateQuizRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var quiz = await uow.Quizzes.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        var category = await uow.QuizCategories.GetByIdAsync(req.CategoryId, ct)
            ?? throw new NotFoundException("Seçilen kategori bulunamadı.", "QUIZ_CATEGORY_NOT_FOUND");

        if (req.AgeGroupId.HasValue && await uow.QuizAgeGroups.GetByIdAsync(req.AgeGroupId.Value, ct) is null)
            throw new NotFoundException("Seçilen yaş grubu bulunamadı.", "QUIZ_AGE_GROUP_NOT_FOUND");

        var oldCount = (await uow.Quizzes.ParticipantCountsAsync([quiz.Id], ct)).GetValueOrDefault(quiz.Id);
        var oldValues = JsonSerializer.Serialize(ToDto(quiz, category, oldCount));

        quiz.Update(ToData(req), currentUser.Name);

        uow.Quizzes.Update(quiz);
        await uow.SaveChangesAsync(ct);

        var participantCount = (await uow.Quizzes.ParticipantCountsAsync([quiz.Id], ct)).GetValueOrDefault(quiz.Id);
        var dto = ToDto(quiz, category, participantCount, await ResolveAgeGroupNameAsync(quiz.AgeGroupId, ct), await ResolveCategoryNameAsync(quiz.SubCategoryId, ct));

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Quiz",
            EntityId = quiz.Id,
            Module = "Quiz",
            Description = $"Yarışma güncellendi: {quiz.Title}",
            OldValues = oldValues,
            NewValues = JsonSerializer.Serialize(dto),
        }, ct);

        return dto;
    }

    public async Task<QuizDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var quiz = await uow.Quizzes.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        if (quiz.IsActive) quiz.Deactivate();
        else quiz.Activate();

        uow.Quizzes.Update(quiz);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Quiz",
            EntityId = quiz.Id,
            Module = "Quiz",
            Description = $"Yarışma {(quiz.IsActive ? "aktif edildi" : "pasife alındı")}: {quiz.Title}",
        }, ct);

        var category = await uow.QuizCategories.GetByIdAsync(quiz.CategoryId, ct);
        var participantCount = (await uow.Quizzes.ParticipantCountsAsync([quiz.Id], ct)).GetValueOrDefault(quiz.Id);
        return ToDto(quiz, category, participantCount);
    }

    public async Task ArchiveAsync(Guid id, CancellationToken ct)
    {
        log.LogStep(nameof(ArchiveAsync), new { id });

        var quiz = await uow.Quizzes.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        quiz.MarkArchived(currentUser.Name);
        uow.Quizzes.Update(quiz);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SoftDelete,
            EntityType = "Quiz",
            EntityId = quiz.Id,
            Module = "Quiz",
            Description = $"Yarışma arşive taşındı: {quiz.Title}",
        }, ct);
    }

    public async Task<QuizDto> RestoreAsync(Guid id, CancellationToken ct)
    {
        log.LogStep(nameof(RestoreAsync), new { id });

        var quiz = await uow.Quizzes.GetIncludingArchivedAsync(id, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        if (!quiz.IsDeleted)
            throw new ConflictException("Bu yarışma zaten arşivde değil.", "QUIZ_NOT_ARCHIVED");

        quiz.Restore();
        uow.Quizzes.Update(quiz);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Restore,
            EntityType = "Quiz",
            EntityId = quiz.Id,
            Module = "Quiz",
            Description = $"Yarışma arşivden geri alındı: {quiz.Title}",
        }, ct);

        var category = await uow.QuizCategories.GetByIdAsync(quiz.CategoryId, ct);
        var participantCount = (await uow.Quizzes.ParticipantCountsAsync([quiz.Id], ct)).GetValueOrDefault(quiz.Id);
        return ToDto(quiz, category, participantCount);
    }

    public async Task HardDeleteAsync(Guid id, CancellationToken ct)
    {
        if (!currentUser.IsSuperAdmin)
            throw new ForbiddenException("Bu işlem için süper admin yetkisi gereklidir.", "SUPERADMIN_REQUIRED");

        var quiz = await uow.Quizzes.GetIncludingArchivedAsync(id, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        var participantCount = (await uow.Quizzes.ParticipantCountsAsync([quiz.Id], ct)).GetValueOrDefault(quiz.Id);
        var oldValues = JsonSerializer.Serialize(ToDto(quiz, null, participantCount));

        await uow.Quizzes.HardDeleteAsync(quiz, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "Quiz",
            EntityId = quiz.Id,
            Module = "Quiz",
            Level = AuditLogLevel.Warning,
            Description = $"Yarışma kalıcı olarak silindi (soruları ve {participantCount} katılımıyla birlikte): {quiz.Title}",
            OldValues = oldValues,
            AdditionalDataJson = JsonSerializer.Serialize(new { participantCount, quiz.QuestionCount }),
        }, ct);
    }

    public async Task<List<QuizQuestionDto>> GetQuestionsAsync(Guid quizId, CancellationToken ct)
    {
        _ = await uow.Quizzes.GetByIdAsync(quizId, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        var questions = await uow.Quizzes.GetQuestionsAsync(quizId, ct);
        return questions.Select(ToQuestionDto).ToList();
    }

    public async Task<List<QuizQuestionDto>> SaveQuestionsAsync(Guid quizId, SaveQuizQuestionsRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(SaveQuestionsAsync), new { quizId, Count = req.Questions.Count });

        var quiz = await uow.Quizzes.GetByIdAsync(quizId, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        var newQuestions = req.Questions.Select((q, index) => QuizQuestion.Create(
            quiz.Id, index, q.Question, q.Options, q.CorrectAnswer, q.CategoryId, q.Difficulty, q.Points, q.TimeLimit,
            q.SubCategoryId, q.AgeGroupId, q.Language, q.Tags)).ToList();

        var oldQuestionCount = quiz.QuestionCount;

        await uow.Quizzes.ReplaceQuestionsAsync(quizId, newQuestions, ct);
        quiz.SetQuestionCount(newQuestions.Count);
        uow.Quizzes.Update(quiz);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "QuizQuestion",
            EntityId = quiz.Id,
            Module = "Quiz",
            Description = $"Yarışma soruları güncellendi: {quiz.Title} ({oldQuestionCount} → {newQuestions.Count} soru)",
            AdditionalDataJson = JsonSerializer.Serialize(new { quizId, oldQuestionCount, newQuestionCount = newQuestions.Count }),
        }, ct);

        var saved = await uow.Quizzes.GetQuestionsAsync(quizId, ct);
        return saved.Select(ToQuestionDto).ToList();
    }

    public async Task<PagedResult<QuizParticipationDto>> GetParticipantsAsync(Guid quizId, QuizParticipantListParams p, CancellationToken ct)
    {
        _ = await uow.Quizzes.GetByIdAsync(quizId, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        var paged = await uow.Quizzes.GetParticipantsAsync(quizId, p, ct);
        return new PagedResult<QuizParticipationDto>
        {
            Items = paged.Items.Select(ToParticipationDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<QuizParticipationDetailDto> GetParticipationDetailAsync(Guid quizId, Guid participationId, CancellationToken ct)
    {
        var participation = await uow.Quizzes.GetParticipationAsync(quizId, participationId, ct)
            ?? throw new NotFoundException("Katılım bulunamadı.", "QUIZ_PARTICIPATION_NOT_FOUND");

        var ranked = await uow.Quizzes.GetRankedParticipationsAsync(quizId, ct);
        var rank = ranked.FindIndex(x => x.Id == participation.Id) + 1;

        // Kullanıcı bulgusu (2026-08-09): katılımcı detayı admin panelde "beyaz sayfa"
        // veriyordu. Kök neden: ParticipantQuizService.SubmitAsync, AnswersJson'ı
        // {questionIndex, selectedAnswer(metin), isCorrect, isPassed, timeSpent} şeklinde
        // yazıyor; ama bu metod eski {order, question, options, selectedAnswer(int index),
        // correctAnswer, ...} şeklini bekleyen QuizAnswerDetailDto'ya doğrudan deserialize
        // etmeye çalışıyordu. Şekil uyuşmazlığı JsonException fırlatıyor, DeserializeAnswers
        // bunu yutup [] dönüyordu (veri kaybı) — ancak selectedAnswer rakamsal bir metinse
        // (örn "2") System.Text.Json'ın Web defaults'undaki AllowReadingFromString sayesinde
        // int'e çevrilebiliyor ve deserialize "başarılı" oluyordu; bu durumda Question/Options
        // alanları null kalıyor, admin panelin QuizResultDetailModal.tsx'i
        // `a.options[a.selectedAnswer]` satırında null referans ile çöküyor → React ağacı
        // tamamen unmount oluyor (admin-panelde global ErrorBoundary de yok) → beyaz sayfa.
        // Çözüm: Ham JSON'ı esnek şekilde okuyup gerçek soru verisiyle (QuizQuestion) yeniden
        // eşleştiriyoruz; hem yeni (questionIndex/metin cevap) hem eski (order/index cevap)
        // kayıt şekillerini destekler.
        var questions = await uow.Quizzes.GetQuestionsAsync(quizId, ct);
        var orderedQuestions = questions.OrderBy(q => q.Order).ToList();
        var answers = BuildAnswerDetails(participation.AnswersJson, orderedQuestions);

        return new QuizParticipationDetailDto(
            participation.Id, participation.QuizId, participation.ParticipantName, participation.Tckn,
            participation.Score, participation.TotalQuestions, participation.CorrectAnswers, participation.WrongAnswers,
            Rate(participation.CorrectAnswers, participation.TotalQuestions), participation.TimeSpent, participation.CompletedAt,
            rank < 1 ? ranked.Count : rank, ranked.Count, answers);
    }

    public async Task<QuizLeaderboardDto> GetLeaderboardAsync(Guid quizId, string? scope, CancellationToken ct)
    {
        var quiz = await uow.Quizzes.GetByIdAsync(quizId, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        var normalizedScope = string.IsNullOrWhiteSpace(scope) ? "general" : scope.Trim().ToLowerInvariant();

        var ranked = normalizedScope switch
        {
            "age" when quiz.AgeGroupId.HasValue => await uow.Quizzes.GetRankedByAgeGroupAsync(quizId, quiz.AgeGroupId.Value, ct),
            "category" => await uow.Quizzes.GetRankedByCategoryAsync(quiz.CategoryId, ct),
            _ => await uow.Quizzes.GetRankedParticipationsAsync(quizId, ct),
        };

        var rankings = ranked.Select((x, index) => new QuizRankingDto(
            index + 1, x.ParticipantName, x.Tckn, x.Score, x.CorrectAnswers, x.TotalQuestions, x.TimeSpent, x.CompletedAt)).ToList();

        return new QuizLeaderboardDto(quiz.Id, ranked.Count, quiz.QuestionCount, rankings);
    }

    // Yönetim > Sorular ekranında istenen (2026-09-20): her sorunun şıkları, doğru cevabı
    // ve kaç katılımcının hangi şıkkı işaretlediği/kaç doğru-kaç yanlış yapıldığı bilgisi.
    // Var olan BuildAnswerDetails ile aynı esnek (yeni/eski AnswersJson şekli) çözümleme
    // mantığını katılımcı bazında tekrar kullanıp sonuçları soru bazında topluyoruz.
    public async Task<QuizStatsDto> GetQuestionStatsAsync(Guid quizId, CancellationToken ct)
    {
        _ = await uow.Quizzes.GetByIdAsync(quizId, ct)
            ?? throw new NotFoundException("Yarışma bulunamadı.", "QUIZ_NOT_FOUND");

        var orderedQuestions = (await uow.Quizzes.GetQuestionsAsync(quizId, ct)).OrderBy(q => q.Order).ToList();
        var participations = await uow.Quizzes.GetParticipationsByQuizIdsAsync([quizId], ct);

        var correctCounts = new int[orderedQuestions.Count];
        var wrongCounts = new int[orderedQuestions.Count];
        var skippedCounts = new int[orderedQuestions.Count];
        var optionCounts = orderedQuestions.Select(q => new int[q.Options.Count]).ToList();

        foreach (var participation in participations)
        {
            var answers = BuildAnswerDetails(participation.AnswersJson, orderedQuestions);
            foreach (var a in answers)
            {
                if (a.Order < 0 || a.Order >= orderedQuestions.Count) continue;
                if (a.SelectedAnswer < 0)
                {
                    skippedCounts[a.Order]++;
                    continue;
                }
                if (a.IsCorrect) correctCounts[a.Order]++;
                else wrongCounts[a.Order]++;

                if (a.SelectedAnswer < optionCounts[a.Order].Length)
                    optionCounts[a.Order][a.SelectedAnswer]++;
            }
        }

        var questionStats = orderedQuestions.Select((q, i) =>
        {
            var totalAnswered = correctCounts[i] + wrongCounts[i];
            var breakdown = q.Options.Select((opt, optIndex) => new QuizOptionStatDto(
                opt, optionCounts[i][optIndex], optIndex == q.CorrectAnswer)).ToList();
            return new QuizQuestionStatDto(
                q.Order, q.Question, q.Options, q.CorrectAnswer,
                totalAnswered, correctCounts[i], wrongCounts[i], skippedCounts[i], breakdown);
        }).ToList();

        return new QuizStatsDto(quizId, participations.Count, questionStats);
    }

    private static QuizData ToData(CreateQuizRequest r)
        => new(r.CategoryId, r.Title, r.Description, r.StartDate, r.EndDate, r.Status, r.QuestionCount, r.PerQuestionTimeLimit, r.DurationMinutes, true,
            r.AgeGroupId, r.SubCategoryId, r.EducationLevel, r.PassingScore, r.NegativeMarking, r.RandomizeQuestions, r.AllowRetry, r.MaxParticipants, r.PassRights, r.ResidencyMode);

    private static QuizData ToData(UpdateQuizRequest r)
        => new(r.CategoryId, r.Title, r.Description, r.StartDate, r.EndDate, r.Status, r.QuestionCount, r.PerQuestionTimeLimit, r.DurationMinutes, true,
            r.AgeGroupId, r.SubCategoryId, r.EducationLevel, r.PassingScore, r.NegativeMarking, r.RandomizeQuestions, r.AllowRetry, r.MaxParticipants, r.PassRights, r.ResidencyMode);

    private static QuizDto ToDto(Quiz q, QuizCategory? category, int participantCount, string? ageGroupName = null, string? subCategoryName = null)
        => new(q.Id, q.Title, q.Description, q.StartDate, q.EndDate, q.Status,
            q.CategoryId, category?.Name ?? string.Empty, category?.Color,
            q.QuestionCount, q.PerQuestionTimeLimit, q.DurationMinutes, participantCount, q.IsActive,
            q.CreatedAt, q.UpdatedAt, q.DeletedAt, q.DeletedBy,
            q.AgeGroupId, ageGroupName, q.SubCategoryId, subCategoryName, q.EducationLevel,
            q.PassingScore, q.NegativeMarking, q.RandomizeQuestions, q.AllowRetry, q.MaxParticipants, q.PassRights, q.ResidencyMode);

    private static QuizQuestionDto ToQuestionDto(QuizQuestion q)
        => new(q.Id, q.QuizId, q.Order, q.Question, q.Options, q.CorrectAnswer, q.CategoryId, null, q.Difficulty, q.Points, q.TimeLimit,
            q.SubCategoryId, q.AgeGroupId, q.Language, q.Tags);

    private static QuizParticipationDto ToParticipationDto(QuizParticipation p)
        => new(p.Id, p.QuizId, p.ParticipantName, p.Tckn, p.Score, p.TotalQuestions, p.CorrectAnswers, p.WrongAnswers,
            Rate(p.CorrectAnswers, p.TotalQuestions), p.TimeSpent, p.CompletedAt);

    private static int Rate(int correct, int totalQuestions)
        => totalQuestions > 0 ? (int)Math.Round((double)correct / totalQuestions * 100) : 0;

    // Kullanıcı bulgusu (2026-08-09): bkz. GetParticipationDetailAsync üstündeki not.
    // AnswersJson iki farklı şekilde saklanmış olabilir:
    //  1) Güncel (ParticipantQuizService.SubmitAsync): questionIndex (int), selectedAnswer (metin/boş)
    //  2) Eski/legacy kayıtlar: order, question, options, selectedAnswer (int index), correctAnswer
    // Her iki durumda da soru metni/şıkları/doğru cevap indeksi güncel QuizQuestion tablosundan
    // (orderedQuestions) okunur — AnswersJson'daki gömülü metinlere güvenilmez, çünkü soru sonradan
    // düzenlenmiş olabilir ve zaten yeni şekilde bu alanlar hiç yok.
    private static List<QuizAnswerDetailDto> BuildAnswerDetails(string json, List<QuizQuestion> orderedQuestions)
    {
        if (orderedQuestions.Count == 0) return [];
        if (string.IsNullOrWhiteSpace(json)) return [];

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(json);
        }
        catch (JsonException)
        {
            return [];
        }

        using (doc)
        {
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return [];

            var result = new List<QuizAnswerDetailDto>();
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                var index = ReadInt(el, "questionIndex") ?? ReadInt(el, "order");
                if (index is null || index < 0 || index >= orderedQuestions.Count) continue;

                var q = orderedQuestions[index.Value];
                var isPassed = ReadBool(el, "isPassed") ?? false;
                var timeSpent = ReadInt(el, "timeSpent") ?? 0;

                // selectedAnswer güncel kayıtlarda cevap METNİ (örn "İstanbul"), eski kayıtlarda
                // şık İNDEKSİ (int) olarak saklanmış olabilir. Her ikisini de gerçek soru
                // şıklarıyla karşılaştırıp -1 (cevaplanmadı) veya doğru şık indeksine çeviriyoruz.
                var selectedIndex = ResolveSelectedIndex(el, q, isPassed);
                var isCorrect = !isPassed && selectedIndex >= 0 && selectedIndex == q.CorrectAnswer;

                result.Add(new QuizAnswerDetailDto(
                    q.Order, q.Question, q.Options, selectedIndex, q.CorrectAnswer,
                    isCorrect, timeSpent, isCorrect ? q.Points : 0, isPassed));
            }

            return result.OrderBy(a => a.Order).ToList();
        }
    }

    private static int ResolveSelectedIndex(JsonElement el, QuizQuestion q, bool isPassed)
    {
        if (isPassed) return -1;
        if (!el.TryGetProperty("selectedAnswer", out var sel)) return -1;

        if (sel.ValueKind == JsonValueKind.Number && sel.TryGetInt32(out var idx))
            return idx >= 0 && idx < q.Options.Count ? idx : -1;

        if (sel.ValueKind == JsonValueKind.String)
        {
            var text = sel.GetString();
            if (string.IsNullOrWhiteSpace(text)) return -1;

            // Önce metin eşleşmesi denenir (güncel format); eşleşmezse eski kayıtlarda
            // rakamsal metin olarak yazılmış bir indeks olabilir ("2" gibi).
            var byText = q.Options.FindIndex(o => string.Equals(o, text, StringComparison.Ordinal));
            if (byText >= 0) return byText;

            return int.TryParse(text, out var parsedIdx) && parsedIdx >= 0 && parsedIdx < q.Options.Count
                ? parsedIdx
                : -1;
        }

        return -1;
    }

    private static int? ReadInt(JsonElement el, string prop)
        => el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : null;

    private static bool? ReadBool(JsonElement el, string prop)
        => el.TryGetProperty(prop, out var v) && (v.ValueKind == JsonValueKind.True || v.ValueKind == JsonValueKind.False) ? v.GetBoolean() : null;
}
