using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Libraries;

public class LibraryApplication : BaseEntity
{
    public string ApplicantName { get; private set; } = null!;
    public string ApplicantSurname { get; private set; } = null!;
    public string? Email { get; private set; }
    public string Phone { get; private set; } = null!;
    public string MembershipType { get; private set; } = null!;
    public string? Documents { get; private set; }
    public Guid? LibraryId { get; private set; }
    public string Status { get; private set; } = "pending";

    private LibraryApplication() { }

    public static LibraryApplication Create(string applicantName, string applicantSurname, string? email,
        string phone, string membershipType, string? documents, Guid? libraryId)
        => new()
        {
            ApplicantName = applicantName,
            ApplicantSurname = applicantSurname,
            Email = email,
            Phone = phone,
            MembershipType = membershipType,
            Documents = documents,
            LibraryId = libraryId,
            Status = "pending",
        };

    public void Approve()
    {
        Status = "approved";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reject()
    {
        Status = "rejected";
        UpdatedAt = DateTime.UtcNow;
    }
}
