using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Seda.Dtos;

namespace Nexora.Application.Features.Seda.Validators;

// Denetim bulgusu (docs/tesis-spor-egitim-derin-test-2026-08-31.md P1-1/P1-2, 2026-09-05 canlı
// testle doğrulandı): PUT /seda/education-records/{id}/result ucu, dosyadaki diğer tüm SEDA
// uçlarının aksine hiçbir IValidator<> almıyordu. Canlı kanıt: Score=-999.99 ve Score=9999.99
// ikisi de 200 OK ile DB'ye yazıldı (kolon numeric(6,2), sınırı ±9999.99); ResultNote için 2000
// karakterlik bir değer gönderildiğinde DB'nin varchar(500) kısıtı istemciye 500 Internal Server
// Error olarak sızdı (doğrulama hatası sunucu hatasına dönüştü). Bu validator her iki sorunu da
// backend'de, DB'ye ulaşmadan önce yakalar.
public class SedaEducationRecordResultRequestValidator : AbstractValidator<SedaEducationRecordResultRequest>
{
    public SedaEducationRecordResultRequestValidator()
    {
        RuleFor(x => x.Score)
            .InclusiveBetween(0, 100).WithMessage("Puan 0 ile 100 arasında olmalıdır.")
            .When(x => x.Score.HasValue);

        RuleFor(x => x.ResultNote)
            .MaximumLength(500).WithMessage("Sonuç notu 500 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Sonuç notu")
            .When(x => !string.IsNullOrWhiteSpace(x.ResultNote));
    }
}
