// Controlled vocabularies shared by the deal form + buyer views. These MUST
// mirror the canonicalization the ghl-sync-buyers edge function applies, so a
// deal's property fields and a buyer's buy-box speak the same language and the
// buyer↔deal match actually joins.

export const US_STATES = [
  "Nationwide",
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
  "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "West Virginia", "Wisconsin", "Wyoming",
] as const;

// Exit strategies — used for a deal's Best Exit AND a buyer's strategies.
export const EXIT_STRATEGIES = [
  "Fix & Flip", "Buy & Hold", "BRRRR", "Wholesale", "Short-Term Rental",
  "New Construction", "Commercial", "Multifamily", "Wrap", "Co-Living", "Group Home",
] as const;

export const PROPERTY_TYPES = [
  "Single Family Residence", "Multifamily 2-4 Units", "Multifamily 5+", "Townhouse",
  "Condo", "Mobile Home", "Mobile Home Park", "RV Park", "Land", "Commercial", "Portfolio",
] as const;
