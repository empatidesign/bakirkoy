namespace Nexora.Application.Features.CitizenSubmissions.Dtos;

public record CitizenSubmissionDto(
    Guid Id,
    string? TrackingNo,
    string CitizenName,
    string CitizenPhone,
    string CitizenTc,
    string Neighborhood,
    string Address,
    double? Latitude,
    double? Longitude,
    string CategoryId,
    string SubmissionType,
    string Priority,
    bool NotifyMuhtar,
    string? ComplaintReason,
    string Title,
    string Description,
    int PhotoCount,
    string Status,
    DateTime SubmittedAt,
    string SubmittedVia,
    DateTime? ForwardedAt,
    DateTime? ResolvedAt,
    string? UlakbelUnit,
    string? UlakbelTrackingNo,
    string? MuhtarName,
    string? MuhtarPhone,
    bool IsIdentityHidden = false,
    IReadOnlyList<string>? MediaUrls = null,
    bool MuhtarAccountProvisioned = false,
    DateTime? CitizenBirthDate = null,
    string? UlakbelForwardState = null);

public record CitizenSubmissionOptionDto(string Value, string Label);

public record ProvisionMuhtarRequest(string FullName, string? Phone, string? Email);

public record ProvisionMuhtarResultDto(
    Guid AdminUserId,
    string FullName,
    string Email,
    string? Phone,
    string Neighborhood,
    bool AccountCreated,
    string? TemporaryPassword);

public record MuhtarAssignmentDto(
    string Neighborhood,
    bool AccountProvisioned,
    Guid? AdminUserId,
    string? FullName,
    string? Email,
    string? Phone,
    bool IsActive = true);

/// <summary>
/// Kullanıcı isteği (2026-08-08): "onların da gerekirse talepte bulunabilmesi" — muhtarın
/// admin-panel üzerinden mahallesi adına belediyeye ilettiği bir talep. Neighborhood alanı
/// YOKTUR: her zaman muhtarın kendi scope'undaki (atanmış olduğu) tek mahalle kullanılır,
/// bu yüzden istemciden gelmez, CitizenSubmissionService.CreateByMuhtarAsync kendi scope'undan
/// çözer.
///
/// Kullanıcı isteği (2026-09-07): "muhtarın kendisi talepte bulunabilir ... fakat kişi
/// başkası adına yapılacaksa muhtar burdan talep oluştururken kişinin bilgilerini form
/// içinde girecek, TC kimlik doğum tarihi girdiğinde kişinin bilgileri NVI ile entegreli
/// çekilecek" — OnBehalfOf=false ise (varsayılan) önceki davranış aynen korunur (muhtarın
/// kendi adına, kimliksiz talebi). OnBehalfOf=true ise CitizenTc + CitizenBirthDate ile NVI
/// doğrulaması zorunludur (bkz. CreateByMuhtarAsync) — sahte/doğrulanmamış kimlik adına
/// talep açılamaz. CitizenPhone yalnızca kişi Participant olarak KAYITLI DEĞİLSE zorunludur
/// (kayıtlıysa telefonu zaten sistemde vardır, tekrar istenmez).
/// </summary>
public record CreateSubmissionByMuhtarRequest(
    string Title,
    string Description,
    string CategoryId,
    string SubmissionType,
    string Priority,
    string Address,
    double? Latitude,
    double? Longitude,
    bool OnBehalfOf = false,
    string? CitizenTc = null,
    DateTime? CitizenBirthDate = null,
    string? CitizenPhone = null,
    // "residence" = NVI/kayıtlı ikametgah adresi kullanılır, "other" = Address alanı elle girilir.
    string AddressType = "residence",
    IReadOnlyList<string>? MediaUrls = null);

/// <summary>Muhtarın başkası adına talep açarken TC + doğum tarihiyle sorguladığı kimlik
/// doğrulama sonucu. Vatandaş zaten Participant olarak kayıtlıysa IsRegisteredCitizen=true
/// döner ve telefon istenmez (backend kayıtlı telefonu kullanır); değilse muhtarın forma
/// telefon girmesi zorunlu hale gelir.</summary>
public record MuhtarNviLookupRequest(string Tckn, DateTime BirthDate);

public record MuhtarNviLookupResultDto(
    string Tckn,
    string FullName,
    DateTime BirthDate,
    string Gender,
    string? Address,
    bool IsRegisteredCitizen,
    string? RegisteredPhoneMasked);

public record MuhtarSubmissionMediaUploadDto(string Url, string ObjectName, long SizeBytes);

public record ResetForwardStateRequest(string? Reason);
