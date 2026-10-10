using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class ParticipantGuardianRepository(AppDbContext context)
    : Repository<ParticipantGuardian>(context), IParticipantGuardianRepository
{
}
