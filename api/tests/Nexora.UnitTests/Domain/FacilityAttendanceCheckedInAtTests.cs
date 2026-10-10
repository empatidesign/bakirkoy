using Nexora.Domain.Entities.Facilities;
using Xunit;

namespace Nexora.UnitTests.Domain;

// Kod denetimi 2026-08-02 (kullanıcı isteği: tüm giriş yollarında CheckedInAt tutarlılığı, iki kez
// bağımsız doğrulanmış gerçek hata): FacilityAttendance.MarkCheckedIn eskiden Status'u her zaman
// "present"e zorluyordu — bu, önceden hesaplanmış "late" durumunu (Sabit-QR akışında) sessizce
// eziyordu. Ayrıca fiziksel turnike/cihaz ve kiosk (manuel/QR) girişleri hiç CheckedInAt set
// etmiyordu, bu da RecurringJobsBootstrapper.FacilityAutoCheckoutJob'ın (CheckedInAt != null
// filtresi) bu kayıtları asla bulamamasına yol açıyordu — kişi kapasitede sonsuza kadar
// "içeride" görünebilirdi. Bu testler regresyonu (SetCheckedInAt'in yeniden Status'a dokunması
// veya kaldırılması) engeller.
public class FacilityAttendanceCheckedInAtTests
{
    private static FacilityAttendance CreateLate()
        => FacilityAttendance.Create("sports", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            Guid.NewGuid(), Guid.NewGuid(), "Test Kişi", "12345678901", "late", "static-qr", "static-qr:test");

    [Fact]
    public void SetCheckedInAt_CheckedInAt_alanini_doldurur()
    {
        var attendance = CreateLate();
        Assert.Null(attendance.CheckedInAt);

        attendance.SetCheckedInAt();

        Assert.NotNull(attendance.CheckedInAt);
    }

    [Fact]
    public void SetCheckedInAt_onceden_hesaplanmis_Status_u_EZMEZ()
    {
        // Bu, tam olarak ScanStaticQrAsync'te bulunan regresyonu temsil ediyor: "late" olarak
        // hesaplanmış bir kayıt, giriş işaretlenirken yanlışlıkla "present"e dönmemeli.
        var attendance = CreateLate();
        Assert.Equal("late", attendance.Status);

        attendance.SetCheckedInAt();

        Assert.Equal("late", attendance.Status);
    }

    [Fact]
    public void MarkCheckedIn_Status_u_present_e_zorlar_kasitli_davranis()
    {
        // MarkCheckedIn hâlâ mevcut (G/mobil self-servis QR akışı kullanıyor) ve kasıtlı olarak
        // Status="present" set ediyor — bu davranış korunmalı, sadece "late" hesaplanan yerlerde
        // (Sabit-QR gibi) artık SetCheckedInAt kullanılıyor.
        var attendance = CreateLate();

        attendance.MarkCheckedIn("qr", "qr-entry:test");

        Assert.Equal("present", attendance.Status);
        Assert.NotNull(attendance.CheckedInAt);
    }

    [Fact]
    public void SetCheckedInAt_Method_ve_MarkedBy_alanlarina_DOKUNMAZ()
    {
        var attendance = CreateLate();

        attendance.SetCheckedInAt();

        // Create() ile verilen orijinal Method/MarkedBy korunmalı — SetCheckedInAt yalnızca
        // CheckedInAt (ve UpdatedAt) alanını değiştiren dar kapsamlı bir metod olmalı.
        Assert.Equal("static-qr", attendance.Method);
        Assert.Equal("static-qr:test", attendance.MarkedBy);
    }
}
