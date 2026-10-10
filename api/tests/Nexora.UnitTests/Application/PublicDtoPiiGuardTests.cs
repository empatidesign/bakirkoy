using System.Reflection;
using Nexora.Application.Features.Public.Dtos;
using Xunit;

namespace Nexora.UnitTests.Application;

public class PublicDtoPiiGuardTests
{
    private static readonly string[] ForbiddenFieldFragments =
    [
        "ManagerPhone", "ManagerEmail", "Manager",
        "InternalNote", "Internal", "AdminNote",
        "Tckn", "PasswordHash", "Password",
        "GuardianPhone", "GuardianEmail",
        "CreatedBy", "UpdatedBy", "DeletedBy",
    ];

    private static readonly HashSet<string> AllowedExceptions = new(StringComparer.OrdinalIgnoreCase)
    {
    };

    public static IEnumerable<object[]> PublicDtoTypes()
    {
        var assembly = typeof(PublicServiceFacilityDto).Assembly;
        foreach (var t in assembly.GetTypes())
        {
            if (t.Namespace == "Nexora.Application.Features.Public.Dtos"
                && t.Name.StartsWith("Public", StringComparison.Ordinal)
                && (t.IsClass || t.IsValueType)
                && !t.IsAbstract
                && !t.IsEnum)
            {
                yield return new object[] { t };
            }
        }
    }

    [Theory]
    [MemberData(nameof(PublicDtoTypes))]
    public void Public_dto_pii_alani_icermez(Type dtoType)
    {
        var members = dtoType.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Select(p => p.Name)
            .Concat(dtoType.GetFields(BindingFlags.Public | BindingFlags.Instance).Select(f => f.Name));

        foreach (var name in members)
        {
            if (AllowedExceptions.Contains(name)) continue;
            foreach (var forbidden in ForbiddenFieldFragments)
            {
                Assert.False(
                    name.Contains(forbidden, StringComparison.OrdinalIgnoreCase),
                    $"Public DTO '{dtoType.Name}' yasak PII alanı içeriyor: '{name}' (eşleşen kalıp: '{forbidden}'). " +
                    "Dış siteye kişisel/iç veri sızdırmayın.");
            }
        }
    }

    [Fact]
    public void En_az_bir_public_dto_taranmis_olmali()
    {
        Assert.NotEmpty(PublicDtoTypes());
    }
}
