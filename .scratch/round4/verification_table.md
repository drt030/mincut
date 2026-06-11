# Round-4 Ticker Audit: Verification Table

| Organization | Old Ticker | Verified Ticker | Action | Status |
|---|---|---|---|---|
| org_jx_advanced_metals | 5541.T | 5016.T | CORRECTED | Critical Fix |
| org_nordson | NSA | NDSN | CORRECTED | Critical Fix |
| org_suss_microtic | SUU | SMHN.DE | CORRECTED | Critical Fix |
| org_landmark_optoelectronics | (NONE) | 3081.TWO | ADDED | Critical Addition |
| org_iqe | IQE | IQE.L | UPDATED | Exchange Clarity |
| org_wolfspeed | WOLF | WOLF | CONFIRMED | Note: Emerged Ch11 Sept 2025 |
| org_ii_vi_coherent | COHR | COHR | CONFIRMED | Verified |
| org_lumentum | LITE | LITE | CONFIRMED | Verified |
| org_globalfoundries | GFS | GFS | CONFIRMED | Verified |
| org_astera_labs | ALAB | ALAB | CONFIRMED | Verified |
| org_credo | CRDO | CRDO | CONFIRMED | Verified |
| org_teradyne | TER | TER | CONFIRMED | Verified |
| org_axt_inc | AXTI | AXTI | CONFIRMED | Verified |
| org_asmpt | 0522.HK | 0522.HK | CONFIRMED | Verified |
| org_disco | 6146.T | 6146.T | CONFIRMED | Verified |
| org_onto_innovation | ONTO | ONTO | CONFIRMED | Verified |
| org_camtek | CAMT | CAMT | CONFIRMED | Verified |
| org_itw | ITW | ITW | CONFIRMED | Verified |
| org_vpec | 2455.TW | 2455.TW | CONFIRMED | Verified (TWSE) |
| org_besi | BESI (Euronext) | BESI.AS | CONFIRMED | Verified |
| org_comet_yxlon | COTN.SW | COTN.SW | CONFIRMED | Verified (SIX Swiss) |

## Summary

**Round-3 Organizations Audited: 21**

**Critical Corrections Required: 4**
- org_jx_advanced_metals: 5541.T → 5016.T (wrong TSE code; correct code verified via TSE official record)
- org_nordson: NSA → NDSN (invalid ticker; correct code verified via SEC filings)
- org_suss_microtic: SUU → SMHN.DE (invalid Xetra code; correct code verified, also promoted to MDAX as of June 2026)
- org_landmark_optoelectronics: (missing) → 3081.TWO (public listing metric was absent; verified TPEx listing)

**Minor Updates for Clarity: 1**
- org_iqe: IQE → IQE.L (added exchange suffix for London AIM clarity)

**No Issues Found: 16**
- All other round-3 orgs' tickers verified against IR pages and exchange data

## Entity-Mapping Ambiguities

None flagged. All organizations uniquely identified and verified against official sources (company IR pages, SEC filings, stock exchange data, Bloomberg/Yahoo Finance).

## Evidence Quality

All evidence records sourced from:
- Official stock exchange records (TSE, Nasdaq, NYSE, Frankfurt/Xetra, London LSE, Taipei Exchange, Euronext Amsterdam, SIX Swiss)
- SEC filings (EDGAR)
- Financial data aggregators (Bloomberg, Yahoo Finance) cross-referenced with exchange data
- Company investor relations pages

**Batch file status:** Passes dry-run import validation (`npm run import:candidates --domain ai_compute_chain --dry-run`).
