using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.AccessibleApplications;
using Nexora.Application.Features.AccessibleApplications.Dtos;
using Nexora.Application.Features.Facilities;
using Nexora.Domain.Entities.Facilities;

namespace Nexora.Infrastructure.Services;

// IDN-Engelsiz (2026-09-11): AccessibleApplicationDetailScreen (mobil) için
// eklendi. Sahiplik kontrolü her metotta yapılır: bir vatandaş yalnızca
// kendi FacilityApplication'ının (ParticipantId == participantId) detayını
// görebilir/düzenleyebilir — aksi halde ForbiddenException (403).
public class AccessibleApplicationService(IUnitOfWork uow) : IAccessibleApplicationService
{
    private const string Module = "accessible-life";

    private async Task<FacilityApplication> GetOwnedApplicationAsync(Guid applicationId, Guid participantId, CancellationToken ct)
    {
        var app = await uow.FacilityApplications.GetByIdAsync(applicationId, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");
        if (app.Module != Module)
            throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");
        if (app.ParticipantId != participantId)
            throw new ForbiddenException("Bu başvuruya erişim yetkiniz yok.", "FORBIDDEN");
        return app;
    }

    public async Task<AccessibleApplicationSummaryDto> GetSummaryAsync(Guid applicationId, Guid participantId, CancellationToken ct)
    {
        var app = await GetOwnedApplicationAsync(applicationId, participantId, ct);
        var detail = await uow.AccessibleApplicationDetails.FirstOrDefaultAsync(
            d => d.FacilityApplicationId == applicationId, ct);

        var group = app.GroupId.HasValue
            ? await uow.FacilityGroups.GetByIdAsync(app.GroupId.Value, ct)
            : null;

        var moduleRule = FacilityModuleRegistry.RulesFor(Module);
        var requiresMedicalDocument = moduleRule.RequiresApplicationDocuments;
        var medicalDocumentVerified = requiresMedicalDocument && HasAnyDocument(app.DocumentsJson);

        // KVKK açık rıza onayı, özel nitelikli veri (engellilik/sağlık) işlendiği
        // için bu modülde her zaman gereklidir.
        var requiresGuardianConsent = true;
        var guardianConsentRecorded = detail?.KvkkConsentGivenAt.HasValue ?? false;

        var hasCaregiver = await uow.AccessibleCaregivers.AnyAsync(
            c => c.ParticipantId == participantId, ct);

        var noteCount = await uow.AccessibleProgressNotes.CountAsync(
            n => n.FacilityApplicationId == applicationId, ct);

        var missing = new List<string>();
        if (requiresMedicalDocument && !medicalDocumentVerified)
            missing.Add("MEDICAL_DOCUMENT_NOT_VERIFIED");
        if (requiresGuardianConsent && !guardianConsentRecorded)
            missing.Add("GUARDIAN_CONSENT_MISSING");

        return new AccessibleApplicationSummaryDto(
            ApplicationId: app.Id,
            GroupId: app.GroupId,
            GroupName: group?.Name ?? string.Empty,
            Status: app.Status,
            RequiresMedicalDocument: requiresMedicalDocument,
            MedicalDocumentVerified: medicalDocumentVerified,
            RequiresGuardianConsent: requiresGuardianConsent,
            GuardianConsentRecorded: guardianConsentRecorded,
            IsEligibleForApproval: missing.Count == 0,
            MissingRequirements: missing,
            PrimaryDisabilityType: detail?.PrimaryDisabilityType,
            DisabilityRate: detail?.DisabilityRate,
            HasCaregiver: hasCaregiver,
            VisibleProgressNoteCount: noteCount
        );
    }

    private static bool HasAnyDocument(string documentsJson)
    {
        if (string.IsNullOrWhiteSpace(documentsJson)) return false;
        try
        {
            var docs = System.Text.Json.JsonSerializer.Deserialize<List<object>>(documentsJson);
            return docs is { Count: > 0 };
        }
        catch
        {
            return false;
        }
    }

    public async Task SubmitDisabilityInfoAsync(Guid applicationId, Guid participantId, SubmitDisabilityInfoRequest req, CancellationToken ct)
    {
        await GetOwnedApplicationAsync(applicationId, participantId, ct);

        var data = new AccessibleApplicationDetailData(
            applicationId,
            req.PrimaryDisabilityType,
            req.DisabilityRate,
            req.EmergencyContactName,
            req.EmergencyContactPhone,
            req.RequiresWheelchairAccess,
            req.RequiresSignLanguage,
            req.RequiresBraille);

        var existing = await uow.AccessibleApplicationDetails.FirstOrDefaultAsync(
            d => d.FacilityApplicationId == applicationId, ct);

        if (existing is null)
        {
            await uow.AccessibleApplicationDetails.AddAsync(AccessibleApplicationDetail.Create(data), ct);
        }
        else
        {
            existing.UpdateDisabilityInfo(data);
            uow.AccessibleApplicationDetails.Update(existing);
        }

        await uow.SaveChangesAsync(ct);
    }

    public async Task GiveKvkkConsentAsync(Guid applicationId, Guid participantId, GiveKvkkConsentRequest req, CancellationToken ct)
    {
        await GetOwnedApplicationAsync(applicationId, participantId, ct);

        var detail = await uow.AccessibleApplicationDetails.FirstOrDefaultAsync(
            d => d.FacilityApplicationId == applicationId, ct);

        // Engellilik bilgisi henüz girilmemişse boş bir kayıt oluşturup rızayı
        // ona işleriz — mobil ekran KVKK kartını "Engellilik Bilgileri"nden
        // bağımsız gösterebiliyor, bu yüzden önkoşul olarak zorunlu tutulmaz.
        // NOT: yeni oluşturulan (henüz kaydedilmemiş, EF "Added" state'indeki)
        // entity'ye ayrıca Update() çağırmak DbUpdateConcurrencyException'a yol
        // açar (EF onu "zaten DB'de var, UPDATE gerekiyor" sanıp 0 satır etkiler
        // — canlı entegrasyon testiyle doğrulandı). Update() yalnızca mevcut,
        // DB'den okunmuş kayıt için çağrılmalı.
        bool isNew = detail is null;
        if (detail is null)
        {
            detail = AccessibleApplicationDetail.Create(new AccessibleApplicationDetailData(
                applicationId, null, null, string.Empty, string.Empty, false, false, false));
            await uow.AccessibleApplicationDetails.AddAsync(detail, ct);
        }

        if (!detail.GiveKvkkConsent(req.Version))
            throw new ConflictException("KVKK onayı zaten verilmiş.", "KVKK_ALREADY_CONSENTED");

        if (!isNew)
            uow.AccessibleApplicationDetails.Update(detail);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<List<AccessibleProgressNoteDto>> GetProgressNotesAsync(Guid applicationId, Guid participantId, CancellationToken ct)
    {
        await GetOwnedApplicationAsync(applicationId, participantId, ct);

        var notes = await uow.AccessibleProgressNotes.FindAsync(
            n => n.FacilityApplicationId == applicationId, ct);

        return notes
            .OrderByDescending(n => n.RecordedAt)
            .Select(n => new AccessibleProgressNoteDto(
                n.Id, n.FacilityApplicationId, n.RecordedAt, n.NoteType, n.RecommendedAdjustments))
            .ToList();
    }

    public async Task DefineCaregiverAsync(Guid participantId, DefineCaregiverRequest req, CancellationToken ct)
    {
        var caregiver = AccessibleCaregiver.Create(
            participantId, req.Name, req.Tc, req.Phone, req.Relation, req.IsAuthorizedPickup);
        await uow.AccessibleCaregivers.AddAsync(caregiver, ct);
        await uow.SaveChangesAsync(ct);
    }
}
