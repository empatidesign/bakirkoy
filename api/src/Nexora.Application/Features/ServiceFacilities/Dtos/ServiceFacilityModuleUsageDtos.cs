namespace Nexora.Application.Features.ServiceFacilities.Dtos;

// Kullanıcı isteği (2026-10-04): "Özdemir Bayraktar gibi bir hizmet tesisi, birden çok
// program modülünde (Spor, Havuz, Kaşif Çocuk vb.) kullanılabilsin, bunun için toplu atama
// yapılsın" — her modülde bu hizmet tesisinin kullanılıp kullanılmadığını (ve varsa hangi
// Facility kaydına karşılık geldiğini) döner.
public record ServiceFacilityModuleUsageDto(
    string Module,
    bool Assigned,
    Guid? FacilityId,
    string? FacilityName,
    bool? FacilityIsActive
);

public record AssignServiceFacilityModulesRequest(List<string> Modules);

public record AssignServiceFacilityModulesResultDto(
    int Assigned,
    int AlreadyAssigned,
    List<string> Failed
);
