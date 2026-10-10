using Microsoft.EntityFrameworkCore;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Infrastructure.Persistence;
using Nexora.Infrastructure.Persistence.Repositories;
using Xunit;

namespace Nexora.Api.IntegrationTests.Repositories;

public sealed class LiveWaitlistCountTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task Counts_exclude_removed_deleted_rejected_and_unrelated_rows_and_include_companions()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(postgres.ConnectionString).Options);
        await db.Database.OpenConnectionAsync();
        // Temporary tables isolate this query regression test from application data and
        // exercise the real PostgreSQL translation and EF soft-delete filters.
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TEMP TABLE "FacilityRegistrations" ("GroupId" uuid, "Status" text, "Kind" text, "IsDeleted" boolean);
            CREATE TEMP TABLE "TravelApplications" ("Id" uuid, "TravelId" uuid, "Status" text, "IsDeleted" boolean);
            CREATE TEMP TABLE "TravelApplicationPassengers" ("ApplicationId" uuid, "IsDeleted" boolean);
            """);
        var group = Guid.NewGuid();
        var other = Guid.NewGuid();
        foreach (var (status, kind, deleted, id) in new[] {
            ("active", "reserve", false, group), ("active", "reserve", false, group),
            ("removed", "reserve", false, group), ("active", "reserve", true, group),
            ("active", "main", false, group), ("active", "reserve", false, other) })
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"FacilityRegistrations\" VALUES ({id}, {status}, {kind}, {deleted})");
        var registrations = new FacilityRegistrationRepository(db);
        var counts = await registrations.CountActiveWaitlistByGroupsAsync([group], default);
        Assert.Equal(2, counts[group]);
        Assert.Single(counts);
        Assert.Empty(await registrations.CountActiveWaitlistByGroupsAsync([], default));
        Assert.Empty(await registrations.CountActiveWaitlistByGroupsAsync([Guid.NewGuid()], default));

        var travel = Guid.NewGuid();
        foreach (var (status, deleted, passengers) in new[] {
            ("approved", false, 3), ("approved", false, 0), ("waitlist", false, 2),
            ("rejected", false, 4), ("waitlist", true, 5) })
        {
            var app = Guid.NewGuid();
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"TravelApplications\" VALUES ({app}, {travel}, {status}, {deleted})");
            for (var i = 0; i < passengers; i++)
                await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"TravelApplicationPassengers\" VALUES ({app}, false)");
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"TravelApplicationPassengers\" VALUES ({app}, true)");
        }
        var applications = new TravelApplicationRepository(db);
        var actual = await applications.CountByTravelsAsync([travel], default);
        Assert.Equal((4, 2), actual[travel]);
        Assert.Equal(await applications.CountByTravelAndStatusAsync(travel, "approved", default), actual[travel].Approved);
        Assert.Equal(await applications.CountByTravelAndStatusAsync(travel, "waitlist", default), actual[travel].Waitlist);
        Assert.Empty(await applications.CountByTravelsAsync([], default));
    }
}
