using Nexora.Domain.Common;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

/// <summary>
/// Bulgu (2026-10-03, canlı QA denetimi — nihai prod-öncesi tur): bkz.
/// ParticipantTravelService.cs ReserveAsync içindeki aynı tarihli not.
/// documentRequired=true bir Route/Travel'a başvuru, global
/// TravelSettings.General.RequireApproval=false olduğunda DocumentStatus
/// hâlâ "pending" iken DOĞRUDAN Status="approved" ile oluşuyordu — admin
/// tarafındaki "evrak tamamlanmadan onaylanamaz" kilidi (DOCUMENTS_REQUIRED)
/// yalnızca bir SONRAKİ durum değişikliğinde tetiklendiği için hiç devreye
/// girmiyordu. Canlı doğrulama: test gezisi documentRequired=true + global
/// RequireApproval=false ile oluşturuldu, gerçek citizen POST /reserve
/// isteği fix öncesi status="approved" döndürdü (DocumentStatus="pending"
/// olsa bile); fix sonrası aynı istek status="pending" döndürdü, admin'in
/// PUT ile evraksız onaylama denemesi gerçekten DOCUMENTS_REQUIRED (409)
/// aldı, documentStatus="complete" yapılınca onay başarılı oldu.
///
/// Bu test, ReserveAsync'teki gerçek newStatus hesaplama formülünü
/// (ParticipantTravelService.cs:374-390) birebir yansıtır — TravelCapacityTests.cs
/// ile aynı "mantığı yerelde yeniden ifade et" deseni izlenmiştir çünkü
/// ReserveAsync doğrudan DbContext/UnitOfWork'e bağımlı olup saf birim testi
/// için izole edilebilir değildir (gerçek davranış yukarıdaki canlı HTTP
/// denetimiyle ayrıca kanıtlanmıştır).
/// </summary>
public class TravelDocumentRequiredApprovalGateTests
{
    private static string ComputeNewStatus(bool waitlistMode, bool globalRequireApproval, string? restrictionsJson)
    {
        var requireApproval = globalRequireApproval || TravelRestrictionRules.DocumentRequired(restrictionsJson);
        return waitlistMode ? "waitlist" : (requireApproval ? "pending" : "approved");
    }

    [Fact]
    public void DocumentRequired_true_ve_global_RequireApproval_false_iken_basvuru_approved_olarak_BASLAMAZ()
    {
        var restrictions = "{\"documentRequired\":true}";
        Assert.Equal("pending", ComputeNewStatus(waitlistMode: false, globalRequireApproval: false, restrictionsJson: restrictions));
    }

    [Fact]
    public void DocumentRequired_false_ve_global_RequireApproval_false_iken_basvuru_hala_otomatik_approved()
    {
        var restrictions = "{\"documentRequired\":false}";
        Assert.Equal("approved", ComputeNewStatus(waitlistMode: false, globalRequireApproval: false, restrictionsJson: restrictions));
    }

    [Fact]
    public void DocumentRequired_true_olsa_da_waitlist_modu_her_zaman_once_gelir()
    {
        var restrictions = "{\"documentRequired\":true}";
        Assert.Equal("waitlist", ComputeNewStatus(waitlistMode: true, globalRequireApproval: false, restrictionsJson: restrictions));
    }

    [Fact]
    public void Global_RequireApproval_true_zaten_pending_sonucunu_degistirmez()
    {
        var restrictions = "{\"documentRequired\":false}";
        Assert.Equal("pending", ComputeNewStatus(waitlistMode: false, globalRequireApproval: true, restrictionsJson: restrictions));
    }

    [Fact]
    public void RestrictionsJson_bos_obje_iken_documentRequired_false_sayilir_ve_otomatik_approved_kalir()
    {
        Assert.Equal("approved", ComputeNewStatus(waitlistMode: false, globalRequireApproval: false, restrictionsJson: "{}"));
    }
}
