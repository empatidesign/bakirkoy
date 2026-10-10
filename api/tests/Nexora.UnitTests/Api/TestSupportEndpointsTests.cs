using Nexora.Api.Endpoints.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Nexora.Infrastructure.Persistence;
using System.Net;
using System.Text.Json;
using Xunit;

namespace Nexora.UnitTests.Api;

public class TestSupportEndpointsTests
{
    [Theory]
    [InlineData("Production")]
    [InlineData("Development")]
    [InlineData("Staging")]
    public void IsEnabled_Rejects_NonTesting_Environments(string environmentName)
    {
        Assert.False(TestSupportEndpoints.IsEnabled(environmentName));
    }

    [Fact]
    public void IsEnabled_Accepts_Only_Testing()
    {
        Assert.True(TestSupportEndpoints.IsEnabled("Testing"));
    }

    [Theory]
    [InlineData(null, "9f2c7a10b4e68d31c5f9072a6b8d4e1f03ac759bd2468e10f5c39a7d61be8420")]
    [InlineData("", "9f2c7a10b4e68d31c5f9072a6b8d4e1f03ac759bd2468e10f5c39a7d61be8420")]
    [InlineData(" ", "9f2c7a10b4e68d31c5f9072a6b8d4e1f03ac759bd2468e10f5c39a7d61be8420")]
    [InlineData("wrong", "9f2c7a10b4e68d31c5f9072a6b8d4e1f03ac759bd2468e10f5c39a7d61be8420")]
    [InlineData("0123456701234567012345670123456701234567012345670123456701234567", "0123456701234567012345670123456701234567012345670123456701234567")]
    [InlineData("gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg", "gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg")]
    public void HasValidApiKey_Rejects_Missing_Or_Wrong_Keys(string? provided, string? configured)
    {
        Assert.False(TestSupportEndpoints.HasValidApiKey(provided, configured));
    }

    [Fact]
    public void HasValidApiKey_Accepts_Exact_Configured_Key()
    {
        const string key = "9f2c7a10b4e68d31c5f9072a6b8d4e1f03ac759bd2468e10f5c39a7d61be8420";
        Assert.True(TestSupportEndpoints.HasValidApiKey(key, key));
    }

    [Fact]
    public void ResidueTargets_Are_An_Explicit_Small_Whitelist()
    {
        Assert.Equal(
            ["Event.Code", "Event.Name", "Session.Code", "Travel.Code", "Travel.Name"],
            TestSupportEndpoints.ResidueTargets.Select(target => $"{target.EntityType.Name}.{target.PropertyName}").Order());
        Assert.DoesNotContain(TestSupportEndpoints.ResidueTargets, target => target.PropertyName == "Title");
    }

    [Fact]
    public void Query_Bounds_Are_Strict()
    {
        Assert.InRange(TestSupportEndpoints.MaxResults, 1, 20);
        Assert.InRange(TestSupportEndpoints.CommandTimeoutSeconds, 1, 10);
    }

    [Fact]
    public void Response_Shape_Contains_No_Pii()
    {
        var json = JsonSerializer.Serialize(new ResidueResponse([new ResidueMatch("Travel", "Name")]));
        Assert.Equal("{\"Residues\":[{\"Resource\":\"Travel\",\"Field\":\"Name\"}]}", json);
        Assert.DoesNotContain("value", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void TestTag_Is_Deterministic_And_Fits_Every_Target_Column()
    {
        Assert.Equal("e2e-4e65d3fbe8ad6535", TestSupportEndpoints.CreateTestTag("run-1"));
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=unused").Options);
        foreach (var target in TestSupportEndpoints.ResidueTargets)
            Assert.True(db.Model.FindEntityType(target.EntityType)!.FindProperty(target.PropertyName)!.GetMaxLength() >= 20);
    }

    [Fact]
    public void TestSupportPartition_Ignores_Forwarded_For()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("10.0.0.5");
        context.Request.Headers["X-Forwarded-For"] = "203.0.113.1";
        var first = TestSupportEndpoints.GetRateLimitPartitionKey(context);
        context.Request.Headers["X-Forwarded-For"] = "203.0.113.2";
        Assert.Equal(first, TestSupportEndpoints.GetRateLimitPartitionKey(context));
        Assert.Equal("10.0.0.5", first);
    }
}
