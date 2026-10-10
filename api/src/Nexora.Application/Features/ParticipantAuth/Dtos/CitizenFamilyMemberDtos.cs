namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenFamilyNviChildDto(
    string Tckn,
    string FullName,
    DateTime BirthDate,
    string Gender,
    string? Address,
    bool AlreadyAdded);

public record CitizenFamilyNviPreviewDto(
    string Tckn,
    string FullName,
    List<CitizenFamilyNviChildDto> Children);

public record CitizenFamilyConfirmRequest(List<string> SelectedTckns);

public record CitizenFamilyConfirmResultDto(
    int TotalFound,
    int NewlyAdded,
    int AlreadyExisted,
    List<CitizenChildDto> Children);
