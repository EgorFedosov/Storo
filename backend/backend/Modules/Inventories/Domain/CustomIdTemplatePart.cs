namespace backend.Modules.Inventories.Domain;

public sealed class CustomIdTemplatePart
{
    public long Id { get; set; }
    public long TemplateId { get; set; }
    public int SortOrder { get; set; }
    public CustomIdPartType PartType { get; set; }
    public string? FixedText { get; set; }
    public string? FormatPattern { get; set; }

    public CustomIdTemplate Template { get; set; } = null!;
}
