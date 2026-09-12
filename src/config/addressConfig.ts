import { COUNTRIES } from "@/components/PhoneInputIntl";

export type AddressFieldText = {
  label: string;
  placeholder: string;
  required: boolean;
};

export type AddressFieldSelect = {
  label: string;
  type: "select";
  required: boolean;
  options: string[];
  placeholder?: string;
};

export type AddressFieldFreeText = {
  label: string;
  type: "text";
  required: boolean;
  placeholder?: string;
};

export type AddressFieldStateOrCity = AddressFieldSelect | AddressFieldFreeText;

export interface AddressConfig {
  countryName: string;
  phonePrefix: string;
  currency: string;
  paymentMethods: string[];
  isBangladesh?: boolean;
  fields: {
    line1: AddressFieldText;
    line2: AddressFieldText;
    city: AddressFieldText | AddressFieldStateOrCity;
    state: AddressFieldStateOrCity;
    postal: AddressFieldText;
  };
}

export const ADDRESS_CONFIGS: Record<string, AddressConfig> = {
  AE: {
    countryName: "United Arab Emirates",
    phonePrefix: "+971",
    currency: "AED",
    paymentMethods: ["card"],
    fields: {
      line1: {
        label: "Villa No. / Building Name",
        placeholder: "e.g., Villa 24, Al Nakheel",
        required: true,
      },
      line2: { label: "Street / Road", placeholder: "e.g., Al Wasl Road", required: false },
      city: { label: "Area / Community", placeholder: "e.g., Jumeirah, Downtown", required: true },
      state: {
        label: "Emirate",
        type: "select",
        required: true,
        options: [
          "Dubai",
          "Abu Dhabi",
          "Sharjah",
          "Ajman",
          "Ras Al Khaimah",
          "Fujairah",
          "Umm Al Quwain",
        ],
      },
      postal: { label: "PO Box (Optional)", placeholder: "", required: false },
    },
  },
  SA: {
    countryName: "Saudi Arabia",
    phonePrefix: "+966",
    currency: "SAR",
    paymentMethods: ["card"],
    fields: {
      line1: { label: "Street Address", placeholder: "e.g., King Fahd Road", required: true },
      line2: { label: "District", placeholder: "e.g., Al Olaya", required: false },
      city: { label: "City", placeholder: "e.g., Riyadh, Jeddah", required: true },
      state: {
        label: "Region",
        type: "select",
        required: true,
        options: [
          "Riyadh",
          "Makkah",
          "Madinah",
          "Eastern Province",
          "Asir",
          "Tabuk",
          "Qassim",
          "Jizan",
          "Najran",
          "Hail",
          "Northern Borders",
          "Jawf",
          "Bahah",
        ],
      },
      postal: { label: "Postal Code", placeholder: "e.g., 11564", required: true },
    },
  },
  AU: {
    countryName: "Australia",
    phonePrefix: "+61",
    currency: "AUD",
    paymentMethods: ["card"],
    fields: {
      line1: { label: "Street Address", placeholder: "e.g., 42 Bondi Avenue", required: true },
      line2: { label: "Apartment / Unit", placeholder: "e.g., Unit 3", required: false },
      city: { label: "Suburb / City", placeholder: "e.g., Sydney", required: true },
      state: {
        label: "State / Territory",
        type: "select",
        required: true,
        options: ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"],
      },
      postal: { label: "Postcode", placeholder: "e.g., 2000", required: true },
    },
  },
  CA: {
    countryName: "Canada",
    phonePrefix: "+1",
    currency: "CAD",
    paymentMethods: ["card"],
    fields: {
      line1: { label: "Street Address", placeholder: "e.g., 100 Main Street", required: true },
      line2: { label: "Apt / Suite", placeholder: "e.g., Suite 201", required: false },
      city: { label: "City", placeholder: "e.g., Toronto", required: true },
      state: {
        label: "Province",
        type: "select",
        required: true,
        options: ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"],
      },
      postal: { label: "Postal Code", placeholder: "e.g., M5V 3A4", required: true },
    },
  },
  BD: {
    countryName: "Bangladesh",
    phonePrefix: "+880",
    currency: "BDT",
    paymentMethods: ["cod"],
    isBangladesh: true,
    fields: {
      line1: {
        label: "House No. / Road No.",
        placeholder: "e.g., House 12, Road 5",
        required: true,
      },
      line2: { label: "Area / Moholla", placeholder: "e.g., Dhanmondi", required: false },
      city: {
        label: "District",
        type: "select",
        required: true,
        options: [
          "Dhaka",
          "Chittagong",
          "Sylhet",
          "Rajshahi",
          "Khulna",
          "Barisal",
          "Rangpur",
          "Mymensingh",
          "Comilla",
          "Narsingdi",
          "Gazipur",
          "Narayanganj",
        ],
      },
      state: {
        label: "Thana / Upazila",
        type: "text",
        required: true,
        placeholder: "e.g., Dhanmondi Thana",
      },
      postal: { label: "Postal Code", placeholder: "e.g., 1205", required: false },
    },
  },
};

export const COUNTRY_FLAGS: Record<string, string> = {
  AE: "🇦🇪",
  SA: "🇸🇦",
  AU: "🇦🇺",
  CA: "🇨🇦",
  BD: "🇧🇩",
};

// Generic fallback config for any country not explicitly listed above.
// Free-text city / region / postal fields, USD pricing, card + COD payment.
export function getAddressConfig(iso: string): AddressConfig {
  const existing = ADDRESS_CONFIGS[iso];
  if (existing) return existing;
  const match = COUNTRIES.find((c) => c.iso === iso);
  return {
    countryName: match?.name || iso,
    phonePrefix: match?.dial || "+1",
    currency: "USD",
    paymentMethods: ["card"],
    fields: {
      line1: { label: "Street Address", placeholder: "House / Building, Street", required: true },
      line2: { label: "Apt / Suite / Unit", placeholder: "Optional", required: false },
      city: { label: "City", placeholder: "e.g., New York", required: true },
      state: {
        label: "State / Region",
        type: "text",
        required: false,
        placeholder: "Optional",
      },
      postal: { label: "Postal / ZIP Code", placeholder: "Optional", required: false },
    },
  };
}
