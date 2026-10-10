using FluentValidation.TestHelper;
using Nexora.Application.Features.MobileConfig.Dtos;
using Nexora.Application.Features.MobileConfig.Validators;
using Xunit;

namespace Nexora.UnitTests.Application;

public class MobileVersionControlValidatorTests
{
    private readonly UpdateVersionControlRequestValidator _validator = new();

    private static UpdateVersionControlRequest Request(
        string? androidMin = null, string? androidLatest = null, string? androidStore = null,
        string? iosMin = null, string? iosLatest = null, string? iosStore = null)
        => new(androidMin, androidLatest, androidStore, iosMin, iosLatest, iosStore, null, null);

    [Fact]
    public void AllFieldsEmpty_IsValid()
        => _validator.TestValidate(Request()).ShouldNotHaveAnyValidationErrors();

    [Fact]
    public void ValidVersions_AreAccepted()
        => _validator.TestValidate(Request(androidMin: "1.0.0", androidLatest: "1.0.4"))
            .ShouldNotHaveAnyValidationErrors();

    [Theory]
    [InlineData("1.x.0")]
    [InlineData("sürüm")]
    [InlineData("-1.0.0")]
    public void MalformedVersion_IsRejected(string value)
        => _validator.TestValidate(Request(androidMin: value))
            .ShouldHaveValidationErrorFor(x => x.AndroidMinVersion);

    /// <summary>
    /// Zorunlu sürüm güncel sürümü aşarsa, store'daki en yeni sürümü indiren
    /// kullanıcı bile güncelleme ekranında kilitli kalırdı.
    /// </summary>
    [Fact]
    public void MinAboveLatest_IsRejected()
    {
        _validator.TestValidate(Request(androidMin: "2.0.0", androidLatest: "1.0.4"))
            .ShouldHaveValidationErrorFor(x => x.AndroidMinVersion);
        _validator.TestValidate(Request(iosMin: "2.0.0", iosLatest: "1.0.4"))
            .ShouldHaveValidationErrorFor(x => x.IosMinVersion);
    }

    [Fact]
    public void MinEqualToLatest_IsAccepted()
        => _validator.TestValidate(Request(androidMin: "1.0.4", androidLatest: "1.0.4"))
            .ShouldNotHaveAnyValidationErrors();

    [Fact]
    public void NonHttpsStoreUrl_IsRejected()
        => _validator.TestValidate(Request(androidStore: "http://play.google.com/store"))
            .ShouldHaveValidationErrorFor(x => x.AndroidStoreUrl);

    [Fact]
    public void HttpsStoreUrl_IsAccepted()
        => _validator.TestValidate(Request(
                androidStore: "https://play.google.com/store/apps/details?id=com.sultansehir",
                iosStore: "https://apps.apple.com/tr/app/id123456789"))
            .ShouldNotHaveAnyValidationErrors();
}
