using Microsoft.AspNetCore.Mvc;
using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Surveys;
using Nexora.Application.Features.Surveys.Dtos;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Notifications.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Surveys;

/// <summary>
/// Yönetim paneli anket uçları: anket CRUD, soru listesi, analitik, yanıtlar,
/// çoğaltma, silme etki özeti ve anket bildirim ayarları.
/// Anketler <c>Category</c> (Etkinlik, Gezi, Spor, Eğitim, Kütüphane,
/// Belediye Hizmetleri, Gençlik, Genel — veya müdürlük adı) alanına göre
/// gruplanır; vatandaş uygulaması listeyi bu alana göre başlıklı bölümlere ayırır.
/// </summary>
public static class SurveyEndpoints
{
    public static IEndpointRouteBuilder MapSurveyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/surveys")
            .WithTags("Surveys")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("survey.view")
            .WithSummary("Anket listesi (sayfalı)")
            .WithDescription("Anketleri sayfalı döner. `category` parametresiyle tek kategoriye (müdürlük/alan) daraltılabilir; `search`, `status`, `isActive` ile filtrelenir. Vatandaş uygulamasındaki kategori başlıkları bu `category` alanından üretilir.");
        group.MapGet("/summary", GetSummary).RequirePermission("survey.view")
            .WithSummary("Anket özet istatistikleri")
            .WithDescription("Toplam/aktif anket, yanıt sayıları ve `categoryDistribution` (kategori başına anket adedi) döner. Kategori bazlı gruplu görünümlerin sayaçları buradan beslenir.");
        group.MapGet("/{id:guid}", GetById).RequirePermission("survey.view")
            .WithSummary("Anket detayı")
            .WithDescription("Tek anketin tüm alanlarını döner: kategori, hedef kitle, anket türü (`surveyType`), kimlik modu (`identityMode`), konu (`topic`), hedef mahalleler ve saha ayarları.");
        group.MapGet("/{id:guid}/questions", GetQuestions).RequirePermission("survey.view")
            .WithSummary("Anket soruları")
            .WithDescription("Anketin sorularını sıra numarasına göre döner (tip, seçenekler, ölçek aralığı ve zorunluluk bilgisiyle).");
        group.MapGet("/{id:guid}/analytics", GetAnalytics).RequirePermission("survey.view")
            .WithSummary("Anket analitiği")
            .WithDescription("Soru bazlı dağılımlar, ortalama puan, katılım oranı ve zaman serisi. Anonim anketlerde kimlik alanları maskelenir.");
        group.MapGet("/{id:guid}/responses", GetResponses).RequirePermission("survey.view")
            .WithSummary("Anket yanıtları (sayfalı)")
            .WithDescription("Ankete verilen yanıtları sayfalı döner. `isAnonymous` anketlerde katılımcı kimliği gizlenir.");
        group.MapGet("/{id:guid}/responses/{responseId:guid}", GetResponseById).RequirePermission("survey.view")
            .WithSummary("Tek yanıt detayı")
            .WithDescription("Bir katılımcının verdiği tüm cevapları soru sırasıyla döner.");
        group.MapPost("/", Create).RequirePermission("survey.create")
            .WithSummary("Anket oluştur")
            .WithDescription("Yeni anket ve soruları oluşturur. `category` zorunlu değildir ama boş bırakılırsa anket vatandaş tarafında kaynak türü başlığı (Etkinlik/Gezi/Kütüphane/Tesis/Genel) altında listelenir; müdürlük veya alan bazlı gruplama için doldurulmalıdır.");
        group.MapPut("/{id:guid}", Update).RequirePermission("survey.edit")
            .WithSummary("Anket güncelle")
            .WithDescription("Anketi ve sorularını tümüyle değiştirir (soru listesi replace edilir). Kategori değişikliği vatandaş listesindeki grubu anında etkiler.");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("survey.edit")
            .WithSummary("Anketi aktif/pasif yap")
            .WithDescription("`isActive` bayrağını ters çevirir. Pasif anket vatandaş listesinde görünmez.");
        group.MapPost("/{id:guid}/duplicate", Duplicate).RequirePermission("survey.create")
            .WithSummary("Anketi çoğalt")
            .WithDescription("Anketi soruları ve kategorisiyle birlikte taslak olarak kopyalar; yanıtlar kopyalanmaz.");
        // Kullanıcı isteği (2026-09-01): silme yalnızca süper yöneticide ve yazılı onayla.
        // Etki özeti ucu, silmeden önce kaç yanıtın yok olacağını yöneticiye gösterir.
        group.MapGet("/{id:guid}/delete-impact", DeleteImpact).RequirePermission("survey.delete")
            .WithSummary("Silme etki özeti")
            .WithDescription("Silme öncesi kaç yanıtın, saha görevinin ve kotanın yok olacağını döner. Silme onay ekranı bu veriyi gösterir.");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("survey.delete")
            .WithSummary("Anketi sil")
            .WithDescription("Anketi, sorularını ve yanıtlarını kalıcı olarak siler. Yalnızca süper yönetici, yazılı onay metniyle çağırabilir. Geri alınamaz.");
        group.MapPost("/messages/send", SendMessage).RequirePermission("survey.edit")
            .WithSummary("Anket duyurusu gönder")
            .WithDescription("Seçili hedef kitleye anket bağlantısını SMS/bildirim olarak gönderir.");
        group.MapGet("/notification-settings", GetNotificationSettings).RequirePermission("survey.view")
            .WithSummary("Anket bildirim ayarları")
            .WithDescription("Etkinlik sonrası otomatik anket gönderimi ve hatırlatma SMS'i için kayıtlı varsayılanları döner.");
        group.MapPut("/notification-settings", SaveNotificationSettings).RequirePermission("survey.edit")
            .WithSummary("Anket bildirim ayarlarını kaydet")
            .WithDescription("Etkinlik sonrası otomatik gönderim ve hatırlatma SMS'i varsayılanlarını günceller.");
        group.MapGet("/global-settings", GetGlobalSettings).RequirePermission("survey.view")
            .WithSummary("Anket genel ayarları")
            .WithDescription("Vatandaş başına günlük opsiyonel anket yanıtı limiti ve iki yanıt arası bekleme süresini döner. Zorunlu anketler bu limitten muaftır.");
        group.MapPut("/global-settings", SaveGlobalSettings).RequirePermission("survey.edit")
            .WithSummary("Anket genel ayarlarını kaydet")
            .WithDescription("Günlük opsiyonel anket limiti ve yanıtlar arası bekleme süresini günceller.");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] SurveyListParams p, ISurveyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(ISurveyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(ct)));

    private static async Task<IResult> GetById(Guid id, ISurveyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> GetQuestions(Guid id, ISurveyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetQuestionsAsync(id, ct)));

    private static async Task<IResult> GetAnalytics(Guid id, ISurveyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetAnalyticsAsync(id, ct)));

    private static async Task<IResult> GetResponses(Guid id, [AsParameters] SurveyResponseListParams p, ISurveyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetResponsesAsync(id, p, ct)));

    private static async Task<IResult> GetResponseById(Guid id, Guid responseId, ISurveyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetResponseByIdAsync(id, responseId, ct)));

    private static async Task<IResult> Create(
        CreateSurveyRequest req,
        ISurveyService service,
        IValidator<CreateSurveyRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/surveys/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateSurveyRequest req,
        ISurveyService service,
        IValidator<UpdateSurveyRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> ToggleStatus(Guid id, ISurveyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));

    private static async Task<IResult> Duplicate(Guid id, ISurveyService service, CancellationToken ct)
    {
        var result = await service.DuplicateAsync(id, ct);
        return Results.Created($"/api/v1/surveys/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Delete(Guid id, [FromBody] SurveyDeleteRequest req, ISurveyService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> DeleteImpact(Guid id, ISurveyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDeleteImpactAsync(id, ct)));

    private static async Task<IResult> SendMessage(ModuleManualMessageRequest req, ISurveyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SendManualMessageAsync(req, ct)));

    private static async Task<IResult> GetNotificationSettings(IModuleNotificationSettingsService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetAsync("survey", ct)));

    private static async Task<IResult> SaveNotificationSettings(ModuleNotificationSettingsDto req, IModuleNotificationSettingsService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SaveAsync("survey", req, ct)));

    private static async Task<IResult> GetGlobalSettings(ISurveyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetGlobalSettingsAsync(ct)));

    private static async Task<IResult> SaveGlobalSettings(UpdateSurveyGlobalSettingsRequest req, ISurveyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.UpdateGlobalSettingsAsync(req, ct)));
}
