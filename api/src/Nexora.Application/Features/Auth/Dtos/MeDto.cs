namespace Nexora.Application.Features.Auth.Dtos;

public record MeDto
{
    public Guid Id { get; init; }
    public string FullName { get; init; } = "";
    public string Email { get; init; } = "";
    public string? Phone { get; init; }
    public bool IsActive { get; init; }
    public bool MustChangePassword { get; init; }
    public bool IsTwoFactorEnabled { get; init; }
    public DateTime? LastLoginAt { get; init; }
    public bool IsSuperAdmin { get; init; }
    public List<string> Permissions { get; init; } = [];
    public List<MeScopeDto> Scopes { get; init; } = [];
    public string RoleName { get; init; } = "";
    public string? RoleColor { get; init; }
    // --- SultanŞehir Anket Platformu — anket-özel yetki alanları (doküman 07 §9) ---
    // Frontend bu bayrağa bakarak "Anket Kullanıcısı" için admin panelde yalnızca
    // Anketler modülünü gösterir, diğer menüleri gizler.
    public bool IsSurveyUser { get; init; }
    public bool SurveyAllNeighborhoods { get; init; } = true;
    public bool SurveyOwnSurveysOnly { get; init; }
    public bool SurveyCanViewParticipants { get; init; }
    public bool SurveyCanViewPastSurveys { get; init; } = true;
    public bool SurveyCreateOnly { get; init; }
    public List<string> SurveyNeighborhoods { get; init; } = [];
}

public record MeScopeDto
{
    public string ModuleKey { get; init; } = "";
    public Guid[] RefIds { get; init; } = [];
}
