namespace Nexora.Domain.Entities.Auth;

public static class RoleColorPalette
{
    public const string SuperAdmin = "#ef4444";

    public static readonly string[] Colors =
    [
        "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#14b8a6",
        "#6366f1", "#f97316", "#84cc16", "#06b6d4", "#a855f7", "#eab308",
        "#0ea5e9", "#d946ef", "#22c55e", "#fb7185", "#0d9488", "#7c3aed",
    ];

    public static string Pick(bool isSuperAdmin, IReadOnlyCollection<string> used)
    {
        if (isSuperAdmin) return SuperAdmin;

        var available = Colors.Where(c => !used.Contains(c)).ToList();
        var pool = available.Count > 0 ? available : Colors.ToList();
        return pool[Random.Shared.Next(pool.Count)];
    }
}
