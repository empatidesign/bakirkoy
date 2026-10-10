using Nexora.Application.Features.CitizenIdentity;
using Nexora.Application.Features.ParticipantFacilities;
using Nexora.Application.Features.QrPasses;

namespace Nexora.Infrastructure.Services;

public class QrPassService(
    ICitizenIdentityQrService identityQr,
    IParticipantFacilityService facilities) : IQrPassService
{
    public async Task<QrPassListDto> GetPassesAsync(Guid participantId, CancellationToken ct)
    {
        var identity = await identityQr.GenerateAsync(participantId, ct);
        var identityPass = new QrPassDto(
            "identity",
            "Kimlik QR",
            "Tüm giriş noktalarında geçerli kimliğiniz",
            identity.Token,
            identity.RotationSeconds,
            identity.ExpiresAt,
            identity.ShortCode,
            null,
            null);

        var turnstile = await facilities.GetTurnstileQrAsync(null, ct);
        var passes = turnstile.Select(t => new QrPassDto(
            "facility",
            t.FacilityName,
            string.IsNullOrWhiteSpace(t.GroupName) ? t.ModuleLabel : $"{t.ModuleLabel} · {t.GroupName}",
            t.Token,
            t.WindowSeconds,
            null,
            null,
            t.Module,
            t.RegistrationId)).ToList();

        return new QrPassListDto(identityPass, passes);
    }
}
