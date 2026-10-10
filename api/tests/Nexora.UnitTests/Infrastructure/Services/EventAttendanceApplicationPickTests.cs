using Nexora.Domain.Entities.Events;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

// REGRESYON — BULGU 2026-09-06 (aile senaryosu canlı testi, TCKN 24223024278):
// `EventAttendanceService.CheckInAsync` yoklama alınacak başvuruyu seçerken istekte gelen
// `sessionId`'yi tamamen yok sayıyor, koşulsuz `FirstOrDefault(a => a.Status == "approved")`
// kullanıyordu. Aynı etkinliğin birden çok seansına başvurmuş bir katılımcı BUGÜNKÜ seansına
// giriş yapmak istediğinde GELECEKTEKİ başvurusu seçiliyor ve `ResolveStartAtAsync` o seansın
// saatine bakıp haksız yere `ATTENDANCE_NOT_OPEN` fırlatıyordu.
//
// Canlı kanıt (düzeltme öncesi/sonrası A/B): 13 Eylül 20:00 + bugün 00:03 başvurusu olan
// katılımcı, bugünkü seansa check-in denediğinde eski kodda 409 ATTENDANCE_NOT_OPEN,
// düzeltmeden sonra 200 ("07.09.2026 · 00:03-01:03") aldı.
public class EventAttendanceApplicationPickTests
{
    private static EventApplication App(Guid? sessionId, string status = "approved")
        => EventApplication.Create(
            eventId: Guid.NewGuid(),
            sessionId: sessionId,
            participantId: Guid.NewGuid(),
            referenceDate: DateTime.UtcNow,
            status: status,
            documentStatus: "missing",
            paymentStatus: "unpaid",
            code: "EVB-TEST",
            actor: null);

    [Fact]
    public void IstenenSeansaAitOnayliBasvuruSecilir()
    {
        var gelecekSeans = Guid.NewGuid();
        var bugunSeans = Guid.NewGuid();
        // Sıra bilinçli: "gelecek" başvuru ilk sırada — eski kod bunu seçip hataya düşüyordu.
        var basvurular = new[] { App(gelecekSeans), App(bugunSeans) };

        var secilen = EventAttendanceService.PickApplication(basvurular, bugunSeans);

        Assert.NotNull(secilen);
        Assert.Equal(bugunSeans, secilen!.SessionId);
    }

    [Fact]
    public void OnaysizBasvurularSecilmez()
    {
        var seans = Guid.NewGuid();
        var basvurular = new[] { App(seans, "pending"), App(seans, "rejected") };

        Assert.Null(EventAttendanceService.PickApplication(basvurular, seans));
    }

    [Fact]
    public void IstenenSeansYoksaSeansBagimsizBasvuruyaDusulur()
    {
        // Seanssız (SessionId = null) başvuru, etkinliğin tamamı için geçerlidir.
        var basvurular = new[] { App(Guid.NewGuid()), App(null) };

        var secilen = EventAttendanceService.PickApplication(basvurular, Guid.NewGuid());

        Assert.NotNull(secilen);
        Assert.Null(secilen!.SessionId);
    }

    [Fact]
    public void SeansBelirtilmezseIlkOnayliBasvuruKullanilir()
    {
        // Seansız etkinliklerde eski davranış korunmalı (geriye dönük uyumluluk).
        var ilk = App(null);
        var basvurular = new[] { ilk, App(null) };

        var secilen = EventAttendanceService.PickApplication(basvurular, null);

        Assert.Same(ilk, secilen);
    }

    [Fact]
    public void EslesmeYoksaVeSeanssizBasvuruDaYoksaIlkOnayliDonulur()
    {
        // Hiçbir başvuru istenen seansa ait değilse eski davranışa düşülür; böylece daha önce
        // çalışan akışlar (ör. admin tarafından farklı seansa taşınmış başvuru) bozulmaz.
        var ilk = App(Guid.NewGuid());
        var basvurular = new[] { ilk, App(Guid.NewGuid()) };

        Assert.Same(ilk, EventAttendanceService.PickApplication(basvurular, Guid.NewGuid()));
    }
}
