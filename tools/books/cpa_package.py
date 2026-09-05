#!/usr/bin/env python3
"""Generate the CPA package PDF from categorize.py output."""
import csv, json
from decimal import Decimal
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, PageBreak, KeepTogether)

HERE = Path(__file__).parent
OUT = HERE / "out"
INK, MUTE, RULE, FLAG = colors.HexColor("#1a1a1a"), colors.HexColor("#666"), colors.HexColor("#d0d0d0"), colors.HexColor("#b00020")

ss = getSampleStyleSheet()
S = {
 "title": ParagraphStyle("t", parent=ss["Title"], fontSize=20, leading=24, textColor=INK, alignment=0, spaceAfter=4),
 "sub":   ParagraphStyle("s", parent=ss["Normal"], fontSize=10.5, leading=15, textColor=MUTE, spaceAfter=14),
 "h":     ParagraphStyle("h", parent=ss["Heading2"], fontSize=13.5, leading=17, textColor=INK, spaceBefore=16, spaceAfter=7),
 "h2":    ParagraphStyle("h2", parent=ss["Heading3"], fontSize=11, leading=14, textColor=INK, spaceBefore=11, spaceAfter=4),
 "p":     ParagraphStyle("p", parent=ss["Normal"], fontSize=9.6, leading=13.6, textColor=INK, spaceAfter=6),
 "small": ParagraphStyle("sm", parent=ss["Normal"], fontSize=8.3, leading=11.4, textColor=MUTE, spaceAfter=4),
 "flag":  ParagraphStyle("f", parent=ss["Normal"], fontSize=9.6, leading=13.6, textColor=FLAG, spaceAfter=6),
}
def P(t, s="p"): return Paragraph(t, S[s])

ENT = [("1109_riviera", "1109 Riviera, LLC"),
       ("evergreen_creative", "Evergreen Creative Home Solutions, LLC"),
       ("evergreen_funded", "Evergreen Funded Ventures, LLC")]

def money(d): 
    d = Decimal(d)
    return f"({abs(d):,.2f})" if d < 0 else f"{d:,.2f}"

def tbl(data, widths, align_right=(), header=True, size=9):
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    st = [("FONT",(0,0),(-1,-1),"Helvetica",size),
          ("TEXTCOLOR",(0,0),(-1,-1),INK),
          ("VALIGN",(0,0),(-1,-1),"TOP"),
          ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
          ("LEFTPADDING",(0,0),(-1,-1),5),("RIGHTPADDING",(0,0),(-1,-1),5),
          ("LINEBELOW",(0,0),(-1,-2),0.4,RULE)]
    if header:
        st += [("FONT",(0,0),(-1,0),"Helvetica-Bold",size),
               ("LINEBELOW",(0,0),(-1,0),0.9,INK),("BOTTOMPADDING",(0,0),(-1,0),6)]
    for c in align_right: st.append(("ALIGN",(c,0),(c,-1),"RIGHT"))
    t.setStyle(TableStyle(st)); return t

story = []

# ---------- cover ----------
story += [P("2025 Books — Working Package", "title"),
          P("Autumn Alexander &nbsp;·&nbsp; prepared 5 September 2026 &nbsp;·&nbsp; tax year 2025", "sub"),
          P("<b>What this is.</b> Mercury bank activity for three entities, categorized into your own Wave "
            "chart of accounts. It is a working draft to speed up your review — not a completed set of books "
            "and not a return. Nothing here has been filed or posted to Wave.", "p"),
          P("<b>What it is not.</b> No source documents have been applied: no Form 1098, no closing statement, "
            "no property manager annual statement, no depreciation schedule. The items in Section 1 must be "
            "resolved before any of these numbers are final.", "p"),
          P("<b>How to read it.</b> Every transaction is in one of four states: posted to the P&amp;L; excluded "
            "as an internal transfer; excluded as intercompany (needing due-to/due-from entries); or held as an "
            "<b>exception</b> because it could not be decided without a source document or a judgment call. "
            "Exceptions are listed in full in Section 6.", "p")]

# entity summary
rows = [["Entity", "Rows", "P&L net", "Exceptions", "Status"]]
tot_exc = 0
for slug, label in ENT:
    led = list(csv.DictReader(open(OUT / f"{slug}__ledger.csv")))
    pl = sum(Decimal(r["amount"]) for r in led if r["treatment"] == "pl")
    exc = sum(1 for r in led if r["treatment"] == "exception"); tot_exc += exc
    rows.append([label, str(len(led)), money(pl), str(exc), "DRAFT"])
rows.append(["Thor Legacy Enterprises, LLC (WY)", "—", "—", "—", "No bank account"])
story += [Spacer(1, 8), tbl(rows, [2.9*inch, .55*inch, 1.05*inch, .8*inch, 1.1*inch], (1,2,3))]
story += [Spacer(1, 6), P("Thor Legacy holds no bank account and has no direct activity. It is the Wyoming "
                          "holding company owning Evergreen Funded Ventures; its return reports that K-1 only. "
                          "Evergreen Creative paid its $166 Wyoming filing fee.", "small")]

# ---------- 1. open items ----------
story += [PageBreak(), P("1. Open items — please start here", "h"),
          P("Ordered by consequence, not by size.", "small")]

items = [
 ("A", "1109 Riviera was never capitalized and no depreciation was ever recorded", True,
  "Wave has no fixed-asset account and no accumulated depreciation for 1109. The building was never put on "
  "the balance sheet in any year. Because depreciation is <i>allowed or allowable</i>, basis is reduced by "
  "depreciation that should have been taken — so the annual deduction was lost and recapture still applies on "
  "the 2025 sale. Please advise on a catch-up (Form 3115) before the sale is computed."),
 ("B", "Form 1098 needed — $47,489.17 of mortgage payments unallocated", True,
  "Nine payments to NSM/Mr. Cooper in 2025 covering principal, interest and escrow as one amount. Wave already "
  "has Mortgage Interest, Escrow (Taxes &amp; Insurance) and the 1st Mortgage liability. The 1098 is the only "
  "missing input. This is the largest single unknown in the package."),
 ("C", "Extension status unconfirmed for all four entities", True,
  "The 2025 Form 1065 was due 16 March 2026; extended, 15 September 2026. We have not confirmed whether "
  "extensions were filed. If they were not, all four returns are late and penalties are accruing per partner "
  "per month. Please confirm and advise on abatement if applicable."),
 ("D", "1109 closing statement not yet applied", False,
  "The property sold 5 November 2025; $82,450.67 was received from Title Guaranty of South Florida. This is "
  "sale proceeds, not revenue, and is excluded from the P&amp;L. Form 4797 treatment needs the closing "
  "statement, adjusted basis and selling costs."),
 ("E", "Two entities to be dissolved — final-year determination needed", False,
  "1109 Riviera is one; its bank accounts reconcile to exactly $0.00 and are fully drained. Please advise "
  "whether 2025 is the final return year and confirm the final-return election, so the entities are not left "
  "expecting future filings."),
 ("F", "1099-NEC forms appear not to have been issued (due 31 January 2026)", False,
  "Nine payees crossed $600 in 2025. The list is in Section 5. Some may be corporations and therefore exempt — "
  "please advise which require filing and how to handle the late issuance."),
 ("G", "Melanie Torres was paid directly from 1109 rather than through Evergreen Creative", False,
  "She received $19,885.43 on the 1109 sale — 34.2% of the distributions, closely matching her 35% membership "
  "in Evergreen Creative. If her interest is held through EC, the distribution arguably should have flowed "
  "1109 → EC → Melanie. This affects the K-1s of both entities."),
 ("H", "Trustee structure — confirm whose income the 1109 rent is", False,
  "Evergreen Creative acted as trustee because the property sat in a trust and no account could be opened for "
  "it. Per the client, the trust's beneficiary was 1109 Riviera, LLC, so all 1109 activity has been assigned "
  "to 1109 Riviera in this package even where the cash sat in EC-titled accounts. Please confirm."),
 ("I", "Farr Law Firm $9,920.17 paid by the wrong entity", False,
  "Paid from Evergreen Creative but belongs to Evergreen Funded Ventures. Held as an exception rather than "
  "reclassified; needs due-to/due-from entries on both balance sheets."),
 ("J", "Ronald Poulard — $6,460.04 reimbursement needs substantiation", False,
  "Reimbursement for 400 Waterside costs he paid on personal accounts (not compensation, so not 1099). Receipts "
  "are needed to book by expense category rather than as a lump sum, and some may be capital improvements."),
 ("K", "Rental income recorded net of property-manager fees", False,
  "Certified Proper remitted $46,725.81 net in 2025. Wave has Rental Income – Gross, Property Manager Clearing "
  "and Property Management Fees, but the gross-up was not performed — so the management fee is not deducted "
  "anywhere. Certified Proper's annual statement is needed."),
 ("L", "Only one Owners Distributions account for a multi-partner entity", False,
  "1109 made distributions to three separate partners in 2025. Wave lumps them into a single equity account, "
  "so per-partner capital accounts cannot be produced. Please advise on the split you want."),
 ("M", "Unidentified spending: PayPal $3,172.89 and Amazon $2,238.15", False,
  "27 charges each, through payment rails that obscure the underlying merchant. Client is reviewing. Held as "
  "exceptions; some is likely personal."),
]
for k, t, urgent, body in items:
    story.append(KeepTogether([
        P(f"<b>{k}. {t}</b>", "flag" if urgent else "h2"), P(body, "p")]))

# ---------- 2-4. P&Ls ----------
for slug, label in ENT:
    story.append(PageBreak())
    story.append(P(f"{label}", "h"))
    story.append(P("Tax year 2025 · draft · Wave account names", "small"))
    led = list(csv.DictReader(open(OUT / f"{slug}__ledger.csv")))
    agg = {}
    for r in led:
        if r["treatment"] == "pl":
            agg[r["account"]] = agg.get(r["account"], Decimal(0)) + Decimal(r["amount"])
    inc = {k: v for k, v in agg.items() if v > 0}
    exp = {k: v for k, v in agg.items() if v <= 0}
    rows = [["Account", "Amount"]]
    for k in sorted(inc): rows.append([k, money(inc[k])])
    rows.append(["Total income", money(sum(inc.values()))])
    rows.append(["", ""])
    for k in sorted(exp): rows.append([k, money(exp[k])])
    rows.append(["Total expenses", money(sum(exp.values()))])
    rows.append(["", ""])
    rows.append(["Net — posted rows only", money(sum(agg.values()))])
    t = tbl(rows, [4.4*inch, 1.5*inch], (1,))
    n = len(rows)
    t.setStyle(TableStyle([("FONT",(0,n-1),(-1,n-1),"Helvetica-Bold",9),
                           ("LINEABOVE",(0,n-1),(-1,n-1),0.9,INK),
                           ("FONT",(0,len(inc)+1),(-1,len(inc)+1),"Helvetica-Bold",9),
                           ("FONT",(0,n-3),(-1,n-3),"Helvetica-Bold",9)]))
    story.append(t)
    exc = [r for r in led if r["treatment"] == "exception"]
    ea = sum(Decimal(r["amount"]) for r in exc)
    story += [Spacer(1, 9),
              P(f"<b>{len(exc)} exceptions totalling {money(ea)} are excluded from the figures above</b> and "
                f"listed in Section 6. This statement is incomplete until they are resolved.", "flag")]

# ---------- 5. intercompany + 1099 ----------
story.append(PageBreak())
story.append(P("5. Intercompany and related-party schedules", "h"))
story.append(P("Intercompany movements — excluded from every P&L, requiring due-to/due-from entries", "h2"))
rows = [["Entity", "Net intercompany"]]
tot = Decimal(0)
for slug, label in ENT:
    v = sum(Decimal(r["amount"]) for r in csv.DictReader(open(OUT / f"{slug}__ledger.csv"))
            if r["treatment"] == "intercompany")
    tot += v; rows.append([label, money(v)])
rows.append(["Net across all entities", money(tot)])
story.append(tbl(rows, [4.4*inch, 1.5*inch], (1,)))
story.append(Spacer(1, 5))
story.append(P(f"These should net to zero. The residual of {money(tot)} arises from one transfer where Mercury "
               "labelled the counterparty with the organisation name rather than the account, and is disclosed "
               "rather than absorbed. It is immaterial but unreconciled.", "small"))

story.append(P("Payees exceeding $600 — 1099-NEC candidates", "h2"))
story.append(P("Reimbursements and corporations are excluded from reporting; please advise which apply.", "small"))
rows = [["Payee", "2025 total", "Note"]]
for n, a, note in [
  ("Steve Daria", "15,960.00", "Co-wholesaler splits, 4 payments"),
  ("Richie Louis", "7,380.00", "Contract labor"),
  ("Diego Arboleda (Disruptive Innovators LLC)", "6,655.00", "Paid via LLC — check entity type"),
  ("ARC TC Services", "5,828.00", "Transaction coordination"),
  ("Ramon Cardona", "2,600.00", "Contract labor"),
  ("The Venture Joint LLC", "1,659.00", "Check entity type"),
  ("Genna Rue", "1,372.00", "Contract labor"),
  ("Hakim & Zafar, CPA", "1,000.00", "Accounting fees"),
  ("Brandon Ashley", "700.00", "Contract labor"),
]: rows.append([n, a, note])
story.append(tbl(rows, [2.5*inch, .95*inch, 2.45*inch], (1,), size=8.6))
story.append(Spacer(1, 6))
story.append(P("<b>Excluded deliberately:</b> Ronald Poulard ($13,310.04) — the Evergreen Creative portion is the "
               "client's own owner draw remitted to his account, and the Evergreen Funded portion is expense "
               "reimbursement. Neither is compensation.", "small"))

# ---------- 6. exceptions ----------
story.append(PageBreak())
story.append(P("6. Exceptions — items not decided automatically", "h"))
story.append(P("Every row below was deliberately withheld from the P&L rather than guessed.", "small"))
for slug, label in ENT:
    exc = list(csv.DictReader(open(OUT / f"{slug}__exceptions.csv")))
    if not exc: continue
    agg = {}
    for r in exc:
        k = r["account"]
        if k not in agg: agg[k] = [0, Decimal(0), r.get("note", "")]
        agg[k][0] += 1; agg[k][1] += Decimal(r["amount"])
    story.append(P(label, "h2"))
    rows = [["Bucket", "Rows", "Amount"]]
    for k, (n, a, _) in sorted(agg.items(), key=lambda x: -abs(x[1][1])):
        rows.append([k, str(n), money(a)])
    story.append(tbl(rows, [3.9*inch, .6*inch, 1.4*inch], (1,2), size=8.6))

story.append(Spacer(1, 16))
story.append(P("Prepared from Mercury exports for the period 1 January – 31 December 2025. Failed and declined "
               "transactions (351) are excluded from all figures. Drafted with automated assistance; every "
               "figure requires professional review before filing.", "small"))

doc = SimpleDocTemplate(str(OUT / "CPA_Package_TY2025.pdf"), pagesize=letter,
                        leftMargin=0.85*inch, rightMargin=0.85*inch,
                        topMargin=0.8*inch, bottomMargin=0.75*inch,
                        title="2025 Books — Working Package", author="Autumn Alexander")
doc.build(story)
print("built:", OUT / "CPA_Package_TY2025.pdf")
