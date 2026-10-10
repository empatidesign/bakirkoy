using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;

namespace Nexora.Infrastructure.Services;

public class OperationTemplateClassifier(IUnitOfWork uow, ILibrarySettingsService settings) : IOperationTemplateClassifier
{
    public const string FullBusyLibrary = OperationTemplates.FullBusyLibrary;
    public const string QrEntryExitOnly = OperationTemplates.QrEntryExitOnly;
    public const string EntryExitAndSeat = OperationTemplates.EntryExitAndSeat;
    public const string SequentialSeat = OperationTemplates.SequentialSeat;

    public async Task<string> ClassifyAsync(Guid libraryId, CancellationToken ct)
    {
        var template = await ComputeAsync(libraryId, ct);
        var library = await uow.Libraries.GetByIdAsync(libraryId, ct)
            ?? throw new InvalidOperationException($"Kütüphane bulunamadı: {libraryId}");
        library.SetOperationTemplate(template);
        uow.Libraries.Update(library);
        await uow.SaveChangesAsync(ct);
        return template;
    }

    public async Task<string> ComputeAsync(Guid libraryId, CancellationToken ct)
    {
        var library = await uow.Libraries.GetByIdAsync(libraryId, ct)
            ?? throw new InvalidOperationException($"Kütüphane bulunamadı: {libraryId}");
        var s = await settings.GetAsync(libraryId, ct);
        var devices = await uow.LibraryDevices.GetByLibraryAsync(libraryId, ct);

        var hasSeatSelection = library.SeatingMode == "masali";
        var hasQueue = library.QueueEnabled;
        var hasBreakOrReservation = s.BreakSystemEnabled || library.ReservationEnabled;

        if (!hasSeatSelection)
            return QrEntryExitOnly;

        if (hasBreakOrReservation)
        {
            var activeDevices = devices.Where(d => d.IsActive).ToList();
            var hasTwoDirectionalDevices = activeDevices.Any(d => d.Direction == "entry" && d.OperationMode == "directional")
                && activeDevices.Any(d => d.Direction == "exit" && d.OperationMode == "directional");
            var hasMagneticLock = activeDevices.Any(d => d.TriggerLockOnSuccess);

            if (OperationTemplates.HasRequiredHardware(OperationTemplates.FullBusyLibraryDefinition, hasTwoDirectionalDevices, hasMagneticLock))
                return FullBusyLibrary;

            return hasQueue ? SequentialSeat : EntryExitAndSeat;
        }

        return hasQueue ? SequentialSeat : EntryExitAndSeat;
    }

    public async Task<int> ClassifyAllAsync(CancellationToken ct)
    {
        var all = await uow.Libraries.GetActiveAsync(ct);
        var count = 0;
        foreach (var lib in all)
        {
            var template = await ComputeAsync(lib.Id, ct);
            lib.SetOperationTemplate(template);
            uow.Libraries.Update(lib);
            count++;
        }
        await uow.SaveChangesAsync(ct);
        return count;
    }
}
