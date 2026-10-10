using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.CitizenSubmissions.Dtos;

namespace Nexora.Application.Features.CitizenSubmissions.Validators;

/// <summary>
/// Denetim düzeltmesi (2026-09-01): aynı hata sınıfı, 2026-08-13/14'te AppMenu/Education'da
/// bulunup kapatılmıştı (bkz. EducationRequestValidators.cs yorumu) — ama bu ayrı modüle hiç
/// taşınmamıştı. `ProvisionMuhtarRequest` ve `CreateSubmissionByMuhtarRequest`'te hiç
/// FluentValidation validator'ı yoktu; DB kolon sınırlarını (AdminUsers.FullName VARCHAR(200),
/// Email VARCHAR(300), Phone VARCHAR(20), CitizenSubmissions.Title VARCHAR(250),
/// Description VARCHAR(2000), Address VARCHAR(500)) aşan girdi, temiz bir 400 yerine
/// yakalanmamış 500 (INTERNAL_SERVER_ERROR) üretiyordu. Canlı testte kanıtlandı: 500 karakterlik
/// FullName, 500 karakterlik Phone, 350+ karakterlik Email ve 500 karakterlik Title'ın hepsi
/// ayrı ayrı 500 döndürdü.
/// </summary>
public class ProvisionMuhtarRequestValidator : AbstractValidator<ProvisionMuhtarRequest>
{
    public ProvisionMuhtarRequestValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Muhtarın ad soyad bilgisi zorunludur.")
            .MaximumLength(200).WithMessage("Ad soyad 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Ad soyad");

        RuleFor(x => x.Phone)
            .MaximumLength(20).WithMessage("Telefon 20 karakteri aşamaz.")
            .When(x => !string.IsNullOrWhiteSpace(x.Phone));

        RuleFor(x => x.Email)
            .MaximumLength(300).WithMessage("E-posta 300 karakteri aşamaz.")
            .EmailAddress().WithMessage("Geçersiz e-posta adresi.")
            .When(x => !string.IsNullOrWhiteSpace(x.Email));
    }
}

public class CreateSubmissionByMuhtarRequestValidator : AbstractValidator<CreateSubmissionByMuhtarRequest>
{
    public CreateSubmissionByMuhtarRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Başlık alanı zorunludur.")
            .MaximumLength(250).WithMessage("Başlık 250 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Başlık");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Açıklama alanı zorunludur.")
            .MaximumLength(2000).WithMessage("Açıklama 2000 karakteri aşamaz.");

        RuleFor(x => x.Address)
            .NotEmpty().WithMessage("Adres alanı zorunludur.")
            .When(x => !x.OnBehalfOf)
            .DependentRules(() =>
            {
                RuleFor(x => x.Address).MaximumLength(500).WithMessage("Adres 500 karakteri aşamaz.");
            });

        // Başkası adına + "farklı adres" seçildiğinde de Address zorunludur (asıl kural
        // serviste tekrar kontrol edilir, burada yalnızca temel format).
        RuleFor(x => x.Address)
            .NotEmpty().WithMessage("Adres alanı zorunludur.")
            .When(x => x.OnBehalfOf && x.AddressType == "other");

        RuleFor(x => x.Address)
            .MaximumLength(500).WithMessage("Adres 500 karakteri aşamaz.")
            .When(x => x.OnBehalfOf);

        RuleFor(x => x.CategoryId)
            .NotEmpty().WithMessage("Kategori seçimi zorunludur.")
            .Must(c => MuhtarlikReference.CategoryOptions.Any(o => o.Value == c))
            .WithMessage("Geçersiz kategori.");

        RuleFor(x => x.SubmissionType)
            .NotEmpty().WithMessage("Başvuru türü zorunludur.")
            .Must(t => MuhtarlikReference.SubmissionTypes.Contains(t))
            .WithMessage("Geçersiz başvuru türü.");

        RuleFor(x => x.Priority)
            .NotEmpty().WithMessage("Öncelik zorunludur.")
            .Must(p => MuhtarlikReference.Priorities.Contains(p))
            .WithMessage("Geçersiz öncelik.");

        // Kullanıcı isteği (2026-09-07): başkası adına talep açarken TC/doğum tarihi zorunlu;
        // asıl kimlik doğrulaması (NVI/Participant sorgusu) serviste yapılır — burada yalnızca
        // temel format/uzunluk kontrolü var.
        RuleFor(x => x.CitizenTc)
            .NotEmpty().WithMessage("T.C. kimlik numarası zorunludur.")
            .Length(11).WithMessage("T.C. kimlik numarası 11 haneli olmalıdır.")
            .When(x => x.OnBehalfOf);

        RuleFor(x => x.CitizenBirthDate)
            .NotNull().WithMessage("Doğum tarihi zorunludur.")
            .When(x => x.OnBehalfOf);

        RuleFor(x => x.CitizenPhone)
            .MaximumLength(20).WithMessage("Telefon 20 karakteri aşamaz.")
            .When(x => !string.IsNullOrWhiteSpace(x.CitizenPhone));

        RuleFor(x => x.AddressType)
            .Must(t => t is "residence" or "other").WithMessage("Geçersiz adres türü.");
    }
}
