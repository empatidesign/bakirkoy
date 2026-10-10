namespace Nexora.Application.Features.SmsPermissions.Dtos;

// Kullanıcı isteği (2026-10-04): "tüm sistemde toplu sms gönderme sistemi kişilere veya
// yetki gruplarında sms gönderme yetkisinin kimde olacağı tanımlanmalı ... tesislere
// gruplara seanslara toplu eşleştirme atamalarının yapılabileceği bir alan olsun admin
// panelinde roller bölümünde toplu işlemlerin yapılacağı bir sayfa kurulumu yap."
// Bu DTO'lar Roller > Toplu İşlemler sayfasının iki aracını besler:
// 1) SMS gönderme yetkisini (sms-send.send) rollere/kişilere toplu ver/al.
// 2) Tesis/Grup/Seans kapsamını (AdminScope/ScopeNode) seçili kişilere veya bir rolün
//    TÜM üyelerine toplu ata.

public record SmsPermissionRoleDto(
    Guid Id,
    string Key,
    string Name,
    string Color,
    bool IsSuperAdmin,
    int AssignedUserCount,
    bool HasSmsSendPermission
);

public record BulkSmsSendAccessRequest(
    List<Guid>? UserIds,
    List<Guid>? RoleIds,
    string Action // "grant" | "revoke"
);

public record BulkSmsSendAccessResultDto(int UsersAffected, int RolesAffected);

public record ScopeAssignmentTarget(
    // "facility" | "group" | "session"
    string Kind,
    // facility/group için zorunlu: FacilityModuleRegistry.All içindeki bir modül anahtarı (ör. "sports").
    // session için kullanılmaz.
    string? ModuleKey,
    Guid RefId
);

public record BulkScopeAssignmentRequest(
    List<Guid>? UserIds,
    // Verilirse, o rollerin ŞU ANDA sahip olduğu TÜM kullanıcılara da aynı kapsam atanır.
    List<Guid>? RoleIds,
    List<ScopeAssignmentTarget> Targets
);

public record BulkScopeAssignmentResultDto(int UsersAffected, int TargetCount, int AssignmentsApplied);
