namespace Nexora.Domain.Common;

/// <summary>Kütüphane mesaisinin gün sonu kesimi hesapları (yerel saat ofsetiyle, UTC giriş/çıkış).</summary>
public static class ShiftCutoff
{
    /// <summary>
    /// Mesainin ait olduğu kesim anı (UTC): yerel saatte kesimden önce başlayan mesai o günün
    /// kesiminde, kesimden sonra başlayan mesai ertesi günün kesiminde kapanır.
    /// </summary>
    public static DateTime CutoffUtcFor(DateTime startUtc, int offsetMinutes, int cutoffHour, int cutoffMinute)
    {
        var offset = TimeSpan.FromMinutes(offsetMinutes);
        var localStart = startUtc + offset;
        var localCutoff = localStart.Date.AddHours(cutoffHour).AddMinutes(cutoffMinute);
        if (localStart >= localCutoff) localCutoff = localCutoff.AddDays(1);
        return DateTime.SpecifyKind(localCutoff - offset, DateTimeKind.Utc);
    }

    /// <summary>Yerel saat, kesim ile sabah açılış saati arasındaysa (kendi mesai başlatma kapalı) true.</summary>
    public static bool IsInClosedWindow(DateTime localNow, int cutoffHour, int cutoffMinute, int openHour)
    {
        var minutes = localNow.Hour * 60 + localNow.Minute;
        return minutes >= cutoffHour * 60 + cutoffMinute || minutes < openHour * 60;
    }
}
