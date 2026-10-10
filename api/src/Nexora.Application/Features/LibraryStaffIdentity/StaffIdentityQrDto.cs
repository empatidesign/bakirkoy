namespace Nexora.Application.Features.LibraryStaffIdentity;

public record StaffIdentityQrDto(string Token, int RotationSeconds, DateTime ExpiresAt, string ShortCode);
