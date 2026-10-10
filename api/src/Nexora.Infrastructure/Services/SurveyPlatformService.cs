using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Surveys;
using Nexora.Application.Features.Surveys.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Surveys;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Persistence;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// SultanŞehir Anket Platformu — saha operasyonu, kota, soru bankası ve karar
/// destek analitiği. Kaynak dokümanlar: docs/SultanSehir_Anket_Platformu_MD_Paketi.
///
/// Tasarım notu: analitik hesapları SurveyResponse üzerindeki mahalle/demografi
/// alanlarından yapılır; bu alanlar boşsa (eski kayıtlar, mobil uygulamadan gelen
/// kimlikli yanıtlar) Participant profilinden türetilir. Talep/şikâyet tarafı
/// mevcut CitizenSubmission (Muhtarlık) modülünden okunur — doküman 05'teki
/// "anket + talep korelasyonu" bu şekilde tek ekranda birleşir.
/// </summary>
public partial class SurveyPlatformService(
    AppDbContext db,
    ICurrentUser currentUser,
    IActivityLogger log,
    IAuditService audit,
    INotificationService notifications,
    INotificationDispatcher dispatcher,
    ISmsService sms) : ISurveyPlatformService
{
    private static readonly string[] AgeBands = ["0-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

    // ---------------------------------------------------------------- helpers

    /// <summary>
    /// Kullanıcı isteği (2026-09-01) + Doküman 07 §9: "Sadece Anket Oluşturabilir" yetkisindeki
    /// bir kullanıcı, frontend'in sekmeleri gizlemesine güvenmeden, saha görevi/kota/soru
    /// bankası/analitik gibi yönetim uçlarına doğrudan API çağrısıyla da erişemesin. Bu metod
    /// tüm yönetim uçlarının başında çağrılır; ihlalde 403 döner.
    /// </summary>
    /// <summary>
    /// Belirli bir izin anahtarının kullanıcıda gerçekten bulunduğunu doğrular. Uç seviyesindeki
    /// RequirePermission tek bir anahtar kontrol ettiği için, tek uçtan birden fazla hassasiyet
    /// düzeyinde iş yapılan yerlerde (toplu işlem ucu: düzenleme + silme) ek kontrol gerekir.
    /// Rol izinleri ve kullanıcıya özel izinler (AdminPermissions, effect=deny önceliklidir)
    /// birlikte değerlendirilir.
    /// </summary>
    private async Task EnsurePermissionAsync(string permissionKey, CancellationToken ct)
    {
        if (currentUser.IsSuperAdmin) return;
        if (currentUser.Id is not Guid userId)
            throw new ForbiddenException("Bu işlem için yetkiniz bulunmuyor.", "FORBIDDEN");

        var permissionId = await db.Permissions.AsNoTracking()
            .Where(p => p.Key == permissionKey).Select(p => p.Id).FirstOrDefaultAsync(ct);
        if (permissionId == Guid.Empty)
            throw new ForbiddenException("Bu işlem için yetkiniz bulunmuyor.", "FORBIDDEN");

        var overrideEffect = await db.AdminPermissions.AsNoTracking()
            .Where(a => a.AdminUserId == userId && a.PermissionId == permissionId)
            .Select(a => a.Effect).FirstOrDefaultAsync(ct);
        if (!string.IsNullOrEmpty(overrideEffect))
        {
            if (string.Equals(overrideEffect, "allow", StringComparison.OrdinalIgnoreCase)) return;
            throw new ForbiddenException("Bu işlem için yetkiniz bulunmuyor.", "FORBIDDEN");
        }

        var roleId = await db.AdminUsers.AsNoTracking()
            .Where(a => a.Id == userId && !a.IsDeleted).Select(a => a.RoleId).FirstOrDefaultAsync(ct);
        var hasRolePermission = await db.RolePermissions.AsNoTracking()
            .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permissionId, ct);
        if (!hasRolePermission)
            throw new ForbiddenException("Bu işlem için yetkiniz bulunmuyor.", "FORBIDDEN");
    }

    private async Task EnsureNotSurveyCreateOnlyAsync(CancellationToken ct)
    {
        if (currentUser.IsSuperAdmin || !currentUser.Id.HasValue) return;
        var admin = await db.AdminUsers.AsNoTracking().FirstOrDefaultAsync(a => a.Id == currentUser.Id.Value && !a.IsDeleted, ct);
        if (admin is not null && admin.IsSurveyUser && admin.SurveyCreateOnly)
            throw new ForbiddenException("Bu ekrana erişim yetkiniz yok. Yalnızca anket oluşturabilirsiniz.", "SURVEY_CREATE_ONLY");
    }

    /// <summary>
    /// Güvenlik açığı düzeltmesi (2026-09-01): kota uçları (GetQuotasAsync/SaveQuotasAsync)
    /// surveyId doğrudan yol parametresinden geliyordu ve hiç sahiplik/geçmiş-anket kontrolü
    /// yapmıyordu — SurveyOwnSurveysOnly kısıtlı bir Anket Kullanıcısı, ID'sini biliyorsa
    /// başkasının anketinin kotalarını görebiliyor, hatta SİLİP YENİDEN YAZABİLİYORDU
    /// (SaveQuotasAsync var olan tüm kota kayıtlarını RemoveRange ile siler). SurveyService
    /// içindeki EnsureSurveyAccessAsync ile aynı kuralı burada da uygular.
    /// </summary>
    private async Task EnsureSurveyOwnershipAsync(Guid surveyId, CancellationToken ct)
    {
        if (currentUser.IsSuperAdmin || !currentUser.Id.HasValue) return;
        var admin = await db.AdminUsers.AsNoTracking().FirstOrDefaultAsync(a => a.Id == currentUser.Id.Value && !a.IsDeleted, ct);
        if (admin is null || !admin.IsSurveyUser) return;

        var survey = await db.Surveys.AsNoTracking().FirstOrDefaultAsync(s => s.Id == surveyId && !s.IsDeleted, ct)
            ?? throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");

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

    /// <summary>
    /// Kullanıcı isteği (2026-09-01): "Tüm Mahalleler" kapalıysa çağıranın erişebileceği
    /// mahalle listesini döner; null = kısıtlama yok (SuperAdmin veya Anket Kullanıcısı
    /// değil veya tüm mahallelere yetkili).
    /// </summary>
    private async Task<List<string>?> GetNeighborhoodScopeAsync(CancellationToken ct)
    {
        if (currentUser.IsSuperAdmin || !currentUser.Id.HasValue) return null;
        var admin = await db.AdminUsers.AsNoTracking().FirstOrDefaultAsync(a => a.Id == currentUser.Id.Value && !a.IsDeleted, ct);
        if (admin is null || !admin.IsSurveyUser || admin.SurveyAllNeighborhoods) return null;
        return admin.SurveyNeighborhoods;
    }

    /// <summary>
    /// Güvenlik açığı düzeltmesi (2026-09-01): SurveyOwnSurveysOnly kısıtlı bir kullanıcı,
    /// yalnızca "kendi oluşturduğu anket" verisini görebilmeliydi. Ancak GetFieldTasksAsync
    /// (surveyId filtresi olmadan) ve buna bağlı GetInterviewerStatsAsync/analitik uçları
    /// sadece mahalle kapsamını uyguluyordu — anket sahiplik kapsamını hiç uygulamıyordu.
    /// Sonuç: bu kullanıcı, kendi kapsamındaki bir mahallede olduğu sürece BAŞKASININ
    /// anketine atanmış saha görevlerini ve anketörlerin gerçek isim/telefon bilgilerini
    /// görebiliyordu. Bu metod, kısıtlı kullanıcının erişebileceği anket ID listesini
    /// döner (null = kısıtlama yok).
    /// </summary>
    private async Task<List<Guid>?> GetOwnSurveyIdsScopeAsync(CancellationToken ct)
    {
        if (currentUser.IsSuperAdmin || !currentUser.Id.HasValue) return null;
        var admin = await db.AdminUsers.AsNoTracking().FirstOrDefaultAsync(a => a.Id == currentUser.Id.Value && !a.IsDeleted, ct);
        if (admin is null || !admin.IsSurveyUser || !admin.SurveyOwnSurveysOnly) return null;
        return await db.Surveys.AsNoTracking()
            .Where(s => !s.IsDeleted && s.CreatedBy == currentUser.Name)
            .Select(s => s.Id)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Güvenlik açığı düzeltmesi (2026-09-01): GetFieldTasksAsync (liste) mahalle kapsamını
    /// uyguluyordu ama tekil-görev uçları (getById/update/delete) uygulamıyordu — ID bilen
    /// kısıtlı bir Anket Kullanıcısı kapsamı dışındaki bir göreve doğrudan erişip
    /// görüntüleyebiliyor, hatta güncelleyip silebiliyordu. Kapsam dışıysa 404 döner
    /// (varlığını dahi sızdırmamak için Forbidden yerine NotFound kullanılır).
    /// </summary>
    private async Task EnsureFieldTaskInScopeAsync(SurveyFieldTask task, CancellationToken ct)
    {
        var neighborhoodScope = await GetNeighborhoodScopeAsync(ct);
        if (neighborhoodScope is not null && (task.Neighborhood is null || !neighborhoodScope.Contains(task.Neighborhood)))
            throw new NotFoundException("Saha görevi bulunamadı.", "FIELD_TASK_NOT_FOUND");

        // SurveyOwnSurveysOnly kısıtlı kullanıcı, başkasının anketine bağlı bir saha görevini
        // (kendi kapsamındaki bir mahallede olsa bile) güncelleyip/silemesin.
        if (currentUser.IsSuperAdmin || !currentUser.Id.HasValue) return;
        var admin = await db.AdminUsers.AsNoTracking().FirstOrDefaultAsync(a => a.Id == currentUser.Id.Value && !a.IsDeleted, ct);
        if (admin is null || !admin.IsSurveyUser || !admin.SurveyOwnSurveysOnly) return;
        var survey = await db.Surveys.AsNoTracking().FirstOrDefaultAsync(s => s.Id == task.SurveyId, ct);
        if (survey is null || !string.Equals(survey.CreatedBy, currentUser.Name, StringComparison.Ordinal))
            throw new NotFoundException("Saha görevi bulunamadı.", "FIELD_TASK_NOT_FOUND");
    }

    /// <summary>
    /// Yetki yükseltme açığı düzeltmesi (2026-09-01): mahalle kapsamlı bir Anket Kullanıcısı
    /// (SurveyAllNeighborhoods=false), önceden bir saha görevi oluştururken/güncellerken
    /// kapsamı dışındaki (hatta "Tüm Mahalleler" = null) bir mahalle seçebiliyordu — bu da
    /// kendi izin verilmediği bir mahallede fiilen anketör ataması yapabilmesi anlamına
    /// geliyordu. Create/Update/Batch-create çağrılarının hepsinde hedef mahalle(ler)
    /// kapsamla doğrulanır.
    /// </summary>
    private async Task EnsureNeighborhoodInScopeAsync(string? neighborhood, CancellationToken ct)
    {
        var neighborhoodScope = await GetNeighborhoodScopeAsync(ct);
        if (neighborhoodScope is null) return;
        if (neighborhood is null || !neighborhoodScope.Contains(neighborhood))
            throw new ForbiddenException("Bu mahalleye saha görevi atama yetkiniz yok.", "SURVEY_NEIGHBORHOOD_OUT_OF_SCOPE");
    }

    private static string AgeBandOf(DateTime birthDate)
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

    private sealed record ResponseRow(
        Guid Id, Guid SurveyId, DateTime SubmittedAt, string AnswersJson, string Channel,
        string? Neighborhood, Guid? InterviewerId, Guid? ParticipantId, int? DurationSeconds,
        string? AgeGroup, string? Gender, bool IsFlagged, string? InterviewerType,
        double? Latitude, double? Longitude)
    {
        /// <summary>Saha kaydının GPS konumu var mı — veri kalitesi/kapsama hesabında kullanılır.</summary>
        public bool HasLocation => Latitude.HasValue && Longitude.HasValue;
    }

    /// <summary>
    /// Filtrelere uyan yanıtları, mahalle/yaş/cinsiyet bilgisi eksikse katılımcı
    /// profilinden tamamlayarak döner.
    /// </summary>
    private async Task<List<ResponseRow>> LoadResponsesAsync(SurveyAnalyticsFilterParams p, CancellationToken ct)
    {
        var q = db.SurveyResponses.AsNoTracking().Where(r => !r.IsDeleted);

        if (p.SurveyId.HasValue) q = q.Where(r => r.SurveyId == p.SurveyId.Value);

        // Güvenlik açığı düzeltmesi (2026-09-01): SurveyOwnSurveysOnly kısıtlı kullanıcı bir
        // surveyId filtresi vermeden çağırırsa (ör. Anketörler/Saha Operasyonları/Başkanlık
        // Paneli genel görünümü) yalnızca kendi oluşturduğu anketlerin yanıtlarını görmeli.
        var ownSurveyScope = await GetOwnSurveyIdsScopeAsync(ct);
        if (ownSurveyScope is not null) q = q.Where(r => ownSurveyScope.Contains(r.SurveyId));

        if (p.From.HasValue) q = q.Where(r => r.SubmittedAt >= DateTime.SpecifyKind(p.From.Value, DateTimeKind.Utc));
        if (p.To.HasValue) q = q.Where(r => r.SubmittedAt < DateTime.SpecifyKind(p.To.Value, DateTimeKind.Utc).AddDays(1));
        if (!string.IsNullOrWhiteSpace(p.Channel)) q = q.Where(r => r.Channel == p.Channel);
        if (p.InterviewerId.HasValue) q = q.Where(r => r.InterviewerId == p.InterviewerId.Value);

        if (!string.IsNullOrWhiteSpace(p.Topic))
        {
            var topicSurveyIds = db.Surveys.AsNoTracking().Where(s => s.Topic == p.Topic).Select(s => s.Id);
            q = q.Where(r => topicSurveyIds.Contains(r.SurveyId));
        }

        var raw = await q
            .Select(r => new ResponseRow(
                r.Id, r.SurveyId, r.SubmittedAt, r.AnswersJson, r.Channel,
                r.Neighborhood, r.InterviewerId, r.ParticipantId, r.DurationSeconds,
                r.AgeGroup, r.Gender, r.IsFlagged, r.InterviewerType,
                r.Latitude, r.Longitude))
            .ToListAsync(ct);

        // Eksik demografi/mahalle bilgisini katılımcı profilinden tamamla.
        var needsEnrich = raw
            .Where(r => r.ParticipantId.HasValue &&
                        (r.Neighborhood is null || r.AgeGroup is null || r.Gender is null))
            .Select(r => r.ParticipantId!.Value)
            .Distinct()
            .ToList();

        if (needsEnrich.Count > 0)
        {
            var profiles = await db.Participants.AsNoTracking()
                .Where(x => needsEnrich.Contains(x.Id))
                .Select(x => new { x.Id, x.Neighborhood, x.Address, x.BirthDate, x.Gender })
                .ToDictionaryAsync(x => x.Id, ct);

            raw = raw.Select(r =>
            {
                if (!r.ParticipantId.HasValue || !profiles.TryGetValue(r.ParticipantId.Value, out var pr)) return r;
                var hood = r.Neighborhood ?? (string.IsNullOrWhiteSpace(pr.Neighborhood)
                    ? BakirkoyNeighborhoods.Classify(pr.Address)
                    : pr.Neighborhood);
                var age = r.AgeGroup ?? AgeBandOf(pr.BirthDate);
                var gender = r.Gender ?? pr.Gender switch
                {
                    Domain.Enums.Gender.Male => "male",
                    Domain.Enums.Gender.Female => "female",
                    _ => null,
                };
                return r with { Neighborhood = hood, AgeGroup = age, Gender = gender };
            }).ToList();
        }

        if (!string.IsNullOrWhiteSpace(p.Neighborhood))
            raw = raw.Where(r => r.Neighborhood == p.Neighborhood).ToList();
        if (!string.IsNullOrWhiteSpace(p.AgeGroup))
            raw = raw.Where(r => r.AgeGroup == p.AgeGroup).ToList();
        if (!string.IsNullOrWhiteSpace(p.Gender))
            raw = raw.Where(r => r.Gender == p.Gender).ToList();

        // Kullanıcı isteği (2026-09-01): "Tüm Mahalleler" kapalı bir Anket Kullanıcısı,
        // kendisine tanımlı mahalleler dışındaki saha/anket verisini hiç görmemeli —
        // sunucu tarafında zorunlu kılınır (frontend filtresine güvenilmez).
        var neighborhoodScope = await GetNeighborhoodScopeAsync(ct);
        if (neighborhoodScope is not null)
            raw = raw.Where(r => r.Neighborhood is not null && neighborhoodScope.Contains(r.Neighborhood)).ToList();

        return raw;
    }

    private async Task<Dictionary<Guid, SurveyQuestion>> LoadQuestionMetaAsync(CancellationToken ct)
        => await db.SurveyQuestions.AsNoTracking().ToDictionaryAsync(q => q.Id, ct);

    /// <summary>Bir yanıtın 0-1 aralığındaki ortalama memnuniyet skoru (skorlanabilir soru yoksa null).</summary>
    private static double? ScoreOf(string answersJson, Dictionary<Guid, SurveyQuestion> meta)
    {
        var scores = new List<double>();
        foreach (var a in SurveyAnswerFormatting.ParseAnswersJson(answersJson))
        {
            if (string.IsNullOrWhiteSpace(a.Answer)) continue;
            meta.TryGetValue(a.QuestionId, out var question);
            var s = SurveyScoring.Normalize(question, a.Answer);
            if (s.HasValue) scores.Add(s.Value);
        }
        return scores.Count > 0 ? scores.Average() : null;
    }

    private static double Score5(IEnumerable<double> normalized)
    {
        var list = normalized.ToList();
        return list.Count == 0 ? 0 : Math.Round(list.Average() * 5, 2);
    }

    private static List<SurveyAnswerDistributionDto> Distribution(IEnumerable<string?> values, int take = 0)
    {
        var list = values.Where(v => !string.IsNullOrWhiteSpace(v)).Select(v => v!).ToList();
        if (list.Count == 0) return [];
        var groups = list.GroupBy(v => v)
            .Select(g => new SurveyAnswerDistributionDto(g.Key, g.Count(), Math.Round(100.0 * g.Count() / list.Count, 1)))
            .OrderByDescending(x => x.Count)
            .ToList();
        return take > 0 ? groups.Take(take).ToList() : groups;
    }

    // ------------------------------------------------------------ field tasks

    public async Task<PagedResult<SurveyFieldTaskDto>> GetFieldTasksAsync(SurveyFieldTaskListParams p, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        var q = db.SurveyFieldTasks.AsNoTracking().Where(t => !t.IsDeleted);

        if (p.SurveyId.HasValue) q = q.Where(t => t.SurveyId == p.SurveyId.Value);
        if (p.InterviewerId.HasValue) q = q.Where(t => t.InterviewerId == p.InterviewerId.Value);
        if (!string.IsNullOrWhiteSpace(p.Neighborhood)) q = q.Where(t => t.Neighborhood == p.Neighborhood);
        if (!string.IsNullOrWhiteSpace(p.Status)) q = q.Where(t => t.Status == p.Status);

        var neighborhoodScope = await GetNeighborhoodScopeAsync(ct);
        if (neighborhoodScope is not null)
            q = q.Where(t => t.Neighborhood != null && neighborhoodScope.Contains(t.Neighborhood));

        // Güvenlik açığı düzeltmesi (2026-09-01): surveyId filtresi verilmeden çağrıldığında
        // (Saha Görevleri tab genel görünümü), SurveyOwnSurveysOnly kısıtlı kullanıcı yalnızca
        // kendi anketlerine ait görevleri görmeli — başkasının anketörünün isim/telefonunu değil.
        var ownSurveyScope = await GetOwnSurveyIdsScopeAsync(ct);
        if (ownSurveyScope is not null)
            q = q.Where(t => ownSurveyScope.Contains(t.SurveyId));

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            var surveyIds = db.Surveys.Where(s => EF.Functions.ILike(s.Title, $"%{term}%")).Select(s => s.Id);
            var adminIds = db.AdminUsers.Where(a => EF.Functions.ILike(a.FullName, $"%{term}%")).Select(a => a.Id);
            // Hata bulgusu (2026-09-01): anketör olarak site üyesi (Participant) de atanabildiği
            // hâlde arama yalnızca AdminUsers.FullName'e bakıyordu; üye anketörün adıyla arama
            // yapan yönetici "sonuç yok" görüyordu. Participant adları da aranır.
            var participantIds = db.Participants.Where(x => EF.Functions.ILike(x.FullName, $"%{term}%")).Select(x => x.Id);
            q = q.Where(t => surveyIds.Contains(t.SurveyId)
                          || (t.InterviewerType != "participant" && adminIds.Contains(t.InterviewerId))
                          || (t.InterviewerType == "participant" && participantIds.Contains(t.InterviewerId))
                          || (t.Neighborhood != null && EF.Functions.ILike(t.Neighborhood, $"%{term}%")));
        }

        var desc = string.Equals(p.Order, "desc", StringComparison.OrdinalIgnoreCase);
        q = p.Sort?.ToLowerInvariant() switch
        {
            "neighborhood" => desc ? q.OrderByDescending(t => t.Neighborhood) : q.OrderBy(t => t.Neighborhood),
            "startdate" => desc ? q.OrderByDescending(t => t.StartDate) : q.OrderBy(t => t.StartDate),
            "status" => desc ? q.OrderByDescending(t => t.Status) : q.OrderBy(t => t.Status),
            "targetcount" => desc ? q.OrderByDescending(t => t.TargetCount) : q.OrderBy(t => t.TargetCount),
            _ => q.OrderByDescending(t => t.CreatedAt),
        };

        var page = Math.Max(1, p.PageResolved);
        var limit = Math.Clamp(p.LimitResolved, 1, 100);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * limit).Take(limit).ToListAsync(ct);

        return new PagedResult<SurveyFieldTaskDto>
        {
            Items = await MapTasksAsync(items, ct),
            Total = total,
            Page = page,
            Limit = limit,
        };
    }

    private async Task<List<SurveyFieldTaskDto>> MapTasksAsync(List<SurveyFieldTask> tasks, CancellationToken ct)
    {
        if (tasks.Count == 0) return [];

        var surveyIds = tasks.Select(t => t.SurveyId).Distinct().ToList();
        var taskIds = tasks.Select(t => t.Id).ToList();

        var titles = await db.Surveys.AsNoTracking()
            .Where(s => surveyIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.Title, ct);

        // Kullanıcı isteği (2026-09-01): anketör hem yönetici hem site üyesi (Participant)
        // olabilir — isim çözümlemesi InterviewerType'a göre iki ayrı tablodan yapılır.
        var adminIds = tasks.Where(t => t.InterviewerType != "participant").Select(t => t.InterviewerId).Distinct().ToList();
        var participantIds = tasks.Where(t => t.InterviewerType == "participant").Select(t => t.InterviewerId).Distinct().ToList();

        var adminNames = await db.AdminUsers.AsNoTracking()
            .Where(a => adminIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, a => a.FullName, ct);
        var participantNames = participantIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await db.Participants.AsNoTracking()
                .Where(p => participantIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.FullName, ct);

        var todayUtc = TurkeyTime.TodayStartUtc();
        var counts = await db.SurveyResponses.AsNoTracking()
            .Where(r => !r.IsDeleted && r.FieldTaskId != null && taskIds.Contains(r.FieldTaskId!.Value))
            .GroupBy(r => r.FieldTaskId!.Value)
            .Select(g => new { TaskId = g.Key, Total = g.Count(), Today = g.Count(x => x.SubmittedAt >= todayUtc) })
            .ToDictionaryAsync(x => x.TaskId, ct);

        return tasks.Select(t =>
        {
            var c = counts.GetValueOrDefault(t.Id);
            var done = c?.Total ?? 0;
            var name = t.InterviewerType == "participant"
                ? participantNames.GetValueOrDefault(t.InterviewerId, "—")
                : adminNames.GetValueOrDefault(t.InterviewerId, "—");
            return new SurveyFieldTaskDto(
                t.Id, t.SurveyId, titles.GetValueOrDefault(t.SurveyId, "—"),
                t.InterviewerId, t.InterviewerType, name,
                t.Neighborhood ?? "Tüm Mahalleler", t.StartDate, t.EndDate, t.TargetCount, t.DailyTarget,
                t.Status, t.Note, t.LastSyncAt, done, c?.Today ?? 0,
                t.TargetCount > 0 ? Math.Round(100.0 * done / t.TargetCount, 1) : 0,
                t.CreatedAt);
        }).ToList();
    }

    public async Task<SurveyFieldTaskDto> GetFieldTaskByIdAsync(Guid id, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        var task = await db.SurveyFieldTasks.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted, ct)
            ?? throw new NotFoundException("Saha görevi bulunamadı.", "FIELD_TASK_NOT_FOUND");
        await EnsureFieldTaskInScopeAsync(task, ct);
        return (await MapTasksAsync([task], ct))[0];
    }

    public async Task<SurveyFieldTaskDto> CreateFieldTaskAsync(SaveSurveyFieldTaskRequest req, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        await EnsureNeighborhoodInScopeAsync(req.Neighborhood, ct);
        await EnsureSurveyOwnershipAsync(req.SurveyId, ct);
        log.LogStep(nameof(CreateFieldTaskAsync), new { req.SurveyId, req.InterviewerId, req.Neighborhood });
        await ValidateTaskAsync(req, ct);

        var task = SurveyFieldTask.Create(
            req.SurveyId, req.InterviewerId, req.Neighborhood, req.StartDate, req.EndDate,
            req.TargetCount, req.DailyTarget, req.Note, currentUser.Name,
            string.IsNullOrWhiteSpace(req.InterviewerType) ? "admin" : req.InterviewerType);

        db.SurveyFieldTasks.Add(task);
        await db.SaveChangesAsync(ct);
        var dto = (await MapTasksAsync([task], ct))[0];

        // Doküman 07 §7 (Audit Log) — anketör atama ("mahalle ata") denetlenebilir olmalı.
        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "SurveyFieldTask",
            EntityId = task.Id,
            Module = "Surveys",
            Description = $"Saha görevi atandı: {dto.SurveyTitle} → {dto.InterviewerName} ({dto.Neighborhood})",
            NewValues = JsonSerializer.Serialize(dto),
        }, ct);

        // Kullanıcı isteği (2026-09-01): görev atandığı anda anketöre bildirim düşsün.
        await NotifyFieldTaskAssignedAsync(dto, task.InterviewerType, ct);

        return dto;
    }

    public async Task<SurveyFieldTaskDto> UpdateFieldTaskAsync(Guid id, SaveSurveyFieldTaskRequest req, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        var task = await db.SurveyFieldTasks.FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted, ct)
            ?? throw new NotFoundException("Saha görevi bulunamadı.", "FIELD_TASK_NOT_FOUND");
        await EnsureFieldTaskInScopeAsync(task, ct);
        var oldDto = (await MapTasksAsync([task], ct))[0];
        await ValidateTaskAsync(req, ct);
        await EnsureNeighborhoodInScopeAsync(req.Neighborhood, ct);

        task.Update(req.InterviewerId, req.Neighborhood, req.StartDate, req.EndDate,
            req.TargetCount, req.DailyTarget, req.Note,
            string.IsNullOrWhiteSpace(req.Status) ? task.Status : req.Status!, currentUser.Name,
            string.IsNullOrWhiteSpace(req.InterviewerType) ? task.InterviewerType : req.InterviewerType);

        await db.SaveChangesAsync(ct);
        var dto = (await MapTasksAsync([task], ct))[0];

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "SurveyFieldTask",
            EntityId = task.Id,
            Module = "Surveys",
            Description = $"Saha görevi güncellendi: {dto.SurveyTitle} → {dto.InterviewerName} ({dto.Neighborhood})",
            OldValues = JsonSerializer.Serialize(oldDto),
            NewValues = JsonSerializer.Serialize(dto),
        }, ct);

        return dto;
    }

    public async Task DeleteFieldTaskAsync(Guid id, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        var task = await db.SurveyFieldTasks.FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted, ct)
            ?? throw new NotFoundException("Saha görevi bulunamadı.", "FIELD_TASK_NOT_FOUND");
        await EnsureFieldTaskInScopeAsync(task, ct);
        var oldDto = (await MapTasksAsync([task], ct))[0];
        task.IsDeleted = true;
        task.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "SurveyFieldTask",
            EntityId = task.Id,
            Module = "Surveys",
            Description = $"Saha görevi silindi: {oldDto.SurveyTitle} → {oldDto.InterviewerName} ({oldDto.Neighborhood})",
            OldValues = JsonSerializer.Serialize(oldDto),
        }, ct);
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-01): Saha Görevleri tablosunda seçilen satırlara toplu
    /// aktif/pasif, mahalle atama, anket atama ve silme. Yetki/kapsam kontrolü tek tek
    /// yapılır; kapsam dışındaki kayıtlar sessizce atlanır (Skipped) — böylece toplu
    /// işlem mahalle/anket kısıtlı bir yönetici için yetki aşımına dönüşmez.
    /// Silme daima soft-delete'tir: toplanan SurveyResponse kayıtlarına dokunulmaz.
    /// </summary>
    public async Task<BulkSurveyFieldTaskResult> BulkFieldTaskActionAsync(BulkSurveyFieldTaskRequest req, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);

        var action = (req.Action ?? "").Trim().ToLowerInvariant();
        if (action is not ("activate" or "deactivate" or "assign-neighborhood" or "assign-survey" or "delete"))
            throw new ConflictException("Geçersiz toplu işlem.", "INVALID_BULK_ACTION");

        // Güvenlik: uç `survey.edit` ile korunur; ancak toplu SİLME ayrıca `survey.delete`
        // gerektirir. Aksi hâlde yalnızca düzenleme yetkisi olan bir kullanıcı, tekil silme
        // ucunda reddedilirken bu uç üzerinden görev silebilirdi (yetki yükseltme).
        if (action == "delete") await EnsurePermissionAsync("survey.delete", ct);

        var ids = (req.Ids ?? []).Distinct().ToList();
        if (ids.Count == 0) return new BulkSurveyFieldTaskResult(0, 0);

        // Hedef mahalle/anket, işlemi yapan yöneticinin kapsamı içinde olmalı.
        var neighborhood = string.IsNullOrWhiteSpace(req.Neighborhood) ? null : req.Neighborhood!.Trim();
        if (action == "assign-neighborhood")
            await EnsureNeighborhoodInScopeAsync(neighborhood, ct);
        if (action == "assign-survey")
        {
            if (req.SurveyId is null) throw new ConflictException("Anket seçilmedi.", "SURVEY_REQUIRED");
            if (!await db.Surveys.AnyAsync(s => s.Id == req.SurveyId.Value && !s.IsDeleted, ct))
                throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");
            await EnsureSurveyOwnershipAsync(req.SurveyId.Value, ct);
        }

        var tasks = await db.SurveyFieldTasks.Where(t => ids.Contains(t.Id) && !t.IsDeleted).ToListAsync(ct);
        var affected = 0;
        var skipped = ids.Count - tasks.Count;

        foreach (var task in tasks)
        {
            try { await EnsureFieldTaskInScopeAsync(task, ct); }
            catch (NotFoundException) { skipped++; continue; }

            switch (action)
            {
                case "activate": task.SetStatus("in_progress", currentUser.Name); break;
                case "deactivate": task.SetStatus("cancelled", currentUser.Name); break;
                case "assign-neighborhood":
                    task.Update(task.InterviewerId, neighborhood, task.StartDate, task.EndDate,
                        task.TargetCount, task.DailyTarget, task.Note, task.Status, currentUser.Name, task.InterviewerType);
                    break;
                case "assign-survey":
                    task.SetSurvey(req.SurveyId!.Value, currentUser.Name);
                    break;
                case "delete":
                    // Soft-delete: görev listeden kalkar, toplanan yanıtlar (SurveyResponse) korunur.
                    task.IsDeleted = true;
                    task.DeletedAt = DateTime.UtcNow;
                    break;
            }
            affected++;
        }

        if (affected > 0) await db.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = action == "delete" ? AuditAction.Delete : AuditAction.Update,
            EntityType = "SurveyFieldTask",
            Module = "Surveys",
            Description = $"Saha görevlerinde toplu işlem: {action} ({affected} kayıt, {skipped} atlandı)",
            NewValues = JsonSerializer.Serialize(new { action, ids, req.Neighborhood, req.SurveyId, affected, skipped }),
        }, ct);

        return new BulkSurveyFieldTaskResult(affected, skipped);
    }

    private async Task ValidateTaskAsync(SaveSurveyFieldTaskRequest req, CancellationToken ct)
    {
        if (req.EndDate.Date < req.StartDate.Date)
            throw new ConflictException("Bitiş tarihi başlangıç tarihinden önce olamaz.", "INVALID_DATE_RANGE");
        if (!await db.Surveys.AnyAsync(s => s.Id == req.SurveyId && !s.IsDeleted, ct))
            throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");
        await ValidateInterviewerExistsAsync(req.InterviewerId, req.InterviewerType, ct);
    }

    private async Task ValidateInterviewerExistsAsync(Guid interviewerId, string? interviewerType, CancellationToken ct)
    {
        var isParticipant = interviewerType == "participant";
        var exists = isParticipant
            ? await db.Participants.AnyAsync(p => p.Id == interviewerId && !p.IsDeleted, ct)
            : await db.AdminUsers.AnyAsync(a => a.Id == interviewerId && !a.IsDeleted, ct);
        if (!exists)
            throw new NotFoundException("Anketör bulunamadı.", "INTERVIEWER_NOT_FOUND");
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-01): tek işlemde birden fazla anketöre ve/veya birden fazla
    /// mahalleye (ya da tek bir "Tüm Mahalleler" kaydı olarak) saha görevi ataması.
    /// </summary>
    public async Task<List<SurveyFieldTaskDto>> BatchCreateFieldTasksAsync(BatchCreateSurveyFieldTaskRequest req, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        if (req.EndDate.Date < req.StartDate.Date)
            throw new ConflictException("Bitiş tarihi başlangıç tarihinden önce olamaz.", "INVALID_DATE_RANGE");
        if (req.Interviewers.Count == 0)
            throw new ConflictException("En az bir anketör seçilmelidir.", "INTERVIEWER_REQUIRED");
        if (!await db.Surveys.AnyAsync(s => s.Id == req.SurveyId && !s.IsDeleted, ct))
            throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");
        await EnsureSurveyOwnershipAsync(req.SurveyId, ct);

        foreach (var i in req.Interviewers)
            await ValidateInterviewerExistsAsync(i.Id, i.Type, ct);

        // Boş mahalle listesi = "Tüm Mahalleler" (Neighborhood = null, tek kayıt).
        var neighborhoods = req.Neighborhoods.Count == 0
            ? new List<string?> { null }
            : req.Neighborhoods.Select(n => (string?)n).ToList();

        // Yetki yükseltme açığı düzeltmesi (2026-09-01): mahalle kapsamlı kullanıcı boş
        // mahalle listesi ("Tüm Mahalleler") ya da kapsamı dışında bir mahalle listesi
        // gönderemez.
        foreach (var n in neighborhoods)
            await EnsureNeighborhoodInScopeAsync(n, ct);

        var created = new List<SurveyFieldTask>();
        foreach (var interviewer in req.Interviewers)
        {
            foreach (var neighborhood in neighborhoods)
            {
                created.Add(SurveyFieldTask.Create(
                    req.SurveyId, interviewer.Id, neighborhood, req.StartDate, req.EndDate,
                    req.TargetCount, req.DailyTarget, req.Note, currentUser.Name,
                    string.IsNullOrWhiteSpace(interviewer.Type) ? "admin" : interviewer.Type));
            }
        }

        db.SurveyFieldTasks.AddRange(created);
        await db.SaveChangesAsync(ct);
        var dtos = await MapTasksAsync(created, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "SurveyFieldTask",
            Module = "Surveys",
            Description = $"Toplu saha görevi ataması: {req.Interviewers.Count} anketör × {neighborhoods.Count} mahalle = {created.Count} görev.",
            NewValues = JsonSerializer.Serialize(dtos),
        }, ct);

        // Kullanıcı isteği (2026-09-01): "yeni anket eklendiğinde bunları da takip
        // edecek, bunların tamamı kullanıcıya bildirilecek." Tekil atamada olduğu gibi
        // toplu atamada da her anketöre bildirim düşmeli; aksi hâlde toplu atanan
        // görevlerden anketörün haberi olmuyordu.
        // Eşleştirme indekse değil kimliğe göre yapılır: bildirim yanlış anketöre
        // gitmesin diye sıralamaya güvenilmez.
        var typeById = created.ToDictionary(t => t.Id, t => t.InterviewerType);
        foreach (var dto in dtos)
        {
            if (typeById.TryGetValue(dto.Id, out var interviewerType))
                await NotifyFieldTaskAssignedAsync(dto, interviewerType, ct);
        }

        return dtos;
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-01): saha görevlisi arama — TC, telefon veya isimle hem
    /// yönetici hesapları hem site üyesi vatandaşlar (Participant) arasında birleşik arama.
    /// </summary>
    public async Task<List<SurveyInterviewerCandidateDto>> SearchInterviewerCandidatesAsync(string? search, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        var term = (search ?? "").Trim();
        var adminQuery = db.AdminUsers.AsNoTracking().Where(a => !a.IsDeleted && a.IsActive);
        var participantQuery = db.Participants.AsNoTracking().Where(p => !p.IsDeleted);

        if (!string.IsNullOrWhiteSpace(term))
        {
            var like = LikeQuery.Escape(term);
            adminQuery = adminQuery.Where(a =>
                EF.Functions.ILike(a.FullName, $"%{like}%") ||
                (a.Phone != null && a.Phone.Contains(term)) ||
                EF.Functions.ILike(a.Email, $"%{like}%"));
            participantQuery = participantQuery.Where(p =>
                EF.Functions.ILike(p.FullName, $"%{like}%") ||
                p.Tckn.Contains(term) ||
                (p.Phone != null && p.Phone.Contains(term)));
        }

        var admins = await adminQuery
            .OrderBy(a => a.FullName)
            .Take(20)
            .Select(a => new SurveyInterviewerCandidateDto(a.Id, "admin", a.FullName, a.Phone, null, a.Department, null))
            .ToListAsync(ct);

        var participants = await participantQuery
            .OrderBy(p => p.FullName)
            .Take(20)
            .Select(p => new { p.Id, p.FullName, p.Phone, p.Tckn, p.Neighborhood })
            .ToListAsync(ct);

        var participantDtos = participants.Select(p => new SurveyInterviewerCandidateDto(
            p.Id, "participant", p.FullName, p.Phone,
            p.Tckn.Length >= 5 ? $"{p.Tckn[..3]}****{p.Tckn[^2..]}" : "*****",
            null, p.Neighborhood)).ToList();

        return admins.Concat(participantDtos).OrderBy(x => x.FullName).ToList();
    }

    // ------------------------------------------------------ interviewer stats

    public async Task<List<SurveyInterviewerStatsDto>> GetInterviewerStatsAsync(SurveyAnalyticsFilterParams p, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        var neighborhoodScope = await GetNeighborhoodScopeAsync(ct);
        var tasksQuery = db.SurveyFieldTasks.AsNoTracking().Where(t => !t.IsDeleted)
            .Where(t => !p.SurveyId.HasValue || t.SurveyId == p.SurveyId!.Value)
            .AsQueryable();
        if (neighborhoodScope is not null)
            tasksQuery = tasksQuery.Where(t => t.Neighborhood != null && neighborhoodScope.Contains(t.Neighborhood));
        var ownSurveyScope = await GetOwnSurveyIdsScopeAsync(ct);
        if (ownSurveyScope is not null)
            tasksQuery = tasksQuery.Where(t => ownSurveyScope.Contains(t.SurveyId));
        var tasks = await tasksQuery.ToListAsync(ct);

        var responses = await LoadResponsesAsync(p, ct);
        var byInterviewer = responses.Where(r => r.InterviewerId.HasValue)
            .GroupBy(r => r.InterviewerId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var ids = tasks.Select(t => t.InterviewerId).Concat(byInterviewer.Keys).Distinct().ToList();
        if (ids.Count == 0) return [];

        var admins = await db.AdminUsers.AsNoTracking()
            .Where(a => ids.Contains(a.Id))
            .Select(a => new { a.Id, a.FullName, a.Department })
            .ToDictionaryAsync(a => a.Id, ct);

        // Hata bulgusu (2026-09-01): anketör performans ekranı yalnızca AdminUsers'a bakıyordu;
        // saha görevi verilen site üyeleri (InterviewerType = "participant") listede isimsiz
        // ("—") görünüyor, bu da yöneticinin saha ekibini takip etmesini imkânsız kılıyordu.
        // Üye anketörlerin adı Participants'tan çözülür; departman yerine "Saha Görevlisi"
        // etiketi verilir (üyelerin belediye departmanı yoktur).
        // Hata bulgusu (2026-09-02, uçtan uca test): isimler yalnızca GÖREV listesinden
        // toplanıyordu. Görevi silinen (soft-delete) ama topladığı yanıtlar duran anketör
        // performans/özet listesinde "—" olarak görünüyordu; yönetici kimin topladığını
        // göremiyordu. Yanıtlardan gelen anketör kimlikleri de isim çözümüne dahil edilir.
        var participantInterviewerIds = tasks
            .Where(t => t.InterviewerType == "participant")
            .Select(t => t.InterviewerId)
            .Concat(responses
                .Where(r => r.InterviewerId.HasValue && r.InterviewerType == "participant")
                .Select(r => r.InterviewerId!.Value))
            .Distinct()
            .ToList();
        var participantNames = participantInterviewerIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await db.Participants.AsNoTracking()
                .Where(x => participantInterviewerIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.FullName, ct);

        var todayTurkey = TurkeyTime.TodayDate();

        return ids.Select(id =>
        {
            var myTasks = tasks.Where(t => t.InterviewerId == id).ToList();
            var myResponses = byInterviewer.GetValueOrDefault(id) ?? [];
            var totalTarget = myTasks.Sum(t => t.TargetCount);
            var admin = admins.GetValueOrDefault(id);
            var isParticipant = participantNames.ContainsKey(id);
            var displayName = admin?.FullName ?? participantNames.GetValueOrDefault(id) ?? "—";
            var department = admin?.Department ?? (isParticipant ? "Saha Görevlisi" : null);
            var durations = myResponses.Where(r => r.DurationSeconds.HasValue).Select(r => (double)r.DurationSeconds!.Value).ToList();

            return new SurveyInterviewerStatsDto(
                id,
                displayName,
                department,
                myTasks.Count,
                myTasks.Count(t => t.Status is "assigned" or "in_progress"),
                totalTarget,
                myResponses.Count,
                myResponses.Count(r => TurkeyTime.ToTurkey(r.SubmittedAt).Date == todayTurkey.Date),
                totalTarget > 0 ? Math.Round(100.0 * myResponses.Count / totalTarget, 1) : 0,
                durations.Count > 0 ? Math.Round(durations.Average(), 1) : 0,
                myResponses.Count(r => r.IsFlagged),
                myTasks.Select(t => t.Neighborhood).Where(n => !string.IsNullOrEmpty(n)).Cast<string>().Distinct().OrderBy(n => n).ToList(),
                myResponses.Count > 0 ? myResponses.Max(r => r.SubmittedAt) : null);
        })
        .OrderByDescending(x => x.CompletedCount)
        .ToList();
    }

    // ------------------------------------------------------------------ quota

    public async Task<List<SurveyQuotaDto>> GetQuotasAsync(Guid surveyId, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        await EnsureSurveyOwnershipAsync(surveyId, ct);
        var quotas = await db.SurveyQuotas.AsNoTracking()
            .Where(q => q.SurveyId == surveyId && !q.IsDeleted)
            .ToListAsync(ct);
        if (quotas.Count == 0) return [];

        var responses = await LoadResponsesAsync(new SurveyAnalyticsFilterParams { SurveyId = surveyId }, ct);

        return quotas.Select(q =>
        {
            var current = q.Dimension switch
            {
                "neighborhood" => responses.Count(r => r.Neighborhood == q.Value),
                "age_group" => responses.Count(r => r.AgeGroup == q.Value),
                "gender" => responses.Count(r => r.Gender == q.Value),
                _ => 0,
            };
            return new SurveyQuotaDto(q.Id, q.SurveyId, q.Dimension, q.Value, q.TargetCount, current,
                q.TargetCount > 0 ? Math.Round(100.0 * current / q.TargetCount, 1) : 0);
        })
        .OrderBy(x => x.Dimension).ThenBy(x => x.Value)
        .ToList();
    }

    public async Task<List<SurveyQuotaDto>> SaveQuotasAsync(Guid surveyId, SaveSurveyQuotasRequest req, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        await EnsureSurveyOwnershipAsync(surveyId, ct);
        if (!await db.Surveys.AnyAsync(s => s.Id == surveyId && !s.IsDeleted, ct))
            throw new NotFoundException("Anket bulunamadı.", "SURVEY_NOT_FOUND");

        var existing = await db.SurveyQuotas.Where(q => q.SurveyId == surveyId).ToListAsync(ct);
        db.SurveyQuotas.RemoveRange(existing);

        var valid = req.Quotas
            .Where(q => !string.IsNullOrWhiteSpace(q.Value) && q.TargetCount > 0)
            .Select(q => SurveyQuota.Create(surveyId, q.Dimension, q.Value, q.TargetCount))
            .ToList();
        db.SurveyQuotas.AddRange(valid);

        await db.SaveChangesAsync(ct);
        var result = await GetQuotasAsync(surveyId, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "SurveyQuota",
            EntityId = surveyId,
            Module = "Surveys",
            Description = $"Anket kotaları güncellendi ({valid.Count} kota tanımı).",
            NewValues = JsonSerializer.Serialize(result),
        }, ct);

        return result;
    }

    // ---------------------------------------------------------- question bank

    public async Task<PagedResult<SurveyQuestionBankItemDto>> GetQuestionBankAsync(SurveyQuestionBankListParams p, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        var q = db.SurveyQuestionBank.AsNoTracking().Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            q = q.Where(x => EF.Functions.ILike(x.Question, $"%{term}%") || EF.Functions.ILike(x.Topic, $"%{term}%"));
        }
        if (!string.IsNullOrWhiteSpace(p.Topic)) q = q.Where(x => x.Topic == p.Topic);
        if (!string.IsNullOrWhiteSpace(p.Type)) q = q.Where(x => x.Type == p.Type);
        if (p.IsActive.HasValue) q = q.Where(x => x.IsActive == p.IsActive.Value);

        var desc = string.Equals(p.Order, "desc", StringComparison.OrdinalIgnoreCase);
        q = p.Sort?.ToLowerInvariant() switch
        {
            "question" => desc ? q.OrderByDescending(x => x.Question) : q.OrderBy(x => x.Question),
            "topic" => desc ? q.OrderByDescending(x => x.Topic) : q.OrderBy(x => x.Topic),
            "usagecount" => desc ? q.OrderByDescending(x => x.UsageCount) : q.OrderBy(x => x.UsageCount),
            "lastusedat" => desc ? q.OrderByDescending(x => x.LastUsedAt) : q.OrderBy(x => x.LastUsedAt),
            _ => q.OrderByDescending(x => x.CreatedAt),
        };

        var page = Math.Max(1, p.PageResolved);
        var limit = Math.Clamp(p.LimitResolved, 1, 100);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((page - 1) * limit).Take(limit).ToListAsync(ct);

        return new PagedResult<SurveyQuestionBankItemDto>
        {
            Items = items.Select(ToBankDto).ToList(),
            Total = total,
            Page = page,
            Limit = limit,
        };
    }

    public async Task<SurveyQuestionBankItemDto> CreateQuestionBankItemAsync(SaveSurveyQuestionBankItemRequest req, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        ValidateBankItem(req);
        var item = SurveyQuestionBankItem.Create(
            req.Question, req.Description, req.Type, req.Options, req.Topic, req.Unit,
            req.Config?.ScaleMin, req.Config?.ScaleMax, req.Config?.MinLabel, req.Config?.MaxLabel,
            req.Config?.RatingCount, req.IsActive, currentUser.Name);

        db.SurveyQuestionBank.Add(item);
        await db.SaveChangesAsync(ct);
        var dto = ToBankDto(item);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "SurveyQuestionBankItem",
            EntityId = item.Id,
            Module = "Surveys",
            Description = $"Soru bankasına eklendi: {item.Question}",
            NewValues = JsonSerializer.Serialize(dto),
        }, ct);

        return dto;
    }

    public async Task<SurveyQuestionBankItemDto> UpdateQuestionBankItemAsync(Guid id, SaveSurveyQuestionBankItemRequest req, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        ValidateBankItem(req);
        var item = await db.SurveyQuestionBank.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct)
            ?? throw new NotFoundException("Soru bulunamadı.", "QUESTION_BANK_ITEM_NOT_FOUND");
        var oldDto = ToBankDto(item);

        item.Update(req.Question, req.Description, req.Type, req.Options, req.Topic, req.Unit,
            req.Config?.ScaleMin, req.Config?.ScaleMax, req.Config?.MinLabel, req.Config?.MaxLabel,
            req.Config?.RatingCount, req.IsActive, currentUser.Name);

        await db.SaveChangesAsync(ct);
        var dto = ToBankDto(item);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "SurveyQuestionBankItem",
            EntityId = item.Id,
            Module = "Surveys",
            Description = $"Soru bankası kaydı güncellendi: {item.Question}",
            OldValues = JsonSerializer.Serialize(oldDto),
            NewValues = JsonSerializer.Serialize(dto),
        }, ct);

        return dto;
    }

    public async Task<SurveyQuestionBankItemDto> ToggleQuestionBankItemAsync(Guid id, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        var item = await db.SurveyQuestionBank.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct)
            ?? throw new NotFoundException("Soru bulunamadı.", "QUESTION_BANK_ITEM_NOT_FOUND");
        item.Toggle();
        await db.SaveChangesAsync(ct);
        return ToBankDto(item);
    }

    public async Task DeleteQuestionBankItemAsync(Guid id, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        var item = await db.SurveyQuestionBank.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct)
            ?? throw new NotFoundException("Soru bulunamadı.", "QUESTION_BANK_ITEM_NOT_FOUND");
        var oldDto = ToBankDto(item);
        item.IsDeleted = true;
        item.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "SurveyQuestionBankItem",
            EntityId = item.Id,
            Module = "Surveys",
            Description = $"Soru bankasından silindi: {item.Question}",
            OldValues = JsonSerializer.Serialize(oldDto),
        }, ct);
    }

    public async Task<List<string>> GetQuestionBankTopicsAsync(CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        return await db.SurveyQuestionBank.AsNoTracking()
            .Where(x => !x.IsDeleted && x.Topic != "")
            .Select(x => x.Topic).Distinct().OrderBy(x => x).ToListAsync(ct);
    }

    private static void ValidateBankItem(SaveSurveyQuestionBankItemRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Question))
            throw new ConflictException("Soru metni zorunludur.", "QUESTION_REQUIRED");
        if (string.IsNullOrWhiteSpace(req.Topic))
            throw new ConflictException("Konu zorunludur.", "TOPIC_REQUIRED");
        if (req.Type is "multiple_choice" or "checkbox" && req.Options.Count(o => !string.IsNullOrWhiteSpace(o)) < 2)
            throw new ConflictException("Seçmeli sorularda en az iki seçenek gerekir.", "OPTIONS_REQUIRED");
    }

    private static SurveyQuestionBankItemDto ToBankDto(SurveyQuestionBankItem x)
        => new(x.Id, x.Question, x.Description, x.Type, x.Options, x.Topic, x.Unit,
            new SurveyQuestionConfigDto(x.ScaleMin, x.ScaleMax, x.MinLabel, x.MaxLabel, x.RatingCount),
            x.UsageCount, x.LastUsedAt, x.IsActive, x.CreatedAt);

    // -------------------------------------------------------------- templates

    public Task<List<SurveyTemplateDto>> GetTemplatesAsync(CancellationToken ct)
        => Task.FromResult(SurveyTemplateCatalog.All);

    // -------------------------------------------------------------- analytics

    private sealed record SubmissionRow(string Neighborhood, string CategoryId, string Status, DateTime SubmittedAt, DateTime? ResolvedAt);

    private async Task<List<SubmissionRow>> LoadSubmissionsAsync(SurveyAnalyticsFilterParams p, CancellationToken ct)
    {
        var q = db.CitizenSubmissions.AsNoTracking().Where(s => !s.IsDeleted);
        if (p.From.HasValue) q = q.Where(s => s.SubmittedAt >= DateTime.SpecifyKind(p.From.Value, DateTimeKind.Utc));
        if (p.To.HasValue) q = q.Where(s => s.SubmittedAt < DateTime.SpecifyKind(p.To.Value, DateTimeKind.Utc).AddDays(1));
        if (!string.IsNullOrWhiteSpace(p.Neighborhood)) q = q.Where(s => s.Neighborhood == p.Neighborhood);

        var neighborhoodScope = await GetNeighborhoodScopeAsync(ct);
        if (neighborhoodScope is not null) q = q.Where(s => neighborhoodScope.Contains(s.Neighborhood));

        return await q.Select(s => new SubmissionRow(s.Neighborhood, s.CategoryId, s.Status, s.SubmittedAt, s.ResolvedAt))
            .ToListAsync(ct);
    }

    public async Task<List<SurveyNeighborhoodStatsDto>> GetNeighborhoodStatsAsync(SurveyAnalyticsFilterParams p, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        var responses = await LoadResponsesAsync(p, ct);
        var submissions = await LoadSubmissionsAsync(p, ct);
        var meta = await LoadQuestionMetaAsync(ct);

        var scored = responses
            .Select(r => (r, Score: ScoreOf(r.AnswersJson, meta)))
            .ToList();

        var now = TurkeyTime.Now();
        var last30 = now.AddDays(-30);
        var prev30 = now.AddDays(-60);

        // Güvenlik/tutarlılık düzeltmesi (2026-09-01): mahalle referans listesi (BakirkoyNeighborhoods.All)
        // sabit ve kapsam-dışıydı — "Tüm Mahalleler" kapalı bir Anket Kullanıcısı, veri sızıntısı
        // olmasa da (sayılar zaten 0'a filtreleniyordu) kendi kapsamı dışındaki tüm ilçe mahalle
        // isimlerini listede görüyordu. Artık kapsamı varsa yalnızca izinli mahalleler taban alınır.
        var neighborhoodScope = await GetNeighborhoodScopeAsync(ct);
        var referenceHoods = neighborhoodScope ?? BakirkoyNeighborhoods.All.ToList();
        // Hata bulgusu (2026-09-02): anket "Cebeci", talep "Cebeci Mahallesi" kaydediyordu;
        // aynı mahalle iki ayrı satıra bölünüp memnuniyet ile talep sayısı hiç yan yana
        // gelmiyordu. Karşılaştırmalar kanonik ada (ek atılmış hâl) göre yapılır.
        //
        // Hata bulgusu (2026-09-02, ekran doğrulaması): kanonikleştirmeden sonra bile
        // sistemde resmî OLMAYAN bir mahalle adı ("Hürriyet Mahallesi" — Sultangazi'nin 15
        // mahallesinden biri değil, muhtemelen eski/hatalı test kaydı) listeye giriyordu.
        // Coğrafi ısı haritasında (yalnızca 15 resmî mahalleyi çizer) görünmüyordu ama KPI
        // kartlarında "En Problemli Mahalle: Hürriyet, %0 memnuniyet" olarak öne çıkıp
        // yöneticiye var olmayan bir mahalle hakkında yanlış bilgi veriyordu. Artık yalnızca
        // resmî 15 mahalle (veya kullanıcının kapsamındaki alt küme) listelenir; tanınmayan
        // mahalle adlı kayıtlar sessizce atılmaz, "Diğer / Belirsiz" başlığı altında toplanır.
        var hoods = referenceHoods
            .Select(BakirkoyNeighborhoods.CanonicalName)
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Distinct()
            .ToList();

        var unrecognized = responses.Select(r => r.Neighborhood)
            .Concat(submissions.Select(s => (string?)s.Neighborhood))
            .Where(n => n is not null)
            .Select(n => BakirkoyNeighborhoods.CanonicalName(n))
            .Where(n => !string.IsNullOrWhiteSpace(n) && !hoods.Contains(n))
            .Any();
        if (unrecognized) hoods.Add(BakirkoyNeighborhoods.Unknown);

        return hoods.Select(hood =>
        {
            // "Diğer / Belirsiz" satırı, resmî 15 mahallenin HİÇBİRİYLE eşleşmeyen (canonik
            // adı hoods listesinde bulunmayan) tüm kayıtları toplar; diğer satırlar kendi
            // canonik adına tam eşleşen kayıtları alır.
            bool Matches(string? n)
            {
                var c = BakirkoyNeighborhoods.CanonicalName(n);
                if (string.IsNullOrWhiteSpace(c)) return false;
                return hood == BakirkoyNeighborhoods.Unknown ? !hoods.Contains(c) : c == hood;
            }

            var hoodResponses = scored.Where(x => Matches(x.r.Neighborhood)).ToList();
            var hoodSubs = submissions.Where(s => Matches(s.Neighborhood)).ToList();
            var resolved = hoodSubs.Count(s => s.Status == "resolved");

            var recentCount = hoodSubs.Count(s => TurkeyTime.ToTurkey(s.SubmittedAt) >= last30);
            var priorCount = hoodSubs.Count(s =>
            {
                var t = TurkeyTime.ToTurkey(s.SubmittedAt);
                return t >= prev30 && t < last30;
            });
            var trend = priorCount == 0
                ? (recentCount > 0 ? 100.0 : 0)
                : Math.Round(100.0 * (recentCount - priorCount) / priorCount, 1);

            return new SurveyNeighborhoodStatsDto(
                hood,
                hoodResponses.Count,
                Score5(hoodResponses.Where(x => x.Score.HasValue).Select(x => x.Score!.Value)),
                hoodSubs.Count(s => s.Status is "new" or "in_review" or "forwarded"),
                hoodSubs.Count,
                resolved,
                hoodSubs.Count > 0 ? Math.Round(100.0 * resolved / hoodSubs.Count, 1) : 0,
                Distribution(hoodSubs.Select(s => MuhtarlikReference.CategoryLabel(s.CategoryId)), 5),
                Distribution(hoodResponses.Select(x => x.r.AgeGroup)),
                Distribution(hoodResponses.Select(x => x.r.Gender switch
                {
                    "male" => "Erkek",
                    "female" => "Kadın",
                    _ => x.r.Gender,
                })),
                trend);
        })
        .OrderByDescending(x => x.ResponseCount + x.TotalSubmissionCount)
        .ToList();
    }

    public async Task<List<SurveyTopicStatsDto>> GetTopicStatsAsync(SurveyAnalyticsFilterParams p, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        var responses = await LoadResponsesAsync(p, ct);
        var submissions = await LoadSubmissionsAsync(p, ct);
        var meta = await LoadQuestionMetaAsync(ct);

        var surveyTopics = await db.Surveys.AsNoTracking()
            .Where(s => !s.IsDeleted)
            .Select(s => new { s.Id, s.Topic, s.Category })
            .ToDictionaryAsync(s => s.Id, s => s.Topic ?? s.Category, ct);

        var now = TurkeyTime.Now();
        var last30 = now.AddDays(-30);
        var prev30 = now.AddDays(-60);

        var byTopic = responses
            .Select(r => (Topic: surveyTopics.GetValueOrDefault(r.SurveyId) ?? "Genel", Row: r, Score: ScoreOf(r.AnswersJson, meta)))
            .GroupBy(x => string.IsNullOrWhiteSpace(x.Topic) ? "Genel" : x.Topic)
            .ToDictionary(g => g.Key, g => g.ToList());

        var subsByTopic = submissions
            .GroupBy(s => MuhtarlikReference.CategoryLabel(s.CategoryId))
            .ToDictionary(g => g.Key, g => g.ToList());

        var topics = byTopic.Keys.Concat(subsByTopic.Keys).Distinct().ToList();

        return topics.Select(topic =>
        {
            var rows = byTopic.GetValueOrDefault(topic) ?? [];
            var subs = subsByTopic.GetValueOrDefault(topic) ?? [];
            var resolved = subs.Count(s => s.Status == "resolved");

            var recent = subs.Count(s => TurkeyTime.ToTurkey(s.SubmittedAt) >= last30);
            var prior = subs.Count(s =>
            {
                var t = TurkeyTime.ToTurkey(s.SubmittedAt);
                return t >= prev30 && t < last30;
            });
            var trend = prior == 0 ? (recent > 0 ? 100.0 : 0) : Math.Round(100.0 * (recent - prior) / prior, 1);

            return new SurveyTopicStatsDto(
                topic,
                rows.Count,
                Score5(rows.Where(x => x.Score.HasValue).Select(x => x.Score!.Value)),
                subs.Count,
                resolved,
                subs.Count > 0 ? Math.Round(100.0 * resolved / subs.Count, 1) : 0,
                trend);
        })
        .OrderByDescending(x => x.SubmissionCount + x.ResponseCount)
        .ToList();
    }

    public async Task<SurveyFieldOperationsDto> GetFieldOperationsAsync(SurveyAnalyticsFilterParams p, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        var responses = await LoadResponsesAsync(p, ct);
        var neighborhoodScope = await GetNeighborhoodScopeAsync(ct);
        var tasksQuery = db.SurveyFieldTasks.AsNoTracking().Where(t => !t.IsDeleted).AsQueryable();
        if (neighborhoodScope is not null)
            tasksQuery = tasksQuery.Where(t => t.Neighborhood != null && neighborhoodScope.Contains(t.Neighborhood));
        var ownSurveyScope = await GetOwnSurveyIdsScopeAsync(ct);
        if (ownSurveyScope is not null)
            tasksQuery = tasksQuery.Where(t => ownSurveyScope.Contains(t.SurveyId));
        var tasks = await tasksQuery.ToListAsync(ct);
        var activeSurveysQuery = db.Surveys.AsNoTracking().Where(s => !s.IsDeleted && s.IsActive);
        if (ownSurveyScope is not null)
            activeSurveysQuery = activeSurveysQuery.Where(s => ownSurveyScope.Contains(s.Id));
        var activeSurveys = await activeSurveysQuery.CountAsync(ct);

        var todayTurkey = TurkeyTime.TodayDate().Date;
        var todayCount = responses.Count(r => TurkeyTime.ToTurkey(r.SubmittedAt).Date == todayTurkey);

        var quotasQuery = db.SurveyQuotas.AsNoTracking().Where(q => !q.IsDeleted).AsQueryable();
        if (ownSurveyScope is not null)
            quotasQuery = quotasQuery.Where(q => ownSurveyScope.Contains(q.SurveyId));
        var quotas = await quotasQuery.ToListAsync(ct);
        double quotaPercent = 0;
        if (quotas.Count > 0)
        {
            var ratios = quotas.Select(q =>
            {
                var current = q.Dimension switch
                {
                    "neighborhood" => responses.Count(r => r.SurveyId == q.SurveyId && r.Neighborhood == q.Value),
                    "age_group" => responses.Count(r => r.SurveyId == q.SurveyId && r.AgeGroup == q.Value),
                    "gender" => responses.Count(r => r.SurveyId == q.SurveyId && r.Gender == q.Value),
                    _ => 0,
                };
                return q.TargetCount > 0 ? Math.Min(1.0, (double)current / q.TargetCount) : 0;
            }).ToList();
            quotaPercent = Math.Round(ratios.Average() * 100, 1);
        }

        var coveredHoods = responses.Select(r => r.Neighborhood).Where(n => !string.IsNullOrWhiteSpace(n)).Distinct().Count();
        var coverage = BakirkoyNeighborhoods.All.Length > 0
            ? Math.Round(100.0 * coveredHoods / BakirkoyNeighborhoods.All.Length, 1)
            : 0;

        var interviewers = await GetInterviewerStatsAsync(p, ct);

        return new SurveyFieldOperationsDto(
            activeSurveys,
            todayCount,
            responses.Count,
            responses.Where(r => r.InterviewerId.HasValue).Select(r => r.InterviewerId!.Value).Distinct().Count(),
            tasks.Count(t => t.Status is "assigned" or "in_progress"),
            responses.Count(r => r.IsFlagged),
            quotaPercent,
            coverage,
            Distribution(responses.Select(r => r.Channel switch
            {
                "field" => "Saha (Tablet)",
                "app" => "Mobil Uygulama",
                "web" => "Web",
                "call_center" => "Çağrı Merkezi",
                _ => r.Channel,
            })),
            Distribution(responses.Select(r => r.Neighborhood), 15),
            interviewers.Take(10).ToList());
    }

    public async Task<SurveyExecutiveDashboardDto> GetExecutiveDashboardAsync(SurveyAnalyticsFilterParams p, CancellationToken ct)
    {
        await EnsureNotSurveyCreateOnlyAsync(ct);
        var responses = await LoadResponsesAsync(p, ct);
        var submissions = await LoadSubmissionsAsync(p, ct);
        var meta = await LoadQuestionMetaAsync(ct);
        var neighborhoods = await GetNeighborhoodStatsAsync(p, ct);
        var topics = await GetTopicStatsAsync(p, ct);
        var questionCounts = await db.SurveyQuestions.AsNoTracking()
            .GroupBy(q => q.SurveyId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        var scored = responses.Select(r => (r, Score: ScoreOf(r.AnswersJson, meta))).ToList();
        var withScore = scored.Where(x => x.Score.HasValue).ToList();
        var satisfactionIndex = Score5(withScore.Select(x => x.Score!.Value));

        var now = TurkeyTime.Now();
        var last30 = now.AddDays(-30);
        var pulse = Score5(withScore.Where(x => TurkeyTime.ToTurkey(x.r.SubmittedAt) >= last30).Select(x => x.Score!.Value));

        var openSubs = submissions.Count(s => s.Status is "new" or "in_review" or "forwarded");
        var resolvedSubs = submissions.Where(s => s.Status == "resolved" && s.ResolvedAt != null).ToList();
        var avgResolutionHours = resolvedSubs.Count > 0
            ? Math.Round(resolvedSubs.Average(s => (s.ResolvedAt!.Value - s.SubmittedAt).TotalHours), 1)
            : 0;

        // Kritik gündem (doküman 04 §7): son 30 günde şikâyeti belirgin artan mahalle+konu.
        var prev30 = now.AddDays(-60);
        var agenda = submissions
            // Mahalle adı kanonikleştirilir; aksi hâlde başlıkta "Gazi Mahallesi Mahallesi"
            // gibi tekrar oluşuyor ve aynı mahalle iki ayrı gündem satırına bölünüyordu.
            .GroupBy(s => (Neighborhood: BakirkoyNeighborhoods.CanonicalName(s.Neighborhood),
                           Topic: MuhtarlikReference.CategoryLabel(s.CategoryId)))
            .Select(g =>
            {
                var recent = g.Count(s => TurkeyTime.ToTurkey(s.SubmittedAt) >= last30);
                var prior = g.Count(s =>
                {
                    var t = TurkeyTime.ToTurkey(s.SubmittedAt);
                    return t >= prev30 && t < last30;
                });
                var change = prior == 0 ? (recent > 0 ? 100.0 : 0) : Math.Round(100.0 * (recent - prior) / prior, 1);
                return (g.Key.Neighborhood, g.Key.Topic, Recent: recent, Change: change);
            })
            .Where(x => x.Recent >= 3 && x.Change > 0)
            .OrderByDescending(x => x.Change)
            .Take(8)
            .Select(x => new SurveyCriticalAgendaItemDto(
                $"Son 30 günde {x.Neighborhood} Mahallesi'nde “{x.Topic}” başvuruları %{x.Change:0.#} arttı.",
                x.Neighborhood, x.Topic, x.Change,
                x.Change >= 50 ? "critical" : x.Change >= 25 ? "high" : "normal"))
            .ToList();

        var trend = new List<SurveySatisfactionTrendDto>();
        for (var i = 5; i >= 0; i--)
        {
            var m = TurkeyTime.TodayDate().AddMonths(-i);
            var start = new DateTime(m.Year, m.Month, 1);
            var end = start.AddMonths(1);
            var bucket = withScore.Where(x =>
            {
                var t = TurkeyTime.ToTurkey(x.r.SubmittedAt);
                return t >= start && t < end;
            }).Select(x => x.Score!.Value);
            trend.Add(new SurveySatisfactionTrendDto(
                start.ToString("MMM yyyy", new System.Globalization.CultureInfo("tr-TR")),
                Score5(bucket)));
        }

        var agePriorities = Distribution(scored.Select(x => x.r.AgeGroup));

        // --- 06.png "RAPORLAR / GENEL BAKIŞ" alanları ------------------------------------
        // Kullanıcı isteği (2026-09-02): "toplam katılımcılar, genel anket say[ısı] ...
        // memnuniyet oranları" tek ekranda görülebilmeli.
        var surveyScope = await GetOwnSurveyIdsScopeAsync(ct);
        var surveysQuery = db.Surveys.AsNoTracking().Where(s => !s.IsDeleted);
        if (surveyScope is not null) surveysQuery = surveysQuery.Where(s => surveyScope.Contains(s.Id));
        var totalSurveys = await surveysQuery.CountAsync(ct);
        var activeSurveys = await surveysQuery.CountAsync(s => s.IsActive, ct);

        // Katılımcı: ParticipantId dolu olan yanıtlar kişi bazında tekilleştirilir; anonim
        // veya misafir kanalından gelen (ParticipantId boş) yanıtlar ayrı birer katılımcı
        // sayılır (aksi hâlde hepsi tek kişiymiş gibi görünüp toplamı yapay şekilde düşürür).
        var totalParticipants = responses
            .Select(r => r.ParticipantId.HasValue ? r.ParticipantId.Value.ToString() : $"anon-{r.Id}")
            .Distinct()
            .Count();

        var completionRates = new List<double>();
        foreach (var r in responses)
        {
            if (!questionCounts.TryGetValue(r.SurveyId, out var qc) || qc <= 0) continue;
            var answered = SurveyAnswerFormatting.ParseAnswersJson(r.AnswersJson)
                .Count(a => !string.IsNullOrWhiteSpace(a.Answer));
            completionRates.Add(100.0 * answered / qc);
        }
        var averageCompletionRate = completionRates.Count > 0 ? Math.Round(completionRates.Average(), 1) : 0;

        var durations = responses.Where(r => r.DurationSeconds.HasValue && r.DurationSeconds > 0)
            .Select(r => r.DurationSeconds!.Value).ToList();
        var averageDurationMinutes = durations.Count > 0 ? Math.Round(durations.Average() / 60.0, 1) : 0;

        // 5 kademeli memnuniyet dağılımı (0-1 normalize skordan): 06.png donut grafiği.
        var satisfactionBuckets = new (string Label, double Min, double Max)[]
        {
            ("Çok Memnun", 0.8, 1.01),
            ("Memnun", 0.6, 0.8),
            ("Kararsız", 0.4, 0.6),
            ("Memnun Değil", 0.2, 0.4),
            ("Hiç Memnun Değil", -0.01, 0.2),
        };
        var satisfactionDistribution = satisfactionBuckets
            .Select(b => (b.Label, Count: withScore.Count(x => x.Score!.Value >= b.Min && x.Score!.Value < b.Max)))
            .Where(x => x.Count > 0)
            .Select(x => new SurveyAnswerDistributionDto(
                x.Label, x.Count, withScore.Count > 0 ? Math.Round(100.0 * x.Count / withScore.Count, 1) : 0))
            .ToList();

        var genderLabels = new Dictionary<string, string> { ["male"] = "Erkek", ["female"] = "Kadın", ["other"] = "Belirtmek İstemiyor" };
        var genderDistribution = Distribution(responses.Select(r => r.Gender is not null && genderLabels.TryGetValue(r.Gender, out var lbl) ? lbl : null));

        // Zaman içinde katılım: filtre aralığı 31 günden kısaysa günlük, uzunsa haftalık
        // kırılım — 06.png "Zaman İçinde Anket Katılımı" çizgi grafiği.
        var participationOverTime = responses
            .GroupBy(r => TurkeyTime.ToTurkey(r.SubmittedAt).Date)
            .OrderBy(g => g.Key)
            .Select(g => new SurveyParticipationPointDto(g.Key.ToString("dd MMM", new System.Globalization.CultureInfo("tr-TR")), g.Count()))
            .ToList();

        return new SurveyExecutiveDashboardDto(
            satisfactionIndex,
            pulse,
            openSubs,
            // "Diğer / Belirsiz" resmî bir mahalle olmadığından "kritik mahalle" olarak
            // gösterilmez (yöneticinin haritada bulamayacağı bir yeri aramasına yol açar).
            neighborhoods.Where(n => n.Neighborhood != BakirkoyNeighborhoods.Unknown)
                .OrderByDescending(n => n.OpenSubmissionCount).FirstOrDefault(n => n.OpenSubmissionCount > 0)?.Neighborhood,
            openSubs,
            avgResolutionHours,
            submissions.Count > 0 ? Math.Round(100.0 * resolvedSubs.Count / submissions.Count, 1) : 0,
            agenda,
            neighborhoods.Take(20).ToList(),
            topics.Where(t => t.SubmissionCount > 0).OrderByDescending(t => t.SubmissionCount).Take(10)
                .Select(t => new SurveyExecutiveTopicDto(t.Topic, t.SatisfactionScore, t.SubmissionCount, t.TrendChangePercent)).ToList(),
            topics.Where(t => t.ResponseCount > 0).OrderByDescending(t => t.SatisfactionScore).Take(10)
                .Select(t => new SurveyExecutiveTopicDto(t.Topic, t.SatisfactionScore, t.ResponseCount, t.TrendChangePercent)).ToList(),
            trend,
            agePriorities.Where(a => AgeBands.Contains(a.Label)).ToList(),
            totalSurveys,
            activeSurveys,
            responses.Count,
            totalParticipants,
            averageCompletionRate,
            averageDurationMinutes,
            satisfactionDistribution,
            genderDistribution,
            participationOverTime);
    }
}
