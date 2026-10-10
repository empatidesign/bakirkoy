using Nexora.Application.Features.CompanyStaffAuth.Dtos;

namespace Nexora.Application.Features.CompanyStaffAuth;

public interface ICompanyStaffAuthService
{
    Task<CompanyStaffTokenPairDto> LoginAsync(CompanyStaffLoginRequest request, CancellationToken ct);
    Task<CompanyStaffTokenPairDto> RefreshAsync(CompanyStaffRefreshRequest request, CancellationToken ct);
    Task<CompanyStaffDto> GetMeAsync(Guid staffId, CancellationToken ct);
    Task LogoutAsync(Guid staffId, CancellationToken ct);
    Task TerminateSessionsAsync(Guid staffId, CancellationToken ct);

    Task<CompanyStaffDto> AcceptKvkkAsync(Guid staffId, CancellationToken ct);
    Task<CompanyStaffDto> AcceptNotificationConsentAsync(Guid staffId, CancellationToken ct);
}
