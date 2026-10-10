namespace Nexora.Application.Features.LibraryStaffIdentity;

// CitizenIdentityQrService ile birebir aynı desende — vatandaşın kişisel rotating kimlik
// QR'ının kütüphane personeli için karşılığı. Ayrı bir servis olmasının nedeni: doğrulama
// başarılı olduğunda dönen kimlik bir Participant değil bir AdminUser/LibraryStaff'tır ve
// kapı sisteminde farklı bir davranış (vardiya başlat/bitir + yetki kontrolü) tetikler —
// aynı token formatını (nxr-cid_ prefix) kullanmak, bir personelin QR'ının yanlışlıkla
// vatandaş akışında (veya tersi) kabul edilmesine yol açardı, bu yüzden ayrı prefix.
public interface IStaffIdentityQrService
{
    Task<StaffIdentityQrDto> GenerateAsync(Guid staffId, CancellationToken ct);
    Task<(bool Success, Guid StaffId)> TryVerifyAsync(string token, CancellationToken ct);
}
