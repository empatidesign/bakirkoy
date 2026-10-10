using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities;

public interface IFacilityService
{
    Task<PagedResult<FacilityDto>> GetPagedAsync(string module, FacilityListParams p, CancellationToken ct);
    Task<FacilityDto> GetByIdAsync(string module, Guid id, CancellationToken ct);
    Task<List<FacilityOptionDto>> GetOptionsAsync(string module, CancellationToken ct);
    Task<FacilitySummaryDto> GetSummaryAsync(string module, CancellationToken ct);
    Task<FacilityDto> CreateAsync(string module, CreateFacilityRequest req, CancellationToken ct);
    Task<FacilityDto> UpdateAsync(string module, Guid id, UpdateFacilityRequest req, CancellationToken ct);
    Task DeleteAsync(string module, Guid id, CancellationToken ct);
    Task<FacilityDto> ToggleStatusAsync(string module, Guid id, CancellationToken ct);
    Task<PagedResult<FacilityDto>> GetTrashAsync(string module, FacilityListParams p, CancellationToken ct);
    Task<FacilityDto> RestoreAsync(string module, Guid id, CancellationToken ct);
    Task PermanentDeleteAsync(string module, Guid id, CancellationToken ct);
    // Kullanıcı isteği (2026-10-05): tesisler manuel sürükle-bırak ile sıralanabilsin.
    // Gönderilen ID listesindekiler sırayla numaralandırılır; listede olmayan (başka bir
    // kullanıcı eş zamanlı ekleme yapmış olabilir) tesisler kendi mevcut sıralarına göre sona eklenir.
    Task ReorderAsync(string module, IReadOnlyList<Guid> orderedIds, CancellationToken ct);
}
