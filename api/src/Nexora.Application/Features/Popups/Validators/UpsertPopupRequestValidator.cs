using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Popups.Dtos;
using Nexora.Domain.Entities.Popups;

namespace Nexora.Application.Features.Popups.Validators;

public class UpsertPopupRequestValidator : AbstractValidator<UpsertPopupRequest>
{
    private static readonly string[] ValidMediaTypes = ["image", "video", "text"];

    public UpsertPopupRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Popup başlığı zorunludur.")
            .MaximumLength(200).WithMessage("Popup başlığı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Popup başlığı");

        RuleFor(x => x.RepeatIntervalHours)
            .GreaterThanOrEqualTo(0).WithMessage("Tekrar aralığı negatif olamaz.");

        RuleFor(x => x.MinDisplaySeconds)
            .GreaterThanOrEqualTo(0).WithMessage("Asgari gösterim süresi negatif olamaz.")
            .LessThanOrEqualTo(600).WithMessage("Asgari gösterim süresi 600 saniyeyi (10 dakika) aşamaz.");

        RuleFor(x => x.TriggerType)
            .Must(PopupTriggerTypes.IsValid)
            .WithMessage("Geçersiz tetikleme türü.");

        RuleFor(x => x.TriggerModuleKey)
            .NotEmpty()
            .WithMessage("Modül tetiklemesi için hedef modül seçilmelidir.")
            .When(x => x.TriggerType == PopupTriggerTypes.ModuleEnter);

        RuleFor(x => x)
            .Must(x => !x.StartDate.HasValue || !x.EndDate.HasValue || x.StartDate.Value <= x.EndDate.Value)
            .WithMessage("Bitiş tarihi başlangıç tarihinden önce olamaz.");

        RuleFor(x => x.MediaItems)
            .Must(m => m != null && m.Count >= 1).WithMessage("En az bir içerik öğesi (resim/video/metin) eklenmelidir.")
            .Must(m => m == null || m.Count <= 20).WithMessage("En fazla 20 içerik öğesi eklenebilir.");

        RuleForEach(x => x.MediaItems).ChildRules(item =>
        {
            item.RuleFor(m => m.Type)
                .Must(t => ValidMediaTypes.Contains(t))
                .WithMessage("İçerik türü resim, video veya metin olmalıdır.");
            item.RuleFor(m => m.Url)
                .NotEmpty().WithMessage("Resim/video içeriği için dosya yüklenmeli veya bağlantı (link) girilmelidir.")
                .When(m => m.Type is "image" or "video");
            item.RuleFor(m => m.Text)
                .NotEmpty().WithMessage("Metin içeriği boş olamaz.")
                .MaximumLength(5000).WithMessage("Metin içeriği 5000 karakteri aşamaz.")
                .When(m => m.Type == "text");
        });
    }
}
