using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.CitizenMenu;
using Nexora.Application.Features.CitizenMenu.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.CitizenMenu;

public static class CitizenMenuEndpoints
{
    public static IEndpointRouteBuilder MapCitizenMenuEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/citizen-menu")
            .WithTags("CitizenMenu")
            .RequireAuthorization();

        group.MapGet("/", async (ICitizenMenuService service, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await service.GetAsync(ct))));

        group.MapPut("/", async (UpdateCitizenMenuRequest req, ICitizenMenuService service, IValidator<UpdateCitizenMenuRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(req, ct)));
        })
        .RequireAuthorization("AdminOrAbove")
        // 2026-07-30 denetiminde tespit edildi (P0): bu endpoint sadece "AdminOrAbove"
        // (yani herhangi bir admin/staff token'ı) kontrolü yapıyordu, granüler bir
        // RequirePermission çağrısı hiç eklenmemişti. Diğer tüm benzer menü modülleri
        // (TopMenu, AppMenu, MobileMenu) app-menu.manage/mobile-menu.manage gibi özel
        // bir izinle korunuyor. Canlı testte hiçbir menü-yönetim izni olmayan bir
        // kullanıcı bu endpoint'e 200 ile erişebiliyordu (beklenen: 403). Mevcut
        // mobile-menu.manage izni (aynı kavramsal alan, henüz frontend'den hiç
        // kullanılmıyor) buraya da uygulandı.
        .RequirePermission("mobile-menu.manage");

        return app;
    }
}
