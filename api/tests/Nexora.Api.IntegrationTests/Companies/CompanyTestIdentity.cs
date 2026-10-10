using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Nexora.Api.IntegrationTests.Infrastructure;
using Nexora.Domain.Entities.Companies;
using Nexora.Infrastructure.Persistence;

namespace Nexora.Api.IntegrationTests.Companies;

// Task 12: the C# integration project has no company/company-staff identity helper prior to this
// task (TestIdentity.cs = admin, CitizenTestIdentity.cs = citizen). Companies' redemption/campaign
// surfaces (CompanyMeEndpoints/CompanyQrEndpoints, RequireAuthorization("Company")/"CompanyOrStaff")
// need a real Company/CompanyStaff row + a token whose claim shape is provably identical to what
// JwtService.GenerateCompanyAccessToken/GenerateCompanyStaffAccessToken produce in production
// (verified by reading JwtService.cs directly), matching the exact same trade-off
// NexoraApiFactory.CreateCitizenClientAsync already makes: direct EF seed of the row, real signed
// token claim shape, not a repurposed admin token.
internal static class CompanyTestIdentityExtensions
{
    private const string JwtSecret = "nexora-integration-test-secret-key-min-32-chars-long!!";
    private const string JwtIssuer = "nexora";
    private const string JwtAudience = "nexora-client";

    // Seeds a real, approved Company row directly via EF (cheaper than driving the full
    // registration+admin-approval HTTP flow, matching CreateCitizenClientAsync's own trade-off) and
    // returns a client bearing a token with user_type=company (JwtService.GenerateCompanyAccessToken
    // claim shape). Approval defaults to true because most redemption/campaign-management tests need
    // an approved company (CompanyMeService.RecordUsageCoreAsync/EnsureApproved both gate on it).
    public static async Task<(Guid CompanyId, HttpClient Client)> CreateCompanyClientAsync(
        this NexoraApiFactory factory, string tag, bool approved = true, Guid? serviceCategoryId = null)
    {
        Guid companyId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var company = Company.Create(
                $"{tag} Firma", TaxNumberFor(tag), PhoneFor(tag), $"{tag.ToLowerInvariant()}@nexora-test.local",
                "Test Adres No:1", "Sultangazi", "x");
            if (serviceCategoryId.HasValue) company.SetServiceCategory(serviceCategoryId.Value);
            if (approved) company.Approve("IT Test");
            await db.Companies.AddAsync(company);
            await db.SaveChangesAsync();
            companyId = company.Id;
        }

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateCompanyToken(companyId, $"{tag} Firma"));
        return (companyId, client);
    }

    // Seeds a real CompanyStaff row under the given company and returns a client bearing a token
    // with user_type=company_staff (JwtService.GenerateCompanyStaffAccessToken claim shape),
    // including the real companyId/can_redeem/can_manage_campaigns claims CurrentUser.cs reads.
    public static async Task<(Guid StaffId, HttpClient Client)> CreateCompanyStaffClientAsync(
        this NexoraApiFactory factory, Guid companyId, string tag, bool canRedeem = true, bool canManageCampaigns = false)
    {
        Guid staffId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var staff = CompanyStaff.Create(companyId, $"{tag} Personel", PhoneFor(tag), null, "x");
            staff.SetCanRedeem(canRedeem);
            staff.SetCanManageCampaigns(canManageCampaigns);
            await db.CompanyStaffs.AddAsync(staff);
            await db.SaveChangesAsync();
            staffId = staff.Id;
        }

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateCompanyStaffToken(staffId, companyId, $"{tag} Personel", canRedeem, canManageCampaigns));
        return (staffId, client);
    }

    private static string TaxNumberFor(string tag)
        => Math.Abs(tag.GetHashCode()).ToString().PadLeft(10, '1')[..10];

    private static string PhoneFor(string tag)
        => "05" + Math.Abs(tag.GetHashCode() ^ 0x5A5A5A5A).ToString().PadLeft(9, '3')[..9];

    private static string CreateCompanyToken(Guid companyId, string name)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, companyId.ToString()),
            new Claim(ClaimTypes.Name, name),
            new Claim("user_type", "company"),
            new Claim("sessionId", Guid.NewGuid().ToString()),
            new Claim("must_change_password", "false"),
        };
        return Sign(claims);
    }

    private static string CreateCompanyStaffToken(Guid staffId, Guid companyId, string name, bool canRedeem, bool canManageCampaigns)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, staffId.ToString()),
            new Claim(ClaimTypes.Name, name),
            new Claim("user_type", "company_staff"),
            new Claim("companyId", companyId.ToString()),
            new Claim("can_redeem", canRedeem ? "true" : "false"),
            new Claim("can_manage_campaigns", canManageCampaigns ? "true" : "false"),
            new Claim("sessionId", Guid.NewGuid().ToString()),
        };
        return Sign(claims);
    }

    private static string Sign(Claim[] claims)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: JwtIssuer,
            audience: JwtAudience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(30),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
