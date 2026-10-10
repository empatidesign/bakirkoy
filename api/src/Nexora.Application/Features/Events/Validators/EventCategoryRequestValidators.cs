using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Events.Dtos;

namespace Nexora.Application.Features.Events.Validators;

public class CreateEventCategoryRequestValidator : AbstractValidator<CreateEventCategoryRequest>
{
    public CreateEventCategoryRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Kategori adı zorunludur.")
            .MaximumLength(100).WithMessage("Kategori adı 100 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Kategori adı");

        RuleFor(x => x.Description)
            .MaximumLength(300).WithMessage("Açıklama 300 karakteri aşamaz.")
            .When(x => x.Description is not null);

        RuleFor(x => x.Color)
            .NotEmpty().WithMessage("Renk zorunludur.")
            .Matches("^#[0-9a-fA-F]{6}$").WithMessage("Renk #RRGGBB biçiminde olmalıdır.");

        RuleFor(x => x.DefaultPoints)
            .GreaterThanOrEqualTo(0).WithMessage("Puan negatif olamaz.");
    }
}

public class BulkCreateEventCategoryRequestValidator : AbstractValidator<BulkCreateEventCategoryRequest>
{
    public BulkCreateEventCategoryRequestValidator()
    {
        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("En az bir kategori girilmelidir.")
            .Must(x => x == null || x.Count <= 100).WithMessage("Tek seferde en fazla 100 kategori eklenebilir.");

        RuleForEach(x => x.Items).SetValidator(new CreateEventCategoryRequestValidator());
    }
}

public class UpdateEventCategoryRequestValidator : AbstractValidator<UpdateEventCategoryRequest>
{
    public UpdateEventCategoryRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Kategori adı zorunludur.")
            .MaximumLength(100).WithMessage("Kategori adı 100 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Kategori adı");

        RuleFor(x => x.Description)
            .MaximumLength(300).WithMessage("Açıklama 300 karakteri aşamaz.")
            .When(x => x.Description is not null);

        RuleFor(x => x.Color)
            .NotEmpty().WithMessage("Renk zorunludur.")
            .Matches("^#[0-9a-fA-F]{6}$").WithMessage("Renk #RRGGBB biçiminde olmalıdır.");

        RuleFor(x => x.DefaultPoints)
            .GreaterThanOrEqualTo(0).WithMessage("Puan negatif olamaz.");
    }
}
