using Nexora.Domain.Entities.Facilities;

namespace Nexora.Application.Features.Facilities;

// K01/V06/Y05: dinamik katılım sınırının TÜM giriş yollarında (vatandaş başvuru, admin başvuru/onay,
// doğrudan admin kayıt, toplu içe-aktarım) tek kaynaktan uygulanması. Sayım kimlik-birleşik (ParticipantId ∪
// TCKN) ve terfi/aynı başvuru ikinci kez sayılmaz. Kişisel kullanım SÜRESİ ile karıştırılmaz — bu yalnız
// dönemsel katılım SAYISI limitidir.
public interface IFacilityParticipationLimitGuard
{
    Task EnsureWithinLimitAsync(
        string module,
        FacilityGroup group,
        Guid? participantId,
        string? tckn,
        DateTime? birthDate,
        Guid? excludeApplicationId,
        CancellationToken ct);
}
