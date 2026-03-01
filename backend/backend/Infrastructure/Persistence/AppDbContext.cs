using backend.Modules.Inventories.Domain;
using backend.Modules.Items.Domain;
using backend.Modules.Users.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace backend.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    private static readonly ValueConverter<CustomFieldType, string> CustomFieldTypeConverter = new(
        value => ToCustomFieldTypeValue(value),
        value => FromCustomFieldTypeValue(value));

    private static readonly ValueConverter<CustomIdPartType, string> CustomIdPartTypeConverter = new(
        value => ToCustomIdPartTypeValue(value),
        value => FromCustomIdPartTypeValue(value));

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

    public DbSet<Item> Items => Set<Item>();
    public DbSet<ItemCustomFieldValue> ItemCustomFieldValues => Set<ItemCustomFieldValue>();
    public DbSet<ItemLike> ItemLikes => Set<ItemLike>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ConfigureUsers(modelBuilder);
        ConfigureRoles(modelBuilder);
        ConfigureUserRoles(modelBuilder);
        ConfigureExternalAuthAccounts(modelBuilder);

        ConfigureCategories(modelBuilder);
        ConfigureInventories(modelBuilder);
        ConfigureInventoryAccess(modelBuilder);
        ConfigureTags(modelBuilder);
        ConfigureInventoryTags(modelBuilder);
        ConfigureCustomIdTemplates(modelBuilder);
        ConfigureCustomIdTemplateParts(modelBuilder);
        ConfigureCustomIdSequenceState(modelBuilder);
        ConfigureCustomFields(modelBuilder);
        ConfigureDiscussionPosts(modelBuilder);
        ConfigureInventoryStatistics(modelBuilder);
        ConfigureInventoryNumericFieldStatistics(modelBuilder);
        ConfigureInventoryStringFieldStatistics(modelBuilder);

        ConfigureItems(modelBuilder);
        ConfigureItemCustomFieldValues(modelBuilder);
        ConfigureItemLikes(modelBuilder);
    }

    private static void ConfigureUsers(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Email)
                .HasColumnName("email")
                .HasMaxLength(320)
                .IsRequired();

            entity.Property(x => x.NormalizedEmail)
                .HasColumnName("normalized_email")
                .HasMaxLength(320)
                .IsRequired();

            entity.Property(x => x.UserName)
                .HasColumnName("user_name")
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.DisplayName)
                .HasColumnName("display_name")
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.IsBlocked)
                .HasColumnName("is_blocked")
                .IsRequired();

            entity.Property(x => x.PreferredLanguage)
                .HasColumnName("preferred_language")
                .HasMaxLength(10)
                .IsRequired();

            entity.Property(x => x.PreferredTheme)
                .HasColumnName("preferred_theme")
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.HasIndex(x => x.Email)
                .IsUnique();

            entity.HasIndex(x => x.NormalizedEmail)
                .IsUnique();

            entity.HasIndex(x => x.UserName)
                .IsUnique();
        });
    }

    private static void ConfigureRoles(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("roles");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Name)
                .HasColumnName("name")
                .HasMaxLength(50)
                .IsRequired();

            entity.HasIndex(x => x.Name)
                .IsUnique();

            entity.HasData(
                new Role { Id = 1, Name = "user" },
                new Role { Id = 2, Name = "admin" }
            );
        });
    }

    private static void ConfigureUserRoles(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.ToTable("user_roles");
            entity.HasKey(x => new { x.UserId, x.RoleId });

            entity.Property(x => x.UserId)
                .HasColumnName("user_id");

            entity.Property(x => x.RoleId)
                .HasColumnName("role_id");

            entity.HasOne(x => x.User)
                .WithMany(x => x.UserRoles)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Role)
                .WithMany(x => x.UserRoles)
                .HasForeignKey(x => x.RoleId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureExternalAuthAccounts(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ExternalAuthAccount>(entity =>
        {
            entity.ToTable("external_auth_accounts");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd();

            entity.Property(x => x.UserId)
                .HasColumnName("user_id");

            entity.Property(x => x.Provider)
                .HasColumnName("provider")
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.ProviderUserId)
                .HasColumnName("provider_user_id")
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.HasOne(x => x.User)
                .WithMany(x => x.ExternalAuthAccounts)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.Provider, x.ProviderUserId })
                .IsUnique();
        });
    }

    private static void ConfigureCategories(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("categories");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Name)
                .HasColumnName("name")
                .HasMaxLength(100)
                .IsRequired();

            entity.HasIndex(x => x.Name)
                .IsUnique();

            entity.HasData(
                new Category { Id = 1, Name = "Equipment" },
                new Category { Id = 2, Name = "Furniture" },
                new Category { Id = 3, Name = "Book" },
                new Category { Id = 4, Name = "Other" }
            );
        });
    }

    private static void ConfigureInventories(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Inventory>(entity =>
        {
            entity.ToTable("inventories");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd();

            entity.Property(x => x.CreatorId)
                .HasColumnName("creator_id")
                .IsRequired();

            entity.Property(x => x.CategoryId)
                .HasColumnName("category_id")
                .IsRequired();

            entity.Property(x => x.Title)
                .HasColumnName("title")
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.DescriptionMarkdown)
                .HasColumnName("description_markdown")
                .HasMaxLength(10000)
                .IsRequired();

            entity.Property(x => x.ImageUrl)
                .HasColumnName("image_url")
                .HasMaxLength(2048);

            entity.Property(x => x.IsPublic)
                .HasColumnName("is_public")
                .IsRequired();

            entity.Property(x => x.Version)
                .HasColumnName("version")
                .IsConcurrencyToken()
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.ToTable(t => t.HasCheckConstraint("ck_inventories_version_positive", "version > 0"));

            entity.HasOne(x => x.Creator)
                .WithMany()
                .HasForeignKey(x => x.CreatorId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Category)
                .WithMany(x => x.Inventories)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => x.CreatorId);
            entity.HasIndex(x => x.CategoryId);
        });
    }

    private static void ConfigureInventoryAccess(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<InventoryAccess>(entity =>
        {
            entity.ToTable("inventory_access");
            entity.HasKey(x => new { x.InventoryId, x.UserId });

            entity.Property(x => x.InventoryId)
                .HasColumnName("inventory_id");

            entity.Property(x => x.UserId)
                .HasColumnName("user_id");

            entity.Property(x => x.GrantedByUserId)
                .HasColumnName("granted_by_user_id");

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.HasOne(x => x.Inventory)
                .WithMany(x => x.AccessList)
                .HasForeignKey(x => x.InventoryId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.GrantedByUser)
                .WithMany()
                .HasForeignKey(x => x.GrantedByUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureTags(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Tag>(entity =>
        {
            entity.ToTable("tags");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd();

            entity.Property(x => x.Name)
                .HasColumnName("name")
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.NormalizedName)
                .HasColumnName("normalized_name")
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.HasIndex(x => x.NormalizedName)
                .IsUnique();
        });
    }

    private static void ConfigureInventoryTags(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<InventoryTag>(entity =>
        {
            entity.ToTable("inventory_tags");
            entity.HasKey(x => new { x.InventoryId, x.TagId });

            entity.Property(x => x.InventoryId)
                .HasColumnName("inventory_id");

            entity.Property(x => x.TagId)
                .HasColumnName("tag_id");

            entity.HasOne(x => x.Inventory)
                .WithMany(x => x.InventoryTags)
                .HasForeignKey(x => x.InventoryId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Tag)
                .WithMany(x => x.InventoryTags)
                .HasForeignKey(x => x.TagId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureCustomIdTemplates(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CustomIdTemplate>(entity =>
        {
            entity.ToTable("custom_id_templates");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd();

            entity.Property(x => x.InventoryId)
                .HasColumnName("inventory_id")
                .IsRequired();

            entity.Property(x => x.IsEnabled)
                .HasColumnName("is_enabled")
                .IsRequired();

            entity.Property(x => x.ValidationRegex)
                .HasColumnName("validation_regex")
                .HasMaxLength(2000);

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.HasIndex(x => x.InventoryId)
                .IsUnique();

            entity.HasOne(x => x.Inventory)
                .WithOne(x => x.CustomIdTemplate)
                .HasForeignKey<CustomIdTemplate>(x => x.InventoryId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureCustomIdTemplateParts(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CustomIdTemplatePart>(entity =>
        {
            entity.ToTable("custom_id_template_parts");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd();

            entity.Property(x => x.TemplateId)
                .HasColumnName("template_id")
                .IsRequired();

            entity.Property(x => x.SortOrder)
                .HasColumnName("sort_order")
                .IsRequired();

            entity.Property(x => x.PartType)
                .HasColumnName("part_type")
                .HasConversion(CustomIdPartTypeConverter)
                .HasMaxLength(40)
                .IsRequired();

            entity.Property(x => x.FixedText)
                .HasColumnName("fixed_text")
                .HasMaxLength(500);

            entity.Property(x => x.FormatPattern)
                .HasColumnName("format_pattern")
                .HasMaxLength(200);

            entity.HasOne(x => x.Template)
                .WithMany(x => x.Parts)
                .HasForeignKey(x => x.TemplateId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.TemplateId, x.SortOrder })
                .IsUnique();

            entity.ToTable(t => t.HasCheckConstraint(
                "ck_custom_id_template_parts_part_type",
                "part_type in ('fixed_text','random_20_bit','random_32_bit','random_6_digit','random_9_digit','guid','datetime','sequence')"));
        });
    }

    private static void ConfigureCustomIdSequenceState(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CustomIdSequenceState>(entity =>
        {
            entity.ToTable("custom_id_sequence_state");
            entity.HasKey(x => x.InventoryId);

            entity.Property(x => x.InventoryId)
                .HasColumnName("inventory_id");

            entity.Property(x => x.LastValue)
                .HasColumnName("last_value")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.HasOne(x => x.Inventory)
                .WithOne(x => x.CustomIdSequenceState)
                .HasForeignKey<CustomIdSequenceState>(x => x.InventoryId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureCustomFields(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CustomField>(entity =>
        {
            entity.ToTable("custom_fields");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd();

            entity.Property(x => x.InventoryId)
                .HasColumnName("inventory_id")
                .IsRequired();

            entity.Property(x => x.FieldType)
                .HasColumnName("field_type")
                .HasConversion(CustomFieldTypeConverter)
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(x => x.SlotNo)
                .HasColumnName("slot_no")
                .IsRequired();

            entity.Property(x => x.Title)
                .HasColumnName("title")
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasColumnName("description")
                .HasMaxLength(2000)
                .IsRequired();

            entity.Property(x => x.ShowInTable)
                .HasColumnName("show_in_table")
                .IsRequired();

            entity.Property(x => x.SortOrder)
                .HasColumnName("sort_order")
                .IsRequired();

            entity.Property(x => x.IsEnabled)
                .HasColumnName("is_enabled")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.HasOne(x => x.Inventory)
                .WithMany(x => x.CustomFields)
                .HasForeignKey(x => x.InventoryId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.InventoryId, x.FieldType, x.SlotNo })
                .IsUnique();

            entity.ToTable(t => t.HasCheckConstraint("ck_custom_fields_slot_no", "slot_no between 1 and 3"));
            entity.ToTable(t => t.HasCheckConstraint(
                "ck_custom_fields_field_type",
                "field_type in ('single_line','multi_line','number','link','bool')"));
        });
    }

    private static void ConfigureItems(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Item>(entity =>
        {
            entity.ToTable("items");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd();

            entity.Property(x => x.InventoryId)
                .HasColumnName("inventory_id")
                .IsRequired();

            entity.Property(x => x.CustomId)
                .HasColumnName("custom_id")
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(x => x.CreatedByUserId)
                .HasColumnName("created_by_user_id");

            entity.Property(x => x.UpdatedByUserId)
                .HasColumnName("updated_by_user_id");

            entity.Property(x => x.Version)
                .HasColumnName("version")
                .IsConcurrencyToken()
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.HasOne(x => x.Inventory)
                .WithMany(x => x.Items)
                .HasForeignKey(x => x.InventoryId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.CreatedByUser)
                .WithMany()
                .HasForeignKey(x => x.CreatedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(x => x.UpdatedByUser)
                .WithMany()
                .HasForeignKey(x => x.UpdatedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(x => new { x.InventoryId, x.CustomId })
                .IsUnique();

            entity.HasIndex(x => new { x.InventoryId, x.CreatedAt })
                .IsDescending(false, true);

            entity.ToTable(t => t.HasCheckConstraint("ck_items_version_positive", "version > 0"));
        });
    }

    private static void ConfigureItemCustomFieldValues(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ItemCustomFieldValue>(entity =>
        {
            entity.ToTable("item_custom_field_values");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd();

            entity.Property(x => x.ItemId)
                .HasColumnName("item_id")
                .IsRequired();

            entity.Property(x => x.CustomFieldId)
                .HasColumnName("custom_field_id")
                .IsRequired();

            entity.Property(x => x.StringValue)
                .HasColumnName("string_value")
                .HasMaxLength(1000);

            entity.Property(x => x.TextValue)
                .HasColumnName("text_value")
                .HasMaxLength(10000);

            entity.Property(x => x.NumberValue)
                .HasColumnName("number_value")
                .HasPrecision(18, 4);

            entity.Property(x => x.LinkValue)
                .HasColumnName("link_value")
                .HasMaxLength(2048);

            entity.Property(x => x.BoolValue)
                .HasColumnName("bool_value");

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.HasOne(x => x.Item)
                .WithMany(x => x.CustomFieldValues)
                .HasForeignKey(x => x.ItemId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.CustomField)
                .WithMany(x => x.Values)
                .HasForeignKey(x => x.CustomFieldId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.ItemId, x.CustomFieldId })
                .IsUnique();
        });
    }

    private static void ConfigureDiscussionPosts(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DiscussionPost>(entity =>
        {
            entity.ToTable("discussion_posts");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd();

            entity.Property(x => x.InventoryId)
                .HasColumnName("inventory_id")
                .IsRequired();

            entity.Property(x => x.AuthorUserId)
                .HasColumnName("author_user_id")
                .IsRequired();

            entity.Property(x => x.ContentMarkdown)
                .HasColumnName("content_markdown")
                .HasMaxLength(10000)
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.HasOne(x => x.Inventory)
                .WithMany(x => x.DiscussionPosts)
                .HasForeignKey(x => x.InventoryId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.AuthorUser)
                .WithMany()
                .HasForeignKey(x => x.AuthorUserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.InventoryId, x.Id });
        });
    }

    private static void ConfigureItemLikes(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ItemLike>(entity =>
        {
            entity.ToTable("item_likes");
            entity.HasKey(x => new { x.ItemId, x.UserId });

            entity.Property(x => x.ItemId)
                .HasColumnName("item_id");

            entity.Property(x => x.UserId)
                .HasColumnName("user_id");

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.HasOne(x => x.Item)
                .WithMany(x => x.Likes)
                .HasForeignKey(x => x.ItemId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureInventoryStatistics(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<InventoryStatistics>(entity =>
        {
            entity.ToTable("inventory_statistics");
            entity.HasKey(x => x.InventoryId);

            entity.Property(x => x.InventoryId)
                .HasColumnName("inventory_id");

            entity.Property(x => x.ItemsCount)
                .HasColumnName("items_count")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.HasOne(x => x.Inventory)
                .WithOne(x => x.Statistics)
                .HasForeignKey<InventoryStatistics>(x => x.InventoryId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureInventoryNumericFieldStatistics(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<InventoryNumericFieldStatistic>(entity =>
        {
            entity.ToTable("inventory_numeric_field_statistics");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd();

            entity.Property(x => x.InventoryId)
                .HasColumnName("inventory_id")
                .IsRequired();

            entity.Property(x => x.CustomFieldId)
                .HasColumnName("custom_field_id")
                .IsRequired();

            entity.Property(x => x.MinValue)
                .HasColumnName("min_value")
                .HasPrecision(18, 4);

            entity.Property(x => x.MaxValue)
                .HasColumnName("max_value")
                .HasPrecision(18, 4);

            entity.Property(x => x.AvgValue)
                .HasColumnName("avg_value")
                .HasPrecision(18, 4);

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.HasOne(x => x.Inventory)
                .WithMany(x => x.NumericFieldStatistics)
                .HasForeignKey(x => x.InventoryId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.CustomField)
                .WithMany(x => x.NumericStatistics)
                .HasForeignKey(x => x.CustomFieldId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.InventoryId, x.CustomFieldId })
                .IsUnique();
        });
    }

    private static void ConfigureInventoryStringFieldStatistics(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<InventoryStringFieldStatistic>(entity =>
        {
            entity.ToTable("inventory_string_field_statistics");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd();

            entity.Property(x => x.InventoryId)
                .HasColumnName("inventory_id")
                .IsRequired();

            entity.Property(x => x.CustomFieldId)
                .HasColumnName("custom_field_id")
                .IsRequired();

            entity.Property(x => x.MostFrequentValue)
                .HasColumnName("most_frequent_value")
                .HasMaxLength(1000);

            entity.Property(x => x.MostFrequentCount)
                .HasColumnName("most_frequent_count")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.HasOne(x => x.Inventory)
                .WithMany(x => x.StringFieldStatistics)
                .HasForeignKey(x => x.InventoryId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.CustomField)
                .WithMany(x => x.StringStatistics)
                .HasForeignKey(x => x.CustomFieldId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => new { x.InventoryId, x.CustomFieldId })
                .IsUnique();
        });
    }

    private static string ToCustomFieldTypeValue(CustomFieldType value)
    {
        return value switch
        {
            CustomFieldType.SingleLine => "single_line",
            CustomFieldType.MultiLine => "multi_line",
            CustomFieldType.Number => "number",
            CustomFieldType.Link => "link",
            CustomFieldType.Bool => "bool",
            _ => throw new ArgumentOutOfRangeException(nameof(value), value, null)
        };
    }

    private static CustomFieldType FromCustomFieldTypeValue(string value)
    {
        return value switch
        {
            "single_line" => CustomFieldType.SingleLine,
            "multi_line" => CustomFieldType.MultiLine,
            "number" => CustomFieldType.Number,
            "link" => CustomFieldType.Link,
            "bool" => CustomFieldType.Bool,
            _ => throw new ArgumentOutOfRangeException(nameof(value), value, null)
        };
    }

    private static string ToCustomIdPartTypeValue(CustomIdPartType value)
    {
        return value switch
        {
            CustomIdPartType.FixedText => "fixed_text",
            CustomIdPartType.Random20Bit => "random_20_bit",
            CustomIdPartType.Random32Bit => "random_32_bit",
            CustomIdPartType.Random6Digit => "random_6_digit",
            CustomIdPartType.Random9Digit => "random_9_digit",
            CustomIdPartType.Guid => "guid",
            CustomIdPartType.DateTime => "datetime",
            CustomIdPartType.Sequence => "sequence",
            _ => throw new ArgumentOutOfRangeException(nameof(value), value, null)
        };
    }

    private static CustomIdPartType FromCustomIdPartTypeValue(string value)
    {
        return value switch
        {
            "fixed_text" => CustomIdPartType.FixedText,
            "random_20_bit" => CustomIdPartType.Random20Bit,
            "random_32_bit" => CustomIdPartType.Random32Bit,
            "random_6_digit" => CustomIdPartType.Random6Digit,
            "random_9_digit" => CustomIdPartType.Random9Digit,
            "guid" => CustomIdPartType.Guid,
            "datetime" => CustomIdPartType.DateTime,
            "sequence" => CustomIdPartType.Sequence,
            _ => throw new ArgumentOutOfRangeException(nameof(value), value, null)
        };
    }
}
