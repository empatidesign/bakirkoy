using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Education;
using Nexora.Application.Features.Education.Dtos;
using Nexora.Application.Features.Education.Requests;
using Nexora.Domain.Entities.Education;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class EducationService(IUnitOfWork uow, ICurrentUser currentUser, IUserScopeService userScope) : IEducationService
{
    // Yetki alanı (scope) kısıtlı bir kullanıcının, kendi scope'unun dışındaki bir
    // katılımcının eğitim geçmişi kaydına ID'sini bilerek erişmesini/değiştirmesini
    // engeller (IDOR önlemi). ParticipantManagementService.EnsureParticipantInScopeAsync
    // ile aynı desen. Süper admin veya sınırsız kullanıcılar için kontrol atlanır.
    private async Task EnsureParticipantInScopeAsync(Guid participantId, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return;
        var scopedIds = await userScope.GetScopedParticipantIdsAsync(uid, ct);
        if (scopedIds is not null && !scopedIds.Contains(participantId))
            throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");
    }

    public async Task<PagedResult<EducationInstitutionDto>> GetInstitutionsAsync(EducationInstitutionListParams p, CancellationToken ct)
    {
        var paged = await uow.EducationInstitutions.GetPagedAsync(p, ct);
        return new PagedResult<EducationInstitutionDto>
        {
            Items = paged.Items.Select(ToDto).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<List<EducationInstitutionOptionDto>> GetInstitutionOptionsAsync(CancellationToken ct)
    {
        var list = await uow.EducationInstitutions.GetActiveAsync(ct);
        return list.Select(x => new EducationInstitutionOptionDto(
            x.Id, x.Name, x.Faculty, x.Department, x.Type, TypeLabel(x.Type)
        )).ToList();
    }

    public async Task<EducationInstitutionDto> CreateInstitutionAsync(CreateEducationInstitutionRequest req, CancellationToken ct)
    {
        var institution = EducationInstitution.Create(req.Type, req.Name.Trim(), req.Faculty?.Trim(), req.Department?.Trim(), req.DegreeLevel);
        await uow.EducationInstitutions.AddAsync(institution, ct);
        await uow.SaveChangesAsync(ct);
        return ToDto(institution);
    }

    public async Task<EducationInstitutionDto> UpdateInstitutionAsync(Guid id, UpdateEducationInstitutionRequest req, CancellationToken ct)
    {
        var institution = await uow.EducationInstitutions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Eğitim kurumu bulunamadı.", "INSTITUTION_NOT_FOUND");
        institution.Update(req.Type, req.Name.Trim(), req.Faculty?.Trim(), req.Department?.Trim(), req.DegreeLevel);
        await uow.SaveChangesAsync(ct);
        return ToDto(institution);
    }

    public async Task DeleteInstitutionAsync(Guid id, CancellationToken ct)
    {
        var institution = await uow.EducationInstitutions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Eğitim kurumu bulunamadı.", "INSTITUTION_NOT_FOUND");
        uow.EducationInstitutions.Delete(institution);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<EducationInstitutionDto> ToggleInstitutionStatusAsync(Guid id, CancellationToken ct)
    {
        var institution = await uow.EducationInstitutions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Eğitim kurumu bulunamadı.", "INSTITUTION_NOT_FOUND");
        if (institution.IsActive) institution.Deactivate(); else institution.Activate();
        await uow.SaveChangesAsync(ct);
        return ToDto(institution);
    }

    public async Task<List<EducationHistoryDto>> GetHistoriesAsync(Guid participantId, CancellationToken ct)
    {
        await EnsureParticipantInScopeAsync(participantId, ct);
        var list = await uow.EducationHistories.GetByParticipantAsync(participantId, ct);
        return list.Select(ToHistoryDto).ToList();
    }

    public async Task<EducationHistoryDto> CreateHistoryAsync(Guid participantId, CreateEducationHistoryRequest req, CancellationToken ct)
    {
        await EnsureParticipantInScopeAsync(participantId, ct);

        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var history = EducationHistory.Create(participantId, req.InstitutionId, req.Level, req.StartYear, req.EndYear, req.IsGraduated);
        await uow.EducationHistories.AddAsync(history, ct);
        await uow.SaveChangesAsync(ct);

        if (req.InstitutionId.HasValue)
        {
            var institution = await uow.EducationInstitutions.GetByIdAsync(req.InstitutionId.Value, ct);
            return ToHistoryDtoWithInstitution(history, institution);
        }

        return ToHistoryDto(history);
    }

    public async Task<EducationHistoryDto> UpdateHistoryAsync(Guid participantId, Guid id, UpdateEducationHistoryRequest req, CancellationToken ct)
    {
        await EnsureParticipantInScopeAsync(participantId, ct);

        var history = await uow.EducationHistories.FirstOrDefaultAsync(x => x.Id == id && x.ParticipantId == participantId, ct)
            ?? throw new NotFoundException("Eğitim kaydı bulunamadı.", "HISTORY_NOT_FOUND");
        history.Update(req.InstitutionId, req.Level, req.StartYear, req.EndYear, req.IsGraduated);
        await uow.SaveChangesAsync(ct);

        if (req.InstitutionId.HasValue)
        {
            var institution = await uow.EducationInstitutions.GetByIdAsync(req.InstitutionId.Value, ct);
            return ToHistoryDtoWithInstitution(history, institution);
        }

        return ToHistoryDto(history);
    }

    public async Task DeleteHistoryAsync(Guid participantId, Guid id, CancellationToken ct)
    {
        await EnsureParticipantInScopeAsync(participantId, ct);

        var history = await uow.EducationHistories.FirstOrDefaultAsync(x => x.Id == id && x.ParticipantId == participantId, ct)
            ?? throw new NotFoundException("Eğitim kaydı bulunamadı.", "HISTORY_NOT_FOUND");
        uow.EducationHistories.Delete(history);
        await uow.SaveChangesAsync(ct);
    }

    private static EducationInstitutionDto ToDto(EducationInstitution x) => new(
        x.Id, x.Type, TypeLabel(x.Type), x.Name, x.Faculty, x.Department,
        x.DegreeLevel, x.DegreeLevel.HasValue ? DegreeLevelLabel(x.DegreeLevel.Value) : null,
        x.IsActive, x.CreatedAt
    );

    private static EducationHistoryDto ToHistoryDto(EducationHistory x) => new(
        x.Id, x.ParticipantId, x.InstitutionId,
        x.Institution?.Name, x.Institution?.Faculty, x.Institution?.Department,
        x.Level, LevelLabel(x.Level), x.StartYear, x.EndYear, x.IsGraduated, x.CreatedAt
    );

    private static EducationHistoryDto ToHistoryDtoWithInstitution(EducationHistory x, EducationInstitution? institution) => new(
        x.Id, x.ParticipantId, x.InstitutionId,
        institution?.Name, institution?.Faculty, institution?.Department,
        x.Level, LevelLabel(x.Level), x.StartYear, x.EndYear, x.IsGraduated, x.CreatedAt
    );

    private static string TypeLabel(InstitutionType t) => t switch
    {
        InstitutionType.Ilkokul => "İlkokul",
        InstitutionType.Ortaokul => "Ortaokul",
        InstitutionType.Lise => "Lise",
        InstitutionType.Universite => "Üniversite",
        InstitutionType.MeslekYuksekokulu => "Meslek Yüksekokulu",
        _ => "Diğer",
    };

    private static string LevelLabel(EducationLevel l) => l switch
    {
        EducationLevel.Ilkokul => "İlkokul",
        EducationLevel.Ortaokul => "Ortaokul",
        EducationLevel.Lise => "Lise",
        EducationLevel.Onlisans => "Ön Lisans",
        EducationLevel.Lisans => "Lisans",
        EducationLevel.YuksekLisans => "Yüksek Lisans",
        EducationLevel.Doktora => "Doktora",
        _ => "",
    };

    private static string DegreeLevelLabel(DegreeLevel d) => d switch
    {
        DegreeLevel.Onlisans => "Ön Lisans",
        DegreeLevel.Lisans => "Lisans",
        DegreeLevel.YuksekLisans => "Yüksek Lisans",
        DegreeLevel.Doktora => "Doktora",
        _ => "",
    };
}
