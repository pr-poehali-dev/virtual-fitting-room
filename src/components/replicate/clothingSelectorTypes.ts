export interface ClothingItem {
  id: string;
  image_url: string;
  name: string;
  description: string;
  categories: string[];
  colors: string[];
  archetypes: string[];
  replicate_category?: string;
}

export interface FilterOption {
  id: number | string;
  name: string;
}

export interface Filters {
  categories: FilterOption[];
  colors: FilterOption[];
  archetypes: FilterOption[];
  genders: FilterOption[];
}

export interface SelectedClothing {
  id: string;
  image: string;
  name?: string;
  category?: string;
  isFromCatalog?: boolean;
}
