using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class HardwareVerificationServiceTests
{
    private readonly HardwareVerificationService _svc = new();

    [Fact]
    public void Verify_UnknownTemplateId_ReturnsNotSatisfiedWithMessage()
    {
        var result = _svc.Verify(new HardwareVerificationRequest("NOT_A_TEMPLATE", "masali", true, true, true, "device", []));

        Assert.False(result.IsSatisfied);
        Assert.Contains(result.MissingRequirements, m => m.Contains("Bilinmeyen şablon"));
        Assert.Null(result.FallbackTemplateId);
    }

    [Fact]
    public void Verify_QrEntryExitOnly_NoHardwareRequired_AlwaysSatisfied()
    {
        var result = _svc.Verify(new HardwareVerificationRequest(
            OperationTemplates.QrEntryExitOnly, "sirali", false, false, false, "qr", null));

        Assert.True(result.IsSatisfied);
        Assert.Empty(result.MissingRequirements);
    }

    [Fact]
    public void Verify_FullBusyLibrary_MissingDevicesAndLock_ReturnsNotSatisfiedWithFallback()
    {
        var result = _svc.Verify(new HardwareVerificationRequest(
            OperationTemplates.FullBusyLibrary, "masali", true, true, true, "device", []));

        Assert.False(result.IsSatisfied);
        Assert.Contains(result.MissingRequirements, m => m.Contains("directional cihaz"));
        Assert.Contains(result.MissingRequirements, m => m.Contains("Manyetik kilit"));
        Assert.Equal(OperationTemplates.SequentialSeat, result.FallbackTemplateId);
    }

    [Fact]
    public void Verify_FullBusyLibrary_WithCompleteHardware_IsSatisfied()
    {
        var devices = new List<PlannedDeviceInput>
        {
            new("entry", "directional", true),
            new("exit", "directional", true),
        };
        var result = _svc.Verify(new HardwareVerificationRequest(
            OperationTemplates.FullBusyLibrary, "masali", true, true, true, "device", devices));

        Assert.True(result.IsSatisfied);
        Assert.Empty(result.MissingRequirements);
        Assert.Null(result.FallbackTemplateId);
    }

    [Fact]
    public void Verify_FullBusyLibrary_OnlyOneDirectionalDevice_StillMissing()
    {
        var devices = new List<PlannedDeviceInput> { new("entry", "directional", true) };
        var result = _svc.Verify(new HardwareVerificationRequest(
            OperationTemplates.FullBusyLibrary, "masali", true, true, true, "device", devices));

        Assert.False(result.IsSatisfied);
        Assert.Contains(result.MissingRequirements, m => m.Contains("directional cihaz"));
    }

    [Fact]
    public void Verify_FullBusyLibrary_ToggleDeviceOnly_DoesNotSatisfyTwoDirectionalRequirement()
    {
        var devices = new List<PlannedDeviceInput> { new("entry", "toggle", true) };
        var result = _svc.Verify(new HardwareVerificationRequest(
            OperationTemplates.FullBusyLibrary, "masali", true, true, true, "device", devices));

        Assert.False(result.IsSatisfied);
        Assert.Contains(result.MissingRequirements, m => m.Contains("directional cihaz"));
    }

    [Fact]
    public void Verify_FullBusyLibrary_DevicesPresentButAccessTypeNotDevice_LockMissing()
    {
        var devices = new List<PlannedDeviceInput>
        {
            new("entry", "directional", true),
            new("exit", "directional", true),
        };
        var result = _svc.Verify(new HardwareVerificationRequest(
            OperationTemplates.FullBusyLibrary, "masali", true, true, true, "qr", devices));

        Assert.False(result.IsSatisfied);
        Assert.Contains(result.MissingRequirements, m => m.Contains("Manyetik kilit"));
    }

    [Fact]
    public void Verify_FullBusyLibrary_HardwareOkButSeatingModeWrong_ReturnsInconsistencyMessage()
    {
        var devices = new List<PlannedDeviceInput>
        {
            new("entry", "directional", true),
            new("exit", "directional", true),
        };
        var result = _svc.Verify(new HardwareVerificationRequest(
            OperationTemplates.FullBusyLibrary, "sirali", true, true, true, "device", devices));

        Assert.False(result.IsSatisfied);
        Assert.Contains(result.MissingRequirements, m => m.Contains("masa seçimi gerektirir"));
    }

    [Fact]
    public void Verify_FullBusyLibrary_QueueDisabled_ReturnsInconsistencyMessage()
    {
        var devices = new List<PlannedDeviceInput>
        {
            new("entry", "directional", true),
            new("exit", "directional", true),
        };
        var result = _svc.Verify(new HardwareVerificationRequest(
            OperationTemplates.FullBusyLibrary, "masali", false, true, true, "device", devices));

        Assert.False(result.IsSatisfied);
        Assert.Contains(result.MissingRequirements, m => m.Contains("sıra sistemi gerektirir"));
    }

    [Fact]
    public void Verify_FullBusyLibrary_BreakSystemDisabled_ReturnsInconsistencyMessage()
    {
        var devices = new List<PlannedDeviceInput>
        {
            new("entry", "directional", true),
            new("exit", "directional", true),
        };
        var result = _svc.Verify(new HardwareVerificationRequest(
            OperationTemplates.FullBusyLibrary, "masali", true, true, false, "device", devices));

        Assert.False(result.IsSatisfied);
        Assert.Contains(result.MissingRequirements, m => m.Contains("mola sistemi gerektirir"));
    }

    [Fact]
    public void Verify_NullPlannedDevices_TreatedAsEmpty_DoesNotThrow()
    {
        var result = _svc.Verify(new HardwareVerificationRequest(
            OperationTemplates.FullBusyLibrary, "masali", true, true, true, "device", null));

        Assert.False(result.IsSatisfied);
    }
}
