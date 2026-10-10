namespace Nexora.Application.Features.CitizenMenu.Dtos;

public record CitizenMenuItemDto(string Key, bool Visible, int Order, bool Locked);

public record CitizenMenuDto(IReadOnlyList<CitizenMenuItemDto> Items);

public record UpdateCitizenMenuRequest(List<CitizenMenuItemDto> Items);
