using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Surveys;

/// <summary>
/// Kullanıcı isteği (2026-09-20): "insanları çok yormadan katılım sağlayalım" — vatandaşın
/// GÜNLÜK olarak yanıtlayabileceği OPSİYONEL (zorunlu olmayan) anket sayısı ve iki anket
/// arasında beklemesi gereken minimum süre, admin panelden yönetilen tek bir global ayar
/// (Anketler &gt; Genel Ayarlar). Zorunlu (IsRequired) anketler bu kısıtlamadan MUAF'tır —
/// zaten sayıca az olur ve uygulamayı bloke ettikleri için tamamlanmaları gerekir; onlar
/// kendi ayrı "MinMandatoryPromptIntervalMinutes" temposuyla (Participant.
/// LastMandatorySurveyPromptAt) yönetilmeye devam eder — bkz. ParticipantSurveyService.
/// Tek satırlık singleton kayıt deseni (MobileAppConfig ile aynı yaklaşım).
/// </summary>
public class SurveyGlobalSettings : BaseEntity
{
    public static readonly Guid SingletonId = new("00000000-0000-0000-0000-00000000507e");

    /// <summary>Bir vatandaşın bir takvim gününde yanıtlayabileceği azami OPSİYONEL anket sayısı. 0 = sınırsız.</summary>
    public int MaxOptionalResponsesPerDay { get; private set; } = 2;

    /// <summary>İki opsiyonel anket yanıtı arasında beklenmesi gereken asgari dakika. 0 = bekleme yok.</summary>
    public int MinMinutesBetweenOptionalResponses { get; private set; } = 120;

    public static SurveyGlobalSettings CreateDefault()
        => new()
        {
            Id = SingletonId,
            MaxOptionalResponsesPerDay = 2,
            MinMinutesBetweenOptionalResponses = 120,
        };

    public void Update(int maxPerDay, int minMinutesBetween)
    {
        MaxOptionalResponsesPerDay = Math.Max(0, maxPerDay);
        MinMinutesBetweenOptionalResponses = Math.Max(0, minMinutesBetween);
        UpdatedAt = DateTime.UtcNow;
    }
}
