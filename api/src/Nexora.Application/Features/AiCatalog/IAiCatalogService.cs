using Nexora.Application.Features.AiCatalog.Dtos;

namespace Nexora.Application.Features.AiCatalog;

/// <summary>
/// Salt-okunur, tüm modülleri kapsayan katalog sorgu servisi. Dış bir yapay zeka
/// asistanının "hangi program nerede var, nerede boşluk var" türü sorulara cevap
/// üretebilmesi için kullanılır. Kasıtlı olarak hiçbir Create/Update/Delete/Apply
/// metodu YOKTUR — asistan bu servis üzerinden hiçbir kayıt/başvuru işlemi yapamaz.
/// </summary>
public interface IAiCatalogService
{
    Task<AiCatalogSummaryDto> GetSummaryAsync(CancellationToken ct);

    /// <summary>Tüm modüllerdeki kurs/program gruplarını (sports, pool, youth-camp, vb.) tarar.</summary>
    Task<IReadOnlyList<AiCatalogProgramDto>> SearchProgramsAsync(AiCatalogSearchParams p, CancellationToken ct);

    Task<IReadOnlyList<AiCatalogLibraryDto>> SearchLibrariesAsync(AiCatalogSearchParams p, CancellationToken ct);

    Task<IReadOnlyList<AiCatalogHallDto>> SearchHallsAsync(AiCatalogSearchParams p, CancellationToken ct);

    Task<IReadOnlyList<AiCatalogTravelDto>> SearchTravelsAsync(AiCatalogSearchParams p, CancellationToken ct);

    Task<IReadOnlyList<AiCatalogEmergencyAreaDto>> SearchEmergencyAreasAsync(AiCatalogSearchParams p, CancellationToken ct);

    Task<IReadOnlyList<AiCatalogFacilityDto>> SearchFacilitiesAsync(AiCatalogSearchParams p, CancellationToken ct);
}
