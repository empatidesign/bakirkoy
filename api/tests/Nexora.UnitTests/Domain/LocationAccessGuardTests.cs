using Nexora.Application.Common;
using Nexora.Application.Common.Exceptions;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class LocationAccessGuardTests
{
    [Theory]
    [InlineData(null, null)]
    [InlineData(91d, 29d)]
    [InlineData(41d, 181d)]
    [InlineData(double.NaN, 29d)]
    [InlineData(41d, double.PositiveInfinity)]
    public void MissingOrInvalidClientCoordinatesAreRejected(double? latitude, double? longitude)
    {
        var ex = Assert.Throws<ConflictException>(() => LocationAccessGuard.EnsureInside(41, 29, 150, latitude, longitude));
        Assert.Equal("LOCATION_REQUIRED", ex.ErrorCode);
    }

    [Fact]
    public void MissingVenueCoordinatesCannotDisableValidation()
    {
        var ex = Assert.Throws<ConflictException>(() => LocationAccessGuard.EnsureInside(null, null, 150, 41, 29));
        Assert.Equal("LOCATION_NOT_CONFIGURED", ex.ErrorCode);
    }

    [Fact]
    public void InsideIsAllowedAndOutsideIsRejected()
    {
        LocationAccessGuard.EnsureInside(41, 29, 150, 41.0001, 29.0001);
        var ex = Assert.Throws<ConflictException>(() => LocationAccessGuard.EnsureInside(41, 29, 150, 41.01, 29.01));
        Assert.Equal("OUTSIDE_GEOFENCE", ex.ErrorCode);
    }

    [Fact]
    public void ZeroRadiusIsConfigurationError()
    {
        var ex = Assert.Throws<ConflictException>(() => LocationAccessGuard.EnsureInside(41, 29, 0, 41, 29));
        Assert.Equal("LOCATION_NOT_CONFIGURED", ex.ErrorCode);
    }
}
