namespace Nexora.Domain.Enums;

public enum BakkartApplicationStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3,
    Cancelled = 4,
}

public enum BakkartCardType
{
    Standard = 1,
    Student = 2,
    Retiree = 3,
    SocialSupport = 4,
}

public enum BakkartDeliveryType
{
    Digital = 1,
    Physical = 2,
}

public enum BakkartCardStatus
{
    Active = 1,
    Passive = 2,
    Blocked = 3,
}

public enum BakkartTransactionType
{
    BalanceLoad = 1,
    BalanceSpend = 2,
    PointsEarn = 3,
    PointsSpend = 4,
    AdminAdjustment = 5,
}
