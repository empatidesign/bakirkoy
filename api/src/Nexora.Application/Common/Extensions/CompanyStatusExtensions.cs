using Nexora.Application.Common.Exceptions;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Enums;

namespace Nexora.Application.Common.Extensions;

// 2026-08-26 denetiminde eklendi (P0, hata #1/#6/#29): firma onay/reddedilme durumu
// login, personel login, QR/manuel redeem ve vatandaş kampanya detay/redeem akışlarının
// hepsinde ayrı ayrı (ve tutarsız/hiç) kontrol ediliyordu. Tek ortak kontrol noktası:
// - EnsureLoginAllowed: firma/personel giriş akışları için (Rejected + Passive engellenir,
//   Pending girişe izin verir çünkü onay bekleyen firma kendi panelini görebilmeli).
// - EnsureApproved: kampanya kullandırma/redeem/detay akışları için (yalnızca Approved
//   durumundaki firmanın kampanyası kullanılabilir/erişilebilir olmalı).
public static class CompanyStatusExtensions
{
    public static void EnsureLoginAllowed(this Company company)
    {
        if (company.Status == CompanyStatus.Rejected)
            throw new ConflictException("Firmanız reddedildi. Lütfen belediye ile iletişime geçin.", "ACCOUNT_REJECTED");

        if (company.Status == CompanyStatus.Passive)
            throw new ConflictException("Hesabınız pasif durumda. Lütfen belediye ile iletişime geçin.", "ACCOUNT_PASSIVE");
    }

    public static void EnsureApproved(this Company company)
    {
        if (!company.IsApproved)
            throw new ForbiddenException("Firmanız onaylı değil. Bu işlem gerçekleştirilemez.", "COMPANY_NOT_APPROVED");
    }
}
