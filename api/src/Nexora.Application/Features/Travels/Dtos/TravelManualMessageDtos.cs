namespace Nexora.Application.Features.Travels.Dtos;

/// <summary>
/// Kullanıcı isteği (2026-08-07): manuel/toplu mesaj gönderme ekranı — bir sefere ait
/// yolculara (opsiyonel: durum filtresiyle) TravelSettings'teki bir şablonu (personalize
/// edilmiş, her yolcuya kendi adıyla) ya da tamamen özel bir metni gönderir.
///
/// customText verilmişse şablon yerine bu metin kullanılır (yine {{placeholder}} interpolasyonu
/// uygulanır) — kullanıcının "gerektiğinde özel metinle değiştirilebilecek" isteğini karşılar.
/// templateEvent = "departure_reminder" seçilip gönderilirse, TravelDepartureReminderJob'ın
/// aynı hatırlatmayı bir daha göndermemesi için Travel.AttendanceReminderSentAt de işaretlenir.
/// </summary>
public record TravelManualMessageRequest(
    Guid TravelId,
    string TemplateEvent,
    string? CustomText,
    bool Sms,
    bool Notify,
    List<string>? StatusFilter = null,
    string? SmsOtp = null
);

public record TravelManualMessageResultDto(
    int Recipients,
    int SmsSent,
    int NotificationsCreated,
    bool SmsMockMode = false
);
