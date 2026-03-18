using backend.Modules.Inventories.Domain;
using backend.Modules.Integrations.Domain;
using backend.Modules.Items.Domain;
using backend.Modules.Users.Domain;
using Microsoft.EntityFrameworkCore;

namespace backend.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<ExternalAuthAccount> ExternalAuthAccounts => Set<ExternalAuthAccount>();

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Inventory> Inventories => Set<Inventory>();
    public DbSet<InventoryAccess> InventoryAccess => Set<InventoryAccess>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<InventoryTag> InventoryTags => Set<InventoryTag>();
    public DbSet<CustomIdTemplate> CustomIdTemplates => Set<CustomIdTemplate>();
    public DbSet<CustomIdTemplatePart> CustomIdTemplateParts => Set<CustomIdTemplatePart>();
    public DbSet<CustomIdSequenceState> CustomIdSequenceState => Set<CustomIdSequenceState>();
    public DbSet<CustomField> CustomFields => Set<CustomField>();
    public DbSet<DiscussionPost> DiscussionPosts => Set<DiscussionPost>();
    public DbSet<InventoryStatistics> InventoryStatistics => Set<InventoryStatistics>();
    public DbSet<InventoryNumericFieldStatistic> InventoryNumericFieldStatistics => Set<InventoryNumericFieldStatistic>();
    public DbSet<InventoryStringFieldStatistic> InventoryStringFieldStatistics => Set<InventoryStringFieldStatistic>();
    public DbSet<InventoryApiToken> InventoryApiTokens => Set<InventoryApiToken>();

    public DbSet<Item> Items => Set<Item>();
    public DbSet<ItemCustomFieldValue> ItemCustomFieldValues => Set<ItemCustomFieldValue>();
    public DbSet<ItemLike> ItemLikes => Set<ItemLike>();
    public DbSet<SupportTicketExport> SupportTicketExports => Set<SupportTicketExport>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
