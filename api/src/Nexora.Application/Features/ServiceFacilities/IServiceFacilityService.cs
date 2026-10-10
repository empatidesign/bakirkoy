using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.ServiceFacilities.Dtos;

namespace Nexora.Application.Features.ServiceFacilities;

public interface IServiceFacilityService
{
    Task<PagedResult<ServiceFacilityDto>> GetPagedAsync(ServiceFacilityListParams p, CancellationToken ct);
    Task<IReadOnlyList<ServiceFacilityOptionDto>> GetOptionsAsync(CancellationToken ct);
    Task<ServiceFacilitySummaryDto> GetSummaryAsync(ServiceFacilityListParams p, CancellationToken ct);
    Task<IReadOnlyList<FacilityMapPointDto>> GetMapPointsAsync(CancellationToken ct);
    Task<ServiceFacilityDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<ServiceFacilityDto> CreateAsync(ServiceFacilityRequest req, CancellationToken ct);
    Task<ServiceFacilityImportResultDto> ImportAsync(Stream excelStream, CancellationToken ct);
    Task<ServiceFacilityDto> UpdateAsync(Guid id, ServiceFacilityRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<ServiceFacilityDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<FacilityServiceCatalogItemDto>> GetServiceCatalogAsync(CancellationToken ct);
    Task<FacilityImageDto> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct);
    Task<MasterQrDto> GetMasterQrAsync(Guid id, CancellationToken ct);
    Task ToggleMasterQrAsync(Guid id, bool enabled, CancellationToken ct);
    Task<MasterCardRotateDto> RotateMasterCardAsync(Guid id, CancellationToken ct);

    // Kullanıcı isteği (2026-10-04): modül bazlı toplu atama — bir hizmet tesisinin hangi
    // program modüllerinde (Spor, Havuz, Kaşif Çocuk vb.) kullanıldığını gösterir ve
    // seçilen yeni modüllerde tek seferde Facility kaydı oluşturur.
    Task<IReadOnlyList<ServiceFacilityModuleUsageDto>> GetModuleUsageAsync(Guid id, CancellationToken ct);
    Task<AssignServiceFacilityModulesResultDto> AssignModulesAsync(Guid id, AssignServiceFacilityModulesRequest req, CancellationToken ct);
}
