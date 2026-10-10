using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.ParticipantSurveys;
using Nexora.Application.Features.ParticipantSurveys.Dtos;

namespace Nexora.Api.Endpoints.Me;

/// <summary>
/// Vatandaş (mobil / citizen-portal) anket uçları: kendisine açık anketleri
/// listeleme, bekleyen zorunlu anket kontrolü, yanıt gönderme ve saha
/// anketörü görev akışı.
/// Liste ucu düz sıralı döner; gruplama istemci tarafında <c>category</c>
/// alanına göre yapılır, kategori boşsa <c>sourceType</c> (Event/Travel/
/// Library/Facility) başlığı kullanılır.
/// </summary>
public static class MeSurveyEndpoints
{
    public static IEndpointRouteBuilder MapMeSurveyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/surveys")
            .WithTags("MeSurveys")
            .RequireAuthorization("Citizen");

        group.MapGet("/", GetList)
            .WithSummary("Vatandaşın anket listesi")
            .WithDescription("Giriş yapan vatandaşa açık, aktif ve tarih aralığı geçerli anketleri sayfalı döner. Her kayıtta `category` (Etkinlik, Kütüphane, Belediye Hizmetleri, müdürlük adı…), `sourceType`, `alreadyResponded` ve `isRequired` bulunur. İstemci bu listeyi `category` başlıklarına göre gruplayarak gösterir.");
        group.MapGet("/pending", GetPending)
            .WithSummary("Bekleyen anketler")
            .WithDescription("Henüz yanıtlanmamış anketleri döner (yanıtlananlar hariç).");
        group.MapGet("/pending/summary", GetPendingSummary)
            .WithSummary("Bekleyen zorunlu anket özeti")
            .WithDescription("Uygulama açılışında gösterilecek zorunlu anket var mı, kaç adet bekliyor bilgisini döner.");
        group.MapPost("/pending/prompted", MarkPrompted)
            .WithSummary("Zorunlu anket uyarısı gösterildi olarak işaretle")
            .WithDescription("Zorunlu anket modalı kullanıcıya gösterildikten sonra çağrılır; aynı oturumda tekrar tekrar açılmasını engeller.");
        group.MapGet("/field-assignment", GetFieldAssignment)
            .WithSummary("Saha anketörü yetkisi var mı")
            .WithDescription("Vatandaşın aktif bir saha anket görevi olup olmadığını döner; uygulamada saha sekmesinin görünürlüğünü belirler.");
        // Kullanıcı isteği (2026-09-01): saha görevlisi vatandaşın anket toplama ekranı.
        group.MapGet("/field/tasks", GetMyFieldTasks)
            .WithSummary("Anketöre atanmış saha görevleri")
            .WithDescription("Vatandaşa atanmış saha anket görevlerini, hedef mahalle ve kota ilerlemesiyle döner.");
        group.MapGet("/field/tasks/{taskId:guid}", GetMyFieldTaskDetail)
            .WithSummary("Saha görevi detayı")
            .WithDescription("Görevin anketi, soruları, hedef sayısı, konum zorunluluğu ve mevcut ilerleme bilgisi.");
        group.MapGet("/field/tasks/{taskId:guid}/responses", GetMyFieldResponses)
            .WithSummary("Anketörün topladığı yanıtlar")
            .WithDescription("Bu görevde anketörün kaydettiği son yanıtları döner (`take` ile sınırlandırılır, varsayılan 20).");
        group.MapGet("/field/tasks/{taskId:guid}/respondent", LookupFieldRespondent)
            .WithSummary("TCKN ile katılımcı sorgula (yerel)")
            .WithDescription("Sistemde kayıtlı katılımcıyı TCKN ile arar; bulunursa ad/soyad ön-doldurulur. Kimlik verisi loglanmaz.");
        group.MapPost("/field/tasks/{taskId:guid}/responses", SubmitFieldResponse)
            .WithSummary("Saha yanıtı kaydet")
            .WithDescription("Anketörün yüz yüze topladığı yanıtı kaydeder. Anket `requireLocation` ise GPS koordinatı zorunludur. Aynı kişi için mükerrer kayıt kota kurallarına göre reddedilebilir.");
        group.MapPost("/field/tasks/{taskId:guid}/nvi-lookup", NviLookupFieldRespondent)
            .WithSummary("NVİ kimlik doğrulama")
            .WithDescription("TCKN + ad/soyad/doğum yılı bilgisini NVİ servisi üzerinden doğrular. Sadece doğrulama sonucu döner, kimlik verisi saklanmaz.");
        group.MapPost("/field/tasks/{taskId:guid}/sms-link", SendFieldSurveySmsLink)
            .WithSummary("Anket bağlantısını SMS ile gönder")
            .WithDescription("Vatandaş yüz yüze doldurmak istemezse ankete tek kullanımlık bağlantı SMS'i gönderir.");
        group.MapPost("/field/location", RecordFieldLocation)
            .WithSummary("Saha görevlisi konum bildirimi")
            .WithDescription("Saha uygulaması açıkken periyodik GPS konumu gönderir; yönetici canlı haritada görevliyi izler. Aktif saha görevi yoksa 409 döner ve konum saklanmaz.");
        group.MapPost("/field/submissions", CreateFieldCitizenSubmission)
            .WithSummary("Sahadan vatandaş talebi oluştur")
            .WithDescription("Anketör saha sırasında vatandaştan gelen talep/şikâyeti başvuru kaydına dönüştürür.");
        group.MapGet("/{id:guid}", GetDetail)
            .WithSummary("Anket detayı ve soruları")
            .WithDescription("Vatandaşın yanıtlayacağı anketin sorularını döner. Anket kapalı, süresi geçmiş veya vatandaşa açık değilse 404 döner.");
        group.MapPost("/{id:guid}/submit", Submit)
            .WithSummary("Anketi yanıtla")
            .WithDescription("Vatandaşın cevaplarını kaydeder. Zorunlu sorular eksikse 400 döner; `allowMultipleResponses` kapalıysa ikinci gönderim reddedilir. Başarılı yanıt sadakat puanı tetikleyebilir.");

        return app;
    }

    private static async Task<IResult> GetFieldAssignment(
        IParticipantSurveyService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(new { hasActiveAssignment = await service.HasActiveFieldAssignmentAsync(ct) }));

    private static async Task<IResult> GetMyFieldTasks(
        IParticipantSurveyService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyFieldTasksAsync(ct)));

    private static async Task<IResult> GetMyFieldTaskDetail(
        Guid taskId,
        IParticipantSurveyService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyFieldTaskDetailAsync(taskId, ct)));

    private static async Task<IResult> GetMyFieldResponses(
        Guid taskId,
        int? take,
        IParticipantSurveyService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyFieldResponsesAsync(taskId, take ?? 20, ct)));

    private static async Task<IResult> LookupFieldRespondent(
        Guid taskId,
        string tckn,
        IParticipantSurveyService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.LookupFieldRespondentAsync(taskId, tckn, ct)));

    private static async Task<IResult> SubmitFieldResponse(
        Guid taskId,
        FieldSurveySubmitRequest req,
        IParticipantSurveyService service,
        CancellationToken ct)
    {
        var result = await service.SubmitFieldResponseAsync(taskId, req, ct);
        return Results.Created($"/api/v1/me/surveys/field/tasks/{taskId}/responses/{result.ResponseId}", ApiResponse.Created(result));
    }

    private static async Task<IResult> NviLookupFieldRespondent(
        Guid taskId,
        FieldNviLookupRequest req,
        IParticipantSurveyService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.NviLookupFieldRespondentAsync(taskId, req, ct)));

    private static async Task<IResult> SendFieldSurveySmsLink(
        Guid taskId,
        FieldSurveySmsLinkRequest req,
        IParticipantSurveyService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SendFieldSurveySmsLinkAsync(taskId, req, ct)));

    private static async Task<IResult> RecordFieldLocation(
        FieldLocationPingRequest req,
        IParticipantSurveyService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.RecordFieldLocationAsync(req, ct)));

    private static async Task<IResult> CreateFieldCitizenSubmission(
        FieldCitizenSubmissionRequest req,
        IParticipantSurveyService service,
        CancellationToken ct)
    {
        var result = await service.CreateFieldCitizenSubmissionAsync(req, ct);
        return Results.Created($"/api/v1/me/surveys/field/submissions/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> GetList(
        [AsParameters] CitizenSurveyListParams p,
        IParticipantSurveyService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetListAsync(p, ct)));

    private static async Task<IResult> GetPending(
        IParticipantSurveyService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPendingAsync(ct)));

    private static async Task<IResult> GetPendingSummary(
        IParticipantSurveyService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPendingSummaryAsync(ct)));

    private static async Task<IResult> MarkPrompted(
        IParticipantSurveyService service,
        CancellationToken ct)
    {
        await service.MarkMandatorySurveyPromptedAsync(ct);
        return Results.Ok(ApiResponse.Ok<object?>(null));
    }

    private static async Task<IResult> GetDetail(
        Guid id,
        IParticipantSurveyService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDetailAsync(id, ct)));

    private static async Task<IResult> Submit(
        Guid id,
        CitizenSurveySubmitRequest req,
        IParticipantSurveyService service,
        CancellationToken ct)
    {
        var result = await service.SubmitAsync(id, req, ct);
        return Results.Created($"/api/v1/me/surveys/{id}", ApiResponse.Created(result));
    }
}
