/**
 * GST facts a tax invoice needs.
 *
 * Browser-safe (the invoice desk's place-of-supply picker reads the state
 * list). Deliberately small: this produces correct invoice fields, it does not
 * file returns — that still happens in Tally or with a CA.
 */

/**
 * SAC for tour operator services. Tour operators charging 5% GST without
 * input tax credit use this code (notification 11/2017-CT(Rate), entry 23(ii)).
 * Have the CA confirm it for this business before the first real invoice.
 */
export const TOUR_OPERATOR_SAC = "998555";

/** State and union-territory codes as they appear as the first two digits of a GSTIN. */
export const GST_STATES = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
];

export function stateByCode(code) {
  return GST_STATES.find((s) => s.code === String(code ?? "").padStart(2, "0")) ?? null;
}

export function stateByName(name) {
  const needle = String(name ?? "").trim().toLowerCase();
  if (!needle) return null;
  return GST_STATES.find((s) => s.name.toLowerCase() === needle) ?? null;
}

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Shape check only — 15 characters, state code, PAN, entity, "Z", checksum. */
export function validGstin(value) {
  const v = String(value ?? "").trim().toUpperCase();
  return GSTIN_PATTERN.test(v) && Boolean(stateByCode(v.slice(0, 2)));
}

export function stateOfGstin(gstin) {
  return validGstin(gstin) ? stateByCode(String(gstin).trim().slice(0, 2)) : null;
}

/**
 * How the tax splits.
 *
 * Same state as the supplier: half CGST, half SGST. Different state: all IGST.
 * The CGST half takes the rounding paisa so the two always sum to the tax.
 * Amounts are whole rupees, like every other figure in the app layer.
 */
export function splitTax(tax, sellerStateCode, placeOfSupplyCode) {
  const amount = Math.max(0, Math.round(Number(tax) || 0));
  const intra =
    Boolean(sellerStateCode) &&
    Boolean(placeOfSupplyCode) &&
    String(sellerStateCode) === String(placeOfSupplyCode);
  if (!intra) return { kind: "igst", igst: amount, cgst: 0, sgst: 0 };
  const sgst = Math.floor(amount / 2);
  return { kind: "cgst-sgst", igst: 0, cgst: amount - sgst, sgst };
}
