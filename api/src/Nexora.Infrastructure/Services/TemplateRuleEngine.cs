using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;

namespace Nexora.Infrastructure.Services;

public class TemplateRuleEngine(
    IUnitOfWork uow,
    ILibrarySettingsService settings,
    Microsoft.Extensions.Configuration.IConfiguration config) : ITemplateRuleEngine
{
    private bool UseTemplateEngine => Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LibraryAccess:UseTemplateEngine", false);

    public async Task<bool> IsBreakSystemEnabledAsync(Guid libraryId, CancellationToken ct)
    {
        var allowedIds = config.GetSection("LibraryAccess:FullBreakLibraryIds").GetChildren()
            .Select(x => Guid.TryParse(x.Value, out var id) ? id : Guid.Empty).ToHashSet();
        if (allowedIds.Count > 0 && !allowedIds.Contains(libraryId)) return false;
        var s = await settings.GetAsync(libraryId, ct);

        if (!UseTemplateEngine)
            return s.BreakSystemEnabled;

        var library = await uow.Libraries.GetByIdAsync(libraryId, ct);
        var template = library?.OperationTemplate is null ? null : OperationTemplates.Find(library.OperationTemplate);

        if (template is null)
            return s.BreakSystemEnabled;

        var templateAllowsBreak = template.Capabilities.ShortBreak || template.Capabilities.LongBreak;
        return templateAllowsBreak && s.BreakSystemEnabled;
    }
}
