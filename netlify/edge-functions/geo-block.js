// netlify/edge-functions/geo-block.js
// Bloquea países que no están en la lista permitida de Supabase

const SUPABASE_URL = 'https://jfjzpowfgbvblhhtlcya.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impmanpwb3dmZ2J2YmxoaHRsY3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NTkxOTEsImV4cCI6MjA5ODMzNTE5MX0.m0CgHH0GGCbSSftf0h2mWl01ByOgcYHoFIyGPEPBt7M';

// Caché en memoria por instancia (dura mientras el edge worker esté activo)
let cachedCountries = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export default async (request, context) => {
  const url = new URL(request.url);

  // Nunca bloquear el panel de admin ni la página de bloqueo misma
  if (url.pathname.startsWith('/admin') || url.pathname === '/geo-blocked.html') {
    return context.next();
  }

  const country = context.geo?.country?.code || '';

  // Si no se puede determinar el país, dejar pasar (fail open)
  if (!country) return context.next();

  try {
    // Usar caché si es reciente
    if (!cachedCountries || Date.now() - cacheTime > CACHE_TTL) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/allowed_countries?enabled=eq.true&select=country_code`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const data = await res.json();
      cachedCountries = data.map(c => c.country_code);
      cacheTime = Date.now();
    }

    if (!cachedCountries.includes(country)) {
      return Response.redirect(new URL('/geo-blocked.html', request.url), 302);
    }
  } catch {
    // Si falla la consulta, dejar pasar
    return context.next();
  }

  return context.next();
};

export const config = { path: '/*' };
