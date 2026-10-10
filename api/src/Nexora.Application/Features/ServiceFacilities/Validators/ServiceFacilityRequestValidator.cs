using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.ServiceFacilities.Dtos;

namespace Nexora.Application.Features.ServiceFacilities.Validators;

public class ServiceFacilityRequestValidator : AbstractValidator<ServiceFacilityRequest>
{
    public ServiceFacilityRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tesis adı zorunludur.")
            .MaximumLength(200).WithMessage("Tesis adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Tesis adı");

        RuleFor(x => x.Type)
            .MaximumLength(100).WithMessage("Tesis türü 100 karakteri aşamaz.");

        // 2026-10-05 bulgusu (canlı 500 hatası): Description alanı DB'de varchar(500) ama
        // hiçbir katmanda uzunluk kontrolü yoktu — 500 karakteri aşan bir açıklama EF Core'u
        // "An error occurred while saving the entity changes" (Postgres 22001) ile patlatıp
        // kullanıcıya anlamsız "Bir sorun oluştu" genel 500 hatası olarak yansıyordu.
        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Açıklama 500 karakteri aşamaz.");

        RuleFor(x => x.About)
            .MaximumLength(4000).WithMessage("Detaylı açıklama 4000 karakteri aşamaz.");

        // Aynı sınıf (varchar taşması -> DbUpdateException -> 500) risk taşıyan diğer serbest
        // metin alanları — DB sütun uzunluklarıyla (bkz. ServiceFacilityConfiguration) birebir.
        RuleFor(x => x.Website).MaximumLength(300).WithMessage("Web sitesi adresi 300 karakteri aşamaz.");
        RuleFor(x => x.Facebook).MaximumLength(300).WithMessage("Facebook adresi 300 karakteri aşamaz.");
        RuleFor(x => x.Instagram).MaximumLength(300).WithMessage("Instagram adresi 300 karakteri aşamaz.");
        RuleFor(x => x.Twitter).MaximumLength(300).WithMessage("Twitter adresi 300 karakteri aşamaz.");
        RuleFor(x => x.EmergencyPhone).MaximumLength(20).WithMessage("Acil durum telefonu 20 karakteri aşamaz.");
        RuleFor(x => x.ManagerPhone).MaximumLength(20).WithMessage("Sorumlu telefonu 20 karakteri aşamaz.");
        RuleFor(x => x.Manager).MaximumLength(150).WithMessage("Sorumlu adı 150 karakteri aşamaz.");
        RuleFor(x => x.ManagerEmail).MaximumLength(150).WithMessage("Sorumlu e-postası 150 karakteri aşamaz.");

        RuleFor(x => x.LocationType)
            .Must(v => string.IsNullOrWhiteSpace(v) || v is "Indoor" or "Outdoor").WithMessage("Konum tipi geçersiz.");

        // Kullanıcı isteği (2026-09-07): tesis kaydında ad dışında hiçbir alan zorunlu
        // değil — tür, il, ilçe, adres ve otopark türü boş bırakılarak kayıt yapılabilir.
        RuleFor(x => x.City)
            .MaximumLength(100).WithMessage("İl 100 karakteri aşamaz.");

        RuleFor(x => x.Address)
            .MaximumLength(500).WithMessage("Adres 500 karakteri aşamaz.");

        // Kullanıcı isteği (2026-08-02): tesis kaydında yönetici ataması artık zorunlu
        // değil — mevcut yöneticiyi silip boş bırakarak (yeniden atama yapmadan)
        // güncelleme yapılabilmeli. Yalnız "sisteme erişim ver" açıksa (yeni kişiye
        // hesap açılıyorsa) ad ve e-posta hâlâ zorunlu — hesap açmak için gerekli.
        RuleFor(x => x)
            .Must(r => !r.GrantAccess || (!string.IsNullOrWhiteSpace(r.Manager) && !string.IsNullOrWhiteSpace(r.ManagerEmail)))
            .WithMessage("Sisteme erişim verilecek kişinin adı ve e-postası zorunludur.");

        RuleFor(x => x.ParkingType)
            .Must(v => v is null or "" or "Free" or "Paid" or "Limited").WithMessage("Otopark türü geçersiz.");

        // 2026-07-30 denetiminde eklendi: EmergencyAreaRequestValidator'da var olan
        // negatif sayı korumaları burada hiç yoktu — capacity:-500, areaSizeM2:-999,
        // parkingCapacity:-100 gibi değerler sorunsuz kaydediliyordu.
        RuleFor(x => x.Capacity)
            .GreaterThanOrEqualTo(0).WithMessage("Kapasite negatif olamaz.")
            .When(x => x.Capacity.HasValue);

        RuleFor(x => x.AreaSizeM2)
            .GreaterThanOrEqualTo(0).WithMessage("Alan büyüklüğü negatif olamaz.")
            .When(x => x.AreaSizeM2.HasValue);

        RuleFor(x => x.ParkingCapacity)
            .GreaterThanOrEqualTo(0).WithMessage("Otopark kapasitesi negatif olamaz.");

        // QR erişimi için kayıtlı tesis konumu zorunludur.
        RuleFor(x => x).Must(x => LocationAccessGuard.IsValid(x.Latitude, x.Longitude))
            .WithMessage("Tesisin geçerli enlem ve boylam koordinatlarını giriniz.");
        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90, 90).WithMessage("Enlem (Latitude) -90 ile 90 arasında olmalıdır.")
            .When(x => x.Latitude.HasValue);

        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180, 180).WithMessage("Boylam (Longitude) -180 ile 180 arasında olmalıdır.")
            .When(x => x.Longitude.HasValue);
    }
}
