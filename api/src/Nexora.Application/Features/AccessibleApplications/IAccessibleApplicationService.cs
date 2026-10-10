using Nexora.Application.Features.AccessibleApplications.Dtos;

namespace Nexora.Application.Features.AccessibleApplications;

public interface IAccessibleApplicationService
{
    Task<AccessibleApplicationSummaryDto> GetSummaryAsync(Guid applicationId, Guid participantId, CancellationToken ct);
    Task SubmitDisabilityInfoAsync(Guid applicationId, Guid participantId, SubmitDisabilityInfoRequest req, CancellationToken ct);
    Task GiveKvkkConsentAsync(Guid applicationId, Guid participantId, GiveKvkkConsentRequest req, CancellationToken ct);
    Task<List<AccessibleProgressNoteDto>> GetProgressNotesAsync(Guid applicationId, Guid participantId, CancellationToken ct);
    Task DefineCaregiverAsync(Guid participantId, DefineCaregiverRequest req, CancellationToken ct);
}
