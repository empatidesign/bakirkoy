using System.Text.Json;

namespace Nexora.Application.Features.Facilities.Dtos;

public record FacilitySettingsDto(
    string Module,
    string Scope,
    Guid? FacilityId,
    bool UseGeneral,
    JsonElement Settings
);

public record SaveGeneralSettingsRequest(JsonElement Settings);

public record SaveFacilitySettingsRequest(bool UseGeneral, JsonElement Settings);
