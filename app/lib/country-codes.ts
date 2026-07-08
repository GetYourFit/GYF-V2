/** E.164 calling codes for the signup phone step. Not exhaustive — the ~40
 *  countries covering the vast majority of a global consumer app's signups,
 *  sorted by calling code. Value is what's stored/sent to the API
 *  (ProfileInput.phone_country_code); label is what the picker shows. */
export interface CountryCode {
  code: string; // E.164 calling code, e.g. "+1"
  country: string;
  iso2: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: "+1", country: "United States / Canada", iso2: "US" },
  { code: "+7", country: "Russia / Kazakhstan", iso2: "RU" },
  { code: "+20", country: "Egypt", iso2: "EG" },
  { code: "+27", country: "South Africa", iso2: "ZA" },
  { code: "+30", country: "Greece", iso2: "GR" },
  { code: "+31", country: "Netherlands", iso2: "NL" },
  { code: "+32", country: "Belgium", iso2: "BE" },
  { code: "+33", country: "France", iso2: "FR" },
  { code: "+34", country: "Spain", iso2: "ES" },
  { code: "+39", country: "Italy", iso2: "IT" },
  { code: "+40", country: "Romania", iso2: "RO" },
  { code: "+44", country: "United Kingdom", iso2: "GB" },
  { code: "+45", country: "Denmark", iso2: "DK" },
  { code: "+46", country: "Sweden", iso2: "SE" },
  { code: "+47", country: "Norway", iso2: "NO" },
  { code: "+48", country: "Poland", iso2: "PL" },
  { code: "+49", country: "Germany", iso2: "DE" },
  { code: "+52", country: "Mexico", iso2: "MX" },
  { code: "+55", country: "Brazil", iso2: "BR" },
  { code: "+61", country: "Australia", iso2: "AU" },
  { code: "+62", country: "Indonesia", iso2: "ID" },
  { code: "+63", country: "Philippines", iso2: "PH" },
  { code: "+64", country: "New Zealand", iso2: "NZ" },
  { code: "+65", country: "Singapore", iso2: "SG" },
  { code: "+66", country: "Thailand", iso2: "TH" },
  { code: "+81", country: "Japan", iso2: "JP" },
  { code: "+82", country: "South Korea", iso2: "KR" },
  { code: "+84", country: "Vietnam", iso2: "VN" },
  { code: "+86", country: "China", iso2: "CN" },
  { code: "+90", country: "Turkey", iso2: "TR" },
  { code: "+91", country: "India", iso2: "IN" },
  { code: "+92", country: "Pakistan", iso2: "PK" },
  { code: "+93", country: "Afghanistan", iso2: "AF" },
  { code: "+94", country: "Sri Lanka", iso2: "LK" },
  { code: "+95", country: "Myanmar", iso2: "MM" },
  { code: "+971", country: "United Arab Emirates", iso2: "AE" },
  { code: "+966", country: "Saudi Arabia", iso2: "SA" },
  { code: "+974", country: "Qatar", iso2: "QA" },
  { code: "+880", country: "Bangladesh", iso2: "BD" },
  { code: "+234", country: "Nigeria", iso2: "NG" },
  { code: "+254", country: "Kenya", iso2: "KE" },
];

export const DEFAULT_COUNTRY_CODE = "+91";
