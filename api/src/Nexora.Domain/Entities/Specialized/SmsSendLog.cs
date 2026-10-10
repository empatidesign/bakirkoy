using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Specialized;

// Kullanıcı isteği (2026-09-19, güncelleme 2026-09-20): "SMS gönderiminde ilk defada bile
// PIN kodu istensin, PIN asla düz metin saklanmasın; PIN yerine kullanıcının kendi
// telefonuna gönderilen SMS doğrulama kodu (OTP) da kullanılabilsin" — model artık günlük
// ücretsiz limit DEĞİL, HER gönderimde zorunlu ikinci faktör (PIN ya da OTP). Bu kaydın
// amacı hem doğrulama KARARINI (hangi yöntemle geçti/geçemedi) hem de KALICI DENETİM
// İZİNİ (kim, ne zaman, hangi modülden, kaç kişiye) tek bir tabloda tutmak. AuditLog genel
// amaçlı olduğu için (tüm CRUD'ları kapsar) SMS'e özel sorgulanabilir alanlar
// (RecipientCount, WasBlocked, UsedPinOverride, UsedOtp) burada ayrı tutuluyor — dashboard
// sorguları bu tablo üzerinden, hafif ve indexli çalışır.
public class SmsSendLog : BaseEntity
{
    public Guid AdminUserId { get; private set; }
    public string AdminUserName { get; private set; } = "";
    public string? Department { get; private set; }
    public string Module { get; private set; } = "";
    public string? Description { get; private set; }
    public int RecipientCount { get; private set; }
    public bool UsedPinOverride { get; private set; }
    /// <summary>2026-09-20: PIN yerine kendi telefonuna gönderilen tek kullanımlık SMS
    /// doğrulama koduyla (OTP) geçti mi. UsedPinOverride ile UsedOtp aynı anda true olamaz.</summary>
    public bool UsedOtp { get; private set; }
    public bool WasBlocked { get; private set; }
    public string? BlockReason { get; private set; }
    public string? IpAddress { get; private set; }

    public static SmsSendLog Create(
        Guid adminUserId, string adminUserName, string? department,
        string module, string? description, int recipientCount,
        bool usedPinOverride, bool usedOtp, bool wasBlocked, string? blockReason, string? ipAddress)
        => new()
        {
            AdminUserId = adminUserId,
            AdminUserName = adminUserName,
            Department = department,
            Module = module,
            Description = description,
            RecipientCount = recipientCount,
            UsedPinOverride = usedPinOverride,
            UsedOtp = usedOtp,
            WasBlocked = wasBlocked,
            BlockReason = blockReason,
            IpAddress = ipAddress,
        };
}
