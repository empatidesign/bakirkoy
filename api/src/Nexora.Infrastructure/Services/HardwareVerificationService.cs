using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;

namespace Nexora.Infrastructure.Services;

public class HardwareVerificationService : IHardwareVerificationService
{
    public HardwareVerificationResultDto Verify(HardwareVerificationRequest req)
    {
        var template = OperationTemplates.Find(req.RequestedTemplateId);
        if (template is null)
        {
            return new HardwareVerificationResultDto(
                req.RequestedTemplateId, false,
                ["Bilinmeyen şablon kimliği: " + req.RequestedTemplateId], null);
        }

        var devices = req.PlannedDevices ?? [];
        var hasTwoDirectionalDevices = devices.Any(d => d.Direction == "entry" && d.OperationMode == "directional")
            && devices.Any(d => d.Direction == "exit" && d.OperationMode == "directional");
        var hasMagneticLock = req.AccessType == "device" && devices.Any(d => d.TriggerLockOnSuccess);

        var missing = new List<string>();
        foreach (var hw in template.RequiredHardware)
        {
            switch (hw)
            {
                case HardwareRequirement.TwoDirectionalDevices when !hasTwoDirectionalDevices:
                    missing.Add("İki yönlü (ayrı giriş + ayrı çıkış) directional cihaz gerekli.");
                    break;
                case HardwareRequirement.MagneticLock when !hasMagneticLock:
                    missing.Add("Manyetik kilit tetikleyen (TriggerLockOnSuccess) bir cihaz ve accessType=device gerekli.");
                    break;
            }
        }

        var wantsSeat = req.SeatingMode == "masali";
        if (template.Capabilities.SeatSelection && !wantsSeat)
            missing.Add("Bu şablon masa seçimi gerektirir ama SeatingMode='sirali' (masa seçimsiz) seçilmiş.");
        if (template.Capabilities.Queue && !req.QueueEnabled)
            missing.Add("Bu şablon sıra sistemi gerektirir ama QueueEnabled=false.");
        if ((template.Capabilities.ShortBreak || template.Capabilities.LongBreak) && !req.BreakSystemEnabled)
            missing.Add("Bu şablon mola sistemi gerektirir ama BreakSystemEnabled=false.");

        if (missing.Count == 0)
            return new HardwareVerificationResultDto(req.RequestedTemplateId, true, [], null);

        var fallback = OperationTemplates.FindBestFallback(hasTwoDirectionalDevices, hasMagneticLock);
        var fallbackId = fallback?.Id == req.RequestedTemplateId ? null : fallback?.Id;
        return new HardwareVerificationResultDto(req.RequestedTemplateId, false, missing, fallbackId);
    }
}
