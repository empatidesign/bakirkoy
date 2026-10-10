using Microsoft.Extensions.Configuration;
using Moq;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class TemplateRuleEngineTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ILibraryRepository> _libraries = new();
    private readonly Mock<ILibrarySettingsService> _settings = new();

    public TemplateRuleEngineTests()
    {
        _uow.SetupGet(x => x.Libraries).Returns(_libraries.Object);
    }

    private TemplateRuleEngine Create(bool useTemplateEngine)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["LibraryAccess:UseTemplateEngine"] = useTemplateEngine ? "true" : "false",
            })
            .Build();
        return new TemplateRuleEngine(_uow.Object, _settings.Object, config);
    }

    private void SetupLibrary(Guid id, string? operationTemplate)
    {
        var lib = Library.Create("Test Kıraathane", Guid.NewGuid());
        if (operationTemplate is not null) lib.SetOperationTemplate(operationTemplate);
        _libraries.Setup(x => x.GetByIdAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(lib);
    }

    private void SetupSettings(Guid id, bool breakSystemEnabled)
        => _settings.Setup(x => x.GetAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new LibrarySettingsDto { BreakSystemEnabled = breakSystemEnabled });

    [Theory]
    [InlineData(null, true, true)]
    [InlineData(null, false, false)]
    [InlineData("QR_ENTRY_EXIT_ONLY", true, true)]
    [InlineData("QR_ENTRY_EXIT_ONLY", false, false)]
    [InlineData("FULL_BUSY_LIBRARY", true, true)]
    [InlineData("FULL_BUSY_LIBRARY", false, false)]
    [InlineData("SEQUENTIAL_SEAT", true, true)]
    public async Task FlagOff_AlwaysMatchesSettingExactly(string? template, bool settingValue, bool expected)
    {
        var id = Guid.NewGuid();
        SetupLibrary(id, template);
        SetupSettings(id, settingValue);

        var result = await Create(useTemplateEngine: false).IsBreakSystemEnabledAsync(id, CancellationToken.None);

        Assert.Equal(expected, result);
    }

    [Fact]
    public async Task FlagOff_DoesNotQueryLibrary()
    {
        var id = Guid.NewGuid();
        SetupSettings(id, true);

        await Create(useTemplateEngine: false).IsBreakSystemEnabledAsync(id, CancellationToken.None);

        _libraries.Verify(x => x.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData("FULL_BUSY_LIBRARY", true, true)]
    [InlineData("FULL_BUSY_LIBRARY", false, false)]
    [InlineData("QR_ENTRY_EXIT_ONLY", true, false)]
    [InlineData("QR_ENTRY_EXIT_ONLY", false, false)]
    [InlineData("ENTRY_EXIT_AND_SEAT", true, false)]
    [InlineData("SEQUENTIAL_SEAT", true, false)]
    public async Task FlagOn_CombinesSettingWithTemplateCapability(string template, bool settingValue, bool expected)
    {
        var id = Guid.NewGuid();
        SetupLibrary(id, template);
        SetupSettings(id, settingValue);

        var result = await Create(useTemplateEngine: true).IsBreakSystemEnabledAsync(id, CancellationToken.None);

        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData(null, true, true)]
    [InlineData(null, false, false)]
    [InlineData("BILINMEYEN_SABLON", true, true)]
    public async Task FlagOn_NoOrUnknownTemplate_FallsBackToSetting(string? template, bool settingValue, bool expected)
    {
        var id = Guid.NewGuid();
        SetupLibrary(id, template);
        SetupSettings(id, settingValue);

        var result = await Create(useTemplateEngine: true).IsBreakSystemEnabledAsync(id, CancellationToken.None);

        Assert.Equal(expected, result);
    }

    [Fact]
    public async Task FlagOn_LibraryNotFound_FallsBackToSetting()
    {
        var id = Guid.NewGuid();
        _libraries.Setup(x => x.GetByIdAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync((Library?)null);
        SetupSettings(id, true);

        var result = await Create(useTemplateEngine: true).IsBreakSystemEnabledAsync(id, CancellationToken.None);

        Assert.True(result);
    }
}
