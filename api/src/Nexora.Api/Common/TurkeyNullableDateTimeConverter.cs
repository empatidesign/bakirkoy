using System.Text.Json;
using System.Text.Json.Serialization;

namespace Nexora.Api.Common;

// Bulgu (2026-09-06, gerçek üretim bug'ı): TurkeyDateTimeConverter (DateTime için)
// System.Text.Json tarafından DateTime? için de otomatik sarmalanıyor, ama sarmalama
// yalnızca JSON `null` token'ını Read() çağırmadan geçiriyor — JSON boş string (`""`)
// gelirse Read() çağrılıyor, DateTime.Parse("") FormatException fırlatıyor ve bu
// ExceptionHandlingMiddleware'de 500 INTERNAL_SERVER_ERROR olarak dışa sızıyor (400
// VALIDATION_ERROR değil). Canlı örnek: admin panelde "Kayıt zorunlu değil" seçilip
// başvuru tarihleri boş bırakıldığında applicationStartDate/EndDate alanları frontend'den
// null değil boş string ("") olarak gidiyor — bu, etkinlik oluşturmayı TAMAMEN
// engelleyen bir hataydı (POST /events her zaman 500 dönüyordu). Bu converter DateTime?
// alanları için ayrıca register edilip boş/whitespace string'i null olarak ele alıyor.
public class TurkeyNullableDateTimeConverter : JsonConverter<DateTime?>
{
    private static readonly TimeZoneInfo TurkeyTz =
        TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");

    public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null) return null;
        var raw = reader.GetString();
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var parsed = DateTime.Parse(raw, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind);
        return parsed.Kind switch
        {
            DateTimeKind.Utc => parsed,
            DateTimeKind.Local => parsed.ToUniversalTime(),
            _ => TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(parsed, DateTimeKind.Unspecified), TurkeyTz),
        };
    }

    public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
    {
        if (value is null) { writer.WriteNullValue(); return; }
        var utc = value.Value.Kind == DateTimeKind.Utc ? value.Value : DateTime.SpecifyKind(value.Value, DateTimeKind.Utc);
        var turkeyTime = TimeZoneInfo.ConvertTimeFromUtc(utc, TurkeyTz);
        var offset = TurkeyTz.GetUtcOffset(turkeyTime);
        writer.WriteStringValue(new DateTimeOffset(turkeyTime, offset).ToString("yyyy-MM-ddTHH:mm:ss.fffzzz"));
    }
}
