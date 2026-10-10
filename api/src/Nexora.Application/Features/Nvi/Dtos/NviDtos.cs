using Nexora.Domain.Enums;

namespace Nexora.Application.Features.Nvi.Dtos;

public record NviPersonDto(
    string Tckn,
    string FirstName,
    string LastName,
    DateTime BirthDate,
    Gender Gender,
    string? Address);

public record NviChildDto(
    string Tckn,
    string FirstName,
    string LastName,
    DateTime BirthDate,
    Gender Gender,
    string? Address);

public record NviPersonAndChildrenResponse(
    bool Success,
    string? ErrorMessage,
    NviPersonDto? Person,
    List<NviChildDto> Children);

public record NviAddressDto(
    string? FullAddress,
    string? City,
    string? District,
    string? Neighborhood,
    string? DistrictCode);

public record NviAddressResponse(
    bool Success,
    string? ErrorMessage,
    NviAddressDto? Address);
