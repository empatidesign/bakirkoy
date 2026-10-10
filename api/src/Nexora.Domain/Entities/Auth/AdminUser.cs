using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Auth;

public class AdminUser : BaseEntity
{
    public string FullName { get; private set; } = "";
    public string Email { get; private set; } = "";
    public string? Phone { get; private set; }
    public string? Department { get; private set; }
    public string PasswordHash { get; private set; } = "";
    public Guid RoleId { get; private set; }
    public bool IsActive { get; private set; }
    public bool IsFirstLogin { get; private set; }
    public bool MustChangePassword { get; private set; }
    public bool IsTwoFactorEnabled { get; private set; }
    public string? TwoFactorChannel { get; private set; }
    public DateTime? LastLoginAt { get; private set; }
    public string? LastLoginIp { get; private set; }
    public int FailedLoginCount { get; private set; }
    public DateTime? LockedUntil { get; private set; }

    public bool IsLocked => LockedUntil.HasValue && LockedUntil.Value > DateTime.UtcNow;

    public int SecurityVersion { get; private set; }

    public void BumpSecurityVersion() => SecurityVersion++;

    // --- SultanŞehir Anket Platformu — anket-özel yetki alanları ---
    // Kullanıcı isteği (2026-09-01): bir yöneticiye admin panelin tamamı yerine yalnızca
    // anket sistemine özel, dar kapsamlı bir yetki verilebilsin. Bu bayrak açıksa
    // (RequirePermission("survey.view") sağlansa bile) kullanıcı yalnızca /survey modülüne
    // ve kendi kapsamındaki verilere erişebilir; başka modüllere admin panel seviyesinde
    // erişemez, gelişmiş (Başkanlık/mahalle) raporlamayı göremez.
    public bool IsSurveyUser { get; private set; }
    /// <summary>Açıksa tüm mahallelerdeki anket/saha verisini görür; kapalıysa yalnızca kendisine atanmış mahalleleri.</summary>
    public bool SurveyAllNeighborhoods { get; private set; } = true;
    /// <summary>Açıksa yalnızca kendisinin oluşturduğu anketleri görür/yönetir; kapalıysa tüm anketleri.</summary>
    public bool SurveyOwnSurveysOnly { get; private set; }
    /// <summary>Ankete katılan vatandaşların kimlik bilgilerini (ad, TC, telefon) görebilir mi.</summary>
    public bool SurveyCanViewParticipants { get; private set; }
    /// <summary>Kapalıysa yalnızca aktif/güncel anketleri görür; açıksa tamamlanmış/arşiv anketleri de görür.</summary>
    public bool SurveyCanViewPastSurveys { get; private set; } = true;
    /// <summary>Yalnızca anket oluşturabilir/düzenleyebilir; saha görevi, kota, soru bankası gibi yönetim ekranlarına erişemez.</summary>
    public bool SurveyCreateOnly { get; private set; }
    /// <summary>SurveyAllNeighborhoods=false iken erişebileceği mahalleler.</summary>
    public List<string> SurveyNeighborhoods { get; private set; } = [];

    public void ConfigureSurveyAccess(
        bool isSurveyUser, bool allNeighborhoods, bool ownSurveysOnly,
        bool canViewParticipants, bool canViewPastSurveys, bool createOnly,
        List<string>? neighborhoods)
    {
        IsSurveyUser = isSurveyUser;
        SurveyAllNeighborhoods = allNeighborhoods;
        SurveyOwnSurveysOnly = ownSurveysOnly;
        SurveyCanViewParticipants = canViewParticipants;
        SurveyCanViewPastSurveys = canViewPastSurveys;
        SurveyCreateOnly = createOnly;
        SurveyNeighborhoods = allNeighborhoods
            ? []
            : (neighborhoods?.Select(n => n.Trim()).Where(n => n.Length > 0).Distinct().ToList() ?? []);
    }


    public static AdminUser Create(string fullName, string email, string? phone, string? department, string passwordHash, Guid roleId)
        => new()
        {
            FullName = fullName,
            Email = email.ToLowerInvariant(),
            Phone = phone,
            Department = department,
            PasswordHash = passwordHash,
            RoleId = roleId,
            IsActive = true,
            IsFirstLogin = true,
            MustChangePassword = true,
            IsTwoFactorEnabled = false,
        };

    public void SetPasswordHash(string passwordHash) => PasswordHash = passwordHash;

    public void CompletePasswordChange(string passwordHash)
    {
        PasswordHash = passwordHash;
        MustChangePassword = false;
        IsFirstLogin = false;
        FailedLoginCount = 0;
        LockedUntil = null;
        SecurityVersion++;
    }

    public void ResetTemporaryPassword(string passwordHash)
    {
        PasswordHash = passwordHash;
        MustChangePassword = true;
        IsFirstLogin = true;
    }

    public void RecordLogin(string? ip)
    {
        LastLoginAt = DateTime.UtcNow;
        LastLoginIp = ip;
        FailedLoginCount = 0;
        LockedUntil = null;
        IsFirstLogin = false;
    }

    // AdminUser'da OTP zorunlu olduğu için asıl oturum RecordLogin() ile OTP doğrulandıktan
    // SONRA açılır. Ama brute-force sayacı şifre doğrulandığı anda (OTP beklemeden) sıfırlanmalı
    // — aksi halde doğru şifreyle giriş yapıp OTP adımında bekleyen bir kullanıcı, o sırada
    // gelen yanlış-şifre denemeleriyle eski sayaçtan devam ederek gereğinden erken kilitlenir
    // (2026-09-21 test bulgusu: Admin_successful_login_resets_failed_attempt_counter).
    public void ResetFailedLoginCount()
    {
        FailedLoginCount = 0;
        LockedUntil = null;
    }

    // Kullanıcı isteği (2026-09-21): "5 yanlış denemede kilitle, ama süre botlar
    // tarafından tahmin edilemesin". Sabit bir kilit süresi (ör. tam 60 saniye)
    // brute-force botların "kilidin tam olarak ne zaman açılacağını" ölçüp o
    // saniyede otomatik yeniden denemesine izin verir. jitterSeconds (üst servis
    // katmanında her denemede yeniden üretilen rastgele bir değer, ör.
    // RandomNumberGenerator ile 0-60 sn) süreye eklenir — aynı eşiğe her ulaşan
    // hesap farklı bir kilit süresiyle karşılaşır, dışarıdan gözlemlenen süre
    // sabit bir sayı değil bir aralıktır.
    public void RecordFailedLogin(int threshold, int lockoutMinutes, int jitterSeconds = 0)
    {
        FailedLoginCount++;
        if (FailedLoginCount >= threshold)
            LockedUntil = DateTime.UtcNow.AddMinutes(lockoutMinutes).AddSeconds(jitterSeconds);
    }

    public void Unlock()
    {
        FailedLoginCount = 0;
        LockedUntil = null;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    public void ConfigureTwoFactor(bool enabled, string? channel)
    {
        IsTwoFactorEnabled = enabled;
        TwoFactorChannel = enabled ? channel : null;
    }

    public void Update(string fullName, string? phone, string? department, Guid roleId)
    {
        FullName = fullName;
        Phone = phone;
        Department = department;
        RoleId = roleId;
    }

    public void SetEmail(string email) => Email = email.ToLowerInvariant();

    public void UpdateSelf(string fullName, string? phone)
    {
        FullName = fullName;
        Phone = phone;
    }

    public void ChangePassword(string currentPasswordHash, string newPasswordHash)
    {
        PasswordHash = newPasswordHash;
        MustChangePassword = false;
        IsFirstLogin = false;
        FailedLoginCount = 0;
        LockedUntil = null;
        SecurityVersion++;
    }
}
