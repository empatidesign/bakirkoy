using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.ParticipantEmergencyAreas;
using Nexora.Application.Features.ParticipantEmergencyAreas.Dtos;
using Nexora.Domain.Entities.EmergencyAreas;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class ParticipantEmergencyAreaService(IUnitOfWork uow) : IParticipantEmergencyAreaService
{
    public async Task<List<CitizenEmergencyAreaDto>> GetListAsync(CancellationToken ct)
    {
        var areas = await uow.EmergencyAreas.GetActiveAsync(ct);
        return areas.Select(ToDto).ToList();
    }

    public async Task<CitizenEmergencyAreaDto> GetDetailAsync(Guid id, CancellationToken ct)
    {
        var area = await uow.EmergencyAreas.GetByIdAsync(id, ct);
        if (area is null || area.Status != EmergencyAreaStatus.Active)
            throw new NotFoundException("Toplanma alanı bulunamadı.", "EMERGENCY_AREA_NOT_FOUND");

        return ToDto(area);
    }

    private static CitizenEmergencyAreaDto ToDto(EmergencyArea a)
        => new(
            a.Id,
            a.Name,
            string.IsNullOrWhiteSpace(a.Neighborhood) ? null : a.Neighborhood,
            string.IsNullOrWhiteSpace(a.Address) ? null : a.Address,
            a.Latitude,
            a.Longitude,
            a.Capacity,
            a.AreaSizeM2,
            string.IsNullOrWhiteSpace(a.EmergencyPhone) ? null : a.EmergencyPhone,
            a.Equipment.Toilet,
            a.Equipment.Water,
            a.Equipment.Electricity,
            a.Equipment.Generator,
            a.Equipment.Heating,
            a.Equipment.TentArea);
}
