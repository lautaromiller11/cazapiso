import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";

// SSRF protection: block private/internal IPs
function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Block non-http(s)
    if (!["http:", "https:"].includes(url.protocol)) return true;

    // Block localhost variants
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname === "::1"
    )
      return true;

    // Block private IP ranges
    const parts = hostname.split(".");
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      const [a, b] = parts.map(Number);
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
      if (a === 0) return true;
    }

    // Block .local and .internal
    if (hostname.endsWith(".local") || hostname.endsWith(".internal"))
      return true;

    return false;
  } catch {
    return true;
  }
}

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

const MAX_HTML_BYTES = 5 * 1024 * 1024;

async function readLimitedHtml(response: Response, signal: AbortSignal): Promise<string> {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_HTML_BYTES) throw new Error("PAGE_TOO_LARGE");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      if (signal.aborted) throw new Error("FETCH_TIMEOUT");
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_HTML_BYTES) {
        await reader.cancel();
        throw new Error("PAGE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchFromScrapingBee(url: string): Promise<string | null> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) return null;
  const endpoint = new URL("https://app.scrapingbee.com/api/v1/");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("render_js", "true");
  endpoint.searchParams.set("block_resources", "false");
  endpoint.searchParams.set("wait_browser", "domcontentloaded");
  if (process.env.SCRAPINGBEE_PREMIUM_PROXY === "true") {
    endpoint.searchParams.set("premium_proxy", "true");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "text/html" },
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`[extract] ScrapingBee returned HTTP ${response.status}`);
      return null;
    }
    return await readLimitedHtml(response, controller.signal);
  } catch (error) {
    if (error instanceof Error && error.message === "PAGE_TOO_LARGE") throw error;
    console.warn(
      `[extract] ScrapingBee request failed: ${error instanceof Error ? error.name : "unknown error"}`
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function looksBlocked(html: string): boolean {
  return /captcha|access denied|checking your browser|verify you are human|unusual traffic|robot or human/i.test(html);
}

function extractPrice(text: string): number | null {
  if (!text) return null;

  // Match common European price formats: 1.200€, 1.200 €, 1200€, €1200, 1,200€
  // Also match: 1.200 €/mes, 1200 EUR
  const patterns = [
    /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*€/,
    /€\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/,
    /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*€/,
    /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*(?:EUR|eur)/,
    /(\d{1,3}(?:,\d{3})*)\s*€/,
    /(\d+(?:\.\d{3})*)\s*€\s*\/\s*mes/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      // Handle European format: dots as thousands, comma as decimal
      let numStr = match[1];
      if (numStr.includes(".") && numStr.includes(",")) {
        numStr = numStr.replace(/\./g, "").replace(",", ".");
      } else if (numStr.includes(".") && numStr.split(".").pop()!.length === 3) {
        // 1.200 -> thousands separator
        numStr = numStr.replace(/\./g, "");
      } else if (numStr.includes(",")) {
        numStr = numStr.replace(",", ".");
      }
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 50 && num < 100000) {
        return num;
      }
    }
  }

  return null;
}

function extractJsonLd($: cheerio.CheerioAPI): {
  title?: string;
  price?: number;
  description?: string;
  image?: string;
  features: Record<string, string | number | boolean | string[]>;
} {
  const result: { title?: string; price?: number; description?: string; image?: string; features: Record<string, string | number | boolean | string[]> } = { features: {} };

  const readMeasurement = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (value && typeof value === "object" && "value" in value) {
      const number = Number((value as { value?: unknown }).value);
      return Number.isFinite(number) ? number : undefined;
    }
    return undefined;
  };
  const readAddress = (value: unknown): string | undefined => {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return undefined;
    const address = value as Record<string, unknown>;
    return [address.streetAddress, address.addressLocality, address.addressRegion]
      .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
      .join(", ") || undefined;
  };
  const normalizeLabel = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[²₂]/g, "2").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const aliases: Record<string, string> = {
    "superficie construida": "constructed_area_m2", "built area": "constructed_area_m2", "constructed area": "constructed_area_m2",
    "superficie util": "usable_area_m2", "useful area": "usable_area_m2", "living area": "usable_area_m2",
    "superficie": "area_m2", "surface area": "area_m2", "floor size": "area_m2",
    "habitaciones": "bedrooms", "dormitorios": "bedrooms", bedrooms: "bedrooms", rooms: "rooms", "numero de habitaciones": "bedrooms",
    "banos": "bathrooms", bathrooms: "bathrooms", "numero de banos": "bathrooms",
    balcon: "balcony", balcony: "balcony", terraza: "terrace", terrace: "terrace",
    "garaje incluido": "garage_included", "plaza de garaje incluida": "garage_included", "parking included": "garage_included",
    "estado del inmueble": "property_condition", "property condition": "property_condition", "home condition": "property_condition",
    orientacion: "orientation", orientation: "orientation", "ano de construccion": "year_built", "year built": "year_built", "construction year": "year_built",
    amueblado: "furnished", furnished: "furnished", "cocina equipada": "kitchen_equipped", "equipped kitchen": "kitchen_equipped",
    planta: "floor", floor: "floor", "planta del inmueble": "floor", exterior: "exterior", interior: "exterior",
    ascensor: "elevator", elevator: "elevator", lift: "elevator", "detalles del edificio": "building_details", "building details": "building_details",
    "aire acondicionado": "air_conditioning", "air conditioning": "air_conditioning", calefaccion: "heating", heating: "heating",
    "otro equipamiento": "climate_other", "other equipment": "climate_other",
    "calificacion energetica consumo": "energy_consumption_rating", "energy consumption rating": "energy_consumption_rating",
    "consumo energetico": "energy_consumption_kwh_m2_year", "energy consumption": "energy_consumption_kwh_m2_year",
    "calificacion energetica emisiones": "energy_emissions_rating", "energy emissions rating": "energy_emissions_rating",
    emisiones: "energy_emissions_kg_m2_year", "emisiones co2": "energy_emissions_kg_m2_year", "co2 emissions": "energy_emissions_kg_m2_year",
    "etiqueta energetica": "energy_label_url", "energy label": "energy_label_url", "certificado energetico": "energy_certificate_details",
  };
  const assignLabeledFeature = (name: string, rawValue: unknown) => {
    const normalizedName = normalizeLabel(name);
    const matchingAlias = Object.keys(aliases).sort((a, b) => b.length - a.length).find((alias) => normalizedName.startsWith(`${alias} `));
    const key = aliases[normalizedName] || (matchingAlias ? aliases[matchingAlias] : undefined);
    let value = rawValue;
    let unit = "";
    if (value && typeof value === "object") {
      const data = value as Record<string, unknown>;
      unit = typeof data.unitText === "string" ? data.unitText : data.unitCode === "MTK" ? "m²" : typeof data.unitCode === "string" ? data.unitCode : "";
      value = data.value;
    }
    const raw = typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? `${value}${unit ? ` ${unit}` : ""}`.trim() : "";
    if (!raw) return;
    const rawDetails = (result.features.raw_details as string[] | undefined) || [];
    result.features.raw_details = [...rawDetails, `${name}: ${raw}`].slice(0, 60);
    if (!key) return;
    const booleanValue = /^(s[ií]|yes|true|1|disponible)$/i.test(raw) ? true : /^(no|false|0|no disponible)$/i.test(raw) ? false : undefined;
    const numberMatch = raw.match(/^\s*(\d+(?:[.,]\d+)?)\s*(.*)\s*$/);
    const number = numberMatch ? Number(numberMatch[1].replace(",", ".")) : NaN;
    if (["constructed_area_m2", "usable_area_m2", "area_m2"].includes(key)) {
      if (Number.isFinite(number) && /^(?:m²|m2|metros cuadrados|sqm)$/i.test(numberMatch?.[2]?.trim() || "")) result.features[key] = number;
    } else if (key === "energy_consumption_kwh_m2_year") {
      if (Number.isFinite(number) && /kwh\s*\/\s*m[²2]\s*(?:[·/]\s*(?:año|year|yr))?/i.test(numberMatch?.[2] || "")) result.features[key] = number;
    } else if (key === "energy_emissions_kg_m2_year") {
      if (Number.isFinite(number) && /kg\s*(?:co2|co₂)\s*\/\s*m[²2]/i.test(numberMatch?.[2] || "")) result.features[key] = number;
    } else if (["bedrooms", "rooms", "bathrooms"].includes(key)) {
      const countMatch = raw.match(/^\s*(\d+)(?:\s+(?:habitaciones?|dormitorios?|rooms?))?\s*$/i);
      if (countMatch) result.features[key] = Number(countMatch[1]);
    } else if (key === "year_built") {
      if (/^(?:17|18|19|20)\d{2}$/.test(raw)) result.features[key] = Number(raw);
    } else if (["balcony", "terrace", "garage_included", "furnished", "kitchen_equipped", "exterior", "elevator", "air_conditioning"].includes(key)) {
      if (booleanValue !== undefined) result.features[key] = key === "exterior" && normalizeLabel(name) === "interior" ? !booleanValue : booleanValue;
    } else if (key === "energy_label_url") {
      try { if (["http:", "https:"].includes(new URL(raw).protocol)) result.features[key] = raw; } catch { /* Keep only a valid label URL. */ }
    } else {
      result.features[key] = raw;
    }
  };

  const bulletFeatures: Record<string, string | number | boolean> = {};
  const bulletRawDetails: string[] = [];
  const saveBulletFeature = (key: string, value: string | number | boolean) => {
    if (bulletFeatures[key] === undefined) bulletFeatures[key] = value;
  };
  const readEnergyGrade = (element: Element) => {
    const candidates = [element, ...$(element).find("[class], [data-rating], [data-value]").toArray()];
    for (const candidate of candidates) {
      const node = $(candidate);
      const className = typeof node.attr("class") === "string" ? node.attr("class")! : "";
      const metadata = [className, node.attr("aria-label"), node.attr("title"), node.attr("data-rating"), node.attr("data-value")].filter(Boolean).join(" ");
      const grade = metadata.match(/(?:icon-)?energy-([a-g])-(?:certification|certificate)|energy-rating-([a-g])/i);
      if (grade) return (grade[1] || grade[2]).toUpperCase();
    }
    return undefined;
  };
  const parseListingBullet = (label: string, section: "basic" | "building" | "equipment" | "energy") => {
    const normalized = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[²₂]/g, "2").toLowerCase().replace(/[^a-z0-9.,]+/g, " ").trim();
    const addRaw = () => {
      if (!bulletRawDetails.includes(label)) bulletRawDetails.push(label);
    };
    const area = normalized.match(/^(\d+(?:[.,]\d+)?)\s*m\s*(?:2|²)\s*(construidos?|utiles?)$/);
    if (area) {
      const key = area[2].startsWith("construid") ? "constructed_area_m2" : "usable_area_m2";
      saveBulletFeature(key, Number(area[1].replace(",", ".")));
      addRaw();
      return;
    }
    const count = normalized.match(/^(\d+)\s+(habitaciones?|dormitorios?|banos?)$/);
    if (count) {
      saveBulletFeature(count[2].startsWith("bano") ? "bathrooms" : "bedrooms", Number(count[1]));
      addRaw();
      return;
    }
    const floor = label.match(/^\s*(bajo|entresuelo|(?:\d{1,2}\s*(?:[.ªº°]{1,2}\s*)?(?:planta|piso)))(?:\s+(exterior|interior))?\s*$/i);
    if (floor && section === "building") {
      saveBulletFeature("floor", floor[1].trim());
      if (floor[2]) saveBulletFeature("exterior", normalizeLabel(floor[2]) === "exterior");
      addRaw();
      return;
    }
    if (/^(?:sin ascensor|no tiene ascensor)$/i.test(normalized)) {
      saveBulletFeature("elevator", false);
      addRaw();
      return;
    }
    if (/^(?:con ascensor|ascensor)$/i.test(normalized)) {
      saveBulletFeature("elevator", true);
      addRaw();
      return;
    }
    if (/^(?:exterior|interior)$/i.test(normalized) && section === "building") {
      saveBulletFeature("exterior", normalized === "exterior");
      addRaw();
      return;
    }
    if (/^(?:amueblado|amueblada|amueblado y cocina equipada|amueblada y cocina equipada)$/i.test(normalized)) {
      saveBulletFeature("furnished", true);
      if (normalized.includes("cocina equipada")) saveBulletFeature("kitchen_equipped", true);
      addRaw();
      return;
    }
    if (/^cocina equipada$/i.test(normalized)) {
      saveBulletFeature("kitchen_equipped", true);
      addRaw();
      return;
    }
    if (/^aire acondicionado$/i.test(normalized) && section === "equipment") {
      saveBulletFeature("air_conditioning", true);
      addRaw();
      return;
    }
    if (/^orientacion\s+/.test(normalized)) {
      saveBulletFeature("orientation", label.replace(/^\s*orientaci[oó]n\s*/i, "").trim());
      addRaw();
      return;
    }
    if (/^construido\s+en\s+\d{4}$/.test(normalized)) {
      saveBulletFeature("year_built", Number(normalized.match(/\d{4}/)?.[0]));
      addRaw();
      return;
    }
    if (/^segunda mano\s*\/\s*bueno estado$/.test(normalized) || /^segunda mano\/buen estado$/.test(normalized) || /^segunda mano buen estado$/.test(normalized)) {
      saveBulletFeature("property_condition", label.trim());
      addRaw();
      return;
    }
    const consumption = normalized.match(/^consumo\s*:?\s*(?:([a-g])\s*)?(\d+(?:[.,]\d+)?)\s*kwh\s*(?:(?:\/|por)\s*)?m\s*(?:2|²)\s*(?:ano)?$/);
    if (consumption && section === "energy") {
      if (consumption[1]) saveBulletFeature("energy_consumption_rating", consumption[1].toUpperCase());
      saveBulletFeature("energy_consumption_kwh_m2_year", Number(consumption[2].replace(",", ".")));
      addRaw();
      return;
    }
    const emissions = normalized.match(/^emisiones(?:\s+co2)?\s*:?\s*(?:([a-g])\s*)?(\d+(?:[.,]\d+)?)\s*kg\s*(?:co2\s*)?(?:(?:\/|por)\s*)?m\s*(?:2|²)\s*(?:ano)?$/);
    if (emissions && section === "energy") {
      if (emissions[1]) saveBulletFeature("energy_emissions_rating", emissions[1].toUpperCase());
      saveBulletFeature("energy_emissions_kg_m2_year", Number(emissions[2].replace(",", ".")));
      addRaw();
      return;
    }
    if (section === "basic" && /segunda mano|buen estado|a reformar|reformado/i.test(normalized)) {
      saveBulletFeature("property_condition", label.trim());
      addRaw();
      return;
    }
    if (section === "equipment" && /^(?:aire acondicionado|calefaccion|calefaccion central)$/i.test(normalized)) {
      if (normalized.startsWith("aire acondicionado")) saveBulletFeature("air_conditioning", true);
      else saveBulletFeature("heating", label.trim());
      addRaw();
      return;
    }
    if (/^(?:consumo|emisiones)\b/.test(normalized)) {
      const grade = normalized.match(/^(consumo|emisiones)\s*:?\s*([a-g])$/);
      if (grade) saveBulletFeature(grade[1] === "consumo" ? "energy_consumption_rating" : "energy_emissions_rating", grade[2].toUpperCase());
      addRaw();
    }
  };

  // Idealista publishes most listing attributes as bullets grouped under section headings.
  $("h2, h3").each((_, heading) => {
    const headingText = $(heading).text().trim();
    const normalizedHeading = normalizeLabel(headingText);
    const section = normalizedHeading.includes("certificado energetico") || normalizedHeading.includes("eficiencia energetica")
      ? "energy"
      : normalizedHeading.includes("edificio")
        ? "building"
        : normalizedHeading.includes("equipamiento")
          ? "equipment"
          : normalizedHeading.includes("caracteristicas basicas")
            ? "basic"
            : undefined;
    if (!section) return;

    let scope = $(heading).parent();
    for (let depth = 0; depth < 5 && scope.length; depth += 1) {
      const bullets = scope.find("li");
      if (bullets.length) {
        bullets.each((__, bullet) => {
          const bulletText = $(bullet).text().replace(/\s+/g, " ").trim();
          parseListingBullet(bulletText, section);
          if (section === "energy") {
            const normalizedBullet = normalizeLabel(bulletText);
            const grade = readEnergyGrade(bullet);
            if (grade && normalizedBullet.startsWith("consumo")) saveBulletFeature("energy_consumption_rating", grade);
            if (grade && normalizedBullet.startsWith("emisiones")) saveBulletFeature("energy_emissions_rating", grade);
          }
        });
        if (section === "energy") {
          scope.find("a[href]").each((__, anchor) => {
            const text = normalizeLabel($(anchor).text() || $(anchor).attr("aria-label") || $(anchor).attr("title") || $(anchor).find("img").attr("alt") || "");
            if (text.includes("etiqueta") || text.includes("calificacion energetica")) {
              const href = $(anchor).attr("href");
              try {
                const absolute = new URL(href || "", "https://www.idealista.com");
                if (["http:", "https:"].includes(absolute.protocol)) saveBulletFeature("energy_label_url", absolute.href);
              } catch { /* Ignore malformed label links. */ }
            }
          });
        }
        break;
      }
      scope = scope.parent();
    }
  });

  // Idealista's energy block is sometimes rendered without an h2/h3 wrapper.
  // Read its own rows directly so the certificate does not depend on heading markup.
  $("li, p, div").each((_, element) => {
    const bulletText = $(element).text().replace(/\s+/g, " ").trim();
    const normalizedBullet = normalizeLabel(bulletText);
    if (!normalizedBullet.startsWith("consumo") && !normalizedBullet.startsWith("emisiones")) return;
    parseListingBullet(bulletText, "energy");
    const grade = readEnergyGrade(element);
    if (grade && normalizedBullet.startsWith("consumo")) saveBulletFeature("energy_consumption_rating", grade);
    if (grade && normalizedBullet.startsWith("emisiones")) saveBulletFeature("energy_emissions_rating", grade);
  });

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || "");
      const visit = (value: unknown): void => {
        if (Array.isArray(value)) return value.forEach(visit);
        if (!value || typeof value !== "object") return;
        const item = value as Record<string, unknown>;
        if (item["@graph"]) visit(item["@graph"]);
        if (item.mainEntity) visit(item.mainEntity);

        const rawTypes = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
        const types = rawTypes.filter((entry): entry is string => typeof entry === "string");
        if (types.some((type) => ["Product", "RealEstateListing", "Apartment", "House", "Residence", "SingleFamilyResidence"].includes(type))) {
          if (typeof item.name === "string") result.title ||= item.name;
          if (typeof item.description === "string") result.description ||= item.description;
          if (typeof item.image === "string") result.image ||= item.image;
          else if (item.image && typeof item.image === "object" && "url" in item.image && typeof item.image.url === "string") result.image ||= item.image.url;
          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
          if (offer && typeof offer === "object") {
            const offerData = offer as Record<string, unknown>;
            const price = Number(offerData.price || offerData.lowPrice);
            if (Number.isFinite(price) && price > 0) result.price ||= price;
          }

          const address = readAddress(item.address);
          if (address) result.features.address ||= address;
          const rooms = readMeasurement(item.numberOfRooms);
          const bedrooms = readMeasurement(item.numberOfBedrooms);
          const bathrooms = readMeasurement(item.numberOfBathroomsTotal);
          const areaValue = item.floorSize;
          const area = areaValue && typeof areaValue === "object" && "unitCode" in areaValue
            && ["MTK", "M2", "m²", "m2"].includes(String((areaValue as { unitCode: unknown }).unitCode))
            ? readMeasurement(areaValue)
            : undefined;
          if (bedrooms !== undefined) result.features.bedrooms = bedrooms;
          if (rooms !== undefined) result.features.rooms = rooms;
          if (bathrooms !== undefined) result.features.bathrooms = bathrooms;
          if (area !== undefined) result.features.area_m2 = area;
          const propertyType = types.find((type) => ["Apartment", "House", "Residence", "SingleFamilyResidence"].includes(type));
          if (propertyType) result.features.property_type ||= propertyType;
          for (const [source, target] of [["floorLevel", "floor"], ["accommodationCategory", "property_type"]] as const) {
            const field = item[source];
            if (typeof field === "string" || typeof field === "number") result.features[target] = String(field);
          }
          if (typeof item.leaseLength === "string") result.features.rental_type ||= item.leaseLength;
          const specifications = offer && typeof offer === "object" ? (offer as Record<string, unknown>).priceSpecification : undefined;
          const specification = Array.isArray(specifications) ? specifications[0] : specifications;
          if (specification && typeof specification === "object") {
            const period = (specification as Record<string, unknown>).unitText;
            if (typeof period === "string") result.features.price_period ||= period;
          }
          const amenityAliases: Record<string, string> = {
            elevator: "elevator", lift: "elevator", ascensor: "elevator",
            furnished: "furnished", amueblado: "furnished", amueblada: "furnished",
            "air conditioning": "air_conditioning", "aire acondicionado": "air_conditioning",
            terrace: "terrace", terraza: "terrace", balcony: "balcony", balcón: "balcony",
            "pets allowed": "pets_allowed", "admite mascotas": "pets_allowed",
            "smoking allowed": "smoking_allowed", "permite fumar": "smoking_allowed",
          };
          const amenities = Array.isArray(item.amenityFeature) ? item.amenityFeature : item.amenityFeature ? [item.amenityFeature] : [];
          for (const amenity of amenities) {
            if (!amenity || typeof amenity !== "object") continue;
            const amenityData = amenity as Record<string, unknown>;
            if (typeof amenityData.name !== "string") continue;
            const key = amenityAliases[amenityData.name.trim().toLowerCase()];
            const value = amenityData.value;
            if (key && (typeof value === "boolean" || value === "true" || value === "false")) {
              result.features[key] = value === true || value === "true";
            }
          }
          const additionalProperties = Array.isArray(item.additionalProperty) ? item.additionalProperty : item.additionalProperty ? [item.additionalProperty] : [];
          for (const entry of additionalProperties) {
            if (!entry || typeof entry !== "object") continue;
            const data = entry as Record<string, unknown>;
            const name = typeof data.name === "string" ? data.name : typeof data.propertyID === "string" ? data.propertyID : "";
            if (name) assignLabeledFeature(name, data.value);
          }
          for (const [source, label] of [
            ["balcony", "balcón"], ["terrace", "terraza"], ["garageIncluded", "garaje incluido"],
            ["furnished", "amueblado"], ["kitchenEquipped", "cocina equipada"], ["exterior", "exterior"],
            ["elevator", "ascensor"], ["airConditioning", "aire acondicionado"], ["yearBuilt", "año de construcción"],
            ["propertyCondition", "estado del inmueble"], ["orientation", "orientación"], ["heating", "calefacción"],
            ["constructedArea", "superficie construida"], ["usableArea", "superficie útil"],
            ["energyConsumptionRating", "calificación energética consumo"], ["energyConsumption", "consumo energético"],
            ["energyEmissionsRating", "calificación energética emisiones"], ["energyEmissions", "emisiones CO2"],
            ["energyLabelUrl", "etiqueta energética"],
          ] as const) {
            if (item[source] !== undefined && item[source] !== null) assignLabeledFeature(label, item[source]);
          }
          if (typeof item.interior === "boolean") assignLabeledFeature("interior", item.interior);
        }

        if (Array.isArray(item.itemListElement)) visit(item.itemListElement);
      };
      visit(json);
    } catch {
      // Ignore malformed JSON-LD
    }
  });

  const itempropText = (name: string) => {
    const element = $(`[itemprop="${name}"]`).first();
    return element.attr("content") || element.attr("datetime") || element.text().trim() || "";
  };
  const itempropMappings = [
    ["numberOfBedrooms", "dormitorios"], ["numberOfRooms", "habitaciones"],
    ["numberOfBathroomsTotal", "baños"], ["floorLevel", "planta"],
    ["propertyType", "tipo de inmueble"], ["rentalType", "tipo de alquiler"], ["availability", "disponibilidad"],
    ["orientation", "orientación"], ["heating", "calefacción"], ["energyRating", "certificado energético"],
    ["emissionsCO2", "emisiones CO2"], ["floorSize", "superficie"],
    ["constructedArea", "superficie construida"], ["usableArea", "superficie útil"],
    ["yearBuilt", "año de construcción"], ["balcony", "balcón"], ["terrace", "terraza"],
    ["elevator", "ascensor"], ["furnished", "amueblado"], ["garageIncluded", "garaje incluido"],
    ["kitchenEquipped", "cocina equipada"], ["airConditioning", "aire acondicionado"],
    ["energyConsumptionRating", "calificación energética consumo"], ["energyConsumption", "consumo energético"],
    ["energyEmissionsRating", "calificación energética emisiones"], ["energyEmissions", "emisiones CO2"],
    ["energyLabelUrl", "etiqueta energética"],
  ] as const;
  for (const [source, label] of itempropMappings) {
    const value = itempropText(source);
    if (value) assignLabeledFeature(label, value);
  }
  const microdataAddress = itempropText("address");
  if (microdataAddress) result.features.address ??= microdataAddress;

  $("dl").each((_, dl) => {
    $(dl).children("dt").each((__, dt) => {
      const label = $(dt).text().trim();
      const value = $(dt).next("dd").text().trim();
      if (label && value && aliases[normalizeLabel(label)]) assignLabeledFeature(label, value);
    });
  });
  $("tr").each((_, row) => {
    const label = $(row).children("th").first().text().trim();
    const value = $(row).children("td").first().text().trim();
    if (label && value && aliases[normalizeLabel(label)]) assignLabeledFeature(label, value);
  });

  // Visible listing bullets take precedence over less reliable generic metadata.
  Object.assign(result.features, bulletFeatures);
  if (bulletRawDetails.length) {
    const metadata = (result.features.raw_details as string[] | undefined) || [];
    result.features.raw_details = [...new Set([...metadata, ...bulletRawDetails])].slice(0, 60);
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "URL no proporcionada" },
        { status: 400 }
      );
    }

    if (!isValidUrl(url)) {
      return NextResponse.json(
        { success: false, error: "URL no válida. Debe comenzar con http:// o https://" },
        { status: 400 }
      );
    }

    if (isPrivateUrl(url)) {
      return NextResponse.json(
        { success: false, error: "URL no permitida" },
        { status: 400 }
      );
    }

    // Fetch with realistic browser headers & timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let response: Response;
    let html = "";
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
          "Cache-Control": "max-age=0",
          "Sec-Ch-Ua":
            '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        },
        redirect: "follow",
      });
    } catch (err: unknown) {
      clearTimeout(timeout);
      try {
        const assistedHtml = await fetchFromScrapingBee(url);
        if (assistedHtml && !looksBlocked(assistedHtml)) {
          html = assistedHtml;
          response = new Response(null, { status: 200 });
        } else {
          throw err;
        }
      } catch {
        const message = process.env.SCRAPINGBEE_API_KEY
          ? "No se pudo conectar al servicio de extracción. Revisa la conexión y la API key de ScrapingBee."
          : err instanceof Error && err.name === "AbortError"
            ? "Tiempo de espera agotado al acceder a la URL"
            : "No se pudo acceder a la URL";
        return NextResponse.json(
          { success: false, error: message, originalUrl: url },
          { status: 422 }
        );
      }
    }

    try {
      if (response.ok && !html) html = await readLimitedHtml(response, controller.signal);
    } catch (err) {
      clearTimeout(timeout);
      const tooLarge = err instanceof Error && err.message === "PAGE_TOO_LARGE";
      return NextResponse.json(
        { success: false, error: tooLarge ? "La página es demasiado grande" : "Tiempo de espera agotado al leer la página", originalUrl: url },
        { status: 422 }
      );
    }
    clearTimeout(timeout);

    if (!response.ok || !html || looksBlocked(html)) {
      try {
        const assistedHtml = await fetchFromScrapingBee(url);
        if (assistedHtml && !looksBlocked(assistedHtml)) html = assistedHtml;
      } catch (err) {
        if (err instanceof Error && err.message === "PAGE_TOO_LARGE") {
          return NextResponse.json({ success: false, error: "La página es demasiado grande", originalUrl: url }, { status: 422 });
        }
      }
    }

    if (!html || looksBlocked(html)) {
      const blocked = response.status === 403 || looksBlocked(html);
      const errorMsg = blocked
        ? process.env.SCRAPINGBEE_API_KEY
          ? "El portal sigue bloqueando la extracción. Puedes completar los datos manualmente."
          : "El portal bloqueó la extracción automática. Configura SCRAPINGBEE_API_KEY para intentar con renderizado del navegador, o completa los datos manualmente."
        : `El sitio web respondió con un estado (${response.status}).`;

      return NextResponse.json(
        { success: false, error: errorMsg, originalUrl: url },
        { status: 422 }
      );
    }

    const $ = cheerio.load(html);

    // Extract JSON-LD first
    const jsonLd = extractJsonLd($);

    // Open Graph
    const ogTitle = $('meta[property="og:title"]').attr("content");
    const ogImage = $('meta[property="og:image"]').attr("content");
    const ogDescription = $('meta[property="og:description"]').attr("content");

    // Standard meta
    const metaDescription = $('meta[name="description"]').attr("content");

    // HTML title
    const htmlTitle = $("title").text().trim();

    // Try to find price in page meta
    const ogPriceAmount = $('meta[property="product:price:amount"]').attr("content");
    const priceFromMeta = ogPriceAmount ? parseFloat(ogPriceAmount) : null;

    // Assemble title
    const title = jsonLd.title || ogTitle || htmlTitle || "";

    // Assemble price: prioritize structured data
    let price: number | null = jsonLd.price || priceFromMeta || null;
    if (!price) {
      price = extractPrice(ogDescription || "") || extractPrice(metaDescription || "");
    }
    if (!price) {
      price = extractPrice(title);
    }
    if (!price) {
      const bodyText = $("body").text().substring(0, 5000);
      price = extractPrice(bodyText);
    }

    // Assemble image
    let imageUrl = jsonLd.image || ogImage || null;
    if (imageUrl && !imageUrl.startsWith("http")) {
      try {
        imageUrl = new URL(imageUrl, url).href;
      } catch {
        imageUrl = null;
      }
    }

    // Assemble description
    const description = jsonLd.description || ogDescription || metaDescription || null;

    return NextResponse.json({
      success: true,
      title: title || "Sin título",
      price: price && !isNaN(price) ? price : null,
      imageUrl,
      description: description ? description.substring(0, 500) : null,
      originalUrl: url,
      features: jsonLd.features,
    });
  } catch (error) {
    console.error("Extract error:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al procesar la URL" },
      { status: 500 }
    );
  }
}
