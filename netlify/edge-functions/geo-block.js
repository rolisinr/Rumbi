// netlify/edge-functions/geo-block.js
// Bloquea países que no están en la lista permitida de Supabase

const SUPABASE_URL = 'https://jfjzpowfgbvblhhtlcya.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impmanpwb3dmZ2J2YmxoaHRsY3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NTkxOTEsImV4cCI6MjA5ODMzNTE5MX0.m0CgHH0GGCbSSftf0h2mWl01ByOgcYHoFIyGPEPBt7M';

// Lista de respaldo si la DB no responde (siempre debe coincidir con allowed_countries)
const FALLBACK_COUNTRIES = ['PE', 'EC', 'CO', 'BO', 'CL'];

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
    if (!cachedCountries || Date.now() - cacheTime > CACHE_TTL) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/allowed_countries?enabled=eq.true&select=country_code`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );
      const data = await res.json();
      // Si la DB devuelve una lista válida y no vacía, usarla; si no, usar respaldo
      cachedCountries = (Array.isArray(data) && data.length > 0)
        ? data.map(c => c.country_code).filter(Boolean)
        : FALLBACK_COUNTRIES;
      cacheTime = Date.now();
    }

    if (!cachedCountries.includes(country)) {
      return Response.redirect(new URL('/geo-blocked.html', request.url), 302);
    }
  } catch {
    // Si falla cualquier cosa, usar la lista de respaldo en vez de bloquear a todos
    const fallback = FALLBACK_COUNTRIES;
    if (!fallback.includes(country)) {
      return Response.redirect(new URL('/geo-blocked.html', request.url), 302);
    }
  }

  return context.next();
};

export const config = { path: '/*' };
