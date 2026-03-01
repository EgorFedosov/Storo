using backend.Modules.Items.Domain;
using backend.Modules.Users.Domain;

namespace backend.Modules.Inventories.Domain;

public sealed class Inventory
{
    public long Id { get; set; }
    public long CreatorId { get; set; }
    public int CategoryId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string DescriptionMarkdown { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public bool IsPublic { get; set; }
    public int Version { get; set; } = 1;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User Creator { get; set; } = null!;
    public Category Category { get; set; } = null!;
    public CustomIdTemplate? CustomIdTemplate { get; set; }
    public CustomIdSequenceState? CustomIdSequenceState { get; set; }
    public InventoryStatistics? Statistics { get; set; }

    public ICollection<InventoryAccess> AccessList { get; set; } = new List<InventoryAccess>();
    public ICollection<InventoryTag> InventoryTags { get; set; } = new List<InventoryTag>();
    public ICollection<CustomField> CustomFields { get; set; } = new List<CustomField>();
    public ICollection<Item> Items { get; set; } = new List<Item>();
    public ICollection<DiscussionPost> DiscussionPosts { get; set; } = new List<DiscussionPost>();
    public ICollection<InventoryNumericFieldStatistic> NumericFieldStatistics { get; set; } =
        new List<InventoryNumericFieldStatistic>();
    public ICollection<InventoryStringFieldStatistic> StringFieldStatistics { get; set; } =
        new List<InventoryStringFieldStatistic>();
}
