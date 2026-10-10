using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.ParticipantSubmissions.Dtos;

namespace Nexora.Application.Features.ParticipantSubmissions;

public interface IParticipantSubmissionService
{
    Task<PagedResult<CitizenSubmissionMeDto>> GetMySubmissionsAsync(CitizenSubmissionMeListParams p, CancellationToken ct);
    Task<CitizenSubmissionMeDto> CreateAsync(CreateCitizenSubmissionMeRequest req, CancellationToken ct);

    /// <summary>Hata raporu (docs/hata.md #4.4): vatandaşın kendi başvurusunu düzenlemesi.</summary>
    Task<CitizenSubmissionMeDto> UpdateAsync(Guid id, UpdateCitizenSubmissionMeRequest req, CancellationToken ct);

    /// <summary>
    /// Kullanıcı isteği (2026-08-28): form seçenekleri + oturum açan vatandaşın ikametgah
    /// mahallesi/adresi (form otomatik dolsun diye). Oturum yoksa ikametgah alanları null döner.
    /// </summary>
    Task<CitizenSubmissionFormOptionsDto> GetFormOptionsAsync(CancellationToken ct);

    /// <summary>Kullanıcı isteği (2026-08-28): "başvurusunun durumunu sorgulayabilir" — tek kayıt + tüm süreç.</summary>
    Task<CitizenSubmissionMeDto> GetMySubmissionByIdAsync(Guid id, CancellationToken ct);

    /// <summary>Takip numarası ile durum sorgulama (kendi kaydı olmak şartıyla).</summary>
    Task<CitizenSubmissionMeDto> GetMySubmissionByTrackingNoAsync(string trackingNo, CancellationToken ct);

    Task<SubmissionMediaUploadDto> UploadMediaAsync(Stream stream, string fileName, string contentType, long sizeBytes, CancellationToken ct);
}
