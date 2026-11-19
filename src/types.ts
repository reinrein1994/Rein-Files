export interface Coordinates {
  lat: string;
  lng: string;
}

export interface Place {
  id: string;
  name: string;
  url: string;
  location: string;
  coordinates: Coordinates;
  rateForTwoNights: string;
  rateNote: string;
  pax: string;
  amenities: string[];
  photos: string[];
}

export interface VoteRecord {
  name: string;
  placeId: string;
  updatedAt: string;
}

export interface VoteResults {
  counts: Record<string, number>;
  voters: Record<string, string[]>;
  total: number;
}

export interface AppData {
  title: string;
  subtitle: string;
  places: Place[];
  results: VoteResults;
}

export interface PlaceInput {
  name: string;
  url: string;
  location: string;
  coordinates: Coordinates;
  rateForTwoNights: string;
  rateNote: string;
  pax: string;
  amenities: string[];
  photos: string[];
}
