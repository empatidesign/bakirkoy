using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.Participants;

namespace Nexora.Api.Endpoints.Me;

// Kullanıcı isteği (2026-09-28): mobilde logoya 3 kez basınca randevu sistemine
// giriş için vatandaşın kendi randevu anahtarı (bkz. Participant.AppointmentKey).
// Anahtar yoksa Key = null döner; mobil bu durumda randevu paneline girişi engeller.
public static class MeAppointmentKeyEndpoints
{
    public static IEndpointRouteBuilder MapMeAppointmentKeyEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/me/appointment-key", async (
                IParticipantService service, ICurrentUser currentUser, CancellationToken ct) =>
            {
                var id = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
                return Results.Ok(ApiResponse.Ok(await service.GetOwnAppointmentKeyAsync(id, ct)));
            })
            .WithTags("MeAppointmentKey")
            .RequireAuthorization("Citizen");

        return app;
    }
}
