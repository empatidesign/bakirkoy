using Nexora.Domain.Entities.CitizenMenu;

namespace Nexora.Application.Common.Repositories;

public interface ICitizenMenuSettingRepository : IRepository<CitizenMenuSetting>
{
    Task<CitizenMenuSetting?> GetSingletonAsync(CancellationToken ct);
}
