using Nexora.Application.Features.SmsPermissions.Dtos;

namespace Nexora.Application.Features.SmsPermissions;

public interface ISmsPermissionService
{
    /// <summary>Roller listesi + her birinin sms-send.send iznine sahip olup olmadığı (Toplu İşlemler ekranı).</summary>
    Task<List<SmsPermissionRoleDto>> GetRolesAsync(CancellationToken ct);

    /// <summary>Şu anda sms-send.send iznine sahip (rol üzerinden veya kişisel override ile) aktif admin kullanıcı kimlikleri.</summary>
    Task<List<Guid>> GetUsersWithSmsSendAccessAsync(CancellationToken ct);

    /// <summary>Seçili kullanıcılara ve/veya rollere toplu SMS gönderme yetkisi ver/al.</summary>
    Task<BulkSmsSendAccessResultDto> BulkSetSmsSendAccessAsync(BulkSmsSendAccessRequest req, CancellationToken ct);

    /// <summary>Seçili kullanıcılara (doğrudan veya rol üzerinden) tesis/grup/seans kapsamını toplu ata.</summary>
    Task<BulkScopeAssignmentResultDto> BulkAssignScopeAsync(BulkScopeAssignmentRequest req, CancellationToken ct);
}
