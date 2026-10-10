namespace Nexora.Infrastructure.Persistence;

public sealed record RoleTemplate(
    string TemplateKey,
    string GroupName,
    string RoleName,
    string Color,
    string[] PermissionKeys)
{
    public string RoleKey => $"tpl-{TemplateKey}";
}

public static class RoleTemplateRegistry
{
    private static readonly string[] InstructorModuleViewPermissions =
        [.. Nexora.Application.Features.Facilities.FacilityModuleRegistry.Prefix.Keys.Select(m => $"{m}.view")];

    public static readonly RoleTemplate[] Templates =
    [
        new("tesis-sorumlusu", "Tesis Sorumlusu Yetkileri", "Tesis Sorumlusu", "#3b82f6",
            ["service-facilities.view", "service-facilities.edit", "sessions.view", "participants.view", "halls.view", "events.view"]),
        new("egitmen", "Eğitmen Yetkileri", "Eğitmen", "#10b981",
            [.. InstructorModuleViewPermissions, "sessions.view", "sessions.edit", "participants.view", "halls.view", "events.view", "qr-kiosk.view", "qr-kiosk.scan"]),
        new("gezi-sorumlusu", "Gezi Sorumlusu Yetkileri", "Gezi Sorumlusu", "#f59e0b",
            ["travels.view", "participants.view"]),
        new("etkinlik-sorumlusu", "Etkinlik Sorumlusu Yetkileri", "Etkinlik Sorumlusu", "#6366f1",
            ["events.view", "events.edit", "sessions.view", "participants.view"]),
        new("kiraathane-sorumlusu", "Kıraathane Sorumlusu Yetkileri", "Kıraathane Sorumlusu", "#8b5cf6",
            ["library.view", "library.edit", "library.devices", "library-mesai.view", "library-mesai.edit"]),
        new("mesai-sorumlusu", "Mesai Sorumlusu Yetkileri", "Mesai Sorumlusu", "#0ea5e9",
            ["library.view", "library-mesai.view", "library-mesai.edit"]),
        new("acil-alan-sorumlusu", "Acil Alan Sorumlusu Yetkileri", "Acil Alan Sorumlusu", "#ef4444",
            ["emergency-areas.view", "emergency-areas.edit"]),
        new("muhtar", "Muhtar Yetkileri", "Muhtar", "#6366f1", ["muhtarlik.view", "muhtarlik.edit"]),
    ];

    public static RoleTemplate? FindByTemplateKey(string templateKey)
        => Templates.FirstOrDefault(t => string.Equals(t.TemplateKey, templateKey, StringComparison.OrdinalIgnoreCase));
}
