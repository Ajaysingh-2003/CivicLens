import { useState, useEffect } from 'react';
import { api } from '../services/api';

export type LevelConfig = { level: number; title: string; min_points: number };

const fallbackLevels: LevelConfig[] = [
  { level: 1, title: 'Citizen Reporter',     min_points: 0    },
  { level: 2, title: 'Civic Observer',       min_points: 100  },
  { level: 3, title: 'Community Voice',      min_points: 300  },
  { level: 4, title: 'Neighborhood Guardian',min_points: 600  },
  { level: 5, title: 'City Watchdog',        min_points: 1000 },
  { level: 6, title: 'Civic Champion',       min_points: 1500 },
  { level: 7, title: 'Urban Protector',      min_points: 2200 },
  { level: 8, title: 'District Leader',      min_points: 3000 },
  { level: 9, title: 'City Steward',         min_points: 5000 },
  { level: 10, title: 'Civic Legend',        min_points: 8000 },
];

export function useLevels() {
  const [levelsConfig, setLevelsConfig] = useState<LevelConfig[]>(fallbackLevels);

  useEffect(() => {
    api.getLevels()
      .then((data) => {
        if (data && data.length > 0) {
            setLevelsConfig(data);
        }
      })
      .catch(() => {
        // Fallback already set
      });
  }, []);

  return levelsConfig;
}
