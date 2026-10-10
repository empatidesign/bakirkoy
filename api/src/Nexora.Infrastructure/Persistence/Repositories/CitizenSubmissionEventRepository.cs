using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.CitizenSubmissions;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class CitizenSubmissionEventRepository(AppDbContext context)
    : Repository<CitizenSubmissionEvent>(context), ICitizenSubmissionEventRepository
{
    public async Task<List<CitizenSubmissionEvent>> GetBySubmissionAsync(Guid submissionId, CancellationToken ct)
        => await DbSet.Where(x => x.SubmissionId == submissionId)
            .OrderBy(x => x.OccurredAt)
            .ToListAsync(ct);

    public async Task<List<CitizenSubmissionEvent>> GetBySubmissionsAsync(IReadOnlyList<Guid> submissionIds, CancellationToken ct)
        => await DbSet.Where(x => submissionIds.Contains(x.SubmissionId))
            .OrderBy(x => x.OccurredAt)
            .ToListAsync(ct);
}
