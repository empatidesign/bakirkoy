namespace Nexora.Domain.Common;

public static class LikeQuery
{
    public static string Escape(string? term)
    {
        if (string.IsNullOrEmpty(term)) return term ?? string.Empty;
        return term
            .Replace("\\", "\\\\")
            .Replace("%", "\\%")
            .Replace("_", "\\_");
    }
}
