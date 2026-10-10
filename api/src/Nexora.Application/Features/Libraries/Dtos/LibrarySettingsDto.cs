namespace Nexora.Application.Features.Libraries.Dtos;

public record LibraryNotificationTemplateDto(
    string Event,
    bool SmsEnabled,
    string SmsBody,
    bool NotifyEnabled,
    string NotifyBody
);

public record LibraryManualMessageRequest(
    List<Guid>? SessionIds,
    string TemplateEvent,
    string? CustomText,
    bool Sms,
    bool Notify,
    // 2026-09-20: PIN yerine kullanıcının kendi telefonuna gönderilen SMS OTP koduyla da
    // doğrulama yapılabilir — bkz. ISmsGovernanceService.
    string? SmsOtp = null
);

public record LibraryManualMessageResultDto(
    int Recipients,
    int SmsSent,
    int NotificationsCreated,
    bool SmsMockMode = false
);

public record LibraryNotificationContext(
    string LibraryName,
    DateTime? Date = null,
    int? DurationMinutes = null,
    int? OverdueCount = null,
    string? StatusInfo = null,
    string? Message = null
);

public record class LibrarySettingsDto
{
    public bool PointsEnabled { get; init; } = true;
    public int PointsPerVisit { get; init; } = 10;
    public int DailyVisitCap { get; init; } = 0;
    public int DailyPointCap { get; init; } = 50;
    public int WeeklyPointCap { get; init; } = 200;
    public bool QrRequired { get; init; } = true;
    public bool RequiresEntryAndExit { get; init; } = true;

    public int BreakDurationMinutes { get; init; } = 30;
    public int MaxDailyBreaks { get; init; } = 3;
    public int LongBreakDurationMinutes { get; init; } = 60;
    public int ShortBreakCooldownMinutes { get; init; } = 60;
    public int MaxDailyLongBreaks { get; init; }
    public int MaxSessionMinutes { get; init; }
    public int MaxStudyHoursPerDay { get; init; } = 9;
    public int RequireBreakAfterHours { get; init; } = 3;
    public bool HourlyBreakEnabled { get; init; } = true;
    public int HourlyBreakMinutesPerHour { get; init; } = 25;
    public int HourlyBreakMaxPerDay { get; init; } = 8;
    public int BreakReturnGraceMinutes { get; init; } = 10;

    public int QueueCallWindowMinutes { get; init; } = 5;
    public bool AutoQueueCallEnabled { get; init; } = true;

    public int ReservationHoldWindowMinutes { get; init; } = 30;
    public int DailyReservationLimitPerLibrary { get; init; } = 2;
    public int AutoCheckOutAfterMinutes { get; init; }
    public int MinCheckoutAfterMinutes { get; init; }

    public int WalkInHoldMinutes { get; init; } = 5;

    public int MinEntryBeforeBreakMinutes { get; init; } = 30;

    public bool BreakSystemEnabled { get; init; } = true;
    /// <summary>
    /// Kullanıcı isteği (2026-08-08): teslim tarihi geçmiş (gecikmiş) emanet/kitabı olan üyenin
    /// kıraathaneye girişi engellensin. Önceden (docs/kutuphane-derin-test-2026-07-29.md P1 bulgusu)
    /// bu kontrol yalnızca personele bildirim gönderiyordu, girişi hiç engellemiyordu.
    /// false (varsayılan) = eski davranış korunur (sadece bildirim), true = giriş reddedilir.
    /// </summary>
    public bool BlockEntryOnOverdue { get; init; } = false;
    /// <summary>
    /// Kullanıcı isteği (2026-08-29): "belirlenen gün öncesi veya saat öncesi bildirim sms
    /// ve mail içinde yapabilmesi lazım, tüm modüller için". Kıraathane üye uyarıları
    /// (rezervasyon giriş süresi dolmak üzere, mola bitmek üzere, çıkış süresi dolmak üzere)
    /// önceden yalnızca LibraryNotifications:MemberWarnChannel (sms/push/both) config'ine göre
    /// SMS/uygulama-içi gönderiyordu, e-posta hiç yoktu. Varsayılan kapalı, mevcut davranışı
    /// bozmasın diye.
    /// </summary>
    public bool MemberWarnEmailEnabled { get; init; } = false;
    public List<LibraryNotificationTemplateDto>? NotificationTemplates { get; init; }
}

public class LibrarySettingsHistoryDto
{
    public Guid Id { get; init; }
    public Guid? LibraryId { get; init; }
    public LibrarySettingsDto? OldSettings { get; init; }
    public LibrarySettingsDto NewSettings { get; init; } = new();
    public string? ChangedBy { get; init; }
    public DateTime ChangedAt { get; init; }
    public List<string> ChangedKeys { get; init; } = [];
}
