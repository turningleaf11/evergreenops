export const PORTFOLIO_ASSET_CLASSES = ['multifamily', 'rv_park', 'mhp'] as const;
export type PortfolioAssetClass = typeof PORTFOLIO_ASSET_CLASSES[number];

export const REQUIRED_PORTFOLIO_DOCUMENTS = [
  'om',
  'rent_roll',
  't12',
  'pnl',
] as const;
export type PortfolioDocumentType = typeof REQUIRED_PORTFOLIO_DOCUMENTS[number];

export type PortfolioDocumentStatus =
  | 'not_applicable'
  | 'not_checked'
  | 'incomplete'
  | 'complete';

export interface PortfolioDocumentEntry {
  status?: 'received' | 'missing' | 'unknown';
  source_message_ids?: string[];
  filenames?: string[];
}

export interface PortfolioDocumentSummary {
  status: PortfolioDocumentStatus;
  required_documents: PortfolioDocumentType[];
  received_documents: PortfolioDocumentType[];
  missing_documents: PortfolioDocumentType[];
}

export function isPortfolioAssetClass(assetClass: string): assetClass is PortfolioAssetClass {
  return PORTFOLIO_ASSET_CLASSES.includes(assetClass as PortfolioAssetClass);
}

/**
 * Computes document completeness only. It deliberately does not decide whether
 * Cash may start; HighLevel stage progression remains the operational trigger.
 */
export function summarizePortfolioDocuments(
  assetClass: string,
  inventory: Record<string, unknown> | null | undefined,
): PortfolioDocumentSummary {
  if (!isPortfolioAssetClass(assetClass)) {
    return {
      status: 'not_applicable',
      required_documents: [],
      received_documents: [],
      missing_documents: [],
    };
  }

  const safeInventory = inventory && typeof inventory === 'object' && !Array.isArray(inventory)
    ? inventory
    : {};

  const received = REQUIRED_PORTFOLIO_DOCUMENTS.filter((type) =>
    documentWasReceived(safeInventory[type])
  );
  const missing = REQUIRED_PORTFOLIO_DOCUMENTS.filter((type) => !received.includes(type));

  return {
    status: missing.length === 0 ? 'complete' : 'incomplete',
    required_documents: [...REQUIRED_PORTFOLIO_DOCUMENTS],
    received_documents: received,
    missing_documents: missing,
  };
}

function documentWasReceived(value: unknown): boolean {
  if (value === true) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (value as PortfolioDocumentEntry).status === 'received';
}
