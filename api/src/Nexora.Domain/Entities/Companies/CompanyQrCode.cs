using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Companies;

public class CompanyQrCode : BaseEntity
{
    public Guid CompanyId { get; private set; }
    public string StaticCode { get; private set; } = default!;
    public bool IsActive { get; private set; }
    public DateTime? ValidUntil { get; private set; }
    public string? Purpose { get; private set; }

    public Company Company { get; private set; } = default!;

    private CompanyQrCode() { }

    public static CompanyQrCode Create(Guid companyId, string? purpose, DateTime? validUntil)
        => new()
        {
            CompanyId = companyId,
            StaticCode = Guid.NewGuid().ToString("N"),
            IsActive = true,
            ValidUntil = validUntil,
            Purpose = purpose
        };

    public void Deactivate() => IsActive = false;
}
