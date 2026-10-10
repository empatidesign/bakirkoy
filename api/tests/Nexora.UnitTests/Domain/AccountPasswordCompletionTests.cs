using System;
using Nexora.Domain.Entities.Auth;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class AccountPasswordCompletionTests
{
    private static Participant NewParticipant() => Participant.Create(
        tckn: "10000000146",
        fullName: "Test Kişi",
        birthDate: new DateTime(1990, 1, 1),
        gender: Gender.Male,
        isMinor: false,
        passwordHash: "temp-hash",
        email: null,
        phone: "05001112233",
        guardianPhone: null,
        guardianEmail: null,
        address: null);

    [Fact]
    public void Participant_CompleteInitialPassword_bayraklari_kilidi_temizler_ve_security_version_artirir()
    {
        var p = NewParticipant();
        Assert.True(p.MustChangePassword);
        Assert.True(p.IsFirstLogin);
        for (var i = 0; i < 5; i++) p.RecordFailedLogin(threshold: 5, lockoutMinutes: 15);
        Assert.True(p.IsLocked);
        Assert.Equal(0, p.SecurityVersion);

        p.CompleteInitialPassword("new-hash");

        Assert.Equal("new-hash", p.PasswordHash);
        Assert.False(p.MustChangePassword);
        Assert.False(p.IsFirstLogin);
        Assert.Equal(0, p.FailedLoginCount);
        Assert.Null(p.LockedUntil);
        Assert.False(p.IsLocked);
        Assert.Equal(1, p.SecurityVersion);
    }

    [Fact]
    public void Participant_her_parola_tamamlama_security_version_i_bir_artirir()
    {
        var p = NewParticipant();
        p.CompleteInitialPassword("h1");
        p.CompleteInitialPassword("h2");
        Assert.Equal(2, p.SecurityVersion);
    }

    [Fact]
    public void AdminUser_CompletePasswordChange_bayraklari_kilidi_temizler_ve_security_version_artirir()
    {
        var a = AdminUser.Create("Yönetici", "admin@belediye.gov.tr", "05001112233", "BT", "temp-hash", Guid.NewGuid());
        Assert.True(a.MustChangePassword);
        Assert.True(a.IsFirstLogin);
        for (var i = 0; i < 5; i++) a.RecordFailedLogin(threshold: 5, lockoutMinutes: 15);
        Assert.True(a.IsLocked);

        a.CompletePasswordChange("new-hash");

        Assert.Equal("new-hash", a.PasswordHash);
        Assert.False(a.MustChangePassword);
        Assert.False(a.IsFirstLogin);
        Assert.Equal(0, a.FailedLoginCount);
        Assert.Null(a.LockedUntil);
        Assert.Equal(1, a.SecurityVersion);
    }

    [Fact]
    public void BumpSecurityVersion_degeri_artirir()
    {
        var p = NewParticipant();
        p.BumpSecurityVersion();
        p.BumpSecurityVersion();
        Assert.Equal(2, p.SecurityVersion);
    }
}
