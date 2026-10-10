using FluentValidation.TestHelper;
using Nexora.Application.Features.MobileConfig.Dtos;
using Nexora.Application.Features.MobileConfig.Validators;
using Xunit;

namespace Nexora.UnitTests.Application;

public class MobileSplashImageValidatorTests
{
    private readonly UpdateSplashImageRequestValidator _validator = new();

    /// <summary>Boş değer görseli kaldırır; uygulama paketli logosuna döner.</summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void EmptyValue_ClearsImageAndIsValid(string? url)
        => _validator.TestValidate(new UpdateSplashImageRequest(url)).ShouldNotHaveAnyValidationErrors();

    /// <summary>Yükleme ucu göreli yol döner; bu yol reddedilirse yüklenen görsel kaydedilemezdi.</summary>
    [Fact]
    public void UploadedRelativePath_IsAccepted()
        => _validator.TestValidate(new UpdateSplashImageRequest("/api/v1/files/public/mobile-splash/abc.webp"))
            .ShouldNotHaveAnyValidationErrors();

    [Fact]
    public void HttpsUrl_IsAccepted()
        => _validator.TestValidate(new UpdateSplashImageRequest("https://cdn.sultangazi.bel.tr/splash.webp"))
            .ShouldNotHaveAnyValidationErrors();

    [Theory]
    [InlineData("http://cdn.sultangazi.bel.tr/splash.webp")]
    [InlineData("javascript:alert(1)")]
    [InlineData("/etc/passwd")]
    [InlineData("../../gizli/dosya.webp")]
    public void UnsafeValue_IsRejected(string url)
        => _validator.TestValidate(new UpdateSplashImageRequest(url))
            .ShouldHaveValidationErrorFor(x => x.ImageUrl);
}
