export interface ReportOptionsResult {
  billTypes: { value: string; label: string }[];
  payModes: { value: string; label: string }[];
  collectedByUsers: { id: string; name: string }[];
  priceCard: {
    serviceTypes: { value: string; label: string }[];
    labNames: { value: string; label: string }[];
    statuses: { value: string; label: string }[];
  };
}