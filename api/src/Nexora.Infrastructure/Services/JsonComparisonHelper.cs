using System.Text.Json.Nodes;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Postgres jsonb sütunları diskte kanonik (normalize edilmiş) anahtar sırasıyla saklanır.
/// EF Core bir jsonb sütununu okuduğunda bu kanonik sırayla string döner, ama
/// istemciden/DTO'dan JsonSerializer.Serialize ile üretilen JSON, alan tanım sırasını korur.
/// İçerik birebir aynı olsa bile ham string karşılaştırması (a != b) bu yüzden güvenilmezdir
/// ve her zaman "değişti" sonucu üretebilir (bkz. HallService/TravelBusService jsonb bug'ı).
/// Bu yardımcı, iki JSON string'i semantik olarak (anahtar sırasından bağımsız) karşılaştırır.
///
/// DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR regresyon kontrolü, madde #10/#18):
/// Önceki implementasyon `NormalizeJson(left) == NormalizeJson(right)` (string eşitliği)
/// kullanıyordu. `JsonNode.Parse(...).ToJsonString()` .NET'te anahtar sırasını SIRALAMAZ,
/// yalnızca whitespace/formatting'i kaldırır — orijinal anahtar sırası korunur. Bu yüzden
/// nested obje içeren (örn. salon koltuk "protokol" ataması) iki eşdeğer-ama-farklı-sıralı
/// JSON hâlâ "farklı" string üretiyor ve `layoutChanged`/`seatChanged` yanlışlıkla `true`
/// dönüp veri (protokol ataması) sessizce siliniyordu. `JsonNode.DeepEquals` ise obje
/// anahtarlarını sıradan bağımsız (değer bazlı) karşılaştırır, dizilerde ise (doğru şekilde)
/// eleman sırasını önemser — canlı testle doğrulandı.
/// </summary>
public static class JsonComparisonHelper
{
    /// <summary>
    /// Bir JSON string'ini kanonik forma normalize eder (JsonNode ağacına parse edip
    /// tekrar serialize eder). Boş/null girdi için null döner; parse edilemeyen girdi
    /// için orijinal string aynen döner (böylece en azından ham string karşılaştırması
    /// bozulmaz, ama en azından hata fırlatmaz).
    /// </summary>
    public static string? NormalizeJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;

        try
        {
            var node = JsonNode.Parse(json);
            return node?.ToJsonString();
        }
        catch (System.Text.Json.JsonException)
        {
            // Parse edilemeyen (geçersiz JSON) girdi olduğu gibi bırakılır; çağıran taraf
            // yine de bir karşılaştırma yapabilsin diye exception fırlatılmaz.
            return json;
        }
    }

    /// <summary>
    /// İki JSON string'inin, anahtar sırasından bağımsız olarak semantik açıdan eşit olup
    /// olmadığını döner. Her iki taraf da null/boş ise eşit sayılır. Parse edilemeyen
    /// girdilerde ham string karşılaştırmasına düşer (exception fırlatmaz).
    /// </summary>
    public static bool JsonEquals(string? left, string? right)
    {
        var leftEmpty = string.IsNullOrWhiteSpace(left);
        var rightEmpty = string.IsNullOrWhiteSpace(right);
        if (leftEmpty && rightEmpty) return true;
        if (leftEmpty != rightEmpty) return false;

        try
        {
            var leftNode = JsonNode.Parse(left!);
            var rightNode = JsonNode.Parse(right!);
            return JsonNode.DeepEquals(leftNode, rightNode);
        }
        catch (System.Text.Json.JsonException)
        {
            // Parse edilemeyen taraf(lar) varsa, en azından ham string karşılaştırmasına düş.
            return left == right;
        }
    }
}
