using Nexora.Domain.Entities.Wheels;
using Nexora.Domain.Enums;

namespace Nexora.Application.Features.Wheels.Dtos;

public static class GiftRequestMapper
{
    public static GiftRequestDto ToDto(this GiftRequest r)
        => new(
            r.Id, r.GiftId, r.GiftName, r.GiftPoints,
            r.CitizenName, r.CitizenTc, r.CitizenPhone,
            r.OrderNumber, r.IsWinner, StatusString(r.Status), r.Source, r.RequestedAt,
            r.ApprovedAt, r.ApprovedBy, r.RejectedAt, r.RejectedBy, r.RejectReason,
            r.DeliveredAt, r.DeliveredBy, r.DeliveryNote);

    public static string StatusString(GiftRequestStatus s) => s switch
    {
        GiftRequestStatus.Pending => "pending",
        GiftRequestStatus.Approved => "approved",
        GiftRequestStatus.Rejected => "rejected",
        _ => "pending",
    };
}
