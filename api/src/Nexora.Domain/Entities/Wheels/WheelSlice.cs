namespace Nexora.Domain.Entities.Wheels;

public class WheelSlice
{
    public string Label { get; set; } = "";
    public string Type { get; set; } = "points";
    public int Value { get; set; }
    public int WinRate { get; set; }
    public string Color { get; set; } = "";
    public Guid? GiftId { get; set; }
    public string? GiftName { get; set; }
}
