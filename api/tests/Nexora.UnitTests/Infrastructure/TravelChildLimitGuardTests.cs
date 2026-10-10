using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.Travels;
using Nexora.Infrastructure.Services.Travels;
using Xunit;

namespace Nexora.UnitTests.Infrastructure;

public class TravelChildLimitGuardTests
{
    private static Travel TravelWith(string restrictionsJson)
    {
        var data = new TravelData(
            RouteId: Guid.NewGuid(), Name: "Test Gezi", CategoryId: Guid.NewGuid(), Destination: "Hedef",
            Latitude: null, Longitude: null, Description: "", Conditions: "", InternalNote: "",
            StartDate: DateTime.UtcNow.AddDays(10), EndDate: DateTime.UtcNow.AddDays(11),
            RegistrationStartDate: DateTime.UtcNow.AddDays(-1), RegistrationEndDate: DateTime.UtcNow.AddDays(5),
            Gender: "mixed", MinAge: 0, MaxAge: 0, Capacity: 50, ReserveCapacity: 0,
            ParticipationPeriod: "none", ParticipationLimit: 0, ExemptFromParticipationLimit: false,
            CancellationDeadlineHours: 0, RestrictionsJson: restrictionsJson, ImagesJson: "[]",
            PricingJson: "{}", PointsJson: "{}", CrewJson: "{}", IsActive: true, SultangaziResidentOnly: false);
        return Travel.Create(data, "GZB-000001", "test");
    }

    private static (IUnitOfWork Uow, Mock<ITravelApplicationRepository> TravelApps) BuildUow(int existingChildrenOnTravel)
    {
        var participants = new Mock<IParticipantRepository>();
        participants
            .Setup(p => p.GetChildrenAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Participant>());

        var travelApps = new Mock<ITravelApplicationRepository>();
        travelApps
            .Setup(t => t.CountActiveChildrenOnTravelAsync(
                It.IsAny<Guid>(),
                It.IsAny<IReadOnlyCollection<Guid>>(),
                It.IsAny<IReadOnlyCollection<Guid>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingChildrenOnTravel);

        var uow = new Mock<IUnitOfWork>();
        uow.SetupGet(u => u.Participants).Returns(participants.Object);
        uow.SetupGet(u => u.TravelApplications).Returns(travelApps.Object);
        return (uow.Object, travelApps);
    }

    private static readonly System.Linq.Expressions.Expression<Func<ITravelApplicationRepository, Task<int>>> CountCall =
        t => t.CountActiveChildrenOnTravelAsync(
            It.IsAny<Guid>(),
            It.IsAny<IReadOnlyCollection<Guid>>(),
            It.IsAny<IReadOnlyCollection<Guid>>(),
            It.IsAny<CancellationToken>());

    [Fact]
    public async Task Throws_CHILD_LIMIT_when_cumulative_children_exceed_max()
    {
        var travel = TravelWith("{\"allowChildren\":true,\"maxChildren\":1}");
        var (uow, _) = BuildUow(existingChildrenOnTravel: 1);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            TravelChildLimitGuard.EnsureAsync(uow, travel, Guid.NewGuid(), new[] { Guid.NewGuid() }, Array.Empty<Guid>(), CancellationToken.None));

        Assert.Equal("CHILD_LIMIT", ex.ErrorCode);
    }

    [Fact]
    public async Task Passes_when_total_within_max()
    {
        var travel = TravelWith("{\"allowChildren\":true,\"maxChildren\":2}");
        var (uow, _) = BuildUow(existingChildrenOnTravel: 1);

        await TravelChildLimitGuard.EnsureAsync(uow, travel, Guid.NewGuid(), new[] { Guid.NewGuid() }, Array.Empty<Guid>(), CancellationToken.None);
    }

    [Fact]
    public async Task Skips_when_maxChildren_unset_unlimited()
    {
        var travel = TravelWith("{\"allowChildren\":true}");
        var (uow, travelApps) = BuildUow(existingChildrenOnTravel: 5);

        await TravelChildLimitGuard.EnsureAsync(uow, travel, Guid.NewGuid(), new[] { Guid.NewGuid() }, Array.Empty<Guid>(), CancellationToken.None);

        travelApps.Verify(CountCall, Times.Never);
    }

    [Fact]
    public async Task Skips_when_children_not_allowed()
    {
        var travel = TravelWith("{\"allowChildren\":false,\"maxChildren\":1}");
        var (uow, travelApps) = BuildUow(existingChildrenOnTravel: 5);

        await TravelChildLimitGuard.EnsureAsync(uow, travel, Guid.NewGuid(), new[] { Guid.NewGuid() }, Array.Empty<Guid>(), CancellationToken.None);

        travelApps.Verify(CountCall, Times.Never);
    }

    [Fact]
    public async Task Skips_when_no_minors_being_added()
    {
        var travel = TravelWith("{\"allowChildren\":true,\"maxChildren\":1}");
        var (uow, travelApps) = BuildUow(existingChildrenOnTravel: 5);

        await TravelChildLimitGuard.EnsureAsync(uow, travel, Guid.NewGuid(), Array.Empty<Guid>(), Array.Empty<Guid>(), CancellationToken.None);

        travelApps.Verify(CountCall, Times.Never);
    }
}
