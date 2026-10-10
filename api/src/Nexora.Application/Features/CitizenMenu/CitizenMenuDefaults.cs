using Nexora.Application.Features.CitizenMenu.Dtos;

namespace Nexora.Application.Features.CitizenMenu;

public static class CitizenMenuDefaults
{
    public static IReadOnlyList<CitizenMenuItemDto> Items { get; } =
    [
        new("home", true, 0, true),
        new("events", true, 1, false),
        new("services", true, 2, false),
        new("applications", true, 3, false),
        new("plans", true, 4, false),
        new("history", true, 5, false),
        new("travels", true, 6, false),
        new("library", true, 7, false),
        new("seda", true, 8, false),
        new("family", true, 9, false),
        new("notifications", true, 10, false),
        new("campaigns", true, 11, false),
        new("wheel", true, 12, false),
        new("submissions", true, 13, false),
        new("quiz", true, 14, false),
        new("surveys", true, 15, false),
        new("emergency", true, 16, false),
        new("profile", true, 17, false),
    ];
}
