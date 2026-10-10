namespace Nexora.Application.Features.Admin.Dtos;

// Kullanıcı talimatı (2026-08-04): "şifreyi manuel oluşturulabilir" — ManualPassword
// dolu gelirse rastgele şifre üretilip SMS/e-posta ile gönderme akışı atlanır, doğrudan
// bu şifre kullanılır (MustChangeOnFirstLogin yine de true kalır — güvenlik ilkesi
// korunur, yalnız iletim yöntemi değişir).
public record CreateAdminRequest(
    string FullName,
    string Email,
    string? Phone,
    string? Department,
    string Role,
    string DeliveryChannel,
    List<Guid>? FacilityScopeIds = null,
    string? ManualPassword = null,
    // --- SultanŞehir Anket Platformu — anket-özel yetki alanları ---
    bool IsSurveyUser = false,
    bool SurveyAllNeighborhoods = true,
    bool SurveyOwnSurveysOnly = false,
    bool SurveyCanViewParticipants = false,
    bool SurveyCanViewPastSurveys = true,
    bool SurveyCreateOnly = false,
    List<string>? SurveyNeighborhoods = null
);
