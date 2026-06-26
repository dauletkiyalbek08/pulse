/** Расстояние между двумя точками на Земле в метрах (формула гаверсинуса). */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // радиус Земли, м
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Округление метров для показа: «12 м», «1.3 км». */
export function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace(".", ",")} км`;
  return `${Math.round(m)} м`;
}
