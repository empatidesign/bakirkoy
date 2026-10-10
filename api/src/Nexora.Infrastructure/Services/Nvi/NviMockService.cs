using Microsoft.Extensions.Logging;
using Nexora.Application.Features.Nvi;
using Nexora.Application.Features.Nvi.Dtos;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services.Nvi;

public class NviMockService(ILogger<NviMockService> logger) : INviService
{
    public Task<NviPersonAndChildrenResponse> GetPersonAndChildrenAsync(
        string tckn,
        DateTime birthDate,
        int maxChildAge = 18,
        CancellationToken ct = default)
    {
        logger.LogInformation("NVI MOCK: sahte veli + 2 çocuk dönülüyor (TC {Prefix})",
            tckn.Length >= 3 ? tckn[..3] : "***");

        var today = DateTime.UtcNow;
        var scenario = IsScenarioTestTckn(tckn);
        var address = scenario && IsOutsideScenarioTckn(tckn)
            ? "Test Mah. Senaryo Cad. No:1 Kadıköy/İstanbul"
            : "Cumhuriyet Mah. Atatürk Cad. No:12 D:5 Sultangazi/İstanbul";
        var parentGender = scenario ? ScenarioGender(tckn) : Gender.Male;

        var person = new NviPersonDto(
            tckn,
            scenario ? "Senaryo" : "Mehmet",
            scenario ? $"Test {tckn[^2..]}" : "Yılmaz",
            DateTime.SpecifyKind(birthDate, DateTimeKind.Utc),
            parentGender,
            address);

        var children = scenario
            ? BuildScenarioChildren(tckn, today, address)
            :
            [
                new(ShiftTc(tckn, 1), "Ali", "Yılmaz", DateTime.SpecifyKind(today.AddYears(-8), DateTimeKind.Utc), Gender.Male, address),
                new(ShiftTc(tckn, 2), "Ayşe", "Yılmaz", DateTime.SpecifyKind(today.AddYears(-14), DateTimeKind.Utc), Gender.Female, address),
            ];

        children = children
            .Where(c => CalculateAge(c.BirthDate, today) < maxChildAge)
            .ToList();

        return Task.FromResult(new NviPersonAndChildrenResponse(true, null, person, children));
    }

    public Task<NviAddressResponse> GetAddressAsync(
        string tckn,
        DateTime birthDate,
        CancellationToken ct = default)
    {
        logger.LogInformation("NVI MOCK: sahte Sultangazi adresi dönülüyor (TC {Prefix})",
            tckn.Length >= 3 ? tckn[..3] : "***");

        var outside = IsScenarioTestTckn(tckn) && IsOutsideScenarioTckn(tckn);
        var address = new NviAddressDto(
            FullAddress: outside
                ? "Test Mah. Senaryo Cad. No:1 Kadıköy/İstanbul"
                : "Cumhuriyet Mah. Atatürk Cad. No:12 D:5 Sultangazi/İstanbul",
            City: "İstanbul",
            District: outside ? "Kadıköy" : "Sultangazi",
            Neighborhood: outside ? "Test" : "Cumhuriyet",
            DistrictCode: outside ? "9999" : "2055");

        return Task.FromResult(new NviAddressResponse(true, null, address));
    }

    private static bool IsScenarioTestTckn(string tckn) =>
        tckn.StartsWith("98", StringComparison.Ordinal) || tckn.StartsWith("99", StringComparison.Ordinal);

    private static bool IsOutsideScenarioTckn(string tckn) => tckn.StartsWith("98", StringComparison.Ordinal);

    private static Gender ScenarioGender(string tckn)
    {
        var digit = tckn.Length > 2 && char.IsDigit(tckn[2]) ? tckn[2] - '0' : 0;
        return digit % 2 == 0 ? Gender.Male : Gender.Female;
    }

    private static List<NviChildDto> BuildScenarioChildren(string tckn, DateTime today, string address)
    {
        var specs = new (int Age, Gender Gender)[]
        {
            (3, Gender.Male),
            (6, Gender.Female),
            (9, Gender.Male),
            (12, Gender.Female),
            (15, Gender.Male),
            (17, Gender.Female),
        };

        return specs.Select((spec, idx) => new NviChildDto(
            ScenarioChildTckn(tckn, idx + 1),
            spec.Gender == Gender.Male ? "Senaryo Erkek" : "Senaryo Kız",
            $"Çocuk {spec.Age}",
            DateTime.SpecifyKind(today.AddYears(-spec.Age), DateTimeKind.Utc),
            spec.Gender,
            address)).ToList();
    }

    private static string ScenarioChildTckn(string parentTckn, int offset)
    {
        var body = parentTckn.Length >= 8 ? parentTckn[..8] : parentTckn.PadRight(8, '0');
        // Bulgu (2026-09-20, canlı test hazırlığı): 9. haneyi doğrudan offset (1-6) ile
        // değiştirmek, ebeveynin TCKN'sinin kendi 9. hanesi (parentTckn[8]) tesadüfen
        // offset'lerden biriyle (1-6) aynıysa ÇOCUK TCKN'sinin EBEVEYNİNKİYLE BİREBİR
        // AYNI olmasına yol açıyordu (örn. ebeveyn ...5665 5 6 ise, offset=5 olan çocuğun
        // base9'u da ...56655 çıkıyor, tam ebeveynin ilk 9 hanesiyle eşleşiyor) — kayıt
        // sırasında "Bu T.C. kimlik numarası ile zaten bir hesap bulunuyor" yerine
        // anlaşılmaz bir DUPLICATE_RECORD (23505 unique violation) hatasına yol açıyordu,
        // rastgele/açıklanamaz görünüyordu çünkü tamamen ebeveynin 9. hanesine bağlıydı.
        // Düzeltme: yeni 9. hane (ebeveynin GERÇEK 9. hanesi + offset) mod 10 olarak
        // hesaplanır — offset 1-6 aralığında olduğu sürece bu her zaman ebeveynin kendi
        // 9. hanesinden FARKLI olur, ve 6 çocuğun kendi aralarında da (farklı offsetler
        // farklı mod-10 sonuç verdiği için, 1-6 aralığı 10'u aşmadan hepsi ayrışır)
        // birbirinden farklı kalır.
        var parentDigit9 = parentTckn.Length >= 9 && char.IsDigit(parentTckn[8]) ? parentTckn[8] - '0' : 0;
        var childDigit9 = (parentDigit9 + offset) % 10;
        var base9 = body + childDigit9;
        return CompleteTckn(base9);
    }

    private static string CompleteTckn(string base9)
    {
        var digits = base9.Select(c => char.IsDigit(c) ? c - '0' : 0).ToArray();
        var d10 = (((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7) - (digits[1] + digits[3] + digits[5] + digits[7])) % 10;
        if (d10 < 0) d10 += 10;
        var d11 = (digits.Sum() + d10) % 10;
        return base9 + d10 + d11;
    }

    private static string ShiftTc(string tckn, int offset)
    {
        if (string.IsNullOrEmpty(tckn) || tckn.Length != 11)
            return new string('1', 10) + offset;

        var prefix = tckn[..10];
        var last = (tckn[10] - '0' + offset) % 10;
        return prefix + last;
    }

    private static int CalculateAge(DateTime birth, DateTime today)
    {
        var age = today.Year - birth.Year;
        if (birth.Date > today.AddYears(-age)) age--;
        return age;
    }
}
