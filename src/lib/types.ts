export interface Entry {
  id: string;
  user_id: string;
  content: string | null;
  audio_url: string | null;
  latitude: number | null;
  longitude: number | null;
  weather: string | null;
  time_of_day: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  photos?: EntryPhoto[];
  links?: EntryLink[];
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface EntryLink {
  id: string;
  entry_id: string;
  url: string;
  title: string | null;
  created_at: string;
}

export interface EntryPhoto {
  id: string;
  entry_id: string;
  storage_path: string;
  created_at: string;
}