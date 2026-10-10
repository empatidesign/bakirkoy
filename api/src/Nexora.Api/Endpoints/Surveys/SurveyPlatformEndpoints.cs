using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Surveys;
using Nexora.Application.Features.Surveys.Dtos;

namespace Nexora.Api.Endpoints.Surveys;

/// <summary>
/// SultanŞehir Anket Platformu uçları: saha görevleri, anketör performansı,
/// kota takibi, soru bankası, hazır şablonlar, mahalle/konu analitiği ve
/// Başkanlık karar destek ekranı.
/// </summary>
public static class SurveyPlatformEndpoints
{
    public static IEndpointRouteBuilder MapSurveyPlatformEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/surveys")
            .WithTags("Survey Platform")
            .RequireAuthorization("AdminOrAbove");

        // Saha görevleri
        group.MapGet("/field-tasks", GetFieldTasks).RequirePermission("survey.view")
            .WithSummary("Saha görevleri (sayfalı)")
            .WithDescription("Anketörlere atanmış saha görevlerini döner. Anket, anketör, hedef mahalle, hedef sayı ve tamamlanma oranı içerir.");
        group.MapGet("/field-tasks/{id:guid}", GetFieldTask).RequirePermission("survey.view")
            .WithSummary("Saha görevi detayı")
            .WithDescription("Tek görevin anketi, atanan anketörü, hedef mahallesi, günlük/toplam hedefi ve o ana kadarki ilerlemesi.");
        group.MapPost("/field-tasks", CreateFieldTask).RequirePermission("survey.create")
            .WithSummary("Saha görevi oluştur")
            .WithDescription("Bir ankete tek anketör atar. Anketin `fieldEnabled` alanı açık olmalıdır.");
        group.MapPost("/field-tasks/batch", BatchCreateFieldTasks).RequirePermission("survey.create")
            .WithSummary("Toplu saha görevi oluştur")
            .WithDescription("Birden çok anketöre aynı anket için tek seferde görev açar; mahalle ve hedef sayısı görev başına dağıtılır.");
        group.MapPut("/field-tasks/{id:guid}", UpdateFieldTask).RequirePermission("survey.edit")
            .WithSummary("Saha görevini güncelle")
            .WithDescription("Görevin anketörünü, hedef mahallesini, hedef sayısını ve tarih aralığını değiştirir. Toplanmış yanıtlar korunur.");
        group.MapDelete("/field-tasks/{id:guid}", DeleteFieldTask).RequirePermission("survey.delete")
            .WithSummary("Saha görevini sil")
            .WithDescription("Görevi kaldırır; görev kapsamında toplanmış yanıtlar korunur.");
        // Kullanıcı isteği (2026-09-01): tabloda seçilen satırlara toplu işlem.
        group.MapPost("/field-tasks/bulk", BulkFieldTaskAction).RequirePermission("survey.edit")
            .WithSummary("Saha görevlerinde toplu işlem")
            .WithDescription("Seçili görevlere toplu aktif/pasif yapma, mahalle atama, anket atama veya silme uygular. `action`: activate | deactivate | assign-neighborhood | assign-survey | delete. Silme soft-delete'tir; toplanan yanıtlar korunur. Yetki kapsamı dışındaki kayıtlar atlanır ve `skipped` ile raporlanır.");
        group.MapGet("/interviewer-candidates", SearchInterviewerCandidates).RequirePermission("survey.create")
            .WithSummary("Anketör adaylarını ara")
            .WithDescription("Görev atanabilecek katılımcıları ada/TCKN'ye göre arar.");

        // Anketör performansı
        group.MapGet("/interviewers", GetInterviewers).RequirePermission("survey.view")
            .WithSummary("Anketör performans listesi")
            .WithDescription("Anketör başına toplanan yanıt sayısı, hedefe ulaşma oranı ve son aktiflik zamanı.");

        // Anketörlere toplu mesaj / duyuru (kullanıcı isteği 2026-09-01)
        group.MapPost("/interviewers/messages", SendInterviewerMessage).RequirePermission("survey.edit")
            .WithSummary("Anketörlere toplu mesaj / duyuru gönder")
            .WithDescription("Saha anketörlerine uygulama içi bildirim ve/veya SMS gönderir. Hedef, doğrudan `interviewerIds` listesiyle ya da `surveyId` verilerek o ankete atanmış tüm anketörlerle belirlenir. `requiresAck: true` gönderildiğinde duyuru anketörün ekranında kapatılamaz bir popup olarak açılır ve \"Okudum\" onayı verilene kadar her açılışta tekrar gösterilir; bu mod bildirim kanalını zorunlu kılar çünkü SMS'te onay alınamaz.");
        // Kullanıcı isteği (2026-09-02): gönderilen bildirimin kimlerce okunduğu adminde görülsün.
        group.MapGet("/interviewers/notifications", GetInterviewerNotificationReceipts).RequirePermission("survey.view")
            .WithSummary("Anketör bildirim okunma takibi")
            .WithDescription("Anketörlere gönderilen duyuru/mesaj ve saha görevi bildirimlerinin alıcı bazında okundu ve \"Okudum\" onay durumu.");

        // Kullanıcı isteği (2026-09-01): saha görevlisi canlı takip ekranı.
        group.MapGet("/field-live", GetLiveAgents).RequirePermission("survey.view")
            .WithSummary("Saha görevlileri canlı harita")
            .WithDescription("Sahadaki anketörlerin son GPS konumu, çevrimiçilik durumu (online/idle/offline), bugün yürüdüğü mesafe, gezdiği ayrık nokta sayısı ve bugünkü anket üretimi.");
        group.MapGet("/field-live/{interviewerId:guid}/trail", GetAgentTrail).RequirePermission("survey.view")
            .WithSummary("Anketör gün izi")
            .WithDescription("Bir anketörün seçilen güne ait rota noktaları (polyline), 10 dakikadan uzun duraklamaları ve anket doldurduğu konumlar. `date` verilmezse bugün.");
        group.MapGet("/interviewer-performance", GetInterviewerPerformance).RequirePermission("survey.view")
            .WithSummary("Anketör performans ve veri güvenilirliği")
            .WithDescription("Anketör başına ortalama puan (5 üzerinden), olumlu/nötr/olumsuz dağılımı, saha ortalamasından sapma (bias), hızlı doldurma ve düz-çizgi oranı, GPS kapsaması, güvenilirlik ve performans skoru ile bu skorların Türkçe gerekçeleri.");

        // Kota
        group.MapGet("/{id:guid}/quotas", GetQuotas).RequirePermission("survey.view")
            .WithSummary("Anket kotaları")
            .WithDescription("Mahalle, yaş grubu ve cinsiyet bazlı hedef/gerçekleşen kota durumunu döner.");
        group.MapPut("/{id:guid}/quotas", SaveQuotas).RequirePermission("survey.edit")
            .WithSummary("Anket kotalarını kaydet")
            .WithDescription("Kota listesini tümüyle değiştirir. Dolan kotaya saha yanıtı kabul edilmez.");

        // Soru bankası
        group.MapGet("/question-bank", GetQuestionBank).RequirePermission("survey.view")
            .WithSummary("Soru bankası")
            .WithDescription("Hazır soruları konu (`topic`) ve kategoriye göre filtreleyerek döner; anket kurulumunda tekrar kullanılır.");
        group.MapGet("/question-bank/topics", GetQuestionBankTopics).RequirePermission("survey.view")
            .WithSummary("Soru bankası konu listesi")
            .WithDescription("Soru bankasında kullanılan konu etiketlerini (Temizlik, Ulaşım, Park ve Bahçeler…) döner.");
        group.MapPost("/question-bank", CreateQuestionBankItem).RequirePermission("survey.create")
            .WithSummary("Soru bankasına soru ekle")
            .WithDescription("Yeni hazır soru kaydeder. Konu (`topic`) ve kategori alanları, anket kurulumunda soruyu filtrelemek için kullanılır.");
        group.MapPut("/question-bank/{id:guid}", UpdateQuestionBankItem).RequirePermission("survey.edit")
            .WithSummary("Soru bankası kaydını güncelle")
            .WithDescription("Bankadaki sorunun metnini, tipini, seçeneklerini ve konusunu değiştirir. Bu sorudan daha önce kopyalanmış anket soruları etkilenmez.");
        group.MapPatch("/question-bank/{id:guid}/toggle-status", ToggleQuestionBankItem).RequirePermission("survey.edit")
            .WithSummary("Soru bankası kaydını aktif/pasif yap")
            .WithDescription("Pasif soru, anket kurulumundaki soru bankası listesinde çıkmaz; mevcut anketlerden silinmez.");
        group.MapDelete("/question-bank/{id:guid}", DeleteQuestionBankItem).RequirePermission("survey.delete")
            .WithSummary("Soru bankası kaydını sil")
            .WithDescription("Soruyu bankadan kaldırır; bu sorudan kopyalanmış anket soruları etkilenmez.");

        // Şablonlar
        group.MapGet("/templates", GetTemplates).RequirePermission("survey.view")
            .WithSummary("Hazır anket şablonları")
            .WithDescription("Memnuniyet, nabız, mahalle ve etkinlik sonrası gibi hazır anket şablonlarını soru setleriyle döner.");

        // Analitik / karar destek
        group.MapGet("/analytics/neighborhoods", GetNeighborhoodStats).RequirePermission("survey.view")
            .WithSummary("Mahalle bazlı anket analizi")
            .WithDescription("Mahalle başına katılım, memnuniyet ortalaması ve kota doluluk oranı.");
        group.MapGet("/analytics/topics", GetTopicStats).RequirePermission("survey.view")
            .WithSummary("Konu bazlı anket analizi")
            .WithDescription("Konu etiketi başına memnuniyet ve şikâyet yoğunluğu; kategori/müdürlük kırılımıyla okunur.");
        group.MapGet("/analytics/field-operations", GetFieldOperations).RequirePermission("survey.view")
            .WithSummary("Saha operasyon durumu")
            .WithDescription("Aktif görevler, anketör verimliliği ve günlük toplanan yanıt eğrisi.");
        group.MapGet("/analytics/executive", GetExecutiveDashboard).RequirePermission("survey.view")
            .WithSummary("Başkanlık karar destek ekranı")
            .WithDescription("Tüm anketlerin üst düzey özeti: genel memnuniyet, öne çıkan konular, en düşük skorlu mahalleler ve trend.");

        return app;
    }

    private static async Task<IResult> GetFieldTasks([AsParameters] SurveyFieldTaskListParams p, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetFieldTasksAsync(p, ct)));

    private static async Task<IResult> GetFieldTask(Guid id, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetFieldTaskByIdAsync(id, ct)));

    private static async Task<IResult> CreateFieldTask(SaveSurveyFieldTaskRequest req, ISurveyPlatformService s, CancellationToken ct)
    {
        var result = await s.CreateFieldTaskAsync(req, ct);
        return Results.Created($"/api/v1/surveys/field-tasks/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> UpdateFieldTask(Guid id, SaveSurveyFieldTaskRequest req, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.UpdateFieldTaskAsync(id, req, ct)));

    private static async Task<IResult> DeleteFieldTask(Guid id, ISurveyPlatformService s, CancellationToken ct)
    {
        await s.DeleteFieldTaskAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> BatchCreateFieldTasks(BatchCreateSurveyFieldTaskRequest req, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Created(await s.BatchCreateFieldTasksAsync(req, ct)));

    private static async Task<IResult> BulkFieldTaskAction(BulkSurveyFieldTaskRequest req, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.BulkFieldTaskActionAsync(req, ct)));

    private static async Task<IResult> SearchInterviewerCandidates(string? search, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.SearchInterviewerCandidatesAsync(search, ct)));

    private static async Task<IResult> SendInterviewerMessage(SurveyInterviewerMessageRequest req, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.SendInterviewerMessageAsync(req, ct)));

    private static async Task<IResult> GetInterviewerNotificationReceipts(
        Guid? interviewerId, Guid? surveyId, int? take, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetInterviewerNotificationReceiptsAsync(interviewerId, surveyId, take ?? 50, ct)));

    private static async Task<IResult> GetInterviewers([AsParameters] SurveyAnalyticsFilterParams p, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetInterviewerStatsAsync(p, ct)));

    private static async Task<IResult> GetLiveAgents([AsParameters] SurveyAnalyticsFilterParams p, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetLiveAgentsAsync(p, ct)));

    private static async Task<IResult> GetAgentTrail(Guid interviewerId, DateTime? date, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetAgentTrailAsync(interviewerId, date, ct)));

    private static async Task<IResult> GetInterviewerPerformance([AsParameters] SurveyAnalyticsFilterParams p, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetInterviewerPerformanceAsync(p, ct)));

    private static async Task<IResult> GetQuotas(Guid id, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetQuotasAsync(id, ct)));

    private static async Task<IResult> SaveQuotas(Guid id, SaveSurveyQuotasRequest req, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.SaveQuotasAsync(id, req, ct)));

    private static async Task<IResult> GetQuestionBank([AsParameters] SurveyQuestionBankListParams p, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetQuestionBankAsync(p, ct)));

    private static async Task<IResult> GetQuestionBankTopics(ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetQuestionBankTopicsAsync(ct)));

    private static async Task<IResult> CreateQuestionBankItem(SaveSurveyQuestionBankItemRequest req, ISurveyPlatformService s, CancellationToken ct)
    {
        var result = await s.CreateQuestionBankItemAsync(req, ct);
        return Results.Created($"/api/v1/surveys/question-bank/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> UpdateQuestionBankItem(Guid id, SaveSurveyQuestionBankItemRequest req, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.UpdateQuestionBankItemAsync(id, req, ct)));

    private static async Task<IResult> ToggleQuestionBankItem(Guid id, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.ToggleQuestionBankItemAsync(id, ct)));

    private static async Task<IResult> DeleteQuestionBankItem(Guid id, ISurveyPlatformService s, CancellationToken ct)
    {
        await s.DeleteQuestionBankItemAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GetTemplates(ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetTemplatesAsync(ct)));

    private static async Task<IResult> GetNeighborhoodStats([AsParameters] SurveyAnalyticsFilterParams p, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetNeighborhoodStatsAsync(p, ct)));

    private static async Task<IResult> GetTopicStats([AsParameters] SurveyAnalyticsFilterParams p, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetTopicStatsAsync(p, ct)));

    private static async Task<IResult> GetFieldOperations([AsParameters] SurveyAnalyticsFilterParams p, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetFieldOperationsAsync(p, ct)));

    private static async Task<IResult> GetExecutiveDashboard([AsParameters] SurveyAnalyticsFilterParams p, ISurveyPlatformService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetExecutiveDashboardAsync(p, ct)));
}
