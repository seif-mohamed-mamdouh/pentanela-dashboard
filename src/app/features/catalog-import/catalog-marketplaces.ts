const marketplaces: Record<string, { code: string; name: string }> = {
  ARBP9OOSHTCHU: { code: 'EG', name: 'Egypt' },
  A17E79C6D8DWNP: { code: 'SA', name: 'Saudi Arabia' },
  ATVPDKIKX0DER: { code: 'US', name: 'United States' },
};

export function catalogMarketplace(id?: string | null): { code: string; name: string } | undefined {
  return id ? marketplaces[id.toUpperCase()] : undefined;
}
