/** lib/octa/secoes/registro.tsx — tipo da seção → componente (o `COMPONENT_REGISTRY` do RenderEngine do sitecrm). */
import type { ReactElement } from "react";
import type { PropsSecao, TipoSecao } from "./tipos";
import { Hero, HeroModern, HeroVisual, HeroSplit, HeroSaaS, HeroMinimal, HeroLead, HeroVideo, HeroDiagonal } from "./hero/hero";
import { FeaturesGrid, FeaturesList, FeaturesCards, FeaturesDark, FeaturesBento, FeaturesMinimal, FeaturesSteps, FeaturesMosaic, FeaturesHighlight, FeaturesGlass } from "./features/features";
import { AboutClassic, AboutMinimal, AboutProfile, AboutStats, AboutImageGrid } from "./about/about";
import { ReviewsGrid, ReviewsMinimal, ReviewsDark, ReviewsSpotlight, ReviewsMasonry } from "./reviews/reviews";
import { LocationSimple, LocationFloat, LocationVisual, LocationGrid, LocationDark } from "./location/location";
import { CtaCentric, CtaImage, CtaMinimal, CtaWhatsApp, CtaGradient } from "./cta/cta";

export const REGISTRO: Record<TipoSecao, (p: PropsSecao) => ReactElement> = {
  hero: Hero, hero_modern: HeroModern, hero_visual: HeroVisual, hero_split: HeroSplit, hero_saas: HeroSaaS,
  hero_minimal: HeroMinimal, hero_lead: HeroLead, hero_video: HeroVideo, hero_diagonal: HeroDiagonal,
  features: FeaturesGrid, features_list: FeaturesList, features_cards: FeaturesCards, features_dark: FeaturesDark,
  features_bento: FeaturesBento, features_minimal: FeaturesMinimal, features_steps: FeaturesSteps,
  features_mosaic: FeaturesMosaic, features_highlight: FeaturesHighlight, features_glass: FeaturesGlass,
  about: AboutClassic, about_minimal: AboutMinimal, about_profile: AboutProfile, about_stats: AboutStats, about_grid: AboutImageGrid,
  reviews: ReviewsGrid, reviews_minimal: ReviewsMinimal, reviews_dark: ReviewsDark, reviews_spotlight: ReviewsSpotlight, reviews_masonry: ReviewsMasonry,
  location: LocationSimple, location_float: LocationFloat, location_visual: LocationVisual, location_grid: LocationGrid, location_dark: LocationDark,
  cta: CtaCentric, cta_image: CtaImage, cta_minimal: CtaMinimal, cta_whatsapp: CtaWhatsApp, cta_gradient: CtaGradient,
};
