namespace Nexora.Application.Features.Admin.Dtos;

public record UpdateAdminRequest(
    string FullName,
    string? Phone,
    string? Department,
    string Role,
    string? Email = null,
    // Kullanıcı isteği: facility-template bir rol seçildiğinde admin panelden hangi
    // tesisleri görebileceği belirlenebilsin. null gönderilirse mevcut yetki alanı
    // hiç değiştirilmez (kısmi güncelleme geri uyumluluğu için); boş liste [] gönderilirse
    // yönetici o modüldeki HİÇBİR tesisi göremeyecek şekilde tüm yetki alanları kaldırılır.
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
