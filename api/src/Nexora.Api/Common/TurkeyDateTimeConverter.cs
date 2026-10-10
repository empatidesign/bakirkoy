using System.Text.Json;
using System.Text.Json.Serialization;

namespace Nexora.Api.Common;

public class TurkeyDateTimeConverter : JsonConverter<DateTime>
{
    private static readonly TimeZoneInfo TurkeyTz =
        TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");

    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.GetString()!;
        var parsed = DateTime.Parse(raw, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind);
        return parsed.Kind switch
        {
            DateTimeKind.Utc => parsed,
            DateTimeKind.Local => parsed.ToUniversalTime(),
            // Offset'siz gelen değer (admin panel DatePicker'ının ürettiği format,
            // örn. "2026-09-01T09:00") Unspecified kind ile parse edilir. Bu HİÇBİR
            // ZAMAN UTC değildir; kullanıcı Türkiye saatini girmiştir. HistoryService
            // .CombineDateAndTime ile aynı desen: yerel saati açıkça Unspecified
            // işaretleyip TimeZoneInfo.ConvertTimeToUtc ile GERÇEK UTC'ye çevir.
            _ => TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(parsed, DateTimeKind.Unspecified), TurkeyTz),
        };
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utc = value.Kind == DateTimeKind.Utc
            ? value
            : DateTime.SpecifyKind(value, DateTimeKind.Utc);

        var turkeyTime = TimeZoneInfo.ConvertTimeFromUtc(utc, TurkeyTz);
        var offset      = TurkeyTz.GetUtcOffset(turkeyTime);

        writer.WriteStringValue(new DateTimeOffset(turkeyTime, offset).ToString("yyyy-MM-ddTHH:mm:ss.fffzzz"));
    }
}
