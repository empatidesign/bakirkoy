namespace Nexora.Domain.Enums;

public enum AuditAction
{
    Create, Update, Delete, SoftDelete, Restore,
    Login, Logout, PasswordChange, PasswordReset,
    StatusChange, Approve, Reject, Cancel,
    Export, Import, BulkOperation,
    QrScan, Attendance, CheckIn, CheckOut,
    SystemConfig, PermissionChange, View
}
