using backend.Infrastructure.Persistence.Configurations;
using backend.Modules.Inventories.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Modules.Inventories.Infrastructure.Persistence.Configurations;

public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> entity)
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
    }
}

public sealed class InventoryConfiguration : IEntityTypeConfiguration<Inventory>
{
    public void Configure(EntityTypeBuilder<Inventory> entity)
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
    }
}

public sealed class InventoryAccessConfiguration : IEntityTypeConfiguration<InventoryAccess>
{
    public void Configure(EntityTypeBuilder<InventoryAccess> entity)
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
    }
}

public sealed class TagConfiguration : IEntityTypeConfiguration<Tag>
{
    public void Configure(EntityTypeBuilder<Tag> entity)
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
    }
}

public sealed class InventoryTagConfiguration : IEntityTypeConfiguration<InventoryTag>
{
    public void Configure(EntityTypeBuilder<InventoryTag> entity)
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
    }
}

public sealed class CustomIdTemplateConfiguration : IEntityTypeConfiguration<CustomIdTemplate>
{
    public void Configure(EntityTypeBuilder<CustomIdTemplate> entity)
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
    }
}

public sealed class CustomIdTemplatePartConfiguration : IEntityTypeConfiguration<CustomIdTemplatePart>
{
    public void Configure(EntityTypeBuilder<CustomIdTemplatePart> entity)
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
            .HasConversion(EnumValueConverters.CustomIdPartTypeConverter)
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
    }
}

public sealed class CustomIdSequenceStateConfiguration : IEntityTypeConfiguration<CustomIdSequenceState>
{
    public void Configure(EntityTypeBuilder<CustomIdSequenceState> entity)
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
    }
}

public sealed class CustomFieldConfiguration : IEntityTypeConfiguration<CustomField>
{
    public void Configure(EntityTypeBuilder<CustomField> entity)
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
            .HasConversion(EnumValueConverters.CustomFieldTypeConverter)
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
    }
}

public sealed class DiscussionPostConfiguration : IEntityTypeConfiguration<DiscussionPost>
{
    public void Configure(EntityTypeBuilder<DiscussionPost> entity)
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
    }
}

public sealed class InventoryStatisticsConfiguration : IEntityTypeConfiguration<InventoryStatistics>
{
    public void Configure(EntityTypeBuilder<InventoryStatistics> entity)
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
    }
}

public sealed class InventoryNumericFieldStatisticConfiguration : IEntityTypeConfiguration<InventoryNumericFieldStatistic>
{
    public void Configure(EntityTypeBuilder<InventoryNumericFieldStatistic> entity)
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
    }
}

public sealed class InventoryStringFieldStatisticConfiguration : IEntityTypeConfiguration<InventoryStringFieldStatistic>
{
    public void Configure(EntityTypeBuilder<InventoryStringFieldStatistic> entity)
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
    }
}
