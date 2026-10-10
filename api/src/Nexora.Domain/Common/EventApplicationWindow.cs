namespace Nexora.Domain.Common;

// FacilityApplicationWindow (aynı klasör) ile aynı desen: etkinliğin kendi
// StartDate/EndDate'inden BAĞIMSIZ, başvuruların ne zaman açılıp kapanacağını
// belirleyen ayrı bir tarih aralığı. Her iki alan da null olabilir (geriye dönük
// uyumluluk) — null ise o yönde sınır yok, başvuru her zaman açık kabul edilir.
// Facility'deki desenle tutarlılık için karşılaştırma gün bazlıdır (Date), saat
// bazlı değildir; TurkeyTime.TodayDate() ile çağrılmalıdır.
public static class EventApplicationWindow
{
    public const string NotOpenCode = "APPLICATION_NOT_OPEN";
    public const string ClosedCode = "APPLICATION_CLOSED";

    public const string NotOpenMessage = "Başvurular henüz açılmadı.";
    public const string ClosedMessage = "Başvuru süresi sona erdi.";

    public static (string Code, string Message)? Check(
        DateTime? applicationStartDate,
        DateTime? applicationEndDate,
        DateTime today)
    {
        if (applicationStartDate.HasValue && applicationStartDate.Value.Date > today.Date)
            return (NotOpenCode, NotOpenMessage);

        if (applicationEndDate.HasValue && applicationEndDate.Value.Date < today.Date)
            return (ClosedCode, ClosedMessage);

        return null;
    }
}
