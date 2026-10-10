using System.Text.Json;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;

namespace Nexora.Infrastructure.Services;

public class FacilitySettingsService(IUnitOfWork uow, ICurrentUser current) : IFacilitySettingsService
{
    public async Task<FacilitySettingsDto> GetGeneralAsync(string module, CancellationToken ct)
    {
        var record = await uow.FacilitySettings.GetGeneralAsync(module, ct);
        return record is null
            ? new FacilitySettingsDto(module, "general", null, false, Parse("{}"))
            : new FacilitySettingsDto(module, "general", null, false, Parse(record.SettingsJson));
    }

    public async Task<FacilitySettingsDto> SaveGeneralAsync(string module, SaveGeneralSettingsRequest req, CancellationToken ct)
    {
        var json = RawOr(req.Settings, "{}");
        var record = await uow.FacilitySettings.GetGeneralAsync(module, ct);
        if (record is null)
        {
            record = FacilitySettingsRecord.CreateGeneral(module, json, current.Name);
            await uow.FacilitySettings.AddAsync(record, ct);
        }
        else
        {
            record.SetSettings(false, json, current.Name);
            uow.FacilitySettings.Update(record);
        }
        await uow.SaveChangesAsync(ct);
        return new FacilitySettingsDto(module, "general", null, false, Parse(record.SettingsJson));
    }

    public async Task<FacilitySettingsDto> GetForFacilityAsync(string module, Guid facilityId, CancellationToken ct)
    {
        await EnsureFacilityAsync(module, facilityId, ct);
        var record = await uow.FacilitySettings.GetForFacilityAsync(facilityId, ct);
        return record is null
            ? new FacilitySettingsDto(module, "facility", facilityId, true, Parse("{}"))
            : new FacilitySettingsDto(module, "facility", facilityId, record.UseGeneral, Parse(record.SettingsJson));
    }

    public async Task<FacilitySettingsDto> SaveForFacilityAsync(string module, Guid facilityId, SaveFacilitySettingsRequest req, CancellationToken ct)
    {
        await EnsureFacilityAsync(module, facilityId, ct);
        var json = RawOr(req.Settings, "{}");
        var record = await uow.FacilitySettings.GetForFacilityAsync(facilityId, ct);
        if (record is null)
        {
            record = FacilitySettingsRecord.CreateForFacility(module, facilityId, req.UseGeneral, json, current.Name);
            await uow.FacilitySettings.AddAsync(record, ct);
        }
        else
        {
            record.SetSettings(req.UseGeneral, json, current.Name);
            uow.FacilitySettings.Update(record);
        }
        await uow.SaveChangesAsync(ct);
        return new FacilitySettingsDto(module, "facility", facilityId, record.UseGeneral, Parse(record.SettingsJson));
    }

    private async Task EnsureFacilityAsync(string module, Guid facilityId, CancellationToken ct)
    {
        var facility = await uow.Facilities.GetByIdAsync(facilityId, ct);
        if (facility is null || facility.Module != module)
            throw new NotFoundException("Tesis bulunamadı.", "FACILITY_NOT_FOUND");
    }

    private static string RawOr(JsonElement el, string fallback)
        => el.ValueKind == JsonValueKind.Undefined ? fallback : el.GetRawText();

    private static JsonElement Parse(string json)
    {
        try { return JsonSerializer.Deserialize<JsonElement>(string.IsNullOrWhiteSpace(json) ? "{}" : json); }
        catch { return JsonSerializer.Deserialize<JsonElement>("{}"); }
    }
}
