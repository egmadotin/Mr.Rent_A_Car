/**
 * Fallback vehicle image resolver for Mr Rent A Car classes.
 * Maps class names to high-resolution asset images in /legacy/vehicle-types/
 * when imageKey is null or empty.
 */

export function resolveVehicleImage(name: string, imageKey?: string | null): string {
  if (imageKey && imageKey.trim().length > 0) {
    return imageKey;
  }

  const n = name.toLowerCase();

  // Electric vehicles
  if (n.includes("model 3") || n.includes("tesla")) {
    return "/legacy/vehicle-types/vehicletypeid536tesla-model-3-2023.jpg";
  }
  if (n.includes("eqb") || n.includes("mercedes")) {
    return "/legacy/vehicle-types/vehicletypeid6592024-mercedes-eqb250.jpg";
  }

  // SUVs
  if (n.includes("compact suv") || n.includes("kona") || n.includes("kicks") || n.includes("cx-30")) {
    return "/legacy/vehicle-types/vehicletypeid467hyundai-kona-2023.jpg";
  }
  if (n.includes("midsize suv") || n.includes("rogue") || n.includes("rav4") || n.includes("cr-v") || n.includes("cx-5")) {
    return "/legacy/vehicle-types/vehicletypeid354nissan-rogue-2023.jpg";
  }
  if (n.includes("standard suv") || n.includes("cherokee") || n.includes("venza") || n.includes("blazer")) {
    return "/legacy/vehicle-types/vehicletypeid524jeep-grand-cherokee-2023.jpg";
  }
  if (n.includes("premium suv") || n.includes("suburban") || n.includes("yukon")) {
    return "/legacy/vehicle-types/vehicletypeid513chevy-suburban-2025.jpg";
  }

  // Vans and Minivans
  if (n.includes("8p") || n.includes("8-passenger") || n.includes("odyssey") || n.includes("sienna")) {
    return "/legacy/vehicle-types/vehicletypeid446honda-odyssey-2024.jpg";
  }
  if (n.includes("7p") || n.includes("7-passenger") || n.includes("grand caravan") || n.includes("minivan")) {
    return "/legacy/vehicle-types/vehicletypeid444chrysler-grand-caravan-2023.jpg";
  }
  if (n.includes("cargo") || n.includes("van")) {
    return "/legacy/vehicle-types/vehicletypeid447gmc-cargo-van-2023.jpg";
  }
  if (n.includes("truck") || n.includes("ram") || n.includes("pickup")) {
    return "/legacy/vehicle-types/vehicletypeid417ram-1500-2024.jpg";
  }

  // Sedans & Hatchbacks
  if (n.includes("economy") || n.includes("spark") || n.includes("chevy")) {
    return "/legacy/vehicle-types/vehicletypeid100chevy-spark.jpg";
  }
  if (n.includes("compact") && !n.includes("suv")) {
    return "/legacy/vehicle-types/vehicletypeid101kia-rio-2024.png";
  }
  if (n.includes("intermediate") || n.includes("forte")) {
    return "/legacy/vehicle-types/vehicletypeid102kia-forte-2024.png";
  }
  if (n.includes("full size") || n.includes("fullsize") || n.includes("camry") || n.includes("altima")) {
    return "/legacy/vehicle-types/vehicletypeid304toyota-camry-se-2024.png";
  }
  if (n.includes("standard") && !n.includes("suv")) {
    return "/legacy/vehicle-types/vehicletypeid103honda-civic-2023.jpg";
  }
  if (n.includes("mystery")) {
    return "/legacy/vehicle-types/vehicletypeid658mystery-car.jpg";
  }

  // Default fallback
  return "/legacy/vehicle-types/vehicletypeid101kia-rio-2024.png";
}
