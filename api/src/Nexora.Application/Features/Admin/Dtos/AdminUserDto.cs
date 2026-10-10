namespace Nexora.Application.Features.Admin.Dtos;

public record AdminUserDto(
    Guid Id,
    string FullName,
    string Email,
    string? Phone,
    string? Department,
    Guid? RoleId,
    string? RoleKey,
    string RoleName,
    string? RoleColor,
    bool IsActive,
    bool IsFirstLogin,
    DateTime? LastLoginAt,
    DateTime CreatedAt,
    bool IsLocked,
    DateTime? LockedUntil,
    int FailedLoginCount,
    // Kullanıcı isteği: "Spor Salonu Yöneticisi" gibi facility-template bir rol seçildiğinde,
    // o yöneticinin hangi tesisleri görebileceği admin panelinden çok-seçimli olarak
    // belirlenebilsin. Rolün bağlı olduğu facility modülü (ör. "sports") ve o yöneticiye
    // şu anda atanmış tesis ID'leri; rol facility modülüyle ilişkili değilse ikisi de null/boş.
    string? FacilityScopeModule = null,
    List<Guid>? FacilityScopeIds = null,
    // --- SultanŞehir Anket Platformu — anket-özel yetki alanları ---
    bool IsSurveyUser = false,
    bool SurveyAllNeighborhoods = true,
    bool SurveyOwnSurveysOnly = false,
    bool SurveyCanViewParticipants = false,
    bool SurveyCanViewPastSurveys = true,
    bool SurveyCreateOnly = false,
    List<string>? SurveyNeighborhoods = null
);
