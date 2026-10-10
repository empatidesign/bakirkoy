using Nexora.Application.Common.Exceptions;
using Nexora.Domain.Common;

namespace Nexora.Application.Common;

/// <summary>Shared fail-closed policy for location-bound attendance operations.</summary>
public static class LocationAccessGuard
{
    public const int DefaultRadiusMeters = 150;

    public static bool IsValid(double? latitude, double? longitude)
        => latitude.HasValue && longitude.HasValue
           && double.IsFinite(latitude.Value) && double.IsFinite(longitude.Value)
           && latitude.Value is >= -90 and <= 90 && longitude.Value is >= -180 and <= 180;

    public static void EnsureInside(double? targetLatitude, double? targetLongitude, int radiusMeters,
        double? latitude, double? longitude)
    {
        if (!IsValid(targetLatitude, targetLongitude) || radiusMeters <= 0)
            throw new ConflictException("Bu alanın konum doğrulama ayarları eksik. Görevli, koordinat ve izin verilen mesafeyi tamamlamalıdır.", "LOCATION_NOT_CONFIGURED");
        if (!IsValid(latitude, longitude))
            throw new ConflictException("QR işlemi için konum servislerini açın ve güncel konum izni verin.", "LOCATION_REQUIRED");

        var distance = GeoDistance.HaversineMeters(targetLatitude!.Value, targetLongitude!.Value, latitude!.Value, longitude!.Value);
        if (!double.IsFinite(distance) || distance > radiusMeters)
            throw new ConflictException($"İzin verilen konum alanının dışındasınız. QR işlemi yalnızca tesisin {radiusMeters} metre yakınında yapılabilir.", "OUTSIDE_GEOFENCE");
    }
}
