export interface Lake {
  id: string;
  name: string;
  nameDe?: string;
  lat: number;
  lon: number;
  areaKm2: number | null;
  elevationM: number | null;
  avgSummerTempC: number | null;
  imageUrl?: string;
}

export interface CompletedSwim {
  lakeId: string;
  date: string;
  notes?: string;
}

export interface UserState {
  selectedLakeIds: string[];
  completedSwims: CompletedSwim[];
  goalCount: number;
  goalDeadline: string;
}
