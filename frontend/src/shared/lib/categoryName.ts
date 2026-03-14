const categoryNameTranslations: Readonly<Record<string, string>> = {
  book: 'Книги',
  equipment: 'Оборудование',
  furniture: 'Мебель',
  other: 'Другое',
}

export function toLocalizedCategoryName(name: string): string {
  const normalizedName = name.trim()
  if (normalizedName.length === 0) {
    return normalizedName
  }

  const translatedName = categoryNameTranslations[normalizedName.toLowerCase()]
  return translatedName ?? normalizedName
}
