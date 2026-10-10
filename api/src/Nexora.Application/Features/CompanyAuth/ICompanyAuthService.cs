using Nexora.Application.Features.Companies.Dtos;
using Nexora.Application.Features.CompanyAuth.Dtos;

namespace Nexora.Application.Features.CompanyAuth;

public interface ICompanyAuthService
{
    Task<CompanyRegisterResultDto> RegisterAsync(CompanyRegisterRequest request, CancellationToken ct);
    Task<CompanyLoginResponseDto> LoginAsync(CompanyLoginRequest request, CancellationToken ct);
    Task<CompanyTokenPairDto> VerifyOtpAsync(CompanyVerifyOtpRequest request, CancellationToken ct);
    Task<CompanyOtpChallengeDto> ResendOtpAsync(CompanyResendOtpRequest request, CancellationToken ct);
    Task<CompanyTokenPairDto> RefreshAsync(CompanyRefreshRequest request, CancellationToken ct);
    Task<CompanyDto> GetMeAsync(Guid companyId, CancellationToken ct);
    Task LogoutAsync(Guid companyId, CancellationToken ct);
    Task<CompanyForgotPasswordResultDto> ForgotPasswordAsync(CompanyForgotPasswordRequest request, CancellationToken ct);
    Task VerifyResetOtpAsync(CompanyVerifyResetOtpRequest request, CancellationToken ct);
    Task ResetPasswordAsync(CompanyResetPasswordRequest request, CancellationToken ct);
    Task ChangeInitialPasswordAsync(Guid companyId, CompanyChangeInitialPasswordRequest request, CancellationToken ct);

    Task ChangePasswordAsync(Guid companyId, CompanyChangePasswordRequest request, CancellationToken ct);

    Task<string> GenerateBypassCodeAsync(Guid companyId, CancellationToken ct);
    Task<CompanyTokenPairDto> ExchangeBypassCodeAsync(string code, CancellationToken ct);
    Task<string> GenerateHandoffCodeAsync(Guid companyId, CancellationToken ct);
    Task<CompanyTokenPairDto> ExchangeHandoffCodeAsync(string code, CancellationToken ct);

    Task TerminateSessionsAsync(Guid companyId, CancellationToken ct);

    Task<CompanyDto> AcceptKvkkAsync(Guid companyId, CancellationToken ct);
    Task<CompanyDto> AcceptNotificationConsentAsync(Guid companyId, CancellationToken ct);
}
