using backend.Modules.Items.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Modules.Items.Infrastructure.Persistence.Configurations;

public sealed class ItemConfiguration : IEntityTypeConfiguration<Item>
{
    public void Configure(EntityTypeBuilder<Item> entity)
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
    }
}

public sealed class ItemCustomFieldValueConfiguration : IEntityTypeConfiguration<ItemCustomFieldValue>
{
    public void Configure(EntityTypeBuilder<ItemCustomFieldValue> entity)
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
    }
}

public sealed class ItemLikeConfiguration : IEntityTypeConfiguration<ItemLike>
{
    public void Configure(EntityTypeBuilder<ItemLike> entity)
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
    }
}
