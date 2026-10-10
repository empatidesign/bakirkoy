using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;

namespace Nexora.Infrastructure.Services;

public class TemplateShadowAuditService(
    IUnitOfWork uow,
    ILibrarySettingsService settings,
    IOperationTemplateClassifier classifier) : ITemplateShadowAuditService
{
    public async Task<TemplateShadowAuditDto> AuditAsync(Guid libraryId, CancellationToken ct)
    {
        var library = await uow.Libraries.GetByIdAsync(libraryId, ct)
            ?? throw new InvalidOperationException($"Kütüphane bulunamadı: {libraryId}");
        return await AuditCoreAsync(library, ct);
    }

    public async Task<List<TemplateShadowAuditDto>> AuditAllAsync(CancellationToken ct)
    {
        var all = await uow.Libraries.GetActiveAsync(ct);
        var results = new List<TemplateShadowAuditDto>(all.Count);
        foreach (var lib in all)
            results.Add(await AuditCoreAsync(lib, ct));
        return results;
    }

    private async Task<TemplateShadowAuditDto> AuditCoreAsync(Domain.Entities.Libraries.Library library, CancellationToken ct)
    {
        var recomputed = await classifier.ComputeAsync(library.Id, ct);
        var hasDrift = library.OperationTemplate is not null && library.OperationTemplate != recomputed;

        var violations = new List<string>();
        var assigned = library.OperationTemplate is null ? null : OperationTemplates.Find(library.OperationTemplate);
        if (assigned is not null)
        {
            var s = await settings.GetAsync(library.Id, ct);
            var caps = assigned.Capabilities;

            if (!caps.SeatSelection && library.SeatingMode == "masali")
                violations.Add("Şablon masa seçimi desteklemiyor ama SeatingMode='masali' (masa seçimi açık).");
            if (!caps.Queue && library.QueueEnabled)
                violations.Add("Şablon sıra sistemi desteklemiyor ama QueueEnabled=true.");
            if (!caps.Reservation && library.ReservationEnabled)
                violations.Add("Şablon rezervasyon desteklemiyor ama ReservationEnabled=true.");
            if (!(caps.ShortBreak || caps.LongBreak) && s.BreakSystemEnabled)
                violations.Add("Şablon mola desteklemiyor ama BreakSystemEnabled=true.");
        }

        return new TemplateShadowAuditDto(
            library.Id, library.Name, library.OperationTemplate, recomputed, hasDrift, violations, DateTime.UtcNow);
    }
}
