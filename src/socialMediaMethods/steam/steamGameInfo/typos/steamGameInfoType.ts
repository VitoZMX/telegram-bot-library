export interface iGameInfo {
  appid: number;
  nameGame: string;
  description?: string;
  urlImg: string;
  urlSteam: string;
  averagePlayers?: number;
  currentPlayers: number;
  grade: {
    score?: number
    url?: string
  }
  news?: {
    lastNewsTitle: string;
    lastNewsDate: string;
  }[]
}

export interface iGameData {
  success: boolean;
  data?: {
    type: string;
    name: string;
    steam_appid: number;
    required_age: number;
    is_free: boolean;
    dlc?: number[];
    detailed_description: string;
    about_the_game: string;
    short_description: string;
    supported_languages: string;
    reviews?: string;
    header_image: string;
    capsule_image?: string;
    capsule_imagev5?: string;
    website?: string;
    pc_requirements: iSystemRequirements;
    mac_requirements?: iSystemRequirements;
    linux_requirements?: iSystemRequirements;
    developers: string[];
    publishers: string[];
    packages?: number[];
    package_groups?: iPackageGroup[];
    platforms: iPlatforms;
    metacritic?: iMetacritic;
    categories: iCategory[];
    genres: iGenre[];
    screenshots: iScreenshot[];
    movies: iMovie[];
    recommendations?: iRecommendations;
    release_date: iReleaseDate;
    support_info: iSupportInfo;
    background: string;
  };
}

interface iSystemRequirements {
  minimum?: string;
  recommended?: string;
}

interface iPackageGroup {
  name: string;
  title: string;
  description: string;
  selection_text: string;
  save_text?: string;
  display_type: number;
  is_recurring_subscription: boolean;
  subs: iSubscription[];
}

interface iSubscription {
  packageid: number;
  percent_savings_text: string;
  percent_savings: number;
  option_text: string;
  option_description: string;
  can_get_free_license: boolean;
  is_free_license: boolean;
  price_in_cents_with_discount: number;
}

interface iPlatforms {
  windows: boolean;
  mac: boolean;
  linux: boolean;
}

interface iMetacritic {
  score: number;
  url: string;
}

interface iCategory {
  id: number;
  description: string;
}

interface iGenre {
  id: string;
  description: string;
}

interface iScreenshot {
  id: number;
  path_thumbnail: string;
  path_full: string;
}

interface iMovie {
  id: number;
  name: string;
  thumbnail: string;
  webm: {
    480: string;
    max: string;
  };
  mp4: {
    480: string;
    max: string;
  };
  highlight: boolean;
}

interface iRecommendations {
  total: number;
}

interface iReleaseDate {
  coming_soon: boolean;
  date: string;
}

interface iSupportInfo {
  url?: string;
  email?: string;
}