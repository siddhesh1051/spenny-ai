import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

// Comprehensive list of currencies with symbols
export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
  { code: "QAR", symbol: "﷼", name: "Qatari Riyal" },
  { code: "KWD", symbol: "KD", name: "Kuwaiti Dinar" },
  { code: "BHD", symbol: "BD", name: "Bahraini Dinar" },
  { code: "OMR", symbol: "﷼", name: "Omani Rial" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira" },
  { code: "RUB", symbol: "₽", name: "Russian Ruble" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "THB", symbol: "฿", name: "Thai Baht" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso" },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong" },
  { code: "TWD", symbol: "NT$", name: "Taiwan Dollar" },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "LKR", symbol: "₨", name: "Sri Lankan Rupee" },
  { code: "NPR", symbol: "₨", name: "Nepalese Rupee" },
  { code: "MMK", symbol: "K", name: "Myanmar Kyat" },
  { code: "KHR", symbol: "៛", name: "Cambodian Riel" },
  { code: "LAK", symbol: "₭", name: "Lao Kip" },
  { code: "MNT", symbol: "₮", name: "Mongolian Tögrög" },
  { code: "PLN", symbol: "zł", name: "Polish Złoty" },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna" },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint" },
  { code: "RON", symbol: "lei", name: "Romanian Leu" },
  { code: "BGN", symbol: "лв", name: "Bulgarian Lev" },
  { code: "HRK", symbol: "kn", name: "Croatian Kuna" },
  { code: "ISK", symbol: "kr", name: "Icelandic Króna" },
  { code: "ILS", symbol: "₪", name: "Israeli Shekel" },
  { code: "EGP", symbol: "£", name: "Egyptian Pound" },
  { code: "MAD", symbol: "MAD", name: "Moroccan Dirham" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "GHS", symbol: "₵", name: "Ghanaian Cedi" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling" },
  { code: "UGX", symbol: "USh", name: "Ugandan Shilling" },
  { code: "ETB", symbol: "Br", name: "Ethiopian Birr" },
  { code: "DZD", symbol: "دج", name: "Algerian Dinar" },
  { code: "TND", symbol: "DT", name: "Tunisian Dinar" },
  { code: "LYD", symbol: "LD", name: "Libyan Dinar" },
  { code: "SDG", symbol: "ج.س.", name: "Sudanese Pound" },
  { code: "MZN", symbol: "MT", name: "Mozambican Metical" },
  { code: "ZMW", symbol: "ZK", name: "Zambian Kwacha" },
  { code: "BWP", symbol: "P", name: "Botswanan Pula" },
  { code: "MUR", symbol: "₨", name: "Mauritian Rupee" },
  { code: "XAF", symbol: "FCFA", name: "Central African CFA Franc" },
  { code: "XOF", symbol: "CFA", name: "West African CFA Franc" },
  { code: "CLP", symbol: "CLP$", name: "Chilean Peso" },
  { code: "COP", symbol: "COL$", name: "Colombian Peso" },
  { code: "ARS", symbol: "ARS$", name: "Argentine Peso" },
  { code: "PEN", symbol: "S/.", name: "Peruvian Sol" },
  { code: "VES", symbol: "Bs.S", name: "Venezuelan Bolívar" },
  { code: "UYU", symbol: "$U", name: "Uruguayan Peso" },
  { code: "BOB", symbol: "Bs.", name: "Bolivian Boliviano" },
  { code: "PYG", symbol: "Gs", name: "Paraguayan Guaraní" },
  { code: "GTQ", symbol: "Q", name: "Guatemalan Quetzal" },
  { code: "HNL", symbol: "L", name: "Honduran Lempira" },
  { code: "NIO", symbol: "C$", name: "Nicaraguan Córdoba" },
  { code: "CRC", symbol: "₡", name: "Costa Rican Colón" },
  { code: "PAB", symbol: "B/.", name: "Panamanian Balboa" },
  { code: "DOP", symbol: "RD$", name: "Dominican Peso" },
  { code: "CUP", symbol: "₱", name: "Cuban Peso" },
  { code: "JMD", symbol: "J$", name: "Jamaican Dollar" },
  { code: "TTD", symbol: "TT$", name: "Trinidad and Tobago Dollar" },
  { code: "BBD", symbol: "Bds$", name: "Barbadian Dollar" },
  { code: "XCD", symbol: "EC$", name: "East Caribbean Dollar" },
  { code: "BSD", symbol: "B$", name: "Bahamian Dollar" },
  { code: "BZD", symbol: "BZ$", name: "Belize Dollar" },
  { code: "GYD", symbol: "GY$", name: "Guyanese Dollar" },
  { code: "SRD", symbol: "SRD$", name: "Surinamese Dollar" },
  { code: "HTG", symbol: "G", name: "Haitian Gourde" },
  { code: "FJD", symbol: "FJ$", name: "Fijian Dollar" },
  { code: "PGK", symbol: "K", name: "Papua New Guinean Kina" },
  { code: "WST", symbol: "WS$", name: "Samoan Tālā" },
  { code: "TOP", symbol: "T$", name: "Tongan Paʻanga" },
  { code: "VUV", symbol: "VT", name: "Vanuatu Vatu" },
  { code: "SBD", symbol: "SI$", name: "Solomon Islands Dollar" },
  { code: "KZT", symbol: "₸", name: "Kazakhstani Tenge" },
  { code: "UZS", symbol: "so'm", name: "Uzbekistani Som" },
  { code: "TJS", symbol: "SM", name: "Tajikistani Somoni" },
  { code: "TMT", symbol: "T", name: "Turkmenistani Manat" },
  { code: "KGS", symbol: "с", name: "Kyrgystani Som" },
  { code: "AMD", symbol: "֏", name: "Armenian Dram" },
  { code: "GEL", symbol: "₾", name: "Georgian Lari" },
  { code: "AZN", symbol: "₼", name: "Azerbaijani Manat" },
  { code: "MDL", symbol: "L", name: "Moldovan Leu" },
  { code: "UAH", symbol: "₴", name: "Ukrainian Hryvnia" },
  { code: "BYN", symbol: "Br", name: "Belarusian Ruble" },
  { code: "ALL", symbol: "L", name: "Albanian Lek" },
  { code: "MKD", symbol: "ден", name: "Macedonian Denar" },
  { code: "BAM", symbol: "KM", name: "Bosnia-Herzegovina Convertible Mark" },
  { code: "RSD", symbol: "din", name: "Serbian Dinar" },
  { code: "IQD", symbol: "ع.د", name: "Iraqi Dinar" },
  { code: "IRR", symbol: "﷼", name: "Iranian Rial" },
  { code: "JOD", symbol: "JD", name: "Jordanian Dinar" },
  { code: "LBP", symbol: "ل.ل", name: "Lebanese Pound" },
  { code: "SYP", symbol: "£", name: "Syrian Pound" },
  { code: "YER", symbol: "﷼", name: "Yemeni Rial" },
  { code: "AFN", symbol: "؋", name: "Afghan Afghani" },
];

const CURRENCY_SYMBOL_MAP: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.symbol])
);

const DEFAULT_CURRENCY = "INR";
const STORAGE_KEY = "currency";

interface CurrencyContextValue {
  currency: string;
  currencySymbol: string;
  currencyInfo: CurrencyInfo | undefined;
  setCurrency: (code: string) => Promise<void>;
  formatAmount: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CURRENCY
  );

  const currencyInfo = CURRENCIES.find((c) => c.code === currency);
  const currencySymbol = CURRENCY_SYMBOL_MAP[currency] ?? currency;

  const formatAmount = useCallback(
    (amount: number): string => {
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `${currencySymbol}${amount.toFixed(2)}`;
      }
    },
    [currency, currencySymbol]
  );

  // On mount, load currency from Supabase profile if user is logged in
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("currency")
        .eq("id", user.id)
        .single();
      if (data?.currency) {
        setCurrencyState(data.currency);
        localStorage.setItem(STORAGE_KEY, data.currency);
      }
    };
    load();
  }, []);

  const setCurrency = useCallback(async (code: string) => {
    setCurrencyState(code);
    localStorage.setItem(STORAGE_KEY, code);

    // Persist to Supabase profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ currency: code, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }
  }, []);

  return (
    <CurrencyContext.Provider
      value={{ currency, currencySymbol, currencyInfo, setCurrency, formatAmount }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
