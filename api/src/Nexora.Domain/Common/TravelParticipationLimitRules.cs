namespace Nexora.Domain.Common;

/// <summary>
/// Gezi (Travel) katılım sıklığı sınırının bir sefer için uygulanıp uygulanmayacağına
/// tek noktadan karar verir. "unlimited" dönem türü (ParticipationPeriod=="unlimited")
/// VE sefere özel muafiyet bayrağı (ExemptFromParticipationLimit) iki ayrı mekanizmadır
/// ama ikisi de aynı sonucu üretir: bu sefer için/bu sefere dönem sayımı uygulanmaz.
/// </summary>
public static class TravelParticipationLimitRules
{
    public static bool IsExempt(string participationPeriod, bool exemptFromParticipationLimit)
        => participationPeriod == "unlimited" || exemptFromParticipationLimit;

    public static bool IsExemptAsVehicleFree(int busCount, bool applyToVehicleFreeTravels)
        => busCount == 0 && !applyToVehicleFreeTravels;
}
