using Nexora.Application.Features.EmergencyAreas.Dtos;

namespace Nexora.Application.Features.EmergencyAreas;

public static class BakirkoyNeighborhoods
{
    public static IReadOnlyList<string> Names { get; } =
    [
        "Ataköy 1. Kısım Mahallesi",
        "Ataköy 2-5-6. Kısım Mahallesi",
        "Ataköy 3-4-11. Kısım Mahallesi",
        "Ataköy 7-8-9-10. Kısım Mahallesi",
        "Basınköy Mahallesi",
        "Cevizlik Mahallesi",
        "Kartaltepe Mahallesi",
        "Osmaniye Mahallesi",
        "Sakızağacı Mahallesi",
        "Şenlik Mahallesi",
        "Yenimahalle Mahallesi",
        "Yeşilköy Mahallesi",
        "Yeşilyurt Mahallesi",
        "Zeytinlik Mahallesi",
        "Zuhuratbaba Mahallesi",
    ];

    public static IReadOnlyList<EmergencyAreaOptionDto> Options { get; } =
        Names.Select(n => new EmergencyAreaOptionDto(n, n)).ToList();
}
