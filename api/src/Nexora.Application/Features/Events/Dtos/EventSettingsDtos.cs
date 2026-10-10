using System.Collections.Generic;

namespace Nexora.Application.Features.Events.Dtos;

public record EventNotificationTemplateDto(
    string Event,
    bool SmsEnabled,
    string SmsBody,
    // Kullanıcı isteği (2026-10-06): önceden tüm Event bildirimleri için TEK global
    // Notifications.Push anahtarı vardı (olay bazlı seçim yoktu). Artık Facility/Travel/SEDA ile
    // aynı desen: her olayın kendi push açma/kapama ve kendi push metni var.
    bool NotifyEnabled = true,
    string NotifyBody = ""
);

public record GeneralSettingsDto(
    int MinAge,
    int MaxAge,
    int WaitingListRatio,
    int CancellationDeadlineHours,
    bool RequireApproval,
    bool AllowWaitingList,
    bool AutoApproveWaitingList
);

public record ParticipationSettingsDto(
    string DefaultLimitPeriod,
    int DefaultLimitCount,
    bool EnforceTcUnique,
    bool BlockDuplicateApplications,
    bool RequireGenderMatch
);

public record NotificationSettingsDto(
    bool Email,
    bool Sms,
    bool Push,
    bool ApplicationConfirm,
    bool Reminder24h,
    bool Reminder1h,
    bool CancellationNotice
);

public record AttendanceSettingsDto(
    bool QrCheckIn,
    bool ManualCheckIn,
    bool BulkCheckIn,
    int LateThresholdMinutes,
    int CloseAfterMinutes,
    bool AllowWalkIn,
    bool RecordCheckOut,
    int OpenBeforeMinutes = 60,
    int CheckOutCloseAfterMinutes = 180
);

public record QrSettingsDto(
    string Mode,
    int RotationSeconds,
    bool KioskEnabled,
    bool KioskAutoFullscreen,
    bool KioskShowName,
    bool PublicLinkEnabled,
    bool PublicLinkRequiresPin
);

public record ImageSpecDto(int Width, int Height, int MaxSizeKb);

public record EventImageRatioSpecDto(string Ratio, int Width, int Height, int MaxSizeKb, string Label);

public record EventImageRatioCatalogDto(
    IReadOnlyList<EventImageRatioSpecDto> Active,
    IReadOnlyList<EventImageRatioSpecDto> Legacy
);

public record ImageVariantsDto(ImageSpecDto Cover, ImageSpecDto Card, ImageSpecDto Thumb);

public record ImageSettingsDto(
    bool CropEnabled,
    bool AutoCompress,
    bool EnforceWebSpecs,
    bool EnforceMobileSpecs,
    ImageVariantsDto Web,
    ImageVariantsDto Mobile
);

public record EventSettingsDto(
    GeneralSettingsDto General,
    ParticipationSettingsDto Participation,
    NotificationSettingsDto Notifications,
    AttendanceSettingsDto Attendance,
    QrSettingsDto Qr,
    ImageSettingsDto Images,
    IReadOnlyList<EventNotificationTemplateDto> NotificationTemplates
);
