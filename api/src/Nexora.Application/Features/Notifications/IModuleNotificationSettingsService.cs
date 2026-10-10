namespace Nexora.Application.Features.Notifications;

public interface IModuleNotificationSettingsService
{
    Task<Dtos.ModuleNotificationSettingsDto> GetAsync(string module, CancellationToken ct);
    Task<Dtos.ModuleNotificationSettingsDto> SaveAsync(string module, Dtos.ModuleNotificationSettingsDto dto, CancellationToken ct);

    /// <summary>Modülün varsayılan (default) şablon listesi — admin hiç düzenlemese bile boş dönmez.</summary>
    IReadOnlyList<Dtos.ModuleNotificationTemplateDto> GetDefaults(string module);
}
