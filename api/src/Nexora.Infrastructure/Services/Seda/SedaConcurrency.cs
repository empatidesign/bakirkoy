using System.Security.Cryptography;
using System.Text;

namespace Nexora.Infrastructure.Services.Seda;

public static class SedaConcurrency
{
    public static string NormalizeTckn(string? tckn) => (tckn ?? string.Empty).Trim();

    public static long TcknLockKey(string? tckn)
        => BitConverter.ToInt64(SHA256.HashData(Encoding.UTF8.GetBytes("seda-tckn:" + NormalizeTckn(tckn))), 0);

    public static long PeriodLockKey(Guid periodId)
        => BitConverter.ToInt64(SHA256.HashData(Encoding.UTF8.GetBytes("seda-period:" + periodId.ToString("N"))), 0);

    public static bool IsTcknUniqueViolation(Exception ex)
    {
        for (Exception? e = ex; e is not null; e = e.InnerException)
        {
            if (e is Npgsql.PostgresException pg
                && pg.SqlState == "23505"
                && (pg.ConstraintName?.Contains("Tckn", StringComparison.OrdinalIgnoreCase) ?? false))
                return true;
        }
        return false;
    }
}
